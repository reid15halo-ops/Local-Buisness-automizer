"""FreyAI Core — FastAPI Backend Entry Point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="FreyAI Backend",
    version="0.1.0",
    description="Backend API for FreyAI Visions SaaS MVP",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health-check endpoint."""
    return {"status": "FreyAI Backend Active"}
