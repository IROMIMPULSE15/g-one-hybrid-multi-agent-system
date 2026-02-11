"""
Complete Synthesis System Integration
======================================
Integrates multiple answer sources:
1. Your trained Mistral LoRA adapter
2. RAG (Retrieval Augmented Generation)
3. Chain-of-Thought reasoning
4. External providers (Google, OpenAI, etc.)
5. Review & synthesis with Llama
6. Auto-retraining on best answers
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import sqlite3

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
from peft import PeftModel

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CompleteSynthesisSystem:
    """Complete synthesis system integrating all answer sources"""
    
    def __init__(self, config: Dict):
        """
        Initialize the synthesis system.
        
        Args:
            config: Configuration dictionary with keys:
                - use_your_llm: bool - Use Mistral LoRA adapter
                - adapter_path: str - Path to adapter
                - use_rag: bool - Use RAG
                - use_cot: bool - Use Chain-of-Thought
                - cot_model: str - Model for CoT
                - use_external: bool - Use external providers
                - external_providers: Dict - Provider configs
                - reviewer_model: str - Model for reviewing answers
                - db_path: str - Path to learning database
        """
        self.config = config
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Initialize database
        self.db_path = config.get("db_path", "../data/learning/knowledge.db")
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_database()
        
        # Load your trained Mistral adapter
        if config.get("use_your_llm", False):
            self._load_mistral_adapter(config.get("adapter_path"))
        else:
            self.your_llm = None
        
        # Load CoT model
        if config.get("use_cot", False):
            self._load_cot_model(config.get("cot_model"))
        else:
            self.cot_model = None
        
        # Load reviewer model
        self.reviewer_model_name = config.get("reviewer_model")
        self.reviewer_model = None
        self.reviewer_tokenizer = None
        
        logger.info("Synthesis system initialized successfully")
    
    def _init_database(self):
        """Initialize SQLite database for learning"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create tables if they don't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS query_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                your_llm_answer TEXT,
                rag_answer TEXT,
                cot_answer TEXT,
                external_answer TEXT,
                final_answer TEXT NOT NULL,
                confidence REAL NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                feedback_score REAL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS retraining_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                answer TEXT NOT NULL,
                confidence REAL NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                used_for_training INTEGER DEFAULT 0
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info(f"Database initialized at {self.db_path}")
    
    def _load_mistral_adapter(self, adapter_path: str):
        """Load Mistral LoRA adapter"""
        try:
            logger.info(f"Loading Mistral adapter from {adapter_path}")
            
            model_name = "mistralai/Mistral-7B-Instruct-v0.1"
            
            # Load tokenizer
            self.your_llm_tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True
            )
            
            # Load base model
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="auto",
                trust_remote_code=True,
                low_cpu_mem_usage=True
            )
            
            # Load adapter
            self.your_llm = PeftModel.from_pretrained(
                model,
                adapter_path,
                is_trainable=False
            )
            
            logger.info("Mistral adapter loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Mistral adapter: {e}")
            self.your_llm = None
    
    def _load_cot_model(self, model_name: str):
        """Load Chain-of-Thought model"""
        try:
            logger.info(f"Loading CoT model: {model_name}")
            self.cot_model = pipeline(
                "text-generation",
                model=model_name,
                device=0 if self.device == "cuda" else -1,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32
            )
            logger.info("CoT model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load CoT model: {e}")
            self.cot_model = None
    
    def _load_reviewer_model(self):
        """Lazy load reviewer model"""
        if self.reviewer_model is None:
            try:
                logger.info(f"Loading reviewer model: {self.reviewer_model_name}")
                self.reviewer_tokenizer = AutoTokenizer.from_pretrained(
                    self.reviewer_model_name,
                    trust_remote_code=True
                )
                self.reviewer_model = AutoModelForCausalLM.from_pretrained(
                    self.reviewer_model_name,
                    torch_dtype=torch.float16,
                    device_map="auto" if self.device == "cuda" else None,
                    trust_remote_code=True
                )
                logger.info("Reviewer model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load reviewer model: {e}")
    
    async def answer_query(self, query: str, mode: str = "synthesis") -> Dict:
        """
        Answer a query using all available sources.
        
        Args:
            query: User query
            mode: 'synthesis' (all sources) or 'fast' (single source)
        
        Returns:
            Dictionary with synthesized answer and metadata
        """
        answers = {}
        confidence_scores = []
        
        # Get answer from your trained LLM
        if self.config.get("use_your_llm") and self.your_llm:
            try:
                answers["your_llm"] = self._get_your_llm_answer(query)
                confidence_scores.append(0.85)  # Default confidence
            except Exception as e:
                logger.error(f"Error with your LLM: {e}")
                answers["your_llm"] = None
        
        # Get RAG answer
        if self.config.get("use_rag"):
            try:
                answers["rag"] = await self._get_rag_answer(query)
                confidence_scores.append(0.80)
            except Exception as e:
                logger.error(f"Error with RAG: {e}")
                answers["rag"] = None
        
        # Get CoT answer
        if self.config.get("use_cot") and self.cot_model:
            try:
                answers["cot"] = self._get_cot_answer(query)
                confidence_scores.append(0.75)
            except Exception as e:
                logger.error(f"Error with CoT: {e}")
                answers["cot"] = None
        
        # Get external provider answers
        if self.config.get("use_external"):
            try:
                answers["external"] = await self._get_external_answers(query)
                confidence_scores.append(0.70)
            except Exception as e:
                logger.error(f"Error with external providers: {e}")
                answers["external"] = None
        
        # Synthesize final answer
        final_answer, confidence = self._synthesize_answers(query, answers)
        
        # Store for retraining if high confidence
        self._store_for_retraining(query, final_answer, confidence)
        
        return {
            "query": query,
            "synthesized_answer": final_answer,
            "confidence": confidence,
            "all_answers": answers,
            "timestamp": datetime.now().isoformat()
        }
    
    def _get_your_llm_answer(self, query: str) -> str:
        """Get answer from trained Mistral adapter"""
        if not self.your_llm:
            return None
        
        prompt = f"[INST] {query} [/INST]"
        
        inputs = self.your_llm_tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.your_llm.generate(
                **inputs,
                max_length=512,
                num_beams=4,
                temperature=0.7,
                top_p=0.95,
                do_sample=True
            )
        
        answer = self.your_llm_tokenizer.decode(
            outputs[0],
            skip_special_tokens=True
        )
        
        return answer.replace(prompt, "").strip()
    
    async def _get_rag_answer(self, query: str) -> str:
        """Get answer from RAG system (placeholder)"""
        logger.info("RAG system not fully implemented")
        return "RAG answer placeholder"
    
    def _get_cot_answer(self, query: str) -> str:
        """Get answer using Chain-of-Thought reasoning"""
        if not self.cot_model:
            return None
        
        prompt = f"""Solve this step by step:

Question: {query}

Step 1: Understanding the question...
Step 2: Breaking it down...
Step 3: Solution...
"""
        
        try:
            outputs = self.cot_model(
                prompt,
                max_length=512,
                temperature=0.7,
                do_sample=True,
                top_p=0.95
            )
            return outputs[0]["generated_text"].split("Step 3: Solution...")[-1].strip()
        except Exception as e:
            logger.error(f"Error in CoT: {e}")
            return None
    
    async def _get_external_answers(self, query: str) -> Dict:
        """Get answers from external providers (placeholder)"""
        logger.info("External providers not fully implemented")
        return {"status": "external_providers_disabled"}
    
    def _synthesize_answers(self, query: str, answers: Dict) -> Tuple[str, float]:
        """Synthesize final answer from all sources"""
        valid_answers = {k: v for k, v in answers.items() if v is not None}
        
        if not valid_answers:
            return "Unable to generate answer.", 0.0
        
        # If only one answer, use it
        if len(valid_answers) == 1:
            answer = list(valid_answers.values())[0]
            confidence = 0.75
            return answer, confidence
        
        # Simple synthesis: concatenate and let reviewer choose best
        synthesis_prompt = f"""Query: {query}

Available answers:
{json.dumps(valid_answers, indent=2)}

Which answer is best and why? Provide the best answer."""
        
        try:
            self._load_reviewer_model()
            inputs = self.reviewer_tokenizer(
                synthesis_prompt,
                return_tensors="pt",
                truncation=True,
                max_length=512
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self.reviewer_model.generate(
                    **inputs,
                    max_length=512,
                    num_beams=4,
                    temperature=0.7
                )
            
            final_answer = self.reviewer_tokenizer.decode(
                outputs[0],
                skip_special_tokens=True
            )
            
            confidence = min(0.95, len(valid_answers) * 0.25)
            return final_answer, confidence
        
        except Exception as e:
            logger.error(f"Error in synthesis: {e}")
            return list(valid_answers.values())[0], 0.7
    
    def _store_for_retraining(self, query: str, answer: str, confidence: float):
        """Store high-confidence answers for future retraining"""
        if confidence >= 0.80:
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO retraining_data (query, answer, confidence)
                    VALUES (?, ?, ?)
                ''', (query, answer, confidence))
                conn.commit()
                conn.close()
                logger.info(f"Stored answer for retraining (confidence: {confidence})")
            except Exception as e:
                logger.error(f"Error storing retraining data: {e}")
    
    def get_retraining_stats(self) -> Dict:
        """Get statistics on data collected for retraining"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM retraining_data WHERE used_for_training=0")
            new_samples = cursor.fetchone()[0]
            
            cursor.execute("SELECT AVG(confidence) FROM retraining_data")
            avg_conf = cursor.fetchone()[0] or 0.0
            
            cursor.execute('''
                SELECT COUNT(*) FROM retraining_data 
                WHERE confidence >= 0.90 AND used_for_training=0
            ''')
            high_conf = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                "new_samples_ready": new_samples,
                "average_confidence": round(avg_conf, 2),
                "high_confidence_samples": high_conf,
                "ready_for_retraining": new_samples >= 100
            }
        except Exception as e:
            logger.error(f"Error getting retraining stats: {e}")
            return {
                "new_samples_ready": 0,
                "average_confidence": 0.0,
                "high_confidence_samples": 0,
                "ready_for_retraining": False
            }
