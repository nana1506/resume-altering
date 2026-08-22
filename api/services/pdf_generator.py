import io
import re
from typing import List, Dict, Any, Union
from api.services.parser import ParsedCV, CVSection, CVEntry, structure_cv_text

# Canonical fixed template order for Part 4 Template Mode
CANONICAL_ORDER = [
    "profile summary",
    "work experience",
    "skills & technologies",
    "skills",
    "technical skills",
    "education",
    "certifications",
    "projects",
    "languages",
    "awards & honors",
    "publications",
    "volunteer experience",
    "additional information"
]

def apply_changes_to_cv(cv: ParsedCV, changes: List[Dict[str, Any]]) -> ParsedCV:
    """
    Applies approved changes directly to the structured ParsedCV model.
    Avoids string search bugs and guarantees changes land in their exact intended sections.
    """
    # Deep copy sections so original object is not mutated in-place
    updated_sections: List[CVSection] = [
        CVSection(
            name=sec.name,
            entries=[CVEntry(type=e.type, text=e.text) for e in sec.entries]
        )
        for sec in cv.sections
    ]

    for change in changes:
        section_name = change.get("section", "").strip()
        final_text = (change.get("final_text") or change.get("suggested_text", "")).strip()
        orig_text = (change.get("original_text") or "").strip()
        entry_idx = change.get("entry_index")

        if not final_text:
            continue

        # Find target section case-insensitively
        target_sec = next(
            (s for s in updated_sections if s.name.lower() == section_name.lower()),
            None
        )

        if not target_sec:
            # Create section if not exists
            target_sec = CVSection(name=section_name or "Additional Highlights", entries=[])
            updated_sections.append(target_sec)

        # 1. If explicit entry_index provided and in bounds
        if entry_idx is not None and isinstance(entry_idx, int) and 0 <= entry_idx < len(target_sec.entries):
            target_sec.entries[entry_idx].text = final_text
            continue

        # 2. Try matching original_text within the section's entries
        matched = False
        if orig_text:
            clean_orig = re.sub(r'^[•\-\*▪▫–—\u2022]\s*', '', orig_text).strip()
            for entry in target_sec.entries:
                if clean_orig in entry.text or entry.text in clean_orig:
                    entry.text = final_text
                    matched = True
                    break

        if matched:
            continue

        # 3. Addition: Append as a new bullet entry, ensuring no material duplicate
        exists_already = any(
            final_text.lower() == e.text.lower() or
            (len(final_text) > 20 and final_text.lower() in e.text.lower())
            for e in target_sec.entries
        )
        if not exists_already:
            target_sec.entries.append(CVEntry(type="bullet", text=final_text))

    return ParsedCV(
        name=cv.name,
        headline=cv.headline,
        contact=cv.contact,
        sections=updated_sections
    )

def reorder_sections(cv: ParsedCV, template_mode: str = "input") -> ParsedCV:
    """
    Part 4: Reorders sections according to canonical structure if template_mode == 'fixed'.
    """
    if template_mode != "fixed":
        return cv

    ordered: List[CVSection] = []
    remaining: List[CVSection] = list(cv.sections)

    for canon in CANONICAL_ORDER:
        matched = [s for s in remaining if s.name.lower() == canon or canon in s.name.lower()]
        for m in matched:
            if m not in ordered:
                ordered.append(m)
                remaining.remove(m)

    # Append any custom or unmapped sections
    ordered.extend(remaining)

    return ParsedCV(
        name=cv.name,
        headline=cv.headline,
        contact=cv.contact,
        sections=ordered
    )

def escape_xml(text: str) -> str:
    """Escapes XML/HTML entities for ReportLab Paragraphs."""
    return (
        text.replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;')
    )

def format_subheading_text(text: str) -> str:
    """
    Formats job title / company / date subheadings nicely with bold title and italicized dates.
    """
    escaped = escape_xml(text)
    # Match date patterns at the end of the line (e.g. " | 2021 - Present" or "(2019 - 2023)")
    date_regex = re.compile(r'(\s*[\(\|\-]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[0-9]{4}).*?\)?)$', re.IGNORECASE)
    match = date_regex.search(escaped)
    if match:
        main_part = escaped[:match.start()].strip()
        date_part = match.group(1).strip()
        return f"<b>{main_part}</b> <font color='#64748b'><i>{date_part}</i></font>"
    return f"<b>{escaped}</b>"

