"""
Complete Answer Synthesis Pipeline - Correct Flow
==================================================
Flow:
1. Your Trained LLM answers
2. RAG answers
3. CoT (Chain of Thought) answers
4. External sources answer (if any)
5. Llama reviews ALL answers and creates BEST answer
6. Best answer returned to user
7. Best answer stored for retraining your LLM
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import requests

# Try vLLM for speed, fallback to Unsloth
try:
    from vllm import LLM, SamplingParams
    VLLM_AVAILABLE = True
except ImportError:
    VLLM_AVAILABLE = False
    from unsloth import FastLanguageModel
    import torch

class YourTrainedLLM:
    """STEP 1.1: Your fine-tuned Mistral model answers FIRST"""
    def __init__(self, adapter_path: str):
        print(f"[INFO] Loading YOUR trained LLM from {adapter_path}...")
        
        if VLLM_AVAILABLE:
            self.llm = LLM(model=adapter_path, gpu_memory_utilization=0.4)
            self.sampling_params = SamplingParams(temperature=0.7, top_p=0.9, max_tokens=256)
            self.use_vllm = True
        else:
            self.model, self.tokenizer = FastLanguageModel.from_pretrained(
                model_name=adapter_path,
                max_seq_length=1024,
                dtype=None,
                load_in_4bit=True,
            )
            FastLanguageModel.for_inference(self.model)
            self.use_vllm = False
    
    def answer(self, query: str) -> Dict:
        """Your LLM answers the question"""
        print(f"[STEP 1.1] Your Trained LLM answering...")
        
        prompt = f"<s>[INST] {query} [/INST]"
        
        if self.use_vllm:
            outputs = self.llm.generate([prompt], self.sampling_params)
            response = outputs[0].outputs[0].text.strip()
        else:
            inputs = self.tokenizer(prompt, return_tensors="pt").to("cuda")
            outputs = self.model.generate(**inputs, max_new_tokens=256, temperature=0.7, use_cache=True)
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            response = response.split("[/INST]")[-1].strip()
        
        return {
            "source": "Your Trained LLM",
            "answer": response,
            "confidence": 0.75,
            "method": "fine_tuned_mistral"
        }

class RAGSource:
    """STEP 1.2: RAG (Pinecone) answers SECOND"""
    def __init__(self, api_endpoint: str):
        self.api_endpoint = api_endpoint
        
    def answer(self, query: str) -> Dict:
        """RAG retrieves context and answers"""
        print(f"[STEP 1.2] RAG (Pinecone) answering...")
        
        try:
            response = requests.post(
                f"{self.api_endpoint}/api/voice-assistant",
                json={"query": query, "mode": "rag"},
                timeout=10
            )
            data = response.json()
            return {
                "source": "RAG (Pinecone)",
                "answer": data.get("response", ""),
                "confidence": data.get("confidence", 0.8),
                "context": data.get("context", []),
                "method": "retrieval_augmented_generation"
            }
        except Exception as e:
            print(f"[WARN] RAG failed: {e}")
            return {"source": "RAG (Pinecone)", "answer": "", "confidence": 0.0}

class CoTSource:
    """STEP 1.3: Chain of Thought reasoning answers THIRD"""
    def __init__(self, model_name: str = "meta-llama/Llama-3.2-3B-Instruct"):
        print(f"[INFO] Loading CoT model: {model_name}...")
        
        if VLLM_AVAILABLE:
            self.llm = LLM(model=model_name, gpu_memory_utilization=0.3)
            self.sampling_params = SamplingParams(temperature=0.3, max_tokens=512)
            self.use_vllm = True
        else:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="auto"
            )
            self.use_vllm = False
    
    def answer(self, query: str) -> Dict:
        """Chain of Thought reasoning"""
        print(f"[STEP 1.3] CoT (Chain of Thought) answering...")
        
        prompt = f"""Think step by step to answer this question:

Question: {query}

Let's break this down:
1. First, identify what is being asked
2. Then, recall relevant information
3. Finally, provide a clear answer

