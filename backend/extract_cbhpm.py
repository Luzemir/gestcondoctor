import fitz  # PyMuPDF
import sys
import re

pdf_path = r"c:\APP\Gestcon Doctor\docs\CBHPM-2022_versao-agosto-2023.pdf"
out_path = r"c:\APP\Gestcon Doctor\backend\pdf_sample.txt"

print(f"Lendo: {pdf_path}")
try:
    doc = fitz.open(pdf_path)
    print(f"Total de Páginas: {len(doc)}")
    
    # Extract text from a sample of pages (e.g., pages 20-25 where tables usually are)
    text_sample = ""
    for i in range(20, min(30, len(doc))):
        page = doc[i]
        text_sample += f"\n--- PÁGINA {i+1} ---\n"
        text_sample += page.get_text()
        
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text_sample)
    print("Amostra extraída para pdf_sample.txt.")
except Exception as e:
    print(f"Erro ao ler PDF: {e}")
