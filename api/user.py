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
