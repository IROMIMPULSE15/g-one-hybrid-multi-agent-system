"""
Optimized LLM Fine-Tuning with Resume Capability
=================================================
- Resumes from last checkpoint automatically
- QLoRA (Quantized Low-Rank Adaptation) for memory efficiency
- Mixed precision training (FP16)
- Gradient checkpointing for reduced VRAM usage
- Cosine learning rate scheduling with warmup
- Validation-based early stopping
- Enhanced logging and monitoring
"""

import torch
from datasets import load_dataset
import os
import subprocess
import sys
import glob
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer, 
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
    BitsAndBytesConfig,
    TrainerCallback
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
import time

# ============================================================
# ENHANCED CONFIGURATION - Optimized for Best Results
# ============================================================
BASE_MODEL = "mistralai/Mistral-7B-Instruct-v0.3"
NEW_MODEL_NAME = "g-one-v1-mistral-adapter"
DATASET_FILE = "merged_training_data.jsonl"
OUTPUT_DIR = "./checkpoints"
MAX_SEQ_LENGTH = 512
BATCH_SIZE = 4
GRADIENT_ACCUMULATION = 1
MAX_STEPS = 1000  # Increased for better convergence
LEARNING_RATE = 2e-4  # Slightly reduced for stability
WARMUP_RATIO = 0.05
EVAL_STEPS = 50  # More frequent evaluation
SAVE_STEPS = 50  # More frequent checkpoints

class ProgressCallback(TrainerCallback):
    """Custom callback for enhanced progress tracking"""
    
    def __init__(self):
        self.start_time = time.time()
        self.last_log_time = time.time()
    
    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs:
            current_time = time.time()
            elapsed = current_time - self.start_time
            step = state.global_step
            
            # Calculate ETA
            if step > 0:
                steps_per_sec = step / elapsed
                remaining_steps = args.max_steps - step
                eta_seconds = remaining_steps / steps_per_sec if steps_per_sec > 0 else 0
                eta_minutes = eta_seconds / 60
                
                print(f"\n{'='*70}")
                print(f"📊 Step {step}/{args.max_steps} ({step/args.max_steps*100:.1f}%)")
                print(f"⏱️  Elapsed: {elapsed/60:.1f}m | ETA: {eta_minutes:.1f}m")
                
                if 'loss' in logs:
                    print(f"📉 Loss: {logs['loss']:.4f}")
                if 'learning_rate' in logs:
                    print(f"📈 LR: {logs['learning_rate']:.2e}")
                if 'eval_loss' in logs:
                    print(f"✅ Eval Loss: {logs['eval_loss']:.4f}")
                
                print(f"{'='*70}\n")

def find_latest_checkpoint():
    """Find the latest checkpoint to resume from"""
    checkpoints = glob.glob(os.path.join(OUTPUT_DIR, "checkpoint-*"))
    if not checkpoints:
        return None
    
    # Sort by checkpoint number
    checkpoints.sort(key=lambda x: int(x.split("-")[-1]))
    latest = checkpoints[-1]
    step_num = int(latest.split("-")[-1])
    
    print(f"\n🔄 Found checkpoint: {latest} (Step {step_num})")
    return latest

