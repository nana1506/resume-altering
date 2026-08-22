import os
import sys
import json

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.services.parser import (
    ParsedCV,
    CVSection,
    CVEntry,
    structure_cv_text,
    cv_to_plain_text,
    clean_text,
    parse_skill_line
)
from api.services.pdf_generator import (
    generate_tailored_pdf,
    apply_changes_to_cv,
    reorder_sections,
    build_pdf_from_cv
)
from api.services.gemini_service import (
    GeminiAnalysisResponse,
    clean_json_string,
    fallback_keyword_extractor
)

def test_line_wrap_continuation_merging():
    print("Testing Line-Wrap Continuation Merging (Fix 1)...")
    wrapped_cv_text = """John Doe
Senior Data Analyst
john.doe@example.com | (555) 987-6543 | Chicago, IL | linkedin.com/in/johndoe

PROFILE SUMMARY
Results-oriented Data Analyst with 5+ years of experience transforming complex datasets into
actionable business intelligence dashboards and predictive models across multi-cloud environments.

WORK EXPERIENCE
Lead Data Analyst at Globex Corp (2020 - Present)
• Built scalable ETL pipelines using Python and Apache Spark,
reducing nightly batch processing times by 45% across all regional hubs.
• Collaborated with executive leadership to design automated KPI reports
in Tableau and Power BI, driving a 15% increase in operational efficiency.

SKILLS & TECHNOLOGIES
Technical Skills: SQL, Python, R, Bash, Git, Docker
BI & Visualization: Tableau, Power BI, Looker Studio, Metabase
Cloud & Databases: AWS Redshift, Snowflake, PostgreSQL, BigQuery

EDUCATION
B.S. in Statistics - University of Illinois (2015 - 2019)
"""
    parsed = structure_cv_text(wrapped_cv_text)
    
    # 1. Check Profile Summary merged into 1 continuous paragraph
    summary_sec = next(s for s in parsed.sections if s.name == "Profile Summary")
    assert len(summary_sec.entries) == 1, f"Expected 1 merged summary paragraph, got {len(summary_sec.entries)}"
    assert "transforming complex datasets into actionable business intelligence" in summary_sec.entries[0].text
    
    # 2. Check Work Experience bullets merged into 2 continuous bullets
    exp_sec = next(s for s in parsed.sections if s.name == "Work Experience")
    bullets = [e for e in exp_sec.entries if e.type == "bullet"]
    assert len(bullets) == 2, f"Expected 2 merged bullets, got {len(bullets)}"
    assert "Apache Spark, reducing nightly batch processing times" in bullets[0].text
    assert "automated KPI reports in Tableau" in bullets[1].text
    
    # 3. Check Skills & Technologies parsed as 3 distinct skill_line entries
    skills_sec = next(s for s in parsed.sections if s.name == "Skills & Technologies")
    assert len(skills_sec.entries) == 3, f"Expected 3 skill category entries, got {len(skills_sec.entries)}"
    assert skills_sec.entries[0].type == "skill_line"
    assert skills_sec.entries[0].label == "Technical Skills"
    assert "Python" in skills_sec.entries[0].text
    assert skills_sec.entries[1].type == "skill_line"
    assert skills_sec.entries[1].label == "BI & Visualization"
    assert skills_sec.entries[2].type == "skill_line"
    assert skills_sec.entries[2].label == "Cloud & Databases"
    print("Line-wrap continuation merging validated successfully!")

