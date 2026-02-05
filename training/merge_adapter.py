import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import os

# Configuration
BASE_MODEL = "mistralai/Mistral-7B-Instruct-v0.3" # Must match training
ADAPTER_DIR = "./g-one-v1-mistral-adapter"     # Output from the notebook
OUTPUT_DIR = "./g-one-v1-merged"               # Where to save the full model

def main():
    print(f"🚀 Starting Merge Process...")
    print(f"   Base: {BASE_MODEL}")
    print(f"   Adapter: {ADAPTER_DIR}")
    
    if not os.path.exists(ADAPTER_DIR):
        print(f"❌ Adapter directory not found: {ADAPTER_DIR}")
        print("   Did you run the Jupyter Notebook training steps yet?")
        return

    # 1. Load Base Model (Full Precision for merging)
    print("⏳ Loading base model (this may take time)...")
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        low_cpu_mem_usage=True,
        return_dict=True,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True
    )
    
    # 2. Load Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
    
    # 3. Load Adapter
    print("🔗 Loading LoRA adapter...")
    model = PeftModel.from_pretrained(base_model, ADAPTER_DIR)
    
    # 4. Merge
    print("🧩 Merging adapter into base model...")
    model = model.merge_and_unload()
    
    # 5. Save
    print(f"💾 Saving full merged model to {OUTPUT_DIR}...")
    model.save_pretrained(OUTPUT_DIR, safe_serialization=True)
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    print("✅ Merge Complete! You can now convert this folder to GGUF for Ollama.")

if __name__ == "__main__":
    main()
