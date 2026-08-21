import os
import uuid
import base64
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from api.services.supabase_client import (
    get_supabase_admin,
    upload_file_to_storage,
    create_signed_download_url
)
from api.services.parser import extract_text_from_file
from api.services.gemini_service import generate_cv_suggestions
from api.services.pdf_generator import generate_tailored_pdf

app = FastAPI(title="CV Tailor API", version="1.0.0")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency for authenticating user from Supabase Bearer token
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    token = authorization.split(" ")[1]
    admin = get_supabase_admin()
    try:
        user_response = admin.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token"
            )
        return {
            "id": user_response.user.id,
            "email": user_response.user.email
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )

# Pydantic Request Models
class CreateApplicationRequest(BaseModel):
    cv_document_id: str
    job_title: str
    job_description_text: str

class UpdateChangeRequest(BaseModel):
    checked: Optional[bool] = None
    final_text: Optional[str] = None

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "CV Tailor API"}

# 1. POST /api/cv/upload
@app.post("/api/cv/upload")
async def upload_cv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Accepts PDF/DOCX multipart upload, parses text, uploads raw file to 'cvs' bucket,
    inserts row into cv_documents table, and returns parsed text + document id.
    """
    user_id = current_user["id"]
    filename = file.filename or "cv_document.pdf"
    
    # Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    
    # Parse text
    try:
        parsed_text, content_type = extract_text_from_file(filename, file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CV: {str(e)}")
    
    # Upload to Supabase Storage bucket 'cvs'
    file_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{file_id}_{filename}"
    try:
        upload_file_to_storage("cvs", storage_path, file_bytes, content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload CV to storage: {str(e)}")
    
    # Insert record into cv_documents
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

# 2. POST /api/applications
@app.post("/api/applications")
async def create_application(
    payload: CreateApplicationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Creates a job_applications row from cv_document_id + job title + job description text.
    """
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    # Verify cv_document belongs to user
    doc_res = admin.table("cv_documents").select("*").eq("id", payload.cv_document_id).eq("user_id", user_id).execute()
    if not doc_res.data:
        raise HTTPException(status_code=404, detail="CV document not found or unauthorized.")
    
    try:
        app_res = admin.table("job_applications").insert({
            "user_id": user_id,
            "cv_document_id": payload.cv_document_id,
            "job_title": payload.job_title,
            "job_description_text": payload.job_description_text
        }).execute()
        
        if not app_res.data:
            raise HTTPException(status_code=500, detail="Failed to create application record.")
            
        return app_res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save job application: {str(e)}")

