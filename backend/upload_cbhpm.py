import pandas as pd
from supabase_client import supabase
import math

csv_path = r"c:\APP\Gestcon Doctor\backend\cbhpm_parsed.csv"

def upload_to_supabase():
    print("Iniciando upload da CBHPM para o Supabase...")
    try:
        df = pd.read_csv(csv_path, sep=";", encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(csv_path, sep=";", encoding="utf-16")
    
    # 1. Criar a Tabela Master CBHPM
    tabela_nome = "CBHPM 2022 (Agosto 2023)"
    
    # Verificar se já existe para evitar duplicidades
    resp = supabase.table("tabelas_preco").select("id").eq("nome_origem", tabela_nome).execute()
    if resp.data:
        tabela_id = resp.data[0]['id']
        print(f"Tabela já existe: {tabela_id}")
        # Limpar itens antigos se quisermos recriar
        # supabase.table("tabelas_preco_itens").delete().eq("tabela_preco_id", tabela_id).execute()
    else:
        nova_tabela = {
            "nome_origem": tabela_nome,
            "descricao": "Tabela base referencial com os códigos da CBHPM",
            "vigencia_inicio": "2023-08-01", 
            "status": "Ativa"
        }
        res_insert = supabase.table("tabelas_preco").insert(nova_tabela).execute()
        tabela_id = res_insert.data[0]['id']
        print(f"Nova Tabela CBHPM criada: {tabela_id}")

    # 2. Inserir itens em lotes (batch)
    records = []
    for index, row in df.iterrows():
        descricao = str(row['descricao']) if pd.notna(row['descricao']) else "Sem descrição"
        # Truncar descrições muito longas se houver
        if len(descricao) > 250:
             descricao = descricao[:247] + "..."
             
        records.append({
            "tabela_preco_id": tabela_id,
            "codigo": str(row['codigo']),
            "descricao": descricao,
            "valor": 0.00  # CBHPM base não tem valor monetário direto, só porte
        })

    # Inserindo de 500 em 500 para não estourar o limite da API
    batch_size = 500
    total = len(records)
    print(f"Enviando {total} itens em lotes de {batch_size}...")
    
    for i in range(0, total, batch_size):
        batch = records[i:i+batch_size]
        try:
            supabase.table("tabelas_preco_itens").upsert(batch, on_conflict="tabela_preco_id,codigo").execute()
            print(f"Lote {i} a {i+len(batch)} enviado.")
        except Exception as e:
            print(f"Erro no lote {i}: {e}")
            
    print("Upload concluído com sucesso!")

if __name__ == "__main__":
    upload_to_supabase()
