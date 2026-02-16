"""FreyAI Core — FastAPI Backend Entry Point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="FreyAI Backend",
    version="0.1.0",
    description="Backend API for FreyAI Visions SaaS MVP",
)

_allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health-check endpoint."""
    return {"status": "FreyAI Backend Active"}