Answer:"""
        
        if self.use_vllm:
            outputs = self.llm.generate([prompt], self.sampling_params)
            response = outputs[0].outputs[0].text
        else:
            inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
            outputs = self.model.generate(**inputs, max_new_tokens=512, temperature=0.3)
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        return {
            "source": "CoT Reasoning",
            "answer": response,
            "confidence": 0.85,
            "method": "chain_of_thought"
        }

class ExternalSources:
    """STEP 1.4: External APIs answer FOURTH (optional)"""
    def __init__(self, providers: Dict[str, str]):
        self.providers = providers  # {"gemini": "api_key", ...}
    
    def answer(self, query: str) -> List[Dict]:
        """Get answers from external sources"""
        print(f"[STEP 1.4] External sources answering...")
        
        answers = []
        
        for provider, api_key in self.providers.items():
            try:
                if provider == "gemini":
                    import google.generativeai as genai
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-pro')
                    response = model.generate_content(query)
                    answers.append({
                        "source": f"External ({provider})",
                        "answer": response.text,
                        "confidence": 0.85,
                        "method": "external_api"
                    })
            except Exception as e:
                print(f"[WARN] {provider} failed: {e}")
        
        return answers

class LlamaReviewer:
    """STEP 2: Llama reviews ALL answers and creates BEST answer"""
    def __init__(self, model_name: str = "meta-llama/Llama-3.2-3B-Instruct"):
        print(f"[INFO] Loading Llama Reviewer: {model_name}...")
        
        if VLLM_AVAILABLE:
            self.llm = LLM(model=model_name, gpu_memory_utilization=0.3)
            self.sampling_params = SamplingParams(temperature=0.2, max_tokens=1024)
            self.use_vllm = True
        else:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="auto"
            )
            self.use_vllm = False
    
    def review_and_synthesize(self, query: str, all_answers: List[Dict]) -> Dict:
        """Llama reviews all answers and creates the BEST single answer"""
        print(f"\n[STEP 2] Llama reviewing {len(all_answers)} answers...")
        
        # Filter valid answers
        valid_answers = [a for a in all_answers if a.get("answer", "").strip()]
        
        if not valid_answers:
            return {
                "best_answer": "I don't have enough information to answer that.",
                "confidence": 0.0,
                "reasoning": "No valid answers received",
                "sources_used": []
            }
        
        # Build review prompt
        prompt = f"""You are an expert answer reviewer. You will receive multiple answers to the same question from different sources. Your job is to:
1. Analyze each answer for accuracy and completeness
2. Identify the best information from all answers
3. Create ONE BEST ANSWER that combines the strongest points

Question: {query}

Answers to review:
"""
        
        for i, ans in enumerate(valid_answers, 1):
            prompt += f"\n--- Answer {i} (from {ans['source']}, confidence: {ans['confidence']:.2f}) ---\n"
            prompt += f"{ans['answer']}\n"
        
        prompt += """
Now, create the BEST SINGLE ANSWER by:
- Taking the most accurate information
- Ensuring completeness
- Making it clear and well-structured
- Removing any contradictions

Respond in JSON format:
{
  "best_answer": "your synthesized answer here",
  "confidence": 0.95,
  "reasoning": "why this is the best answer",
  "sources_used": ["source1", "source2"]
}

JSON Response:"""
        
        # Get Llama's review
        if self.use_vllm:
            outputs = self.llm.generate([prompt], self.sampling_params)
            response = outputs[0].outputs[0].text
        else:
            inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
            outputs = self.model.generate(**inputs, max_new_tokens=1024, temperature=0.2)
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Parse JSON response
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            if start != -1 and end > start:
                result = json.loads(response[start:end])
                print(f"[SUCCESS] Llama created best answer (confidence: {result.get('confidence', 0):.2f})")
                return result
        except Exception as e:
            print(f"[WARN] Failed to parse Llama response: {e}")
        
        # Fallback: use highest confidence answer
        best = max(valid_answers, key=lambda x: x['confidence'])
        return {
            "best_answer": best['answer'],
            "confidence": best['confidence'],
            "reasoning": f"Selected highest confidence answer from {best['source']}",
            "sources_used": [best['source']]
        }

class LearningDatabase:
    """STEP 4: Store best answers for retraining YOUR LLM"""
    def __init__(self, db_path: str = "../data/learning/knowledge.db"):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        
    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                best_answer TEXT NOT NULL,
                confidence REAL,
                sources TEXT,
                reasoning TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_confidence ON conversations(confidence DESC)")
        conn.commit()
        conn.close()
        
    def store_for_training(self, query: str, best_answer: str, confidence: float, sources: List[str], reasoning: str):
        """Store best answer to retrain YOUR LLM later"""
        if confidence < 0.7:  # Only store high-quality answers
            print(f"[SKIP] Low confidence ({confidence:.2f}), not storing for training")
            return
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO conversations (query, best_answer, confidence, sources, reasoning)
            VALUES (?, ?, ?, ?, ?)
        """, (query, best_answer, confidence, json.dumps(sources), reasoning))
        conn.commit()
        conn.close()
        
        print(f"[STEP 4] ✅ Stored for training YOUR LLM (confidence: {confidence:.2f})")

