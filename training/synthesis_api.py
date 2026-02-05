"""
FastAPI Backend for Complete Synthesis System
==============================================
Integrates with Next.js frontend automatically
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from complete_synthesis_system import CompleteSynthesisSystem
import os

app = FastAPI(
    title="V64 G-One Complete Synthesis API",
    description="Multi-source answer synthesis with automatic learning",
    version="2.0.0"
)

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize complete synthesis system
config = {
    "use_your_llm": True,
    "adapter_path": "./g-one-v1-mistral-adapter",
    "use_rag": False,  # Enable when Pinecone configured
    "api_endpoint": "http://localhost:3000",
    "use_cot": True,
    "cot_model": "meta-llama/Llama-3.2-3B-Instruct",
    "use_external": False,
    "external_providers": {},  # Add: {"gemini": "api_key"}
    "reviewer_model": "meta-llama/Llama-3.2-3B-Instruct",
    "db_path": "../data/learning/knowledge.db"
}

try:
    system = CompleteSynthesisSystem(config)
    print("✅ Complete synthesis system initialized")
except Exception as e:
    print(f"⚠️ System initialization failed: {e}")
    system = None

class QueryRequest(BaseModel):
    query: str
    mode: str = "synthesis"  # synthesis, simple, rag, cot

class QueryResponse(BaseModel):
    synthesized_answer: str
    confidence: float
    reasoning: str = ""
    sources: list = []
    all_answers: list = []  # For transparency

@app.get("/")
async def root():
    return {
        "service": "V64 G-One Complete Synthesis API",
        "status": "running",
        "version": "2.0.0",
        "flow": [
            "1. Your Trained LLM answers",
            "2. RAG answers",
            "3. CoT answers",
            "4. External sources answer",
            "5. Llama reviews all and creates best answer",
            "6. Best answer returned to user",
            "7. Best answer stored for retraining"
        ]
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "synthesis_system": "ready" if system else "not initialized",
        "components": {
            "your_llm": system.your_llm is not None if system else False,
            "rag": system.rag is not None if system else False,
            "cot": system.cot is not None if system else False,
            "external": system.external is not None if system else False,
            "llama_reviewer": system.llama_reviewer is not None if system else False,
            "learning_db": system.learning_db is not None if system else False
        }
    }

@app.post("/synthesize", response_model=QueryResponse)
async def synthesize(request: QueryRequest):
    """
    Complete synthesis flow:
    1. Collect answers from all sources
    2. Llama reviews and creates best answer
    3. Return to user
    4. Store for retraining
    """
    if not system:
        raise HTTPException(status_code=503, detail="Synthesis system not initialized")
    
    try:
        result = system.process_query(request.query)
        
        return QueryResponse(
            synthesized_answer=result["synthesized_answer"],
            confidence=result["confidence"],
            reasoning=result.get("reasoning", ""),
            sources=result.get("sources", []),
            all_answers=result.get("all_answers", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def get_stats():
    """Get learning statistics"""
    if not system or not system.learning_db:
        raise HTTPException(status_code=503, detail="Learning database not available")
    
    import sqlite3
    conn = sqlite3.connect(system.learning_db.db_path)
    cursor = conn.cursor()
    
    # Total stored answers
    cursor.execute("SELECT COUNT(*) FROM conversations")
    total = cursor.fetchone()[0]
    
    # High confidence answers
    cursor.execute("SELECT COUNT(*) FROM conversations WHERE confidence >= 0.8")
    high_conf = cursor.fetchone()[0]
    
    # Average confidence
    cursor.execute("SELECT AVG(confidence) FROM conversations")
    avg_conf = cursor.fetchone()[0] or 0
    
    # Recent answers
    cursor.execute("SELECT query, confidence, timestamp FROM conversations ORDER BY timestamp DESC LIMIT 5")
    recent = cursor.fetchall()
    
    conn.close()
    
    return {
        "total_answers_stored": total,
        "high_confidence_answers": high_conf,
        "average_confidence": round(avg_conf, 2),
        "ready_for_retraining": total >= 100,
        "recent_queries": [
            {"query": r[0], "confidence": r[1], "timestamp": r[2]}
            for r in recent
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")