# 3. POST /api/applications/{id}/suggest
@app.post("/api/applications/{application_id}/suggest")
async def generate_suggestions(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Calls Gemini with structured prompt, parses JSON response,
    inserts rows into suggested_changes (default checked = true), and returns them.
    """
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    # Fetch job application
    app_res = admin.table("job_applications").select("*, cv_documents(parsed_text)").eq("id", application_id).eq("user_id", user_id).execute()
    if not app_res.data:
        raise HTTPException(status_code=404, detail="Job application not found.")
        
    app_data = app_res.data[0]
    job_title = app_data.get("job_title", "")
    job_description = app_data.get("job_description_text", "")
    cv_doc = app_data.get("cv_documents") or {}
    cv_text = cv_doc.get("parsed_text", "")
    
    if not cv_text:
        # Fallback query if join was not returned
        doc_res = admin.table("cv_documents").select("parsed_text").eq("id", app_data["cv_document_id"]).execute()
        if doc_res.data:
            cv_text = doc_res.data[0].get("parsed_text", "")
            
    if not cv_text:
        raise HTTPException(status_code=400, detail="CV text could not be found for this application.")
        
    # Check if suggestions already exist
    existing = admin.table("suggested_changes").select("*").eq("application_id", application_id).execute()
    if existing.data and len(existing.data) > 0:
        return {"suggestions": existing.data}
        
    # Generate suggestions via Gemini
    try:
        suggestions = generate_cv_suggestions(
            cv_text=cv_text,
            job_title=job_title,
            job_description=job_description
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Suggestion generation failed: {str(e)}")
        
    # Insert suggestions into database
    records_to_insert = [
        {
            "application_id": application_id,
            "section": item.section,
            "original_text": item.original_text,
            "suggested_text": item.suggested_text,
            "reason": item.reason,
            "checked": True,
            "final_text": None
        }
        for item in suggestions
    ]
    
    if records_to_insert:
        insert_res = admin.table("suggested_changes").insert(records_to_insert).execute()
        return {"suggestions": insert_res.data}
    else:
        return {"suggestions": []}

# 4. PATCH /api/changes/{id}
@app.patch("/api/changes/{change_id}")
async def update_change(
    change_id: str,
    payload: UpdateChangeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates a single suggestion's checked boolean and/or final_text (inline edit).
    Fast and idempotent.
    """
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    # Verify change belongs to user
    change_res = admin.table("suggested_changes").select("*, job_applications(user_id)").eq("id", change_id).execute()
    if not change_res.data:
        raise HTTPException(status_code=404, detail="Suggestion item not found.")
        
    change_item = change_res.data[0]
    app_info = change_item.get("job_applications")
    if app_info and app_info.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    update_data = {}
    if payload.checked is not None:
        update_data["checked"] = payload.checked
    if payload.final_text is not None:
        update_data["final_text"] = payload.final_text
        
    if not update_data:
        return change_item
        
    try:
        updated = admin.table("suggested_changes").update(update_data).eq("id", change_id).execute()
        return updated.data[0] if updated.data else update_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update change: {str(e)}")

# 5. POST /api/applications/{id}/generate
@app.post("/api/applications/{application_id}/generate")
async def generate_cv(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Takes all suggested_changes rows where checked = true, applies final_text/suggested_text
    to the original parsed CV text, renders a new PDF using reportlab, uploads to 'generated'
    bucket, inserts generated_cvs row, and returns signed download URL.
    """
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    # Fetch job application and cv parsed text
    app_res = admin.table("job_applications").select("*, cv_documents(parsed_text, filename)").eq("id", application_id).eq("user_id", user_id).execute()
    if not app_res.data:
        raise HTTPException(status_code=404, detail="Job application not found.")
        
    app_data = app_res.data[0]
    cv_doc = app_data.get("cv_documents") or {}
    cv_text = cv_doc.get("parsed_text", "")
    orig_filename = cv_doc.get("filename", "cv.pdf")
    
    if not cv_text:
        doc_res = admin.table("cv_documents").select("parsed_text, filename").eq("id", app_data["cv_document_id"]).execute()
        if doc_res.data:
            cv_text = doc_res.data[0].get("parsed_text", "")
            orig_filename = doc_res.data[0].get("filename", "cv.pdf")
            
    if not cv_text:
        raise HTTPException(status_code=400, detail="CV text is missing.")
        
    # Fetch approved changes (checked = True)
    changes_res = admin.table("suggested_changes").select("*").eq("application_id", application_id).eq("checked", True).execute()
    approved_changes = changes_res.data or []
    
    # Generate new PDF bytes
    try:
        pdf_bytes = generate_tailored_pdf(cv_text, approved_changes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF rendering failed: {str(e)}")
        
    # Upload to Supabase Storage bucket 'generated'
    gen_id = str(uuid.uuid4())
    clean_title = "".join(c for c in app_data.get("job_title", "tailored") if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
    gen_filename = f"CV_Tailored_{clean_title}_{gen_id[:8]}.pdf"
    storage_path = f"{user_id}/{gen_id}_{gen_filename}"
    
    try:
        upload_file_to_storage("generated", storage_path, pdf_bytes, "application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store generated PDF: {str(e)}")
        
    # Insert record into generated_cvs
    try:
        cv_record = admin.table("generated_cvs").insert({
            "id": gen_id,
            "application_id": application_id,
            "storage_path": storage_path
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database record insertion failed: {str(e)}")
        
    # Generate signed download URL (valid for 1 hour)
    try:
        download_url = create_signed_download_url("generated", storage_path, expires_in=3600)
    except Exception as e:
        download_url = ""
        
    return {
        "generated_cv_id": gen_id,
        "storage_path": storage_path,
        "download_url": download_url,
        "filename": gen_filename
    }

# 6. GET /api/applications/{id}
@app.get("/api/applications/{application_id}")
async def get_application_details(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetches job application details, cv doc info, suggested changes, and generated cvs.
    """
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    app_res = admin.table("job_applications").select("*, cv_documents(*)").eq("id", application_id).eq("user_id", user_id).execute()
    if not app_res.data:
        raise HTTPException(status_code=404, detail="Job application not found.")
        
    app_data = app_res.data[0]
    
    # Get suggested changes
    changes_res = admin.table("suggested_changes").select("*").eq("application_id", application_id).order("created_at").execute()
    
    # Get generated cvs
    gen_res = admin.table("generated_cvs").select("*").eq("application_id", application_id).order("created_at", desc=True).execute()
    
    # Get signed url for generated cv if exists
    generated_cvs = gen_res.data or []
    for gen in generated_cvs:
        try:
            gen["download_url"] = create_signed_download_url("generated", gen["storage_path"], expires_in=3600)
        except Exception:
            gen["download_url"] = None

    return {
        "application": app_data,
        "suggested_changes": changes_res.data or [],
        "generated_cvs": generated_cvs
    }