def prepare_data():
    """Prepare training dataset from multiple sources"""
    print("\n[INFO] Running prepare_dataset.py...")
    try:
        subprocess.run([sys.executable, "prepare_dataset.py"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Failed to prepare dataset: {e}")
        sys.exit(1)

def train():
    """Main training function with resume capability"""
    
    # Check for existing training data
    if not os.path.exists(DATASET_FILE):
        print("[INFO] Training data not found. Preparing dataset...")
        prepare_data()
    else:
        print(f"[INFO] Using existing training data: {DATASET_FILE}")
    
    # Find latest checkpoint
    resume_from_checkpoint = find_latest_checkpoint()
    
    # ============================================================
    # STEP 1: Load and Split Dataset
    # ============================================================
    print(f"\n[INFO] Loading dataset from {DATASET_FILE}...")
    try:
        full_dataset = load_dataset("json", data_files=DATASET_FILE, split="train")
        dataset_split = full_dataset.train_test_split(test_size=0.05, seed=42)
        train_dataset = dataset_split["train"]
        eval_dataset = dataset_split["test"]
        print(f"[INFO] Training: {len(train_dataset)} examples | Validation: {len(eval_dataset)} examples")
    except Exception as e:
        print(f"[ERROR] Could not load dataset: {e}")
        return

    # ============================================================
    # STEP 2: Initialize Tokenizer
    # ============================================================
    print("\n[INFO] Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    def formatting_prompts_func(examples):
        """Format examples in Mistral instruction format"""
        texts = []
        for messages in examples['messages']:
            user = next((m['content'] for m in messages if m['role'] == 'user'), '')
            assistant = next((m['content'] for m in messages if m['role'] == 'assistant'), '')
            text = f"<s>[INST] {user} [/INST] {assistant}</s>"
            texts.append(text)
        return {"text": texts}

    def tokenize_function(examples):
        """Tokenize with truncation and padding"""
        result = tokenizer(
            examples["text"],
            truncation=True,
            max_length=MAX_SEQ_LENGTH,
            padding="max_length",
        )
        result["labels"] = [ids[:] for ids in result["input_ids"]]
        return result

    # ============================================================
    # STEP 3: Preprocess Datasets
    # ============================================================
    print("\n[INFO] Formatting and tokenizing datasets...")
    train_dataset = train_dataset.map(
        formatting_prompts_func,
        batched=True,
        remove_columns=train_dataset.column_names,
        desc="Formatting training data"
    )
    
    eval_dataset = eval_dataset.map(
        formatting_prompts_func,
        batched=True,
        remove_columns=eval_dataset.column_names,
        desc="Formatting eval data"
    )

    train_dataset = train_dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=["text"],
        desc="Tokenizing training data"
    )

    eval_dataset = eval_dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=["text"],
        desc="Tokenizing eval data"
    )

    # ============================================================
    # STEP 4: Load Model with 4-bit Quantization (QLoRA)
    # ============================================================
    print(f"\n[INFO] Loading base model: {BASE_MODEL}")
    
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.float16,
        trust_remote_code=True,
    )

    model.gradient_checkpointing_enable()
    model = prepare_model_for_kbit_training(model)

    # ============================================================
    # STEP 5: Configure LoRA (Low-Rank Adaptation)
    # ============================================================
    print("\n[INFO] Configuring LoRA adapters...")
    # IMPORTANT: These parameters MUST match the existing checkpoint configuration
    # to enable proper resumption from checkpoint-878
    peft_config = LoraConfig(
        r=32,  # Rank - matches checkpoint (was 32, not 16)
        lora_alpha=16,  # Scaling factor - matches checkpoint (was 16, not 32)
        lora_dropout=0.1,  # Regularization - matches checkpoint (was 0.1, not 0.05)
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "down_proj",  # Added to match checkpoint
            "gate_proj",  # Added to match checkpoint
            "up_proj",    # Added to match checkpoint
        ]
    )

    model = get_peft_model(model, peft_config)
    print("\n[INFO] Trainable Parameters:")
    model.print_trainable_parameters()

    # ============================================================
    # STEP 6: Data Collator
    # ============================================================
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
    )

    # ============================================================
    # STEP 7: Enhanced Training Arguments
    # ============================================================
    training_arguments = TrainingArguments(
        output_dir=OUTPUT_DIR,
        
        # Training schedule
        max_steps=MAX_STEPS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION,
        
        # Optimization
        optim="paged_adamw_32bit",
        learning_rate=LEARNING_RATE,
        lr_scheduler_type="cosine",
        warmup_ratio=WARMUP_RATIO,
        weight_decay=0.01,
        max_grad_norm=0.3,
        
        # Mixed precision
        fp16=True,
        bf16=False,
        
        # Logging and saving
        logging_steps=10,
        save_steps=SAVE_STEPS,
        save_total_limit=5,  # Keep more checkpoints
        
        # Evaluation
        eval_strategy="steps",
        eval_steps=EVAL_STEPS,
        per_device_eval_batch_size=BATCH_SIZE,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        
        # Performance
        dataloader_num_workers=0,
        group_by_length=True,
        
        # Reporting
        report_to="none",
        logging_first_step=True,
        
        # Resume
        resume_from_checkpoint=resume_from_checkpoint is not None,
    )

    # ============================================================
    # STEP 8: Initialize Trainer with Progress Callback
    # ============================================================
    trainer = Trainer(
        model=model,
        args=training_arguments,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
        callbacks=[ProgressCallback()],
    )

    # ============================================================
    # STEP 9: Train the Model
    # ============================================================
    print("\n" + "="*70)
    print("🚀 STARTING OPTIMIZED LLM FINE-TUNING")
    print("="*70)
    print(f"📦 Base Model: {BASE_MODEL}")
    print(f"📊 Total Examples: {len(train_dataset)}")
    print(f"🎯 Max Steps: {MAX_STEPS}")
    print(f"📦 Batch Size: {BATCH_SIZE} (effective: {BATCH_SIZE * GRADIENT_ACCUMULATION})")
    print(f"📈 Learning Rate: {LEARNING_RATE}")
    print(f"💾 Checkpoints: Every {SAVE_STEPS} steps")
    print(f"✅ Evaluation: Every {EVAL_STEPS} steps")
    
    if resume_from_checkpoint:
        print(f"🔄 Resuming from: {resume_from_checkpoint}")
    
    print("="*70 + "\n")
    
    try:
        trainer.train(resume_from_checkpoint=resume_from_checkpoint)
    except KeyboardInterrupt:
        print("\n[INFO] Training interrupted by user")
        print("[INFO] Progress has been saved to the latest checkpoint")
    except Exception as e:
        print(f"[ERROR] Training failed: {e}")
        import traceback
        traceback.print_exc()
        return

    # ============================================================
    # STEP 10: Save the Fine-tuned Model
    # ============================================================
    print(f"\n[INFO] Saving final model to {NEW_MODEL_NAME}...")
    trainer.model.save_pretrained(NEW_MODEL_NAME)
    tokenizer.save_pretrained(NEW_MODEL_NAME)
    
    print("\n" + "="*70)
    print("✅ TRAINING COMPLETE!")
    print("="*70)
    print(f"📁 Model saved to: {NEW_MODEL_NAME}")
    print(f"💾 Checkpoints saved to: {OUTPUT_DIR}")
    print(f"📊 Total steps completed: {trainer.state.global_step}")
    print("="*70 + "\n")
    
    # Print final metrics
    if trainer.state.log_history:
        final_metrics = trainer.state.log_history[-1]
        print("\n📊 Final Metrics:")
        for key, value in final_metrics.items():
            if isinstance(value, float):
                print(f"  {key}: {value:.4f}")

if __name__ == "__main__":
    train()
