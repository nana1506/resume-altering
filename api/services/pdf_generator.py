import io
import re
from typing import List, Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    HRFlowable,
    ListFlowable,
    ListItem
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

def apply_changes_to_text(original_text: str, changes: List[Dict[str, Any]]) -> str:
    """
    Applies the approved changes to the original CV text.
    If original_text in a change exists in the CV, replaces it.
    If original_text is empty or not found verbatim, appends to the respective section.
    """
    modified_text = original_text
    
    # Sort changes: replacements first, additions last
    replacements = [c for c in changes if c.get("original_text") and c.get("original_text").strip()]
    additions = [c for c in changes if not c.get("original_text") or not c.get("original_text").strip()]

    # Apply direct replacements
    for change in replacements:
        orig = change["original_text"].strip()
        rep = (change.get("final_text") or change.get("suggested_text", "")).strip()
        if not rep:
            continue
        
        # Try direct exact replacement
        if orig in modified_text:
            modified_text = modified_text.replace(orig, rep, 1)
        else:
            # Try relaxed line matching
            orig_lines = [l.strip() for l in orig.split("\n") if l.strip()]
            if orig_lines and orig_lines[0] in modified_text:
                modified_text = modified_text.replace(orig_lines[0], rep, 1)
            else:
                # If couldn't find exact location, append with section context
                additions.append(change)

    # Apply additions by section if any
    for change in additions:
        section_name = change.get("section", "").strip()
        rep = (change.get("final_text") or change.get("suggested_text", "")).strip()
        if not rep:
            continue
            
        # Try finding section in text
        if section_name:
            # Find section header case-insensitively
            pattern = re.compile(rf'(^|\n)({re.escape(section_name)}[^\n]*)(\n)', re.IGNORECASE)
            match = pattern.search(modified_text)
            if match:
                idx = match.end()
                modified_text = modified_text[:idx] + f"• {rep}\n" + modified_text[idx:]
                continue
        
        # Fallback: append near the end or skills/summary
        modified_text += f"\n\n{section_name or 'Additional Highlights'}:\n• {rep}"

    return modified_text

def build_pdf_from_cv_text(cv_text: str) -> bytes:
    """
    Renders a clean, modern, ATS-friendly PDF from structured CV text using ReportLab.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom Modern Palette
    primary_color = colors.HexColor("#1e293b")   # Slate 800
    accent_color = colors.HexColor("#3b82f6")    # Blue 500
    text_color = colors.HexColor("#334155")      # Slate 700
    subtext_color = colors.HexColor("#64748b")   # Slate 500
    
    # Custom Paragraph Styles
    name_style = ParagraphStyle(
        'CVName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color,
        alignment=TA_CENTER,
        spaceAfter=4
    )
    
    contact_style = ParagraphStyle(
        'CVContact',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=subtext_color,
        alignment=TA_CENTER,
        spaceAfter=12
    )

    section_header_style = ParagraphStyle(
        'CVSectionHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=primary_color,
        spaceBefore=10,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'CVBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=text_color,
        alignment=TA_LEFT,
        spaceAfter=4
    )

    bullet_style = ParagraphStyle(
        'CVBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=text_color,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3
    )

    story = []
    
    lines = cv_text.strip().split("\n")
    if not lines:
        lines = ["Tailored CV Document"]

    # First non-empty line as candidate Name
    first_line_idx = 0
    while first_line_idx < len(lines) and not lines[first_line_idx].strip():
        first_line_idx += 1
        
    candidate_name = lines[first_line_idx].strip() if first_line_idx < len(lines) else "Curriculum Vitae"
    
    # Check if 2nd line looks like contact info (email, phone, linkedin, location)
    contact_line = ""
    contact_idx = first_line_idx + 1
    if contact_idx < len(lines):
        candidate_contact = lines[contact_idx].strip()
        if any(keyword in candidate_contact.lower() for keyword in ["@", "linkedin", "phone", "+", "|", "github", "http"]) or len(candidate_contact) < 80:
            contact_line = candidate_contact
            start_content_idx = contact_idx + 1
        else:
            start_content_idx = contact_idx
    else:
        start_content_idx = contact_idx

    story.append(Paragraph(escape_xml(candidate_name), name_style))
    if contact_line:
        story.append(Paragraph(escape_xml(contact_line), contact_style))
    
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent_color, spaceAfter=8, spaceBefore=2))

    # Common section header keywords
    section_keywords = [
        "summary", "professional summary", "about", "experience", "work experience",
        "employment history", "skills", "technical skills", "core competencies",
        "education", "certifications", "projects", "languages", "awards", "volunteer"
    ]

    for line in lines[start_content_idx:]:
        raw_line = line.strip()
        if not raw_line:
            story.append(Spacer(1, 4))
            continue

        clean_lower = raw_line.lower().rstrip(":-")
        is_header = (
            (clean_lower in section_keywords or any(clean_lower.startswith(k + ":") for k in section_keywords))
            or (raw_line.isupper() and len(raw_line) < 40)
            or (raw_line.endswith(":") and len(raw_line) < 45)
        )

        if is_header and len(raw_line) < 50:
            header_text = raw_line.rstrip(":")
            story.append(Spacer(1, 6))
            story.append(Paragraph(escape_xml(header_text.upper()), section_header_style))
            story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#cbd5e1"), spaceAfter=5, spaceBefore=1))
        elif raw_line.startswith("•") or raw_line.startswith("-") or raw_line.startswith("*"):
            bullet_content = re.sub(r'^[•\-\*]\s*', '', raw_line)
            story.append(Paragraph(f"&bull; {escape_xml(bullet_content)}", bullet_style))
        else:
            story.append(Paragraph(escape_xml(raw_line), body_style))

    doc.build(story)
    return buffer.getvalue()

def escape_xml(text: str) -> str:
    """Escapes special XML/HTML characters for ReportLab Paragraphs."""
    return (
        text.replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;')
    )

def generate_tailored_pdf(original_cv_text: str, approved_changes: List[Dict[str, Any]]) -> bytes:
    """
    Main entry point: applies approved changes to original CV text and renders PDF bytes.
    """
    updated_cv_text = apply_changes_to_text(original_cv_text, approved_changes)
    return build_pdf_from_cv_text(updated_cv_text)
