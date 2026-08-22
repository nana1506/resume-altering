import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from api._shared.auth import setup_cors, get_current_user
from api.services.supabase_client import get_supabase_admin, upload_file_to_storage
from api.services.parser import parse_file_to_structured_cv

app = FastAPI(title="CV Tailor CV API", version="2.3.0")
setup_cors(app)

@app.post("/api/cv/upload")
async def upload_cv(
    file: UploadFile = File(...),
    save_to_profile: bool = Form(False),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    filename = file.filename or "cv_document.pdf"
    
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    
    try:
        parsed_text, parsed_cv, content_type = parse_file_to_structured_cv(filename, file_bytes)
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
        insert_payload = {
            "id": file_id,
            "user_id": user_id,
            "filename": filename,
            "storage_path": storage_path,
            "parsed_text": parsed_text,
            "parsed_structure": parsed_cv.model_dump()
        }
        res = admin.table("cv_documents").insert(insert_payload).execute()
        
        doc_record = res.data[0] if res.data else {"id": file_id}

        if save_to_profile:
            try:
                admin.table("profiles").update({"default_cv_document_id": doc_record["id"]}).eq("id", user_id).execute()
            except Exception as err:
                print(f"Warning: Failed to set default_cv_document_id on profile: {err}")

        return {
            "cv_document_id": doc_record["id"],
            "filename": filename,
            "storage_path": storage_path,
            "parsed_text": parsed_text,
            "parsed_structure": parsed_cv.model_dump(),
            "saved_to_profile": bool(save_to_profile)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")