def test_cv_structuring():
    print("Testing Structured CV Parsing...")
    sample_raw_cv = """Alex Morgan
Senior Full-Stack Engineer | Cloud & Distributed Systems
alex.morgan@example.com | (555) 123-4567 | San Francisco, CA | linkedin.com/in/alexmorgan

PROFILE SUMMARY
Results-driven engineer with 6 years of experience scaling web services.

WORK EXPERIENCE
Senior Software Engineer at Acme Corp (2021 - Present)
• Built user interfaces using React and TypeScript.
• Maintained legacy backend endpoints in Python.
• Led cloud migration reducing infrastructure cost by 20%.

SKILLS & TECHNOLOGIES
• Languages: Python, TypeScript, JavaScript, SQL
• Frameworks: Next.js, FastAPI, Django
• Tools: Docker, Kubernetes, AWS, PostgreSQL

EDUCATION
B.S. in Computer Science - UC Berkeley (2015 - 2019)
"""
    parsed = structure_cv_text(sample_raw_cv)
    assert parsed.name == "Alex Morgan"
    assert "Senior Full-Stack Engineer" in parsed.headline
    assert "alex.morgan@example.com" in parsed.contact
    assert len(parsed.sections) == 4
    
    section_names = [s.name for s in parsed.sections]
    assert "Profile Summary" in section_names
    assert "Work Experience" in section_names
    assert "Skills & Technologies" in section_names
    assert "Education" in section_names
    
    exp_sec = next(s for s in parsed.sections if s.name == "Work Experience")
    subheadings = [e for e in exp_sec.entries if e.type == "subheading"]
    bullets = [e for e in exp_sec.entries if e.type == "bullet"]
    assert len(subheadings) == 1
    assert "Senior Software Engineer at Acme Corp" in subheadings[0].text
    assert len(bullets) == 3
    print("CV structuring validated successfully!")

def test_apply_changes_to_cv():
    print("Testing Precise Change Application to Structured CV...")
    sample_cv = ParsedCV(
        name="Jordan Lee",
        headline="Software Developer",
        contact="jordan@example.com",
        sections=[
            CVSection(
                name="Profile Summary",
                entries=[
                    CVEntry(type="paragraph", text="Experienced software developer with 3 years experience.")
                ]
            ),
            CVSection(
                name="Work Experience",
                entries=[
                    CVEntry(type="subheading", text="Software Engineer at Beta Inc (2020 - Present)"),
                    CVEntry(type="bullet", text="Developed backend APIs.")
                ]
            ),
            CVSection(
                name="Skills & Technologies",
                entries=[
                    CVEntry(type="skill_line", label="Languages", text="Python, SQL, Git")
                ]
            )
        ]
    )

    changes = [
        {
            "section": "Profile Summary",
            "entry_index": 0,
            "original_text": "Experienced software developer with 3 years experience.",
            "suggested_text": "High-performing Software Engineer with 3+ years of expertise in FastAPI and Docker microservices.",
            "reason": "Aligns with Senior role criteria",
            "checked": True,
            "final_text": None
        },
        {
            "section": "Work Experience",
            "entry_index": 1,
            "original_text": "Developed backend APIs.",
            "suggested_text": "Architected high-throughput REST APIs in FastAPI, reducing latency by 40%.",
            "reason": "Quantifies achievements",
            "checked": True,
            "final_text": None
        },
        {
            "section": "Skills & Technologies",
            "entry_index": -1,  # Addition
            "original_text": "",
            "suggested_text": "Docker, Kubernetes, AWS, PostgreSQL, Redis",
            "reason": "Adds vacancy cloud keywords",
            "checked": True,
            "final_text": None
        }
    ]

    updated = apply_changes_to_cv(sample_cv, changes)
    
    # 1. Check Profile Summary replacement
    assert updated.sections[0].entries[0].text == "High-performing Software Engineer with 3+ years of expertise in FastAPI and Docker microservices."
    
    # 2. Check Work Experience bullet replacement
    assert updated.sections[1].entries[1].text == "Architected high-throughput REST APIs in FastAPI, reducing latency by 40%."
    
    # 3. Check Skills addition
    assert len(updated.sections[2].entries) == 2
    assert updated.sections[2].entries[1].text == "Docker, Kubernetes, AWS, PostgreSQL, Redis"
    print("Structured change application verified successfully!")

