import json
import os
import re
from typing import List, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

class SuggestionItem(BaseModel):
    section: str = Field(..., description="The CV section this applies to (e.g., 'Summary', 'Skills', 'Experience - Company X')")
    original_text: str = Field(default="", description="Verbatim excerpt from the original CV, or empty string if it's a new bullet point / addition")
    suggested_text: str = Field(..., description="The proposed replacement or addition with keyword/skill alignment")
    reason: str = Field(..., description="Explanation of which job vacancy requirement or skill keyword this addresses")

class GeminiSuggestionsResponse(BaseModel):
    suggestions: List[SuggestionItem]

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

def generate_cv_suggestions(cv_text: str, job_title: str, job_description: str) -> List[SuggestionItem]:
    """
    Calls Google Gemini to analyze gaps between the CV and job vacancy,
    returning structured actionable suggestions per section.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")

    prompt = f"""
You are an expert ATS (Applicant Tracking System) CV optimizer and career consultant.
Your goal is to tailor the candidate's CV specifically for the target job vacancy: "{job_title}".

CANDIDATE'S ORIGINAL CV:
\"\"\"
{cv_text}
\"\"\"

TARGET JOB VACANCY & REQUIREMENTS:
\"\"\"
{job_description}
\"\"\"

INSTRUCTIONS:
1. Identify missing keywords, key skills, industry technologies, and qualifications mentioned in the job description that match or extend the candidate's background.
2. Suggest precise, high-impact, section-by-section edits or additions (e.g. in 'Summary', 'Skills', 'Experience - [Company/Role]', 'Projects', 'Education').
3. DO NOT rewrite the entire CV. Only suggest specific, actionable changes (replace vague bullets with quantifiable/keyword-rich statements, add missing core skills, sharpen summary).
4. For each suggestion:
   - "section": Name of the section (e.g., "Professional Summary", "Skills", "Experience - Software Engineer at Acme").
   - "original_text": Verbatim excerpt from the CV to replace, or empty string "" if this is a newly added bullet point.
   - "suggested_text": The exact new text or revised bullet point with active action verbs and keywords.
   - "reason": Clear rationale linking this change directly to a requirement in the job description.

You MUST return ONLY valid JSON matching this schema:
{{
  "suggestions": [
    {{
      "section": "string",
      "original_text": "string",
      "suggested_text": "string",
      "reason": "string"
    }}
  ]
}}
"""

    # Attempt calling Gemini using google.generativeai
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        # Prefer fast & reliable models
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={"response_mime_type": "application/json"}
        )
        response = model.generate_content(prompt)
        raw_text = response.text
        cleaned_json = clean_json_string(raw_text)
        data = json.loads(cleaned_json)
        parsed = GeminiSuggestionsResponse(**data)
        return parsed.suggestions
    except Exception as first_err:
        # Fallback / Retry with strict prompt reminder if parsing failed
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name="gemini-1.5-flash")
            retry_prompt = prompt + "\n\nCRITICAL RETRY NOTICE: The previous output failed JSON validation. Output pure, valid JSON ONLY. Start with { and end with }."
            response = model.generate_content(retry_prompt)
            raw_text = response.text
            cleaned_json = clean_json_string(raw_text)
            data = json.loads(cleaned_json)
            parsed = GeminiSuggestionsResponse(**data)
            return parsed.suggestions
        except Exception as retry_err:
            raise RuntimeError(f"Failed to generate and parse Gemini CV suggestions: {str(retry_err)} (Initial error: {str(first_err)})")
