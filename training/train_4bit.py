"""
Mistral LoRA Training - 4-bit Quantized (Memory Optimized)
===========================================================
Uses BitsAndBytes 4-bit quantization for ultra-low memory footprint

Usage:
    python train_4bit.py --epochs 1 --batch-size 1
"""

import os
import json
import argparse
import logging
from pathlib import Path
from typing import List
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


class QuantizedLoRATrainer:
    """LoRA trainer with 4-bit quantization for low-memory systems"""
    
    def __init__(
        self,
        model_name: str = "mistralai/Mistral-7B-Instruct-v0.1",
        adapter_save_dir: str = "./adapters",
        data_dir: str = "../data",
    ):
        """Initialize with 4-bit quantization"""
        
        self.model_name = model_name
        self.adapter_save_dir = Path(adapter_save_dir)
        self.data_dir = Path(data_dir)
        
        self.adapter_save_dir.mkdir(parents=True, exist_ok=True)
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.version_dir = self.adapter_save_dir / f"mistral_lora_{self.timestamp}"
        self.version_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info("="*60)
        logger.info("TRAINING WITH 4-BIT QUANTIZATION")
        logger.info("="*60)
        logger.info(f"Model: {model_name}")
        logger.info(f"Save to: {self.version_dir}")
        
        # 4-bit quantization config
        logger.info("Configuring 4-bit quantization...")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
        )
        
        # Load tokenizer
        logger.info("Loading tokenizer...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Load model with 4-bit quantization
        logger.info("Loading model with 4-bit quantization (low memory)...")
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            quantization_config=bnb_config,
            device_map="auto",
            trust_remote_code=True,
        )
        
        logger.info("✅ Model loaded with 4-bit quantization!")
        logger.info(f"   Memory usage reduced by ~75%")
        
        # Setup LoRA
        logger.info("Setting up LoRA...")
        lora_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            bias="none",
            target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
            modules_to_save=["lm_head"],
        )
        
        self.model = get_peft_model(self.model, lora_config)
        self.model.print_trainable_parameters()
        
        logger.info("✅ LoRA configured successfully")
    
    def load_training_data(self) -> Dataset:
        """Load all training datasets"""
        
        dataset_files = [
            'customer_support_subset',
            'empathetic_dialogues',
            'human_vs_robot',
            'task_oriented_dialogues'
        ]
        
        all_texts = []
        
        for dataset_name in dataset_files:
            file_path = self.data_dir / f"{dataset_name}.json"
            
            if not file_path.exists():
                logger.warning(f"Dataset not found: {file_path}")
                continue
            
            logger.info(f"Loading: {dataset_name}")
            
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            count = 0
            for item in data:
                if isinstance(item, dict) and 'human' in item and 'bot' in item:
                    text = f"[INST] {item['human']} [/INST] {item['bot']}"
                    all_texts.append(text)
                    count += 1
            
            logger.info(f"   Loaded {count} examples")
        
        logger.info(f"Total: {len(all_texts)} training examples")
        return Dataset.from_dict({"text": all_texts})
    
    def train(self, dataset: Dataset, epochs: int = 1, batch_size: int = 1) -> None:
        """Train the model"""
        
        logger.info("Preparing training...")
        
        # Tokenize directly without multiprocessing (avoid Windows issues)
        def tokenize_fn(example):
            # Single example at a time to avoid Windows multiprocessing issues
            output = self.tokenizer(
                example["text"],
                padding=False,
                truncation=True,
                max_length=512,
            )
            output["labels"] = output["input_ids"].copy()
            return output
        
        logger.info("Tokenizing dataset...")
        # Process one example at a time to avoid Windows multiprocessing problems
        tokenized_data = []
        for i, example in enumerate(dataset):
            tokenized = tokenize_fn(example)
            tokenized_data.append(tokenized)
            if (i + 1) % 5 == 0:
                logger.info(f"Tokenized {i + 1}/{len(dataset)} examples")
        
        # Create dataset from tokenized data
        tokenized_dataset = Dataset.from_dict({
            "input_ids": [t["input_ids"] for t in tokenized_data],
            "attention_mask": [t["attention_mask"] for t in tokenized_data],
            "labels": [t["labels"] for t in tokenized_data],
        })
        
        logger.info(f"✅ Tokenized {len(tokenized_dataset)} examples")
        
        # Training args
        training_args = TrainingArguments(
            output_dir=str(self.version_dir / "checkpoints"),
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=2,
            learning_rate=2e-4,
            warmup_steps=10,
            logging_steps=1,
            save_steps=len(tokenized_dataset),
            save_total_limit=1,
            report_to=[],
            fp16=False,  # Disable FP16 for stability with 4-bit
            bf16=False,  # Disable BF16 too
            optim="adamw_8bit",
            gradient_checkpointing=False,  # Disable to avoid cache issues
            remove_unused_columns=False,
            max_grad_norm=1.0,
        )
        
        # Train
        logger.info("Starting training...")
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=tokenized_dataset,
            data_collator=DataCollatorForLanguageModeling(self.tokenizer, mlm=False),
        )
        
        trainer.train()
        logger.info("✅ Training completed!")
        
        # Save
        self._save_adapter()
    
    def _save_adapter(self) -> None:
        """Save adapter"""
        
        logger.info("Saving adapter...")
        
        adapter_path = self.version_dir / "adapter"
        self.model.save_pretrained(str(adapter_path))
        self.tokenizer.save_pretrained(str(adapter_path))
        
        config = {
            "model_name": self.model_name,
            "adapter_version": self.timestamp,
            "quantization": "4-bit NF4",
            "adapter_path": str(adapter_path),
        }
        
        with open(self.version_dir / "adapter_config.json", 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"✅ Adapter saved: {adapter_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=1)
    args = parser.parse_args()
    
    trainer = QuantizedLoRATrainer()
    dataset = trainer.load_training_data()
    
    if len(dataset) == 0:
        logger.error("No training data!")
        return
    
    trainer.train(dataset, epochs=args.epochs, batch_size=args.batch_size)
    
    logger.info("="*60)
    logger.info("✅ SUCCESS!")
    logger.info("Next step: python adapter_manager.py list")
    logger.info("="*60)


if __name__ == "__main__":
    main()
