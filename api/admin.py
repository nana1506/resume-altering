from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends
from api._shared.auth import setup_cors, get_admin_user, get_app_site_url, ADMIN_EMAIL
from api._shared.models import AccessRequestPayload, DirectInvitePayload, UpdateUserPayload
from api.services.supabase_client import get_supabase_admin

app = FastAPI(title="CV Tailor Admin API", version="2.3.0")
setup_cors(app)

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
        for app_row in apps:
            uid = app_row.get("user_id")
            if uid:
                usage_map[uid] = usage_map.get(uid, 0) + 1
                
        enriched = []
        for p in profiles:
            uid = p.get("id")
            enriched.append({
                **p,
                "cv_count": usage_map.get(uid, 0),
                "is_admin": p.get("role") == "admin" or (ADMIN_EMAIL and p.get("email") == ADMIN_EMAIL)
            })
            
        return {"users": enriched}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list users: {str(e)}")

def _compute_user_storage_bytes(admin, user_id: str) -> int:
    """Computes total storage bytes used across cvs and generated buckets for a user."""
    total_bytes = 0
    # 1. cvs bucket
    try:
        cv_items = admin.storage.from_("cvs").list(path=user_id) or []
        for item in cv_items:
            if isinstance(item, dict):
                meta = item.get("metadata") or {}
                size = meta.get("size") or item.get("size") or 0
                total_bytes += int(size)
    except Exception:
        pass

    # 2. generated bucket (may contain subfolders for generation IDs)
    try:
        gen_items = admin.storage.from_("generated").list(path=user_id) or []
        for item in gen_items:
            if isinstance(item, dict):
                meta = item.get("metadata") or {}
                subfolder = item.get("name")
                # If subfolder, list files inside
                if subfolder and (meta.get("mimetype") == "application/json" or not meta or item.get("id") is None):
                    try:
                        subfiles = admin.storage.from_("generated").list(path=f"{user_id}/{subfolder}") or []
                        for sf in subfiles:
                            if isinstance(sf, dict):
                                sf_meta = sf.get("metadata") or {}
                                sf_size = sf_meta.get("size") or sf.get("size") or 0
                                total_bytes += int(sf_size)
                    except Exception:
                        pass
                else:
                    size = meta.get("size") or item.get("size") or 0
                    total_bytes += int(size)
    except Exception:
        pass

    return total_bytes

@app.get("/api/admin/usage")
async def get_admin_usage(admin_user: dict = Depends(get_admin_user)):
    admin = get_supabase_admin()
    
    try:
        # Fetch all profiles
        profiles_res = admin.table("profiles").select("id, email, name, role, created_at").order("created_at", desc=True).execute()
        profiles = profiles_res.data or []

        # Fetch usage logs
        logs_res = admin.table("gemini_usage_log").select("user_id, input_tokens, output_tokens, created_at").execute()
        logs = logs_res.data or []

        now_utc = datetime.now(timezone.utc)
        thirty_days_ago = (now_utc - timedelta(days=30)).isoformat()

        # Aggregate per user
        user_usage = {}
        for p in profiles:
            uid = p["id"]
            user_usage[uid] = {
                "calls_last_30d": 0,
                "calls_all_time": 0,
                "total_tokens": 0,
            }

        for log in logs:
            uid = log.get("user_id")
            if not uid:
                continue
            if uid not in user_usage:
                user_usage[uid] = {
                    "calls_last_30d": 0,
                    "calls_all_time": 0,
                    "total_tokens": 0,
                }
            
            user_usage[uid]["calls_all_time"] += 1
            created_at = log.get("created_at") or ""
            if created_at >= thirty_days_ago:
                user_usage[uid]["calls_last_30d"] += 1
            
            tokens = (log.get("input_tokens") or 0) + (log.get("output_tokens") or 0)
            user_usage[uid]["total_tokens"] += tokens

        # Enrich profiles with usage and storage
        enriched_users = []
        tot_calls_30d = 0
        tot_calls_all = 0
        tot_tokens = 0
        tot_storage = 0

        for p in profiles:
            uid = p["id"]
            u_metrics = user_usage.get(uid, {"calls_last_30d": 0, "calls_all_time": 0, "total_tokens": 0})
            storage_bytes = _compute_user_storage_bytes(admin, uid)

            tot_calls_30d += u_metrics["calls_last_30d"]
            tot_calls_all += u_metrics["calls_all_time"]
            tot_tokens += u_metrics["total_tokens"]
            tot_storage += storage_bytes

            is_admin = p.get("role") == "admin" or (ADMIN_EMAIL and p.get("email") == ADMIN_EMAIL)

            enriched_users.append({
                "user_id": uid,
                "email": p.get("email", ""),
                "name": p.get("name") or p.get("email", "").split("@")[0],
                "role": p.get("role", "user"),
                "is_admin": is_admin,
                "calls_last_30d": u_metrics["calls_last_30d"],
                "calls_all_time": u_metrics["calls_all_time"],
                "total_tokens": u_metrics["total_tokens"],
                "storage_bytes": storage_bytes
            })

        return {
            "summary": {
                "total_calls_30d": tot_calls_30d,
                "total_calls_all_time": tot_calls_all,
                "total_tokens": tot_tokens,
                "total_storage_bytes": tot_storage
            },
            "users": enriched_users
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch usage analytics: {str(e)}")

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
    except Exception:
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
