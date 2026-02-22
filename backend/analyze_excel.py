import pandas as pd
import sys

file_path = r"c:\APP\Gestcon Doctor\docs\Tabela Procedimentos.xlsx"
out_path = r"c:\APP\Gestcon Doctor\backend\excel_analysis_utf8.txt"

try:
    with open(out_path, "w", encoding="utf-8") as f:
        xl = pd.ExcelFile(file_path)
        f.write(f"Planilhas (Abas) encontradas: {xl.sheet_names}\n")
        
        for sheet in xl.sheet_names:
            f.write(f"\n--- Aba: {sheet} ---\n")
            df = pd.read_excel(file_path, sheet_name=sheet, nrows=5)
            f.write(f"Colunas: {list(df.columns)}\n")
            f.write("Primeiras 2 linhas:\n")
            f.write(df.head(2).to_string() + "\n")
    print("Concluído.")
except Exception as e:
    print(f"Erro ao ler arquivo Excel: {e}")
