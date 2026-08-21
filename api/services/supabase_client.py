import os
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def get_supabase_admin() -> Client:
    """Returns a Supabase client configured with the service role key for server operations."""
    key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
    if not SUPABASE_URL or not key:
        raise ValueError("Supabase environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set.")
    return create_client(SUPABASE_URL, key)

def get_supabase_client_for_user(access_token: Optional[str] = None) -> Client:
    """Returns a Supabase client with user context if access_token is provided."""
    key = SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
    if not SUPABASE_URL or not key:
        raise ValueError("Supabase URL and API Key must be set.")
    
    client = create_client(SUPABASE_URL, key)
    if access_token:
        client.postgrest.auth(access_token)
    return client

def upload_file_to_storage(bucket_name: str, path: str, file_bytes: bytes, content_type: str = "application/octet-stream") -> str:
    """Uploads bytes to a Supabase storage bucket and returns the storage path."""
    client = get_supabase_admin()
    try:
        # Upload or update file in bucket
        client.storage.from_(bucket_name).upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"}
        )
    except Exception as e:
        # If it already exists and upsert wasn't honored in older sdk versions, try update
        try:
            client.storage.from_(bucket_name).update(
                path=path,
                file=file_bytes,
                file_options={"content-type": content_type, "upsert": "true"}
            )
        except Exception:
            raise e
    return path

def create_signed_download_url(bucket_name: str, path: str, expires_in: int = 3600) -> str:
    """Creates a signed URL for private bucket file download."""
    client = get_supabase_admin()
    response = client.storage.from_(bucket_name).create_signed_url(path, expires_in)
    if isinstance(response, dict) and "signedURL" in response:
        return response["signedURL"]
    elif hasattr(response, "signed_url"):
        return response.signed_url
    elif isinstance(response, dict) and "signedUrl" in response:
        return response["signedUrl"]
    return str(response)