def build_pdf_from_cv(parsed_cv: ParsedCV, template_mode: str = "input") -> bytes:
    """
    Part 3: Renders an ATS-friendly, beautifully aligned PDF from a structured ParsedCV model.
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        HRFlowable
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

    cv = reorder_sections(parsed_cv, template_mode=template_mode)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=32,
        bottomMargin=32
    )

    styles = getSampleStyleSheet()

    # Unified Design System Palette
    primary_color = colors.HexColor("#1e293b")   # Slate 800 (Headings, Name)
    accent_color = colors.HexColor("#2563eb")    # Blue 600 (Headline, Accent Rule)
    text_color = colors.HexColor("#334155")      # Slate 700 (Body, Bullets)
    subtext_color = colors.HexColor("#64748b")   # Slate 500 (Contact, Dates)
    rule_color = colors.HexColor("#cbd5e1")      # Slate 300 (Section Separators)

    # Standard Spacing Constants
    SPACE_HEADER_AFTER = 6
    SPACE_SECTION_BEFORE = 7
    SPACE_SECTION_AFTER = 3
    SPACE_SUBHEADING_BEFORE = 4
    SPACE_SUBHEADING_AFTER = 1.5
    SPACE_BULLET_AFTER = 2.5
    SPACE_PARAGRAPH_AFTER = 3.5

    # 1. Header Block Styles
    name_style = ParagraphStyle(
        'CVName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=21,
        textColor=primary_color,
        alignment=TA_CENTER,
        spaceAfter=1.5
    )

    headline_style = ParagraphStyle(
        'CVHeadline',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12.5,
        textColor=accent_color,
        alignment=TA_CENTER,
        spaceAfter=2.5
    )

    contact_style = ParagraphStyle(
        'CVContact',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.2,
        leading=10.5,
        textColor=subtext_color,
        alignment=TA_CENTER,
        spaceAfter=5
    )

    # 2. Section Styles
    section_header_style = ParagraphStyle(
        'CVSectionHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        textColor=primary_color,
        spaceBefore=SPACE_SECTION_BEFORE,
        spaceAfter=1,
        keepWithNext=True
    )

    subheading_style = ParagraphStyle(
        'CVSubheading',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=primary_color,
        spaceBefore=SPACE_SUBHEADING_BEFORE,
        spaceAfter=SPACE_SUBHEADING_AFTER,
        keepWithNext=True
    )

    bullet_style = ParagraphStyle(
        'CVBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.8,
        leading=12,
        textColor=text_color,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=SPACE_BULLET_AFTER
    )

    paragraph_style = ParagraphStyle(
        'CVParagraph',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.8,
        leading=12.5,
        textColor=text_color,
        alignment=TA_JUSTIFY,
        spaceAfter=SPACE_PARAGRAPH_AFTER
    )

    story = []

    # 1. Header Block (Name + Headline + Contact + Top Rule)
    candidate_name = cv.name or "Curriculum Vitae"
    story.append(Paragraph(escape_xml(candidate_name), name_style))

    if cv.headline:
        story.append(Paragraph(escape_xml(cv.headline), headline_style))

    if cv.contact:
        story.append(Paragraph(escape_xml(cv.contact), contact_style))

    story.append(HRFlowable(width="100%", thickness=1.2, color=accent_color, spaceAfter=SPACE_HEADER_AFTER, spaceBefore=1))

    # 2. Sections rendering
    for section in cv.sections:
        if not section.entries:
            continue

        story.append(Paragraph(escape_xml(section.name.upper()), section_header_style))
        story.append(HRFlowable(width="100%", thickness=0.6, color=rule_color, spaceAfter=SPACE_SECTION_AFTER, spaceBefore=0.5))

        for entry in section.entries:
            clean_text_content = entry.text.strip()
            if not clean_text_content:
                continue

            if entry.type == "bullet":
                story.append(Paragraph(f"&bull; {escape_xml(clean_text_content)}", bullet_style))
            elif entry.type == "subheading":
                story.append(Paragraph(format_subheading_text(clean_text_content), subheading_style))
            else:
                story.append(Paragraph(escape_xml(clean_text_content), paragraph_style))

    doc.build(story)
    return buffer.getvalue()

def generate_tailored_pdf(
    cv_data: Union[str, Dict[str, Any], ParsedCV],
    approved_changes: List[Dict[str, Any]],
    template_mode: str = "input"
) -> bytes:
    """
    Main entry point: applies approved changes to structured CV and renders a standardized PDF.
    """
    if isinstance(cv_data, ParsedCV):
        structured_cv = cv_data
    elif isinstance(cv_data, dict):
        structured_cv = ParsedCV(**cv_data)
    elif isinstance(cv_data, str):
        structured_cv = structure_cv_text(cv_data)
    else:
        structured_cv = ParsedCV(name="Candidate", sections=[])

    updated_cv = apply_changes_to_cv(structured_cv, approved_changes)
    return build_pdf_from_cv(updated_cv, template_mode=template_mode)

def build_pdf_from_cv_text(cv_text: str) -> bytes:
    """Backward compatibility wrapper."""
    return generate_tailored_pdf(cv_text, [])

def apply_changes_to_text(original_text: str, changes: List[Dict[str, Any]]) -> str:
    """Backward compatibility wrapper for text string manipulation."""
    cv = structure_cv_text(original_text)
    updated_cv = apply_changes_to_cv(cv, changes)
    from api.services.parser import cv_to_plain_text
    return cv_to_plain_text(updated_cv)
