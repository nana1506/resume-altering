import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from api.services.supabase_client import get_supabase_admin

load_dotenv()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "") or os.getenv("NEXT_PUBLIC_ADMIN_EMAIL", "")

def setup_cors(app: FastAPI):
    """Configures CORS with explicit allowed origins read from ALLOWED_ORIGINS."""
    raw_origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5328,http://127.0.0.1:5328"
    )
    allowed_origins = [orig.strip() for orig in raw_origins.split(",") if orig.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
    
    if ADMIN_EMAIL and current_user.get("email") == ADMIN_EMAIL:
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
