import os
import uuid
import base64
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

load_dotenv()

from api.services.supabase_client import (
    get_supabase_admin,
    upload_file_to_storage,
    create_signed_download_url
)
from api.services.parser import extract_text_from_file
from api.services.gemini_service import generate_cv_suggestions, fallback_keyword_extractor
from api.services.pdf_generator import generate_tailored_pdf

app = FastAPI(title="CV Tailor API", version="2.3.0")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_EMAIL = "isnan.rizqikurniawan@gmail.com"

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

def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    admin = get_supabase_admin()
    try:
        res = admin.table("profiles").select("role, email").eq("id", current_user["id"]).execute()
        if res.data and res.data[0].get("role") == "admin":
            return current_user
    except Exception:
        pass
    
    if current_user.get("email") == ADMIN_EMAIL:
        return current_user
        
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrator access required."
    )

def get_app_site_url() -> str:
    """Returns the base URL of the Next.js app for auth redirects."""
    explicit_url = os.getenv("NEXT_PUBLIC_SITE_URL") or os.getenv("APP_URL")
    if explicit_url:
        return explicit_url.rstrip("/")
    vercel_prod = os.getenv("VERCEL_PROJECT_PRODUCTION_URL")
    if vercel_prod:
        return f"https://{vercel_prod.rstrip('/')}"
    vercel_url = os.getenv("VERCEL_URL")
    if vercel_url:
        return f"https://{vercel_url.rstrip('/')}"
    return "http://localhost:3000"

class CreateApplicationRequest(BaseModel):
    cv_document_id: str
    job_title: str
    company_name: Optional[str] = None
    job_description_text: str

class UpdateChangeRequest(BaseModel):
    checked: Optional[bool] = None
    final_text: Optional[str] = None

class AccessRequestPayload(BaseModel):
    name: str
    email: str
    goals: str

class DirectInvitePayload(BaseModel):
    name: str
    email: str

class UpdateUserPayload(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None

class UpdateUserProfilePayload(BaseModel):
    name: Optional[str] = None
    headline: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    bio: Optional[str] = None

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "CV Tailor API", "version": "2.3.0"}

# ==========================================
# PUBLIC: Access Requests
# ==========================================

