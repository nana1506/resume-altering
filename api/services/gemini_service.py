import json
import os
import re
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

class KeywordItem(BaseModel):
    keyword: str = Field(..., description="The specific skill, tool, framework, or experience requirement mentioned in the job vacancy")
    category: str = Field(default="Core Skills", description="Category: 'Core Skills', 'Tools & Technologies', 'Domain & Experience', or 'Qualifications'")
    status: Literal["exists", "different_terms", "not_exists"] = Field(
        ...,
        description="'exists' if present in CV verbatim, 'different_terms' if present under synonymous or related phrasing, 'not_exists' if completely absent"
    )
    details: str = Field(..., description="Brief explanation, e.g. 'Present in Experience section', 'CV uses Next.js for React Frameworks', or 'Missing from resume; added in suggestions below'")

class SuggestionItem(BaseModel):
    section: str = Field(..., description="The CV section this applies to (e.g., 'Profile Summary', 'Skills & Technologies', 'Work Experience')")
    entry_index: Optional[int] = Field(default=-1, description="Index into that section's entries list; -1 or omitted = new entry (addition)")
    original_text: str = Field(default="", description="Verbatim excerpt from the original CV entry, or empty string if it's a new bullet point / addition")
    suggested_text: str = Field(..., description="The proposed replacement or addition with keyword/skill alignment")
    reason: str = Field(..., description="Explanation of which job vacancy requirement or skill keyword this addresses")

class GeminiAnalysisResponse(BaseModel):
    match_score: int = Field(..., ge=0, le=100, description="Original ATS compatibility match score from 0 to 100 percentage before changes")
    predicted_match_score: Optional[int] = Field(default=None, ge=0, le=100, description="Predicted ATS match score (typically 88-98%) after applying all suggested alterations")
    match_label: str = Field(..., description="Fit label: 'Strong Match' (>=80%), 'Moderate Match' (60-79%), or 'Low Match' (<60%)")
    match_summary: str = Field(..., description="Executive summary highlighting candidate strengths and critical keyword gaps")
    keywords: List[KeywordItem] = Field(..., description="Comprehensive list of 8-20 critical keywords from the job vacancy with CV presence status")
    suggestions: List[SuggestionItem] = Field(..., description="Targeted bullet suggestions to bridge the keyword gaps")

