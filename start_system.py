#!/usr/bin/env python3
"""
Unified System Startup Script
==============================
Starts all components of the V64 G-One system:
1. Python synthesis backend (FastAPI)
2. Next.js frontend
3. Auto-retraining scheduler (optional)

Usage:
    python start_system.py
    python start_system.py --no-retrain  # Skip auto-retraining
"""

import subprocess
import sys
import os
import time
import signal
from pathlib import Path

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

def print_success(text):
    print(f"{Colors.OKGREEN}✅ {text}{Colors.ENDC}")

def print_info(text):
    print(f"{Colors.OKCYAN}ℹ️  {text}{Colors.ENDC}")

def print_warning(text):
    print(f"{Colors.WARNING}⚠️  {text}{Colors.ENDC}")

def print_error(text):
    print(f"{Colors.FAIL}❌ {text}{Colors.ENDC}")

# Store process references for cleanup
processes = []

def cleanup(signum=None, frame=None):
    """Cleanup all processes on exit"""
    print_header("Shutting Down System")
    for name, process in processes:
        if process and process.poll() is None:
            print_info(f"Stopping {name}...")
            process.terminate()
            try:
                process.wait(timeout=5)
                print_success(f"{name} stopped")
            except subprocess.TimeoutExpired:
                process.kill()
                print_warning(f"{name} force killed")
    sys.exit(0)

# Register cleanup handlers
signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

def check_dependencies():
    """Check if required dependencies are installed"""
    print_header("Checking Dependencies")
    
    # Check Python packages
    required_packages = ['fastapi', 'uvicorn', 'unsloth', 'transformers', 'peft']
    missing = []
    
    for package in required_packages:
        try:
            __import__(package)
            print_success(f"Python package '{package}' found")
        except ImportError:
            missing.append(package)
            print_error(f"Python package '{package}' missing")
    
    if missing:
        print_error(f"Missing packages: {', '.join(missing)}")
        print_info("Install with: pip install " + " ".join(missing))
        return False
    
    # Check Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        print_success(f"Node.js found: {result.stdout.strip()}")
    except FileNotFoundError:
        print_error("Node.js not found")
        return False
    
    return True

def start_synthesis_backend():
    """Start the Python FastAPI synthesis backend"""
    print_header("Starting Synthesis Backend")
    
    # Create the FastAPI server if it doesn't exist
    api_file = Path("training/synthesis_api.py")
    if not api_file.exists():
        print_info("Creating synthesis API...")
        create_synthesis_api()
    
    print_info("Starting FastAPI server on port 5000...")
    
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "synthesis_api:app", "--host", "0.0.0.0", "--port", "5000", "--reload"],
        cwd="training",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    processes.append(("Synthesis Backend", process))
    
    # Wait for server to start
    time.sleep(3)
    
    if process.poll() is None:
        print_success("Synthesis backend started on http://localhost:5000")
        return True
    else:
        print_error("Failed to start synthesis backend")
        return False

def start_nextjs_frontend():
    """Start the Next.js frontend"""
    print_header("Starting Next.js Frontend")
    
    print_info("Starting Next.js dev server on port 3000...")
    
    process = subprocess.Popen(
        ["npm", "run", "dev"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    processes.append(("Next.js Frontend", process))
    
    # Wait for server to start
    time.sleep(5)
    
    if process.poll() is None:
        print_success("Next.js frontend started on http://localhost:3000")
        return True
    else:
        print_error("Failed to start Next.js frontend")
        return False

def start_auto_retrainer():
    """Start the continuous retraining scheduler"""
    print_header("Starting Auto-Retrainer")
    print_info("Starting continuous retraining loop (checks every 60 mins)...")
    
    # Check if we should force retrain on startup
    args = [sys.executable, "continuous_retrain.py", "--loop", "3600"]
    
    process = subprocess.Popen(
        args,
        cwd="training",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    processes.append(("Auto-Retrainer", process))
    print_success("Auto-retrainer started in background")
    return True

def create_synthesis_api():
    """Create the FastAPI synthesis API file"""
    api_code = '''"""
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
'''
    
    with open("training/synthesis_api.py", "w") as f:
        f.write(api_code)
    
    print_success("Created synthesis_api.py")

def monitor_processes():
    """Monitor running processes and display logs"""
    print_header("System Running")
    print_success("All services started successfully!")
    print_info("Press Ctrl+C to stop all services")
    print()
    print_info("Services:")
    print("  - Synthesis Backend: http://localhost:5000")
    print("  - Next.js Frontend:  http://localhost:3000")
    print("  - Auto-Retrainer:    Running (every 60m)")
    print("  - API Docs:          http://localhost:5000/docs")
    print()
    
    try:
        while True:
            # Check if processes are still running
            for name, process in processes:
                if process.poll() is not None:
                    print_error(f"{name} has stopped unexpectedly!")
                    # Don't exit immediately if retrainer fails, but warn
                    if name != "Auto-Retrainer":
                        cleanup()
            
            time.sleep(5)
    except KeyboardInterrupt:
        cleanup()

def main():
    """Main entry point"""
    print_header("V64 G-One Unified System Startup")
    
    # Check dependencies
    if not check_dependencies():
        print_error("Dependency check failed. Please install missing packages.")
        sys.exit(1)
    
    # Start services
    if not start_synthesis_backend():
        print_error("Failed to start synthesis backend")
        cleanup()
        sys.exit(1)
    
    if not start_nextjs_frontend():
        print_error("Failed to start Next.js frontend")
        cleanup()
        sys.exit(1)
        
    # Start auto-retrainer if not disabled
    if "--no-retrain" not in sys.argv:
        start_auto_retrainer()
    else:
        print_warning("Auto-retraining disabled by argument")
    
    # Monitor processes
    monitor_processes()

if __name__ == "__main__":
    main()