@app.post("/api/access-requests")
async def submit_access_request(payload: AccessRequestPayload):
    admin = get_supabase_admin()
    email_clean = payload.email.strip().lower()
    
    existing = admin.table("access_requests").select("*").eq("email", email_clean).execute()
    if existing.data:
        return {
            "status": "received",
            "message": "We have already received your access request! We will notify you once approved.",
            "request_id": existing.data[0]["id"]
        }
        
    try:
        res = admin.table("access_requests").insert({
            "name": payload.name.strip(),
            "email": email_clean,
            "goals": payload.goals.strip(),
            "status": "pending"
        }).execute()
        
        return {
            "status": "created",
            "message": "Your request has been submitted successfully. The administrator will review and invite you via email.",
            "data": res.data[0] if res.data else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit access request: {str(e)}")

# ==========================================
# ADMIN ENDPOINTS
# ==========================================

@app.get("/api/admin/stats")
async def get_admin_stats(admin_user: dict = Depends(get_admin_user)):
    admin = get_supabase_admin()
    try:
        profiles_res = admin.table("profiles").select("id, status, terms_agreed", count="exact").execute()
        total_users = profiles_res.count if profiles_res.count is not None else len(profiles_res.data or [])
        active_users = sum(1 for p in (profiles_res.data or []) if p.get("status") == "active")
        terms_agreed_count = sum(1 for p in (profiles_res.data or []) if p.get("terms_agreed") is True)
        
        requests_res = admin.table("access_requests").select("id, status", count="exact").execute()
        pending_requests = sum(1 for r in (requests_res.data or []) if r.get("status") == "pending")
        
        cvs_res = admin.table("job_applications").select("id", count="exact").execute()
        total_altered_cvs = cvs_res.count if cvs_res.count is not None else len(cvs_res.data or [])
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "pending_requests": pending_requests,
            "total_altered_cvs": total_altered_cvs,
            "terms_agreed_count": terms_agreed_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch admin stats: {str(e)}")

@app.get("/api/admin/requests")
async def list_access_requests(admin_user: dict = Depends(get_admin_user)):
    admin = get_supabase_admin()
    try:
        res = admin.table("access_requests").select("*").order("created_at", desc=True).execute()
        return {"requests": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list access requests: {str(e)}")

@app.post("/api/admin/requests/{request_id}/approve")
async def approve_access_request(request_id: str, admin_user: dict = Depends(get_admin_user)):
    admin = get_supabase_admin()
    
    req_res = admin.table("access_requests").select("*").eq("id", request_id).execute()
    if not req_res.data:
        raise HTTPException(status_code=404, detail="Access request not found.")
        
    req = req_res.data[0]
    email = req["email"]
    name = req["name"]
    site_url = get_app_site_url()
    redirect_url = f"{site_url}/auth/callback?next=/set-password"
    
    direct_link = None
    email_sent = True
    
    try:
        invite_res = admin.auth.admin.invite_user_by_email(
            email,
            options={
                "data": {"name": name, "role": "user", "status": "invited"},
                "redirect_to": redirect_url
            }
        )
        if invite_res and invite_res.user:
            admin.table("profiles").upsert({
                "id": invite_res.user.id,
                "email": email,
                "name": name,
                "role": "user",
                "status": "invited",
                "terms_agreed": False
            }).execute()
    except Exception as e:
        email_sent = False
        print(f"Direct invite email notice: {e}")
        
    # Always generate direct password setup link as a fail-safe (bypasses SMTP rate limits)
    try:
        gen_res = admin.auth.admin.generate_link(
            type="invite",
            email=email,
            options={
                "data": {"name": name, "role": "user", "status": "invited"},
                "redirect_to": redirect_url
            }
        )
        if gen_res:
            direct_link = getattr(gen_res, "action_link", None) or (gen_res.properties.get("action_link") if hasattr(gen_res, "properties") else None)
    except Exception:
        pass
        
    admin.table("access_requests").update({"status": "approved"}).eq("id", request_id).execute()
    
    return {
        "status": "approved",
        "email": email,
        "email_sent": email_sent,
        "direct_link": direct_link,
        "message": f"Approved access request for {name} ({email})." if email_sent else f"Approved access for {name} ({email}). Direct invite link generated."
    }

@app.post("/api/admin/requests/{request_id}/reject")
async def reject_access_request(request_id: str, admin_user: dict = Depends(get_admin_user)):
    admin = get_supabase_admin()
    try:
        admin.table("access_requests").update({"status": "rejected"}).eq("id", request_id).execute()
        return {"status": "rejected", "message": "Access request rejected."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reject request: {str(e)}")

@app.get("/api/admin/users")
async def list_users_usage(admin_user: dict = Depends(get_admin_user)):
    admin = get_supabase_admin()
    
    try:
        profiles_res = admin.table("profiles").select("*").order("created_at", desc=True).execute()
        profiles = profiles_res.data or []
        
        apps_res = admin.table("job_applications").select("id, user_id").execute()
        apps = apps_res.data or []
        
        usage_map = {}
        for app in apps:
            uid = app.get("user_id")
            if uid:
                usage_map[uid] = usage_map.get(uid, 0) + 1
                
        enriched = []
        for p in profiles:
            uid = p.get("id")
            enriched.append({
                **p,
                "cv_count": usage_map.get(uid, 0),
                "is_admin": p.get("role") == "admin" or p.get("email") == ADMIN_EMAIL
            })
            
        return {"users": enriched}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list users: {str(e)}")

@app.post("/api/admin/invite")
async def direct_invite_user(payload: DirectInvitePayload, admin_user: dict = Depends(get_admin_user)):
    admin = get_supabase_admin()
    email_clean = payload.email.strip().lower()
    name_clean = payload.name.strip()
    site_url = get_app_site_url()
    redirect_url = f"{site_url}/auth/callback?next=/set-password"
    
    email_sent = True
    direct_link = None
    
    # 1. Attempt sending invite email
    try:
        invite_res = admin.auth.admin.invite_user_by_email(
            email_clean,
            options={
                "data": {"name": name_clean, "role": "user", "status": "invited"},
                "redirect_to": redirect_url
            }
        )
        if invite_res and invite_res.user:
            admin.table("profiles").upsert({
                "id": invite_res.user.id,
                "email": email_clean,
                "name": name_clean,
                "role": "user",
                "status": "invited",
                "terms_agreed": False
            }).execute()
    except Exception as invite_err:
        email_sent = False
        print(f"Invite email warning: {invite_err}")

    # 2. Always generate direct link (bypasses rate limit if email failed)
    try:
        gen_res = admin.auth.admin.generate_link(
            type="invite",
            email=email_clean,
            options={
                "data": {"name": name_clean, "role": "user", "status": "invited"},
                "redirect_to": redirect_url
            }
        )
        if gen_res:
            direct_link = getattr(gen_res, "action_link", None) or (gen_res.properties.get("action_link") if hasattr(gen_res, "properties") else None)
            if hasattr(gen_res, "user") and gen_res.user:
                admin.table("profiles").upsert({
                    "id": gen_res.user.id,
                    "email": email_clean,
                    "name": name_clean,
                    "role": "user",
                    "status": "invited",
                    "terms_agreed": False
                }).execute()
    except Exception as gen_err:
        print(f"Generate link warning: {gen_err}")
        
    return {
        "status": "success",
        "email": email_clean,
        "email_sent": email_sent,
        "direct_link": direct_link,
        "message": f"Invitation email sent to {email_clean}." if email_sent else f"User invited! You can share the direct setup link with {email_clean}."
    }

@app.post("/api/admin/users/{target_user_id}/resend-invite")
async def resend_user_invite(target_user_id: str, admin_user: dict = Depends(get_admin_user)):
    admin = get_supabase_admin()
    
    user_res = admin.table("profiles").select("*").eq("id", target_user_id).execute()
    email = None
    name = "User"
    if user_res.data:
        email = user_res.data[0].get("email")
        name = user_res.data[0].get("name") or "User"
    
    if not email:
        try:
            auth_user = admin.auth.admin.get_user_by_id(target_user_id)
            if auth_user and auth_user.user:
                email = auth_user.user.email
        except Exception:
            pass
            
    if not email:
        raise HTTPException(status_code=404, detail="User email not found.")
        
    site_url = get_app_site_url()
    redirect_url = f"{site_url}/auth/callback?next=/set-password"
    
    email_sent = True
    direct_link = None
    
    # 1. Attempt sending invite / reset email
    try:
        try:
            admin.auth.admin.invite_user_by_email(
                email,
                options={
                    "data": {"name": name, "role": "user", "status": "invited"},
                    "redirect_to": redirect_url
                }
            )
        except Exception:
            admin.auth.reset_password_for_email(
                email,
                options={"redirect_to": redirect_url}
            )
    except Exception as email_err:
        email_sent = False
        print(f"Resend email notice (likely rate limit): {email_err}")

    # 2. Generate direct setup link (guaranteed to succeed regardless of SMTP rate limit)
    try:
        gen_res = admin.auth.admin.generate_link(
            type="recovery",
            email=email,
            options={"redirect_to": redirect_url}
        )
        if gen_res:
            direct_link = getattr(gen_res, "action_link", None) or (gen_res.properties.get("action_link") if hasattr(gen_res, "properties") else None)
    except Exception as recovery_err:
        try:
            gen_res = admin.auth.admin.generate_link(
                type="invite",
                email=email,
                options={"redirect_to": redirect_url}
            )
            if gen_res:
                direct_link = getattr(gen_res, "action_link", None) or (gen_res.properties.get("action_link") if hasattr(gen_res, "properties") else None)
        except Exception:
            pass

    admin.table("profiles").update({"status": "invited"}).eq("id", target_user_id).execute()
    
    return {
        "status": "success",
        "email": email,
        "email_sent": email_sent,
        "direct_link": direct_link,
        "message": f"Password setup link resent to {email}." if email_sent else f"Generated direct setup link for {email} (bypassing email rate limit)."
    }

@app.patch("/api/admin/users/{target_user_id}")
async def update_user_status(
    target_user_id: str,
    payload: UpdateUserPayload,
    admin_user: dict = Depends(get_admin_user)
):
    admin = get_supabase_admin()
    update_data = {}
    if payload.status:
        update_data["status"] = payload.status
    if payload.role:
        update_data["role"] = payload.role
        
    if not update_data:
        return {"status": "noop"}
        
    try:
        res = admin.table("profiles").update(update_data).eq("id", target_user_id).execute()
        return {"status": "updated", "data": res.data[0] if res.data else update_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")

@app.delete("/api/admin/users/{target_user_id}")
async def delete_user(target_user_id: str, admin_user: dict = Depends(get_admin_user)):
    admin = get_supabase_admin()
    try:
        admin.auth.admin.delete_user(target_user_id)
        admin.table("profiles").delete().eq("id", target_user_id).execute()
        return {"status": "deleted", "message": "User deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

# ==========================================
# USER PROFILE & TERMS AGREEMENT
# ==========================================

@app.get("/api/user/profile")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    try:
        res = admin.table("profiles").select("*").eq("id", current_user["id"]).execute()
        if res.data:
            profile = res.data[0]
            if current_user.get("email") == ADMIN_EMAIL:
                profile["role"] = "admin"
            return profile
        return {
            "id": current_user["id"],
            "email": current_user["email"],
            "role": "admin" if current_user.get("email") == ADMIN_EMAIL else "user",
            "terms_agreed": False,
            "status": "active"
        }
    except Exception:
        return {
            "id": current_user["id"],
            "email": current_user["email"],
            "role": "admin" if current_user.get("email") == ADMIN_EMAIL else "user",
            "terms_agreed": False,
            "status": "active"
        }

@app.patch("/api/user/profile")
async def update_user_profile(
    payload: UpdateUserProfilePayload,
    current_user: dict = Depends(get_current_user)
):
    admin = get_supabase_admin()
    user_id = current_user["id"]
    
    update_data = {}
    if payload.name is not None:
        update_data["name"] = payload.name.strip()
    if payload.headline is not None:
        update_data["headline"] = payload.headline.strip()
    if payload.phone is not None:
        update_data["phone"] = payload.phone.strip()
    if payload.location is not None:
        update_data["location"] = payload.location.strip()
    if payload.linkedin_url is not None:
        update_data["linkedin_url"] = payload.linkedin_url.strip()
    if payload.github_url is not None:
        update_data["github_url"] = payload.github_url.strip()
    if payload.portfolio_url is not None:
        update_data["portfolio_url"] = payload.portfolio_url.strip()
    if payload.bio is not None:
        update_data["bio"] = payload.bio.strip()
        
    if not update_data:
        return {"status": "noop"}
        
    try:
        res = admin.table("profiles").update(update_data).eq("id", user_id).execute()
        return {
            "status": "success",
            "message": "Personal profile updated successfully.",
            "profile": res.data[0] if res.data else update_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

@app.post("/api/user/accept-terms")
async def accept_terms(current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    try:
        admin.table("profiles").upsert({
            "id": current_user["id"],
            "email": current_user["email"],
            "status": "active",
            "terms_agreed": True,
            "terms_agreed_at": now_iso
        }).execute()
        return {"status": "success", "terms_agreed": True, "terms_agreed_at": now_iso}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record terms agreement: {str(e)}")

# ==========================================
# CV & APPLICATION CORE ENDPOINTS
# ==========================================

# 1. POST /api/cv/upload
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

# 2. POST /api/applications
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

# 3. DELETE /api/applications/{id}
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

# 4. POST /api/applications/{id}/suggest
@app.post("/api/applications/{application_id}/suggest")
async def generate_suggestions(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
    app_res = admin.table("job_applications").select("*, cv_documents(parsed_text)").eq("id", application_id).eq("user_id", user_id).execute()
    if not app_res.data:
        raise HTTPException(status_code=404, detail="Job application not found.")
        
    app_data = app_res.data[0]
    job_title = app_data.get("job_title", "")
    job_description = app_data.get("job_description_text", "")
    cv_doc = app_data.get("cv_documents") or {}
    cv_text = cv_doc.get("parsed_text", "")
    
    if not cv_text:
        doc_res = admin.table("cv_documents").select("parsed_text").eq("id", app_data["cv_document_id"]).execute()
        if doc_res.data:
            cv_text = doc_res.data[0].get("parsed_text", "")
            
    if not cv_text:
        raise HTTPException(status_code=400, detail="CV text could not be found for this application.")
        
    # Generate structured analysis via Gemini
    try:
        analysis = generate_cv_suggestions(
            cv_text=cv_text,
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

    # Insert suggestions
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
        for item in analysis.suggestions
    ]
    
    inserted_suggestions = []
    if records_to_insert:
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

# 5. PATCH /api/changes/{id}
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

# 6. POST /api/applications/{id}/generate
@app.post("/api/applications/{application_id}/generate")
async def generate_cv(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    admin = get_supabase_admin()
    
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
        
    changes_res = admin.table("suggested_changes").select("*").eq("application_id", application_id).eq("checked", True).execute()
    approved_changes = changes_res.data or []
    
    try:
        pdf_bytes = generate_tailored_pdf(cv_text, approved_changes)
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

# 7. GET /api/applications/{id}
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