class CompleteSynthesisSystem:
    """Main orchestrator - follows the correct flow"""
    def __init__(self, config: Dict):
        print("\n" + "="*60)
        print("Initializing Complete Synthesis System")
        print("="*60)
        
        # Initialize all components
        self.your_llm = YourTrainedLLM(config["adapter_path"]) if config.get("use_your_llm") else None
        self.rag = RAGSource(config["api_endpoint"]) if config.get("use_rag") else None
        self.cot = CoTSource(config.get("cot_model", "meta-llama/Llama-3.2-3B-Instruct")) if config.get("use_cot") else None
        self.external = ExternalSources(config.get("external_providers", {})) if config.get("use_external") else None
        self.llama_reviewer = LlamaReviewer(config.get("reviewer_model", "meta-llama/Llama-3.2-3B-Instruct"))
        self.learning_db = LearningDatabase(config.get("db_path", "../data/learning/knowledge.db"))
        
        print("="*60)
        print("✅ System Ready!")
        print("="*60 + "\n")
    
    def process_query(self, query: str) -> Dict:
        """
        Complete flow:
        1. Collect all answers
        2. Llama reviews and creates best answer
        3. Return to user
        4. Store for retraining
        """
        print(f"\n{'='*60}")
        print(f"QUERY: {query}")
        print(f"{'='*60}\n")
        
        # STEP 1: Collect ALL answers in parallel
        print("[STEP 1] Collecting answers from all sources...")
        all_answers = []
        
        if self.your_llm:
            all_answers.append(self.your_llm.answer(query))
        
        if self.rag:
            all_answers.append(self.rag.answer(query))
        
        if self.cot:
            all_answers.append(self.cot.answer(query))
        
        if self.external:
            all_answers.extend(self.external.answer(query))
        
        print(f"\n[STEP 1 COMPLETE] Collected {len(all_answers)} answers\n")
        
        # STEP 2: Llama reviews and creates BEST answer
        result = self.llama_reviewer.review_and_synthesize(query, all_answers)
        
        # STEP 3: Return to user (happens in API)
        print(f"\n[STEP 3] Returning best answer to user")
        
        # STEP 4: Store for retraining YOUR LLM
        self.learning_db.store_for_training(
            query,
            result["best_answer"],
            result["confidence"],
            result.get("sources_used", []),
            result.get("reasoning", "")
        )
        
        print(f"\n{'='*60}")
        print("PROCESS COMPLETE")
        print(f"{'='*60}\n")
        
        return {
            "synthesized_answer": result["best_answer"],
            "confidence": result["confidence"],
            "reasoning": result.get("reasoning", ""),
            "sources": result.get("sources_used", []),
            "all_answers": all_answers  # For debugging/transparency
        }

# Example usage
if __name__ == "__main__":
    config = {
        "use_your_llm": True,
        "adapter_path": "./g-one-v1-mistral-adapter",
        "use_rag": False,  # Enable when Pinecone configured
        "api_endpoint": "http://localhost:3000",
        "use_cot": True,
        "cot_model": "meta-llama/Llama-3.2-3B-Instruct",
        "use_external": False,
        "external_providers": {},  # {"gemini": "api_key"}
        "reviewer_model": "meta-llama/Llama-3.2-3B-Instruct",
        "db_path": "../data/learning/knowledge.db"
    }
    
    system = CompleteSynthesisSystem(config)
    
    # Test query
    result = system.process_query("What is diabetes?")
    
    print("\n" + "="*60)
    print("FINAL RESULT:")
    print("="*60)
    print(f"Answer: {result['synthesized_answer']}")
    print(f"Confidence: {result['confidence']:.2f}")
    print(f"Sources: {', '.join(result['sources'])}")
