"""
🔥 V64 G-One: REAL LLM Comparison Test
=======================================
Makes ACTUAL API calls to ALL LLM providers:
- Ollama (llama3.2:3b)
- OpenAI (gpt-4o-mini)
- Google Gemini (gemini-2.0-flash-exp)
- Llama/HuggingFace (Mistral-7B)
- V64 G-One (Multi-Agent with RAG + CoT)

This is a GENUINE test with real API responses!
"""

import requests
import json
import time
import os
from typing import Dict, List, Any
from datetime import datetime
import statistics


class RealLLMComparison:
    """GENUINE comparison with real API calls to all providers"""
    
    def __init__(self):
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "test_cases": [],
            "provider_summary": {},
            "overall_winner": {},
            "note": "REAL API CALLS - NOT SIMULATED"
        }
        
        # Load API keys from environment
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.hf_key = os.getenv("HUGGINGFACE_API_KEY")
        self.v64_url = "http://localhost:3000/api/voice-assistant"
        
        # Test queries covering "All Perspectives"
        self.test_queries = [
            {
                "query": "What is machine learning?",
                "type": "Simple Knowledge",
                "expected_keywords": ["algorithm", "data", "learn", "artificial intelligence"]
            },
            {
                "query": "What are the symptoms of type 2 diabetes?",
                "type": "Medical/Specialized",
                "expected_keywords": ["glucose", "insulin", "thirst", "urination", "blood"]
            },
            {
                "query": "Explain the difference between supervised and unsupervised learning",
                "type": "Comparison/Technical",
                "expected_keywords": ["labeled", "unlabeled", "data", "training"]
            },
            {
                "query": "How does a hash table work?",
                "type": "Technical/CS",
                "expected_keywords": ["key", "value", "bucket", "hash", "function", "index"]
            },
            {
                "query": "Write a short poem about coding",
                "type": "Creative/Generative",
                "expected_keywords": ["code", "bug", "screen", "loop", "syntax", "write"]
            },
            {
                "query": "Why is the sky blue? Explain like I'm 5.",
                "type": "Explanation/Reasoning",
                "expected_keywords": ["scattering", "sunlight", "atmosphere", "color", "rayleigh"]
            }
        ]

    def call_ollama(self, query: str) -> Dict[str, Any]:
        """Make REAL call to Ollama"""
        print("   📡 Calling Ollama...")
        start_time = time.time()
        
        try:
            # Short timeout for testing speed
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": query,
                    "stream": False,
                    "options": {"temperature": 0.7}
                },
                timeout=30
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "provider": "Ollama",
                    "model": "llama3.2:3b",
                    "response": data.get("response", ""),
                    "tokens_used": data.get("eval_count", 0),
                    "response_time": response_time,
                    "success": True,
                    "cost": 0.0
                }
            else:
                return {"success": False, "error": f"HTTP {response.status_code}", "provider": "Ollama"}
                
        except Exception as e:
            return {"success": False, "error": str(e), "provider": "Ollama"}
    
    def call_openai(self, query: str) -> Dict[str, Any]:
        """Make REAL call to OpenAI"""
        if not self.openai_key:
            return {"success": False, "error": "No API key", "provider": "OpenAI"}
        
        print("   📡 Calling OpenAI...")
        start_time = time.time()
        
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openai_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": query}],
                    "temperature": 0.7
                },
                timeout=30
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                tokens = data.get("usage", {}).get("total_tokens", 0)
                return {
                    "provider": "OpenAI",
                    "model": "gpt-4o-mini",
                    "response": data["choices"][0]["message"]["content"],
                    "tokens_used": tokens,
                    "response_time": response_time,
                    "success": True,
                    "cost": tokens * 0.00015 / 1000
                }
            else:
                return {"success": False, "error": f"HTTP {response.status_code}", "provider": "OpenAI"}
                
        except Exception as e:
            return {"success": False, "error": str(e), "provider": "OpenAI"}
    
    def call_gemini(self, query: str) -> Dict[str, Any]:
        """Make REAL call to Gemini"""
        if not self.gemini_key:
            return {"success": False, "error": "No API key", "provider": "Gemini"}
        
        print("   📡 Calling Gemini...")
        start_time = time.time()
        
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={self.gemini_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": query}]}],
                    "generationConfig": {"temperature": 0.7}
                },
                timeout=30
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                tokens = data.get("usageMetadata", {}).get("totalTokenCount", 0)
                return {
                    "provider": "Gemini",
                    "model": "gemini-2.0-flash-exp",
                    "response": text,
                    "tokens_used": tokens,
                    "response_time": response_time,
                    "success": True,
                    "cost": 0.0
                }
            else:
                return {"success": False, "error": f"HTTP {response.status_code}", "provider": "Gemini"}
                
        except Exception as e:
            return {"success": False, "error": str(e), "provider": "Gemini"}
    
    def call_huggingface(self, query: str) -> Dict[str, Any]:
        """Make REAL call to HuggingFace"""
        if not self.hf_key:
            return {"success": False, "error": "No API key", "provider": "Llama/HF"}
        
        print("   📡 Calling Llama/HuggingFace...")
        start_time = time.time()
        
        try:
            response = requests.post(
                "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
                headers={"Authorization": f"Bearer {self.hf_key}"},
                json={
                    "inputs": query,
                    "parameters": {"temperature": 0.7, "max_new_tokens": 500},
                    "options": {"wait_for_model": True}
                },
                timeout=60
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                text = data[0]["generated_text"] if isinstance(data, list) else data.get("generated_text", "")
                # Estimate tokens (HF doesn't always return count)
                tokens = len(text.split()) * 1.3  # Rough estimate
                return {
                    "provider": "Llama/HuggingFace",
                    "model": "Mistral-7B-Instruct",
                    "response": text,
                    "tokens_used": int(tokens),
                    "response_time": response_time,
                    "success": True,
                    "cost": tokens * 0.0001 / 1000
                }
            else:
                return {"success": False, "error": f"HTTP {response.status_code}", "provider": "Llama/HF"}
                
        except Exception as e:
            return {"success": False, "error": str(e), "provider": "Llama/HF"}
    
    def call_v64(self, query: str) -> Dict[str, Any]:
        """Make REAL call to V64 G-One"""
        print("   📡 Calling V64 G-One...")
        start_time = time.time()
        
        try:
            response = requests.post(
                self.v64_url,
                json={
                    "message": query,
                    "sessionId": f"test_{int(time.time())}"
                },
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                metadata = data.get("metadata", {})
                return {
                    "provider": "V64 G-One",
                    "model": metadata.get("model", "Multi-Agent"),
                    "response": data.get("response", ""),
                    "tokens_used": metadata.get("totalTokensUsed", 0),
                    "response_time": response_time,
                    "success": True,
                    "rag_used": metadata.get("ragResults", 0) > 0,
                    "cot_used": len(metadata.get("cotSteps", [])) > 0,
                    "cost": metadata.get("totalTokensUsed", 0) * 0.00005 / 1000
                }
            else:
                return {"success": False, "error": f"HTTP {response.status_code}", "provider": "V64 G-One"}
                
        except Exception as e:
            return {"success": False, "error": str(e), "provider": "V64 G-One"}
    
    def calculate_accuracy(self, response: str, expected_keywords: List[str]) -> float:
        """Calculate accuracy based on keyword presence"""
        if not response:
            return 0.0
        response_lower = response.lower()
        matches = sum(1 for kw in expected_keywords if kw.lower() in response_lower)
        return matches / len(expected_keywords) if expected_keywords else 0.0
    
    def run_comparison(self, test_case: Dict) -> Dict[str, Any]:
        """Run REAL comparison for a single test case"""
        query = test_case["query"]
        
        print(f"\n{'='*100}")
        print(f"📝 Test Query: {query}")
        print(f"   Type: {test_case['type']}")
        print(f"{'='*100}")
        
        # Call ALL providers with REAL APIs
        providers_results = {}
        
        # Ollama
        ollama_result = self.call_ollama(query)
        if ollama_result.get("success"):
            ollama_result["accuracy"] = self.calculate_accuracy(
                ollama_result["response"], 
                test_case["expected_keywords"]
            )
            providers_results["Ollama"] = ollama_result
        
        # OpenAI
        openai_result = self.call_openai(query)
        if openai_result.get("success"):
            openai_result["accuracy"] = self.calculate_accuracy(
                openai_result["response"], 
                test_case["expected_keywords"]
            )
            providers_results["OpenAI"] = openai_result
        
        # Gemini
        gemini_result = self.call_gemini(query)
        if gemini_result.get("success"):
            gemini_result["accuracy"] = self.calculate_accuracy(
                gemini_result["response"], 
                test_case["expected_keywords"]
            )
            providers_results["Gemini"] = gemini_result
        
        # HuggingFace
        hf_result = self.call_huggingface(query)
        if hf_result.get("success"):
            hf_result["accuracy"] = self.calculate_accuracy(
                hf_result["response"], 
                test_case["expected_keywords"]
            )
            providers_results["Llama/HuggingFace"] = hf_result
        
        # V64 G-One
        v64_result = self.call_v64(query)
        if v64_result.get("success"):
            v64_result["accuracy"] = self.calculate_accuracy(
                v64_result["response"], 
                test_case["expected_keywords"]
            )
            providers_results["V64 G-One"] = v64_result
        
        # Print comparison table
        print(f"\n{'Provider':<20} {'Tokens':<10} {'Time':<10} {'Accuracy':<12} {'Cost':<12}")
        print("-" * 100)
        
        for provider, result in providers_results.items():
            if result.get("success"):
                print(f"{provider:<20} {result['tokens_used']:<10} "
                      f"{result['response_time']:.2f}s{'':<6} "
                      f"{result.get('accuracy', 0):.1%}{'':<7} "
                      f"${result.get('cost', 0):.6f}")
        
        # Find winners
        if providers_results:
            best_accuracy = max(providers_results.items(), key=lambda x: x[1].get('accuracy', 0))
            best_tokens = min(providers_results.items(), key=lambda x: x[1].get('tokens_used', 999999))
            best_speed = min(providers_results.items(), key=lambda x: x[1].get('response_time', 999))
            
            print(f"\n🏆 WINNERS:")
            print(f"   🎯 Best Accuracy: {best_accuracy[0]} ({best_accuracy[1].get('accuracy', 0):.1%})")
            print(f"   💰 Most Efficient: {best_tokens[0]} ({best_tokens[1].get('tokens_used', 0)} tokens)")
            print(f"   ⚡ Fastest: {best_speed[0]} ({best_speed[1].get('response_time', 0):.2f}s)")
        
        return {
            "query": query,
            "type": test_case["type"],
            "providers": providers_results
        }
    
    def run_full_comparison(self) -> Dict[str, Any]:
        """Run complete REAL comparison"""
        print("\n" + "="*100)
        print("🔥 V64 G-ONE: REAL LLM COMPARISON TEST (GENUINE API CALLS)")
        print("="*100)
        print(f"Timestamp: {self.results['timestamp']}")
        print(f"Test Cases: {len(self.test_queries)}")
        print("⚠️  This will make REAL API calls and may consume credits!")
        print("="*100)
        
        for test_case in self.test_queries:
            result = self.run_comparison(test_case)
            self.results["test_cases"].append(result)
            time.sleep(2)  # Rate limiting
        
        # Calculate summary
        self._calculate_summary()
        
        return self.results
    
    def _calculate_summary(self):
        """Calculate aggregate statistics"""
        providers = set()
        for test in self.results["test_cases"]:
            providers.update(test["providers"].keys())
        
        for provider in providers:
            provider_data = []
            for test in self.results["test_cases"]:
                if provider in test["providers"] and test["providers"][provider].get("success"):
                    provider_data.append(test["providers"][provider])
            
            if provider_data:
                self.results["provider_summary"][provider] = {
                    "avg_tokens": statistics.mean(d["tokens_used"] for d in provider_data),
                    "avg_response_time": statistics.mean(d["response_time"] for d in provider_data),
                    "avg_accuracy": statistics.mean(d.get("accuracy", 0) for d in provider_data),
                    "total_cost": sum(d.get("cost", 0) for d in provider_data),
                    "tests_completed": len(provider_data)
                }
        
        # Print final summary
        print("\n\n" + "="*100)
        print("📊 FINAL REAL COMPARISON RESULTS")
        print("="*100)
        
        print(f"\n{'Provider':<20} {'Avg Tokens':<12} {'Avg Time':<12} {'Avg Accuracy':<15} {'Total Cost':<12}")
        print("-" * 100)
        
        for provider, summary in self.results["provider_summary"].items():
            print(f"{provider:<20} {summary['avg_tokens']:<12.0f} "
                  f"{summary['avg_response_time']:<12.2f}s "
                  f"{summary['avg_accuracy']:<15.1%} "
                  f"${summary['total_cost']:<11.6f}")
        
        # Find overall winner
        if self.results["provider_summary"]:
            best_accuracy = max(self.results["provider_summary"].items(), 
                               key=lambda x: x[1]["avg_accuracy"])
            print(f"\n🏆 OVERALL ACCURACY WINNER: {best_accuracy[0]} ({best_accuracy[1]['avg_accuracy']:.1%})")
        
        print("\n" + "="*100)
    
    def save_results(self, filename: str = None):
        """Save results to JSON"""
        if filename is None:
            filename = f"real_llm_comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        filepath = f"tests/{filename}"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Results saved to: {filepath}")
        return filepath


def main():
    """Main execution"""
    print("\n🔥 Starting REAL Multi-LLM Comparison Test...")
    print("⚠️  This will make ACTUAL API calls to all providers!")
    print("⚠️  Make sure:")
    print("   1. Ollama is running (ollama serve)")
    print("   2. V64 dev server is running (npm run dev)")
    print("   3. API keys are set in .env")
    
    print("   3. API keys are set in .env")
    
    # Process continues automatically
    
    comparison = RealLLMComparison()
    results = comparison.run_full_comparison()
    
    # Save results
    comparison.save_results()
    
    print("\n✅ REAL comparison completed!")
    print("\n📋 This is GENUINE data from actual API calls!")
    print("   Use these results for your jury presentation with confidence.")
    
    return results


if __name__ == "__main__":
    main()
