import fitz
import re
import pandas as pd

pdf_path = r"c:\APP\Gestcon Doctor\docs\CBHPM-2022_versao-agosto-2023.pdf"
out_csv = r"c:\APP\Gestcon Doctor\backend\cbhpm_parsed.csv"

def parse_cbhpm(pdf_path, out_csv):
    doc = fitz.open(pdf_path)
    code_pattern = re.compile(r'^\d\.\d{2}\.\d{2}\.\d{2}-\d$')
    porte_pattern = re.compile(r'^(\d{1,2}[A-C]|-)$') # 1A, 14C, or '-'
    
    data = []
    
    current_code = None
    current_desc = []
    
    # Process from page 25 (where actual tables begin) up to end
    for i in range(25, min(240, len(doc))):
        page = doc[i]
        lines = page.get_text().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if code_pattern.match(line):
                # If we had a previous code, but didn't save it because no porte was found
                # (e.g., a header code like 1.01.00.00-8), we ignore it or save it as header.
                # Let's just save right away
                if current_code and current_desc:
                    desc_str = " ".join(current_desc)
                    # Simple heuristic: if desc contains "OBSERVAÇÕES", it's a note, not a procedure
                    if "OBSERVAÇ" not in current_code and "OBSERVAÇ" not in desc_str:
                         data.append({"codigo": current_code, "descricao": desc_str})
                         
                current_code = line
                current_desc = []
            elif current_code:
                # Accumulate description
                # Stop accumulating if we hit a Porte or obvious other column like numbers (UCO, etc)
                # For basic import, we only need code and description.
                if porte_pattern.match(line) or (line.replace(',','').replace('.','').isdigit() and len(line) < 6):
                    # We hit a column value (porte, uco, etc). We can stop accumulating desc if we want.
                    # To be safe, let's just save the item
                    desc_str = " ".join(current_desc)
                    if "OBSERVAÇ" not in desc_str:
                        data.append({"codigo": current_code, "descricao": desc_str})
                    current_code = None
                    current_desc = []
                else:
                    if len(line) > 3 and "OBSERVAÇ" not in line: # avoid capturing page numbers or single chars
                        current_desc.append(line)

    # Some remaining code at the end
    if current_code and current_desc:
         desc_str = " ".join(current_desc)
         data.append({"codigo": current_code, "descricao": desc_str})
         
    df = pd.DataFrame(data)
    # Remove duplicates
    df = df.drop_duplicates(subset=["codigo"])
    df.to_csv(out_csv, index=False, sep=";", encoding="utf-8")
    print(f"Extração concluída: {len(df)} códigos encontrados.")
    print(df.head(10))

if __name__ == "__main__":
    parse_cbhpm(pdf_path, out_csv)
