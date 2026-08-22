import uuid
from fastapi import FastAPI, HTTPException, Depends
from api._shared.auth import setup_cors, get_current_user
from api._shared.models import CreateApplicationRequest, UpdateChangeRequest
from api.services.supabase_client import (
    get_supabase_admin,
    upload_file_to_storage,
    create_signed_download_url
)
from api.services.gemini_service import generate_cv_suggestions, fallback_keyword_extractor
from api.services.pdf_generator import generate_tailored_pdf

app = FastAPI(title="CV Tailor Applications API", version="2.3.0")
setup_cors(app)

# 1. POST /api/applications
@app.post("/api/applications")
async def create_application(
    payload: CreateApplicationRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    doc_res = admin.table("cv_documents").select("*").eq("id", payload.cv_document_id).eq("user_id", user_id).execute()
    if not doc_res.data:
        raise HTTPException(status_code=404, detail="CV document not found or unauthorized.")
    
    try:
        app_res = admin.table("job_applications").insert({
            "user_id": user_id,
            "cv_document_id": payload.cv_document_id,
            "job_title": payload.job_title,
            "company_name": payload.company_name.strip() if payload.company_name else None,
            "job_description_text": payload.job_description_text
        }).execute()
        
        if not app_res.data:
            raise HTTPException(status_code=500, detail="Failed to create application record.")
            
        return app_res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save job application: {str(e)}")

# 2. DELETE /api/applications/{application_id}
@app.delete("/api/applications/{application_id}")
async def delete_application(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    app_res = admin.table("job_applications").select("id").eq("id", application_id).eq("user_id", user_id).execute()
    if not app_res.data:
        raise HTTPException(status_code=404, detail="Application not found or unauthorized.")
        
    try:
        admin.table("job_applications").delete().eq("id", application_id).execute()
        return {"status": "deleted", "id": application_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete application: {str(e)}")

from api.services.parser import ParsedCV, structure_cv_text, cv_to_plain_text

# 3. POST /api/applications/{application_id}/suggest
@app.post("/api/applications/{application_id}/suggest")
async def generate_suggestions(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    app_res = admin.table("job_applications").select("*, cv_documents(parsed_text, parsed_structure)").eq("id", application_id).eq("user_id", user_id).execute()
    if not app_res.data:
        raise HTTPException(status_code=404, detail="Job application not found.")
        
    app_data = app_res.data[0]
    job_title = app_data.get("job_title", "")
    job_description = app_data.get("job_description_text", "")
    cv_doc = app_data.get("cv_documents") or {}
    cv_text = cv_doc.get("parsed_text", "")
    parsed_structure = cv_doc.get("parsed_structure")
    
    if not cv_text and not parsed_structure:
        doc_res = admin.table("cv_documents").select("parsed_text, parsed_structure").eq("id", app_data["cv_document_id"]).execute()
        if doc_res.data:
            cv_text = doc_res.data[0].get("parsed_text", "")
            parsed_structure = doc_res.data[0].get("parsed_structure")
            
    if not cv_text and not parsed_structure:
        raise HTTPException(status_code=400, detail="CV text could not be found for this application.")
        
    # Prepare structured representation for high-fidelity LLM prompt
    if parsed_structure:
        try:
            structured_obj = ParsedCV(**parsed_structure)
            formatted_cv_prompt_text = cv_to_plain_text(structured_obj)
        except Exception:
            formatted_cv_prompt_text = cv_text
    else:
        structured_obj = structure_cv_text(cv_text)
        formatted_cv_prompt_text = cv_to_plain_text(structured_obj)

    # Generate structured analysis via Gemini
    try:
        analysis = generate_cv_suggestions(
            cv_text=formatted_cv_prompt_text,
            job_title=job_title,
            job_description=job_description
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Suggestion generation failed: {str(e)}")
        
    # Update job_applications with match score, summary, and keywords analysis
    try:
        keywords_json = [k.model_dump() for k in analysis.keywords]
        admin.table("job_applications").update({
            "match_score": analysis.match_score,
            "predicted_match_score": analysis.predicted_match_score or min(98, analysis.match_score + 25),
            "match_label": analysis.match_label,
            "match_summary": analysis.match_summary,
            "keywords_analysis": keywords_json
        }).eq("id", application_id).execute()
    except Exception as update_err:
        print(f"Warning: Could not update match score on job_applications: {update_err}")

    # Check if suggestions already exist
    existing = admin.table("suggested_changes").select("*").eq("application_id", application_id).execute()
    if existing.data and len(existing.data) > 0:
        return {
            "match_score": analysis.match_score,
            "predicted_match_score": analysis.predicted_match_score or min(98, analysis.match_score + 25),
            "match_label": analysis.match_label,
            "match_summary": analysis.match_summary,
            "keywords": analysis.keywords,
            "suggestions": existing.data
        }

    # Insert suggestions with entry_index
    records_to_insert = [
        {
            "application_id": application_id,
            "section": item.section,
            "entry_index": getattr(item, "entry_index", -1),
            "original_text": item.original_text,
            "suggested_text": item.suggested_text,
            "reason": item.reason,
            "checked": True,
            "final_text": None
        }
        for item in analysis.suggestions
    ]
    
    inserted_suggestions = []
    if records_to_insert:
        try:
            insert_res = admin.table("suggested_changes").insert(records_to_insert).execute()
            inserted_suggestions = insert_res.data or []
        except Exception:
            # Fallback if entry_index column is not yet in Supabase table
            for r in records_to_insert:
                r.pop("entry_index", None)
            insert_res = admin.table("suggested_changes").insert(records_to_insert).execute()
            inserted_suggestions = insert_res.data or []
        
    return {
        "match_score": analysis.match_score,
        "predicted_match_score": analysis.predicted_match_score or min(98, analysis.match_score + 25),
        "match_label": analysis.match_label,
        "match_summary": analysis.match_summary,
        "keywords": analysis.keywords,
        "suggestions": inserted_suggestions
    }

# 4. PATCH /api/changes/{change_id}
@app.patch("/api/changes/{change_id}")
async def update_change(
    change_id: str,
    payload: UpdateChangeRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
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

# 5. POST /api/applications/{application_id}/generate
@app.post("/api/applications/{application_id}/generate")
async def generate_cv(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    app_res = admin.table("job_applications").select("*, cv_documents(parsed_text, parsed_structure, filename)").eq("id", application_id).eq("user_id", user_id).execute()
    if not app_res.data:
        raise HTTPException(status_code=404, detail="Job application not found.")
        
    app_data = app_res.data[0]
    cv_doc = app_data.get("cv_documents") or {}
    cv_text = cv_doc.get("parsed_text", "")
    parsed_structure = cv_doc.get("parsed_structure")
    orig_filename = cv_doc.get("filename", "cv.pdf")
    
    if not cv_text and not parsed_structure:
        doc_res = admin.table("cv_documents").select("parsed_text, parsed_structure, filename").eq("id", app_data["cv_document_id"]).execute()
        if doc_res.data:
            cv_text = doc_res.data[0].get("parsed_text", "")
            parsed_structure = doc_res.data[0].get("parsed_structure")
            orig_filename = doc_res.data[0].get("filename", "cv.pdf")
            
    if not cv_text and not parsed_structure:
        raise HTTPException(status_code=400, detail="CV text is missing.")
        
    changes_res = admin.table("suggested_changes").select("*").eq("application_id", application_id).eq("checked", True).execute()
    approved_changes = changes_res.data or []
    
    try:
        # Use structured CV representation if available, otherwise parse text
        source_data = parsed_structure if parsed_structure else cv_text
        pdf_bytes = generate_tailored_pdf(source_data, approved_changes, template_mode="input")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF rendering failed: {str(e)}")
        
    gen_id = str(uuid.uuid4())
    clean_title = "".join(c for c in app_data.get("job_title", "tailored") if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
    gen_filename = f"CV_Tailored_{clean_title}_{gen_id[:8]}.pdf"
    storage_path = f"{user_id}/{gen_id}_{gen_filename}"
    
    try:
        upload_file_to_storage("generated", storage_path, pdf_bytes, "application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store generated PDF: {str(e)}")
        
    try:
        admin.table("generated_cvs").insert({
            "id": gen_id,
            "application_id": application_id,
            "storage_path": storage_path
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")
        
    try:
        download_url = create_signed_download_url("generated", storage_path, expires_in=3600)
    except Exception:
        download_url = ""
        
    return {
        "generated_cv_id": gen_id,
        "storage_path": storage_path,
        "download_url": download_url,
        "filename": gen_filename
    }

# 6. GET /api/applications/{application_id}
@app.get("/api/applications/{application_id}")
async def get_application_details(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    app_res = admin.table("job_applications").select("*, cv_documents(*)").eq("id", application_id).eq("user_id", user_id).execute()
    if not app_res.data:
        raise HTTPException(status_code=404, detail="Job application not found.")
        
    app_data = app_res.data[0]
    
    # Retrieve keywords analysis or generate fallback if not yet populated
    keywords_analysis = app_data.get("keywords_analysis") or []
    if not keywords_analysis:
        cv_doc = app_data.get("cv_documents") or {}
        cv_text = cv_doc.get("parsed_text", "")
        job_title = app_data.get("job_title", "")
        job_description = app_data.get("job_description_text", "")
        fallback_keywords = fallback_keyword_extractor(cv_text, job_title, job_description)
        keywords_analysis = [k.model_dump() for k in fallback_keywords]
        
    # Retrieve match score and label or compute reasonable defaults if not yet populated
    match_score = app_data.get("match_score")
    match_label = app_data.get("match_label")
    match_summary = app_data.get("match_summary")
    
    if match_score is None:
        if keywords_analysis:
            exists_cnt = sum(1 for k in keywords_analysis if k.get("status") == "exists")
            diff_cnt = sum(1 for k in keywords_analysis if k.get("status") == "different_terms")
            total = max(1, len(keywords_analysis))
            calculated_score = int(((exists_cnt * 1.0 + diff_cnt * 0.6) / total) * 100)
            match_score = max(50, min(95, calculated_score))
            match_label = "Strong Match" if match_score >= 80 else "Moderate Match" if match_score >= 60 else "Low Match"
            match_summary = "Evaluated based on detected core skills, frameworks, and domain experience from the job vacancy."
        else:
            match_score = 75
            match_label = "Moderate Match"
            match_summary = "Candidate demonstrates solid foundational capabilities with opportunities for keyword alignment."
            
    predicted_match_score = app_data.get("predicted_match_score")
    if predicted_match_score is None:
        predicted_match_score = min(98, match_score + 22)

    changes_res = admin.table("suggested_changes").select("*").eq("application_id", application_id).order("created_at").execute()
    gen_res = admin.table("generated_cvs").select("*").eq("application_id", application_id).order("created_at", desc=True).execute()
    
    generated_cvs = gen_res.data or []
    for gen in generated_cvs:
        try:
            gen["download_url"] = create_signed_download_url("generated", gen["storage_path"], expires_in=3600)
        except Exception:
            gen["download_url"] = None

    return {
        "application": app_data,
        "match_score": match_score,
        "predicted_match_score": predicted_match_score,
        "match_label": match_label,
        "match_summary": match_summary,
        "keywords_analysis": keywords_analysis,
        "suggested_changes": changes_res.data or [],
        "generated_cvs": generated_cvs
    }
