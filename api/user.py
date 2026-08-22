from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Depends
from api._shared.auth import setup_cors, get_current_user, ADMIN_EMAIL
from api._shared.models import UpdateUserProfilePayload
from api.services.supabase_client import get_supabase_admin

app = FastAPI(title="CV Tailor User API", version="2.3.0")
setup_cors(app)

@app.get("/api/user/profile")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    try:
        res = admin.table("profiles").select("*").eq("id", current_user["id"]).execute()
        if res.data:
            profile = res.data[0]
            if ADMIN_EMAIL and current_user.get("email") == ADMIN_EMAIL:
                profile["role"] = "admin"
            return profile
        return {
            "id": current_user["id"],
            "email": current_user["email"],
            "role": "admin" if (ADMIN_EMAIL and current_user.get("email") == ADMIN_EMAIL) else "user",
            "terms_agreed": False,
            "status": "active"
        }
    except Exception:
        return {
            "id": current_user["id"],
            "email": current_user["email"],
            "role": "admin" if (ADMIN_EMAIL and current_user.get("email") == ADMIN_EMAIL) else "user",
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

@app.get("/api/user/cv")
async def get_user_profile_cv(current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    user_id = current_user["id"]
    try:
        p_res = admin.table("profiles").select("default_cv_document_id").eq("id", user_id).execute()
        if not p_res.data or not p_res.data[0].get("default_cv_document_id"):
            return {"has_profile_cv": False}
        
        default_cv_id = p_res.data[0]["default_cv_document_id"]
        cv_res = admin.table("cv_documents").select("id, filename, created_at, storage_path").eq("id", default_cv_id).execute()
        if not cv_res.data:
            return {"has_profile_cv": False}
        
        cv_doc = cv_res.data[0]
        return {
            "has_profile_cv": True,
            "cv": {
                "id": cv_doc["id"],
                "filename": cv_doc["filename"],
                "created_at": cv_doc["created_at"],
                "storage_path": cv_doc.get("storage_path")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile CV: {str(e)}")

@app.delete("/api/user/cv")
async def remove_user_profile_cv(current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    user_id = current_user["id"]
    try:
        admin.table("profiles").update({"default_cv_document_id": None}).eq("id", user_id).execute()
        return {"status": "success", "message": "CV unlinked from profile successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove profile CV: {str(e)}")
