"""
Medical Agent API Server
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

# Load environment variables
load_dotenv()

app = FastAPI(title="Medical Agent API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "medical-agent"}


@app.post("/api/chat")
async def chat(message: dict):
    """Chat endpoint for medical queries"""
    try:
        user_message = message.get("message", "")
        # TODO: Implement medical agent logic
        return {
            "response": f"Processing: {user_message}",
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e), "status": "error"}


@app.post("/api/analyze")
async def analyze(data: dict):
    """Analyze medical data endpoint"""
    try:
        # TODO: Implement analysis logic
        return {
            "analysis": "Medical analysis",
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e), "status": "error"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
