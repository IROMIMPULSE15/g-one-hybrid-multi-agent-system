import json
import sqlite3
import os
from pathlib import Path
from datasets import load_dataset

# Configuration
BASE_DIR = Path("..")  # Assuming script runs in /training
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "learning" / "knowledge.db"
JSON_PATH = DATA_DIR / "human_vs_robot.json"
OUTPUT_FILE = "merged_training_data.jsonl"

CONFIDENCE_THRESHOLD = 0.7   # Used only for filtering, not exposed

def load_json_data(path):
    print(f"[INFO] Loading existing training data from {path}...")
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            formatted = []
            for item in data:
                if 'human' in item and 'robot' in item:
                    formatted.append({
                        "messages": [
                            {"role": "user", "content": item['human']},
                            {"role": "assistant", "content": item['robot']}
                        ],
                        "source": "human_vs_robot"
                    })
            print(f"[SUCCESS] Loaded {len(formatted)} examples from JSON.")
            return formatted
    except Exception as e:
        print(f"[ERROR] Failed to load JSON: {e}")
        return []

def load_sqlite_data(path):
    print(f"[INFO] Loading continuous learning data from {path}...")
    if not os.path.exists(path):
        print("[WARN] Learning database not found. Skipping.")
        return []
    
    try:
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        
        query = """
        SELECT query, response
        FROM conversations
        WHERE confidence >= ? AND feedback >= 0
        """
        
        cursor.execute(query, (CONFIDENCE_THRESHOLD,))
        rows = cursor.fetchall()
        
        formatted = []
        for query_text, response_text in rows:
            formatted.append({
                "messages": [
                    {"role": "user", "content": query_text},
                    {"role": "assistant", "content": response_text}
                ],
                "source": "continuous_learning_db"
            })
            
        print(f"[SUCCESS] Loaded {len(formatted)} high-quality examples from SQLite.")
        conn.close()
        return formatted
    except Exception as e:
        print(f"[ERROR] Failed to load SQLite: {e}")
        return []

def save_merged_data(data, output_path):
    print(f"[INFO] Saving {len(data)} merged examples to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        for entry in data:
            json.dump(entry, f, ensure_ascii=False)
            f.write('\n')
    print("[SUCCESS] Dataset ready for LLM fine-tuning.")

def load_pile_data(limit=5000):
    print(f"[INFO] Loading subset of The Pile (MiniPile) via Hugging Face (limit={limit})...")
    try:
        # Load streaming enabled to avoid massive downloads
        ds = load_dataset("JeanKaddour/minipile", split="train", streaming=True)
        
        formatted = []
        count = 0
        
        print("[INFO] Processing MiniPile stream...")
        for item in ds:
            if count >= limit:
                break
            
            text = item.get('text', '')
            if len(text) < 500: # Skip very short snippets
                continue
                
            # Create a "completion" style instruction
            # We take the first chunk as context and ask the model to continue/complete it
            # This aligns with the SFT format while teaching knowledge
            
            split_point = min(len(text) // 3, 500) # Use first 1/3 or 500 chars as prompt
            prompt_text = text[:split_point]
            completion_text = text[split_point:]
            
            formatted.append({
                "messages": [
                    {"role": "user", "content": f"Complete the following text:\n\n{prompt_text}..."},
                    {"role": "assistant", "content": completion_text}
                ],
                "source": "minipile"
            })
            count += 1
            
        print(f"[SUCCESS] Loaded {len(formatted)} examples from MiniPile.")
        return formatted

    except Exception as e:
        print(f"[ERROR] Failed to load MiniPile: {e}")
        return []

def main():
    print("[INFO] Starting Self-Learning Dataset Builder...")

    json_data = load_json_data(JSON_PATH)
    sqlite_data = load_sqlite_data(DB_PATH)
    pile_data = load_pile_data(limit=2000) # Start with 2000 to keep it fast but adding knowledge

    all_data = json_data + sqlite_data + pile_data

    # Deduplicate by user message
    seen = set()
    unique_data = []

    for item in all_data:
        try:
            # Safe access to nested structure
            if "messages" in item and len(item["messages"]) > 0:
                user_text = item["messages"][0]["content"]
                if user_text not in seen:
                    seen.add(user_text)
                    unique_data.append(item)
        except Exception as e:
            print(f"[WARN] Skipping malformed item: {e}")

    print(f"[INFO] Final unique training samples: {len(unique_data)}")

    save_merged_data(unique_data, OUTPUT_FILE)

if __name__ == "__main__":
    main()
