from typing import Optional
from pydantic import BaseModel

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
