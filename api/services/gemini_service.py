import json
import os
import re
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

class KeywordItem(BaseModel):
    keyword: str = Field(..., description="The specific skill, tool, or qualification mentioned in the job vacancy")
    category: str = Field(default="Skills", description="Category: 'Core Skills', 'Tools & Technologies', 'Qualifications', or 'Domain Knowledge'")
    status: Literal["exists", "different_terms", "not_exists"] = Field(
        ...,
        description="'exists' if present in CV verbatim, 'different_terms' if present under synonymous or related phrasing, 'not_exists' if completely absent"
    )
    details: str = Field(..., description="Brief explanation, e.g. 'Found under Experience', 'CV uses Next.js for React Frameworks', or 'Missing from resume'")

class SuggestionItem(BaseModel):
    section: str = Field(..., description="The CV section this applies to (e.g., 'Summary', 'Skills', 'Experience - Company X')")
    original_text: str = Field(default="", description="Verbatim excerpt from the original CV, or empty string if it's a new bullet point / addition")
    suggested_text: str = Field(..., description="The proposed replacement or addition with keyword/skill alignment")
    reason: str = Field(..., description="Explanation of which job vacancy requirement or skill keyword this addresses")

class GeminiAnalysisResponse(BaseModel):
    match_score: int = Field(..., ge=0, le=100, description="Overall ATS compatibility match score from 0 to 100 percentage")
    match_label: str = Field(..., description="Fit label: 'Strong Match' (>=80%), 'Moderate Match' (60-79%), or 'Low Match' (<60%)")
    match_summary: str = Field(..., description="Executive summary highlighting candidate strengths and critical keyword gaps")
    keywords: List[KeywordItem] = Field(..., description="Comprehensive list of keywords extracted from the job vacancy with status relative to the CV")
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

def generate_cv_suggestions(cv_text: str, job_title: str, job_description: str) -> GeminiAnalysisResponse:
    """
    Calls Google Gemini to analyze ATS match score, extract vacancy keywords with presence status,
    and generate precise section-by-section bullet improvements.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")

    prompt = f"""
You are an expert ATS (Applicant Tracking System) CV auditor and career strategist.
Your task is to analyze the candidate's CV against the target job vacancy: "{job_title}".

CANDIDATE'S ORIGINAL CV:
\"\"\"
{cv_text}
\"\"\"

TARGET JOB VACANCY & REQUIREMENTS:
\"\"\"
{job_description}
\"\"\"

ANALYSIS INSTRUCTIONS:
1. Extract ALL key skills, technologies, tools, methodologies, and requirements from the target job vacancy.
2. For each keyword, determine its status in the candidate's CV:
   - "exists": The keyword or skill is clearly mentioned in the CV.
   - "different_terms": The candidate demonstrates this capability but uses synonymous or related terminology (e.g. CV mentions "FastAPI" for "Python backend", or "PostgreSQL" for "SQL databases").
   - "not_exists": The keyword or skill is completely missing from the candidate's CV.
3. Calculate an overall ATS match score (0 - 100 percentage) and assign a match label:
   - "Strong Match" (80% - 100%)
   - "Moderate Match" (60% - 79%)
   - "Low Match" (below 60%)
4. Write a concise executive match_summary explaining the fit and primary gaps.
5. Suggest precise, high-impact section-by-section bullet edits or additions to bridge the "not_exists" and "different_terms" gaps without rewriting the entire CV.

You MUST return ONLY valid JSON matching this schema:
{{
  "match_score": 75,
  "match_label": "Moderate Match",
  "match_summary": "Summary of alignment and gaps...",
  "keywords": [
    {{
      "keyword": "Python",
      "category": "Core Skills",
      "status": "exists",
      "details": "Present in Experience and Skills section"
    }},
    {{
      "keyword": "API Architecture",
      "category": "Methodologies",
      "status": "different_terms",
      "details": "CV describes building REST endpoints"
    }},
    {{
      "keyword": "Kubernetes",
      "category": "Tools & Technologies",
      "status": "not_exists",
      "details": "Not mentioned in CV; addressed in suggested bullet below"
    }}
  ],
  "suggestions": [
    {{
      "section": "Summary",
      "original_text": "verbatim text to replace or empty string if new",
      "suggested_text": "new tailored text",
      "reason": "which keyword or requirement this addresses"
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
            return parsed
        except Exception as err:
            last_error = err
            continue

    # Fallback retry
    for model_name in candidate_models:
        try:
            model = genai.GenerativeModel(model_name=model_name)
            retry_prompt = prompt + "\n\nCRITICAL RETRY: Return ONLY valid JSON format. Start with { and end with }."
            response = model.generate_content(retry_prompt)
            raw_text = response.text
            cleaned_json = clean_json_string(raw_text)
            data = json.loads(cleaned_json)
            parsed = GeminiAnalysisResponse(**data)
            return parsed
        except Exception as retry_err:
            last_error = retry_err
            continue

    raise RuntimeError(f"Failed to generate and parse Gemini CV suggestions: {str(last_error)}")