def test_template_reordering():
    print("Testing Template Mode Canonical Reordering...")
    unconventional_cv = ParsedCV(
        name="Taylor Swift",
        headline="Data Engineer",
        contact="taylor@example.com",
        sections=[
            CVSection(name="Education", entries=[CVEntry(type="paragraph", text="MIT 2020")]),
            CVSection(name="Work Experience", entries=[CVEntry(type="bullet", text="Engineered pipelines")]),
            CVSection(name="Profile Summary", entries=[CVEntry(type="paragraph", text="Data specialist")])
        ]
    )

    reordered = reorder_sections(unconventional_cv, template_mode="fixed")
    ordered_names = [s.name for s in reordered.sections]
    assert ordered_names == ["Profile Summary", "Work Experience", "Education"]
    print("Canonical template reordering verified successfully!")

def test_pdf_generation():
    print("Testing Structured PDF Generation with Justified Bullets and Skill Lines...")
    sample_cv = structure_cv_text("""
Alex Morgan
Senior Cloud Engineer
alex.morgan@example.com | (555) 123-4567 | San Francisco, CA | linkedin.com/in/alexmorgan

SUMMARY
Experienced software engineer with 5 years of background in building high-scale web applications.

EXPERIENCE
Software Engineer at Acme Corp (2021 - Present)
• Built user interfaces using React and TypeScript, improving customer checkout conversion by 18%.
• Maintained legacy backend endpoints in Python and FastAPI.

SKILLS
Technical Skills: Python, FastAPI, Supabase, PostgreSQL, Next.js, Docker
Cloud Infrastructure: AWS, GCP, Terraform, Kubernetes, CI/CD
""")

    sample_changes = [
        {
            "section": "SUMMARY",
            "entry_index": 0,
            "original_text": "Experienced software engineer with 5 years of background in building high-scale web applications.",
            "suggested_text": "Results-driven Senior Full-Stack Engineer with 5+ years of experience designing scalable microservices.",
            "reason": "Aligns with Senior role",
            "checked": True
        }
    ]

    pdf_bytes = generate_tailored_pdf(sample_cv, sample_changes)
    assert len(pdf_bytes) > 1000, f"Generated PDF is too small: {len(pdf_bytes)} bytes"
    print(f"Structured PDF generated successfully! Size: {len(pdf_bytes)} bytes.")

def test_gemini_json_parsing():
    print("Testing Gemini Schema Parsing with Match Score, Keywords & Entry Index...")
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
      "section": "Profile Summary",
      "entry_index": 0,
      "original_text": "Software engineer with 3 years experience",
      "suggested_text": "Senior Software Engineer specializing in distributed cloud systems",
      "reason": "Matches Senior Cloud Engineer job vacancy requirement"
    }
  ]
}
```"""
    cleaned = clean_json_string(sample_raw_json)
    raw_dict = json.loads(cleaned)
    parsed = GeminiAnalysisResponse(**raw_dict)
    assert parsed.match_score == 82
    assert parsed.match_label == "Strong Match"
    assert len(parsed.keywords) == 3
    assert parsed.suggestions[0].entry_index == 0
    assert parsed.suggestions[0].section == "Profile Summary"
    print("Gemini response parsing verified successfully!")

def test_fallback_keyword_extractor():
    print("Testing Fallback Keyword Extractor...")
    cv = "Software Engineer with React, TypeScript, Git and REST API experience."
    job_title = "Senior Full-Stack Engineer (Python / Next.js)"
    job_desc = "We are seeking a Senior Full-Stack Engineer proficient with Python, FastAPI, PostgreSQL, Docker, and AWS."
    
    extracted = fallback_keyword_extractor(cv, job_title, job_desc)
    assert len(extracted) >= 4, f"Expected multiple keywords, got {len(extracted)}"
    terms = [k.keyword for k in extracted]
    assert "Python" in terms
    assert "Docker" in terms
    assert "PostgreSQL" in terms
    print(f"Extracted {len(extracted)} keywords reliably: {terms}")

if __name__ == "__main__":
    test_line_wrap_continuation_merging()
    test_cv_structuring()
    test_apply_changes_to_cv()
    test_template_reordering()
    test_pdf_generation()
    test_gemini_json_parsing()
    test_fallback_keyword_extractor()
    print("All service unit tests passed cleanly!")
