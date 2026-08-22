import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from api._shared.auth import setup_cors, get_current_user
from api.services.supabase_client import get_supabase_admin, upload_file_to_storage
from api.services.parser import extract_text_from_file

app = FastAPI(title="CV Tailor CV API", version="2.3.0")
setup_cors(app)

@app.post("/api/cv/upload")
async def upload_cv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    filename = file.filename or "cv_document.pdf"
    
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    
    try:
        parsed_text, content_type = extract_text_from_file(filename, file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CV: {str(e)}")
    
    file_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{file_id}_{filename}"
    try:
        upload_file_to_storage("cvs", storage_path, file_bytes, content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload CV to storage: {str(e)}")
    
    admin = get_supabase_admin()
    try:
        res = admin.table("cv_documents").insert({
            "id": file_id,
            "user_id": user_id,
            "filename": filename,
            "storage_path": storage_path,
            "parsed_text": parsed_text
        }).execute()
        
        doc_record = res.data[0] if res.data else {"id": file_id}
        return {
            "cv_document_id": doc_record["id"],
            "filename": filename,
            "storage_path": storage_path,
            "parsed_text": parsed_text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")
