from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import os
from dotenv import load_dotenv
from supabase_client import supabase

load_dotenv()

app = FastAPI(title="Gestcon Doctor API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependência para verificar autenticação via Supabase
async def get_current_user(token: str):
    try:
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido ou expirado",
            )
        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

@app.get("/")
async def root():
    return {"message": "Gestcon Doctor API Online", "version": "1.0.0"}

@app.get("/stats")
async def get_stats():
    # Placeholder para estatísticas reais do banco
    return {
        "medicos": 12,
        "hospitais": 5,
        "convenios": 8,
        "producao_mes": "R$ 45.200,00"
    }
