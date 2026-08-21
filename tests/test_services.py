import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.services.pdf_generator import generate_tailored_pdf, apply_changes_to_text
from api.services.gemini_service import GeminiAnalysisResponse, clean_json_string

def test_pdf_generation():
    print("Testing PDF Generation...")
    sample_cv = """
Alex Morgan
alex.morgan@example.com | (555) 123-4567 | San Francisco, CA | linkedin.com/in/alexmorgan

SUMMARY
Experienced software engineer with 5 years of background in building web apps.

EXPERIENCE
Software Engineer at Acme Corp (2021 - Present)
• Built user interfaces using React and TypeScript.
• Maintained legacy backend endpoints.
• Collaborated with cross-functional teams.

SKILLS
JavaScript, React, HTML, CSS, Git
"""

    sample_changes = [
        {
            "section": "SUMMARY",
            "original_text": "Experienced software engineer with 5 years of background in building web apps.",
            "suggested_text": "Results-driven Senior Full-Stack Engineer with 5+ years of experience designing scalable microservices and Next.js applications.",
            "reason": "Aligns with Senior role and Next.js keywords",
            "checked": True,
            "final_text": None
        },
        {
            "section": "EXPERIENCE",
            "original_text": "• Maintained legacy backend endpoints.",
            "suggested_text": "• Re-architected backend microservices in Python & FastAPI, reducing API latency by 35%.",
            "reason": "Adds Python/FastAPI keywords and quantifiable metrics",
            "checked": True,
            "final_text": None
        },
        {
            "section": "SKILLS",
            "original_text": "",
            "suggested_text": "Python, FastAPI, Supabase, PostgreSQL, Next.js, Docker, Tailwind CSS",
            "reason": "Includes core vacancy technical stack",
            "checked": True,
            "final_text": None
        }
    ]

    pdf_bytes = generate_tailored_pdf(sample_cv, sample_changes)
    assert len(pdf_bytes) > 1000, f"Generated PDF is too small: {len(pdf_bytes)} bytes"
    print(f"PDF generated successfully! Size: {len(pdf_bytes)} bytes.")

def test_gemini_json_parsing():
    print("Testing Gemini Schema Parsing with Match Score & Keywords...")
    sample_raw_json = """```json
{
  "match_score": 82,
  "match_label": "Strong Match",
  "match_summary": "Strong engineering foundations with minor cloud keyword gaps.",
  "keywords": [
    {
      "keyword": "React",
      "category": "Core Skills",
      "status": "exists",
      "details": "Present in Experience"
    },
    {
      "keyword": "PostgreSQL",
      "category": "Databases",
      "status": "different_terms",
      "details": "CV mentions SQL databases"
    },
    {
      "keyword": "Docker",
      "category": "DevOps",
      "status": "not_exists",
      "details": "Missing from CV"
    }
  ],
  "suggestions": [
    {
      "section": "Summary",
      "original_text": "Software engineer with 3 years experience",
      "suggested_text": "Senior Software Engineer specializing in distributed cloud systems",
      "reason": "Matches Senior Cloud Engineer job vacancy requirement"
    }
  ]
}
```"""
    cleaned = clean_json_string(sample_raw_json)
    import json
    parsed = GeminiAnalysisResponse(**json.loads(cleaned))
    assert parsed.match_score == 82
    assert parsed.match_label == "Strong Match"
    assert len(parsed.keywords) == 3
    assert parsed.keywords[0].status == "exists"
    assert parsed.keywords[1].status == "different_terms"
    assert parsed.keywords[2].status == "not_exists"
    assert len(parsed.suggestions) == 1
    print("Gemini response parsing verified successfully!")

if __name__ == "__main__":
    test_pdf_generation()
    test_gemini_json_parsing()
    print("All service unit tests passed!")
