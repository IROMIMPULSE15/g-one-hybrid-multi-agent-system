"""
Heavy-Duty Mistral LoRA Training - Deep Learning Optimization
=============================================================
Multi-epoch, high-throughput training with gradient accumulation
and advanced optimization for peak performance.

Usage:
    python train_heavy.py --epochs 5 --batch-size 2 --accumulation-steps 4
    python train_heavy.py --epochs 10 --batch-size 1 --accumulation-steps 8
"""

import os
import json
import argparse
import logging
from pathlib import Path
from typing import List, Dict
from datetime import datetime

import torch
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from peft import get_peft_model, LoraConfig, TaskType

import warnings
warnings.filterwarnings('ignore')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class HeavyLoRATrainer:
    """Heavy-duty LoRA trainer with gradient accumulation and optimization"""
    
    def __init__(
        self,
        model_name: str = "mistralai/Mistral-7B-Instruct-v0.1",
        adapter_save_dir: str = "./adapters",
        data_dir: str = "../data",
    ):
        """Initialize with 4-bit quantization for heavy training"""
        
        self.model_name = model_name
        self.adapter_save_dir = Path(adapter_save_dir)
        self.data_dir = Path(data_dir)
        
        self.adapter_save_dir.mkdir(parents=True, exist_ok=True)
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.version_dir = self.adapter_save_dir / f"mistral_heavy_{self.timestamp}"
        self.version_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info("="*70)
        logger.info("🔥 HEAVY-DUTY TRAINING - DEEP LEARNING OPTIMIZATION 🔥")
        logger.info("="*70)
        logger.info(f"Model: {model_name}")
        logger.info(f"Save to: {self.version_dir}")
        
        # 4-bit quantization config
        logger.info("\n📊 Configuring 4-bit NF4 quantization...")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,  # Double quantization
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
        )
        
        # Load tokenizer
        logger.info("Loading tokenizer...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Load model with 4-bit quantization
        logger.info("Loading model with 4-bit quantization...")
        try:
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                quantization_config=bnb_config,
                device_map="auto",
                trust_remote_code=True,
                attn_implementation="flash_attention_2",  # Faster attention if available
            )
        except ImportError:
            # Flash attention not available, use standard attention
            logger.warning("⚠️  Flash Attention 2 not available, using standard attention")
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                quantization_config=bnb_config,
                device_map="auto",
                trust_remote_code=True,
            )
        
        # Enable gradient checkpointing for memory efficiency
        self.model.gradient_checkpointing_enable()
        
        logger.info("✅ Model loaded with 4-bit quantization!")
        logger.info(f"   Memory usage reduced by ~75%")
        logger.info(f"   Gradient checkpointing enabled for efficiency\n")
        
        # Setup LoRA with larger rank for heavy training
        logger.info("⚙️  Setting up LoRA configuration (heavy)...")
        lora_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=32,  # Increased from 16 for heavier training
            lora_alpha=64,  # Proportional increase
            lora_dropout=0.1,  # Stronger regularization
            bias="none",
            target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
            modules_to_save=["lm_head"],
        )
        
        self.model = get_peft_model(self.model, lora_config)
        self.model.print_trainable_parameters()
        logger.info("✅ LoRA configured!\n")
    
    def load_training_data(self) -> Dataset:
        """Load all training datasets"""
        logger.info("📂 Loading training data...")
        
        all_examples = []
        
        json_files = [
            self.data_dir / "customer_support_subset.json",
            self.data_dir / "empathetic_dialogues.json",
            self.data_dir / "task_oriented_dialogues.json",
            self.data_dir / "human_vs_robot.json",
        ]
        
        for json_file in json_files:
            if json_file.exists():
                try:
                    with open(json_file, 'r') as f:
                        data = json.load(f)
                    if isinstance(data, list):
                        all_examples.extend(data)
                        logger.info(f"  ✓ {json_file.name}: {len(data)} examples")
                except Exception as e:
                    logger.warning(f"  ✗ {json_file.name}: {e}")
        
        logger.info(f"Total: {len(all_examples)} training examples\n")
        
        # Convert to huggingface Dataset
        texts = []
        for example in all_examples:
            if isinstance(example, dict):
                human = example.get("human", "")
                bot = example.get("bot", "")
                if human and bot:
                    # Format as conversation
                    text = f"[INST] {human} [/INST] {bot}"
                    texts.append({"text": text})
            elif isinstance(example, str):
                texts.append({"text": example})
        
        logger.info(f"✅ Processed {len(texts)} dialogue pairs")
        return Dataset.from_dict({"text": [t["text"] for t in texts]})
    
    def tokenize_data(self, dataset: Dataset, max_seq_length: int = 512) -> Dataset:
        """Tokenize dataset with sequential processing (Windows compatible)"""
        logger.info(f"\n🔤 Tokenizing dataset (max_seq_length={max_seq_length})...")
        
        def tokenize_fn(example):
            tokens = self.tokenizer(
                example["text"],
                truncation=True,
                max_length=max_seq_length,
                padding="max_length",
                return_tensors=None,
            )
            tokens["labels"] = tokens["input_ids"].copy()
            return tokens
        
        # Sequential tokenization (Windows compatible)
        tokenized = []
        for i, example in enumerate(dataset):
            if i % 5 == 0:
                logger.info(f"  Tokenized {i+1}/{len(dataset)} examples")
            tokenized.append(tokenize_fn(example))
        
        logger.info(f"  ✅ Tokenized {len(dataset)} examples\n")
        
        return Dataset.from_dict({
            "input_ids": [t["input_ids"] for t in tokenized],
            "attention_mask": [t["attention_mask"] for t in tokenized],
            "labels": [t["labels"] for t in tokenized],
        })
    
    def train(
        self,
        num_epochs: int = 5,
        per_device_batch_size: int = 1,
        gradient_accumulation_steps: int = 4,
        learning_rate: float = 5e-4,
        warmup_ratio: float = 0.1,
    ):
        """Heavy training with gradient accumulation"""
        
        logger.info("📚 Preparing training data...")
        dataset = self.load_training_data()
        tokenized_dataset = self.tokenize_data(dataset)
        
        # Calculate effective batch size
        effective_batch_size = per_device_batch_size * gradient_accumulation_steps
        logger.info(f"⚡ Effective batch size: {effective_batch_size}")
        logger.info(f"   (device batch: {per_device_batch_size} × accumulation steps: {gradient_accumulation_steps})\n")
        
        logger.info("🎯 Setting up training arguments...")
        training_args = TrainingArguments(
            output_dir=str(self.version_dir / "checkpoints"),
            overwrite_output_dir=True,
            
            # Heavy training parameters
            num_train_epochs=num_epochs,
            per_device_train_batch_size=per_device_batch_size,
            gradient_accumulation_steps=gradient_accumulation_steps,
            
            # Learning rate scheduling
            learning_rate=learning_rate,
            warmup_ratio=warmup_ratio,
            lr_scheduler_type="cosine",  # Cosine annealing
            
            # Optimization
            optim="paged_adamw_8bit",  # Memory-efficient optimizer
            weight_decay=0.01,
            max_grad_norm=1.0,
            
            # Logging and saving
            logging_steps=1,
            save_steps=500,  # Save frequently
            eval_strategy="no",
            save_strategy="steps",
            save_total_limit=3,
            
            # Precision
            fp16=False,  # Avoid precision issues
            bf16=True,  # Use bfloat16 if available
            
            # Other
            seed=42,
            dataloader_num_workers=0,  # Windows compatible
            remove_unused_columns=False,
        )
        
        logger.info("✅ Training arguments configured\n")
        
        # Data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False,
        )
        
        # Trainer
        logger.info("🚀 Initializing Trainer...")
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=tokenized_dataset,
            data_collator=data_collator,
        )
        
        logger.info("="*70)
        logger.info("🔥 STARTING HEAVY TRAINING 🔥")
        logger.info("="*70 + "\n")
        
        # Train
        train_result = trainer.train()
        
        logger.info("\n" + "="*70)
        logger.info("✅ TRAINING COMPLETED SUCCESSFULLY!")
        logger.info("="*70)
        logger.info(f"Training time: {train_result.training_loss:.2f} loss")
        logger.info(f"Training runtime: {train_result.training_loss:.2f} seconds\n")
        
        # Save adapter
        self._save_adapter(num_epochs, per_device_batch_size, gradient_accumulation_steps)
    
    def _save_adapter(self, epochs: int, batch_size: int, accumulation_steps: int):
        """Save LoRA adapter and metadata"""
        
        adapter_path = self.version_dir / "adapter"
        logger.info(f"💾 Saving LoRA adapter to {adapter_path}...")
        
        self.model.save_pretrained(str(adapter_path))
        self.tokenizer.save_pretrained(str(adapter_path))
        
        # Save metadata
        metadata = {
            "model_name": self.model_name,
            "adapter_version": self.timestamp,
            "training_type": "heavy_lora",
            "quantization": "4-bit NF4",
            "training_params": {
                "epochs": epochs,
                "batch_size": batch_size,
                "accumulation_steps": accumulation_steps,
                "effective_batch_size": batch_size * accumulation_steps,
            },
            "adapter_path": str(adapter_path),
        }
        
        with open(self.version_dir / "adapter_config.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"✅ Adapter saved: {adapter_path}")
        logger.info(f"\n📋 Metadata saved:\n")
        logger.info(json.dumps(metadata, indent=2))
        logger.info("\n" + "="*70)
        logger.info(f"✨ INSIDER LLM TRAINED: mistral_heavy_{self.timestamp}")
        logger.info("="*70)
        logger.info("\nNext steps:")
        logger.info(f"  1. python adapter_manager.py list")
        logger.info(f"  2. python adapter_manager.py activate {self.timestamp}")
        logger.info("="*70 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Heavy LoRA training for Mistral")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=1, help="Batch size per device")
    parser.add_argument("--accumulation-steps", type=int, default=4, help="Gradient accumulation steps")
    parser.add_argument("--learning-rate", type=float, default=5e-4, help="Learning rate")
    parser.add_argument("--warmup-ratio", type=float, default=0.1, help="Warmup ratio")
    
    args = parser.parse_args()
    
    trainer = HeavyLoRATrainer()
    trainer.train(
        num_epochs=args.epochs,
        per_device_batch_size=args.batch_size,
        gradient_accumulation_steps=args.accumulation_steps,
        learning_rate=args.learning_rate,
        warmup_ratio=args.warmup_ratio,
    )


if __name__ == "__main__":
    main()
