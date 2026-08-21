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
    section: str = Field(..., description="The CV section this applies to (e.g., 'Summary', 'Skills', 'Experience - Company X')")
    original_text: str = Field(default="", description="Verbatim excerpt from the original CV, or empty string if it's a new bullet point / addition")
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

def generate_cv_suggestions(cv_text: str, job_title: str, job_description: str) -> GeminiAnalysisResponse:
    """
    Calls Google Gemini to analyze ATS match score, extract vacancy keywords with presence status,
    and generate precise section-by-section bullet improvements.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")

    prompt = f"""
You are an expert ATS (Applicant Tracking System) CV auditor and talent acquisition specialist.
Your task is to conduct an in-depth keyword gap analysis and optimization for the target job: "{job_title}".

CANDIDATE'S ORIGINAL CV:
\"\"\"
{cv_text}
\"\"\"

TARGET JOB VACANCY & REQUIREMENTS:
\"\"\"
{job_description}
\"\"\"

CRITICAL KEYWORD EXTRACTION RULES:
1. You MUST extract between 8 and 20 distinct, essential keywords from the job vacancy.
   These MUST include:
   - Core hard skills (e.g. programming languages, data modeling, analytical skills, leadership)
   - Primary tools, frameworks, and technologies (e.g. React, PostgreSQL, Docker, AWS, Figma, Python)
   - Key domain experiences and methodologies (e.g. CI/CD, Agile Scrum, Microservices, System Architecture, Cross-functional collaboration)
   - Essential qualifications or degree requirements
2. DO NOT return an empty keywords array. Every job description has explicit and implicit key requirements.
3. For each extracted keyword, evaluate its status relative to the candidate's CV:
   - "exists": The skill or term is explicitly stated in the CV.
   - "different_terms": The candidate shows this capability but uses alternative, synonymous, or broader phrasing (e.g. CV mentions "FastAPI / Flask" for "Python backend frameworks", or "PostgreSQL" for "Relational Databases").
   - "not_exists": The skill or requirement is completely absent in the CV.
4. Calculate an overall ATS match score (0 - 100 percentage) and assign a match label:
   - "Strong Match" (80% - 100%)
   - "Moderate Match" (60% - 79%)
   - "Low Match" (below 60%)
5. Write a concise executive match_summary explaining the alignment strengths and the primary gap areas.
6. Provide precise, actionable section-by-section bullet suggestions (in 'Summary', 'Skills', 'Experience', etc.) to directly address the "not_exists" and "different_terms" keyword gaps.

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
      "section": "Professional Summary",
      "original_text": "Software engineer with background in web development.",
      "suggested_text": "Full-Stack Software Engineer with expertise in Python, FastAPI, and Dockerized microservices.",
      "reason": "Incorporates missing Docker and Python keywords to match ATS criteria."
    }}
  ]
}}
"""

    import google.generativeai as genai
    genai.configure(api_key=api_key)

    candidate_models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-3-flash-preview"]
    
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
                
            return parsed
        except Exception as err:
            last_error = err
            continue

    # Fallback retry without strict mime-type if needed
    for model_name in candidate_models:
        try:
            model = genai.GenerativeModel(model_name=model_name)
            retry_prompt = prompt + "\n\nCRITICAL RETRY: Return ONLY valid JSON format. Start with { and end with }."
            response = model.generate_content(retry_prompt)
            raw_text = response.text
            cleaned_json = clean_json_string(raw_text)
            data = json.loads(cleaned_json)
            parsed = GeminiAnalysisResponse(**data)
            
            if not parsed.keywords or len(parsed.keywords) < 3:
                parsed.keywords = fallback_keyword_extractor(cv_text, job_title, job_description)
                
            return parsed
        except Exception as retry_err:
            last_error = retry_err
            continue

    raise RuntimeError(f"Failed to generate and parse Gemini CV suggestions: {str(last_error)}")
