import io
import re
from typing import Tuple

def parse_pdf(file_bytes: bytes) -> str:
    """Extracts plain text from a PDF file using pdfplumber."""
    import pdfplumber
    
    text_chunks = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            page_text = page.extract_text()
            if page_text:
                text_chunks.append(page_text.strip())
            
            # Also extract tables if present and not already captured
            tables = page.extract_tables()
            for table in tables:
                table_lines = []
                for row in table:
                    filtered_row = [str(cell).strip() for cell in row if cell is not None]
                    if filtered_row:
                        table_lines.append(" | ".join(filtered_row))
                if table_lines:
                    text_chunks.append("\n".join(table_lines))
                    
    extracted = "\n\n".join(text_chunks).strip()
    return clean_text(extracted)

def parse_docx(file_bytes: bytes) -> str:
    """Extracts plain text from a DOCX file using python-docx."""
    import docx
    
    doc = docx.Document(io.BytesIO(file_bytes))
    text_chunks = []
    
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            text_chunks.append(text)
            
    for table in doc.tables:
        for row in table.rows:
            row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_text:
                text_chunks.append(" | ".join(row_text))
                
    extracted = "\n".join(text_chunks).strip()
    return clean_text(extracted)

def clean_text(text: str) -> str:
    """Normalizes whitespace and removes unwanted artifacts."""
    # Replace multiple empty lines with double newline
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Replace weird unicode spaces
    text = text.replace('\xa0', ' ').replace('\u200b', '')
    return text.strip()

def extract_text_from_file(filename: str, file_bytes: bytes) -> Tuple[str, str]:
    """
    Determines file type from extension and extracts text.
    Returns (parsed_text, file_type).
    """
    lower_filename = filename.lower()
    if lower_filename.endswith(".pdf"):
        return parse_pdf(file_bytes), "application/pdf"
    elif lower_filename.endswith(".docx"):
        return parse_docx(file_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif lower_filename.endswith(".txt"):
        return clean_text(file_bytes.decode("utf-8", errors="ignore")), "text/plain"
    else:
        raise ValueError(f"Unsupported file format: {filename}. Please upload a PDF or DOCX file.")