def clean_json_string(text: str) -> str:
    """Strips markdown code fences and extraneous text from JSON responses."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def fallback_keyword_extractor(cv_text: str, job_title: str, job_description: str) -> List[KeywordItem]:
    """
    Guarantees non-empty keywords extraction even if AI model has brief output.
    Extracts high-value technical terms, tools, and domain keywords.
    """
    cv_lower = cv_text.lower()
    
    # Common tech/domain patterns in job descriptions
    common_terms = [
        ("Python", "Core Skills"), ("JavaScript", "Core Skills"), ("TypeScript", "Core Skills"),
        ("React", "Tools & Technologies"), ("Next.js", "Tools & Technologies"), ("Vue.js", "Tools & Technologies"),
        ("Node.js", "Tools & Technologies"), ("FastAPI", "Tools & Technologies"), ("Django", "Tools & Technologies"),
        ("SQL", "Core Skills"), ("PostgreSQL", "Tools & Technologies"), ("MySQL", "Tools & Technologies"),
        ("MongoDB", "Tools & Technologies"), ("Redis", "Tools & Technologies"), ("Docker", "Tools & Technologies"),
        ("Kubernetes", "Tools & Technologies"), ("AWS", "Tools & Technologies"), ("GCP", "Tools & Technologies"),
        ("Azure", "Tools & Technologies"), ("Git", "Tools & Technologies"), ("CI/CD", "Domain & Experience"),
        ("REST API", "Domain & Experience"), ("GraphQL", "Tools & Technologies"), ("Microservices", "Domain & Experience"),
        ("Agile / Scrum", "Domain & Experience"), ("Unit Testing", "Domain & Experience"), ("System Design", "Domain & Experience"),
        ("Tailwind CSS", "Tools & Technologies"), ("HTML / CSS", "Core Skills"), ("Linux", "Tools & Technologies"),
        ("Project Management", "Domain & Experience"), ("Data Analysis", "Domain & Experience")
    ]
    
    extracted: List[KeywordItem] = []
    
    # Extract terms mentioned in job description
    jd_lower = job_description.lower()
    for term, category in common_terms:
        if term.lower() in jd_lower or term.lower() in job_title.lower():
            if term.lower() in cv_lower:
                status = "exists"
                details = f"Explicitly found in candidate's CV."
            elif any(syn in cv_lower for syn in [term.lower().replace('.', ''), term.lower().replace(' ', '')]):
                status = "different_terms"
                details = f"CV contains related capability under alternative phrasing."
            else:
                status = "not_exists"
                details = f"Key requirement in vacancy, not currently highlighted in CV."
            extracted.append(KeywordItem(keyword=term, category=category, status=status, details=details))
            
    # If still few, add job title key phrase
    if len(extracted) < 5 and job_title:
        title_in_cv = job_title.lower() in cv_lower
        extracted.append(KeywordItem(
            keyword=job_title,
            category="Domain & Experience",
            status="exists" if title_in_cv else "not_exists",
            details="Target role domain experience." if title_in_cv else "Target position title alignment."
        ))
        
    return extracted

def log_gemini_usage(
    user_id: Optional[str],
    application_id: Optional[str],
    input_tokens: Optional[int],
    output_tokens: Optional[int],
    model_used: str
):
    """Helper to record Gemini API call metadata to the gemini_usage_log database table."""
    if not user_id:
        return
    try:
        from api.services.supabase_client import get_supabase_admin
        admin = get_supabase_admin()
        admin.table("gemini_usage_log").insert({
            "user_id": user_id,
            "application_id": application_id,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model_used": model_used
        }).execute()
    except Exception as log_err:
        print(f"Warning: Failed to log Gemini usage to database: {log_err}")

def generate_cv_suggestions(
    cv_text: str,
    job_title: str,
    job_description: str,
    user_id: Optional[str] = None,
    application_id: Optional[str] = None
) -> GeminiAnalysisResponse:
    """
    Calls Google Gemini to analyze ATS match score, extract vacancy keywords with presence status,
    and generate precise section-by-section bullet improvements.
    Logs token consumption and model metadata to gemini_usage_log.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")

    prompt = f"""
You are an expert ATS (Applicant Tracking System) CV auditor and talent acquisition specialist.
Your task is to conduct an in-depth keyword gap analysis and optimization for the target job: "{job_title}".

CANDIDATE'S ORIGINAL CV (Structured with Section & Entry Index headers):
\"\"\"
{cv_text}
\"\"\"

TARGET JOB VACANCY & REQUIREMENTS:
\"\"\"
{job_description}
\"\"\"

CRITICAL KEYWORD & SUGGESTION RULES:
1. You MUST extract between 8 and 20 distinct, essential keywords from the job vacancy.
   These MUST include core hard skills, primary tools & frameworks, domain experience, and qualifications.
2. DO NOT return an empty keywords array.
3. For each extracted keyword, evaluate its status relative to the candidate's CV:
   - "exists": Explicitly stated in the CV.
   - "different_terms": Present under alternative or synonymous phrasing.
   - "not_exists": Completely absent in the CV.
4. Calculate an overall ATS match score (0 - 100 percentage) and assign a match label.
5. Provide precise, actionable section-by-section bullet suggestions.
   - Specify the exact "section" (e.g. "Profile Summary", "Work Experience", "Skills & Technologies").
   - If replacing or improving an existing line, specify its 0-based "entry_index" in that section and include the verbatim "original_text".
   - If adding a new bullet point to a section, set "entry_index": -1 and "original_text": "".

You MUST return ONLY valid JSON matching this schema:
{{
  "match_score": 68,
  "predicted_match_score": 95,
  "match_label": "Moderate Match",
  "match_summary": "Candidate has solid foundational experience in ..., but lacks explicit mentions of ... required by the vacancy.",
  "keywords": [
    {{
      "keyword": "Python",
      "category": "Core Skills",
      "status": "exists",
      "details": "Present in Experience and Skills section"
    }},
    {{
      "keyword": "API Architecture",
      "category": "Domain & Experience",
      "status": "different_terms",
      "details": "CV describes building REST endpoints"
    }},
    {{
      "keyword": "Docker",
      "category": "Tools & Technologies",
      "status": "not_exists",
      "details": "Required for containerization; added in suggested experience bullet"
    }}
  ],
  "suggestions": [
    {{
      "section": "Profile Summary",
      "entry_index": 0,
      "original_text": "Software engineer with background in web development.",
      "suggested_text": "Full-Stack Software Engineer with expertise in Python, FastAPI, and Dockerized microservices.",
      "reason": "Incorporates missing Docker and Python keywords to match ATS criteria."
    }}
  ]
}}
"""

    import google.generativeai as genai
    genai.configure(api_key=api_key)

    # Primary reliable models (fast & stable)
    candidate_models = ["gemini-2.5-flash", "gemini-flash-latest"]
    
    last_error = None
    for model_name in candidate_models:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={"response_mime_type": "application/json"}
            )
            response = model.generate_content(prompt)
            raw_text = response.text
            cleaned_json = clean_json_string(raw_text)
            data = json.loads(cleaned_json)
            parsed = GeminiAnalysisResponse(**data)
            
            # Guarantee non-empty keywords
            if not parsed.keywords or len(parsed.keywords) < 3:
                parsed.keywords = fallback_keyword_extractor(cv_text, job_title, job_description)
            
            # Extract token counts from Gemini response metadata
            prompt_tokens = None
            candidates_tokens = None
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", None)
                candidates_tokens = getattr(response.usage_metadata, "candidates_token_count", None)

            log_gemini_usage(
                user_id=user_id,
                application_id=application_id,
                input_tokens=prompt_tokens,
                output_tokens=candidates_tokens,
                model_used=model_name
            )
                
            return parsed
        except Exception as err:
            last_error = err
            continue

    # Single retry pass with strict formatting prompt reminder on the primary model
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config={"response_mime_type": "application/json"}
        )
        retry_prompt = prompt + "\n\nCRITICAL RETRY: Return ONLY valid JSON format matching schema. Start with { and end with }."
        response = model.generate_content(retry_prompt)
        raw_text = response.text
        cleaned_json = clean_json_string(raw_text)
        data = json.loads(cleaned_json)
        parsed = GeminiAnalysisResponse(**data)
        
        if not parsed.keywords or len(parsed.keywords) < 3:
            parsed.keywords = fallback_keyword_extractor(cv_text, job_title, job_description)

        prompt_tokens = None
        candidates_tokens = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", None)
            candidates_tokens = getattr(response.usage_metadata, "candidates_token_count", None)

        log_gemini_usage(
            user_id=user_id,
            application_id=application_id,
            input_tokens=prompt_tokens,
            output_tokens=candidates_tokens,
            model_used="gemini-2.5-flash"
        )
            
        return parsed
    except Exception as retry_err:
        last_error = retry_err

    # If call fails after all attempts, log the failed attempt with null token counts
    log_gemini_usage(
        user_id=user_id,
        application_id=application_id,
        input_tokens=None,
        output_tokens=None,
        model_used="failed_attempt"
    )

    raise RuntimeError(f"Failed to generate and parse Gemini CV suggestions: {str(last_error)}")
