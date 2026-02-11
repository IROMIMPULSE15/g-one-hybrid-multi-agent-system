"""
Mistral LoRA Fine-Tuning - Memory Optimized with Unsloth
=========================================================
Uses Unsloth for ultra-efficient training + 4-bit quantization
Trains on limited memory systems

Usage:
    python train_optimized.py --epochs 1 --batch-size 1
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
from peft import LoraConfig
from unsloth import FastLanguageModel
import warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class OptimizedLoRATrainer:
    """Ultra-memory-efficient LoRA training with Unsloth"""
    
    def __init__(
        self,
        model_name: str = "mistralai/Mistral-7B-Instruct-v0.1",
        adapter_save_dir: str = "./adapters",
        data_dir: str = "../data",
        max_seq_length: int = 512,
        load_in_4bit: bool = True,
    ):
        """Initialize with Unsloth for ultra-efficient training"""
        
        self.model_name = model_name
        self.adapter_save_dir = Path(adapter_save_dir)
        self.data_dir = Path(data_dir)
        self.max_seq_length = max_seq_length
        
        self.adapter_save_dir.mkdir(parents=True, exist_ok=True)
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.version_dir = self.adapter_save_dir / f"mistral_lora_{self.timestamp}"
        self.version_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Using Unsloth for ultra-efficient training")
        logger.info(f"Model: {model_name}")
        logger.info(f"4-bit Quantization: {load_in_4bit}")
        logger.info(f"Save directory: {self.version_dir}")
        
        # Load model with Unsloth
        self.model, self.tokenizer = FastLanguageModel.from_pretrained(
            model_name=model_name,
            max_seq_length=max_seq_length,
            dtype=torch.float16,
            load_in_4bit=load_in_4bit,
            trust_remote_code=True,
        )
        
        logger.info("✅ Model loaded with Unsloth (47% faster, 50% less memory!)")
        
        # Prepare for training
        FastLanguageModel.for_training(self.model)
        
        logger.info("Model ready for training")
    
    def load_training_data(self, dataset_names: List[str] = None) -> Dataset:
        """Load training data from JSON files"""
        
        if dataset_names is None:
            dataset_names = [
                'customer_support_subset',
                'empathetic_dialogues',
                'human_vs_robot',
                'task_oriented_dialogues'
            ]
        
        all_texts = []
        
        for dataset_name in dataset_names:
            file_path = self.data_dir / f"{dataset_name}.json"
            
            if not file_path.exists():
                logger.warning(f"Dataset not found: {file_path}")
                continue
            
            logger.info(f"Loading dataset: {file_path}")
            
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            count = 0
            for item in data:
                if isinstance(item, dict) and 'human' in item and 'bot' in item:
                    # Mistral chat format
                    text = f"[INST] {item['human']} [/INST] {item['bot']}"
                    all_texts.append({"text": text})
                    count += 1
            
            logger.info(f"Loaded {count} examples from {dataset_name}")
        
        logger.info(f"Total training examples: {len(all_texts)}")
        
        return Dataset.from_dict({"text": [ex["text"] for ex in all_texts]})
    
    def train(
        self,
        dataset: Dataset,
        epochs: int = 1,
        batch_size: int = 1,
        learning_rate: float = 2e-4,
        warmup_steps: int = 10,
    ) -> None:
        """Train with Unsloth optimized trainer"""
        
        logger.info("Preparing for training...")
        
        # Setup for training
        from transformers import TrainingArguments, Trainer, DataCollatorForLanguageModeling
        
        training_args = TrainingArguments(
            output_dir=str(self.version_dir / "checkpoints"),
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=2,
            learning_rate=learning_rate,
            warmup_steps=warmup_steps,
            weight_decay=0.01,
            logging_steps=1,
            save_steps=len(dataset),
            save_total_limit=1,
            logging_dir=str(self.version_dir / "logs"),
            report_to=[],
            optim="adamw_8bit",
            fp16=True,
            gradient_checkpointing=True,
            remove_unused_columns=False,
        )
        
        # Tokenize dataset
        logger.info("Tokenizing dataset...")
        
        def tokenize_fn(examples):
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            result = self.tokenizer(
                examples["text"],
                padding=True,
                truncation=True,
                max_length=self.max_seq_length,
                return_tensors=None,
            )
            result["labels"] = result["input_ids"].copy()
            return result
        
        tokenized_dataset = dataset.map(
            tokenize_fn,
            remove_columns=["text"],
            num_proc=1,
            desc="Tokenizing",
        )
        
        logger.info(f"Tokenized {len(tokenized_dataset)} examples")
        
        # Create trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=tokenized_dataset,
            data_collator=DataCollatorForLanguageModeling(self.tokenizer, mlm=False),
        )
        
        logger.info("Starting Unsloth training...")
        trainer.train()
        
        logger.info("✅ Training completed!")
        self._save_adapter()
    
    def _save_adapter(self) -> None:
        """Save trained adapter"""
        
        logger.info("Saving adapter...")
        
        adapter_path = self.version_dir / "adapter"
        self.model.save_pretrained(str(adapter_path))
        self.tokenizer.save_pretrained(str(adapter_path))
        
        # Save config
        config = {
            "model_name": self.model_name,
            "adapter_version": self.timestamp,
            "training_datasets": [
                "customer_support_subset",
                "empathetic_dialogues",
                "human_vs_robot",
                "task_oriented_dialogues"
            ],
            "adapter_path": str(adapter_path),
            "max_seq_length": self.max_seq_length,
            "framework": "unsloth",
        }
        
        config_path = self.version_dir / "adapter_config.json"
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"✅ Adapter saved: {adapter_path}")
        logger.info(f"✅ Config saved: {config_path}")


def main():
    parser = argparse.ArgumentParser(description="Train Mistral with Unsloth optimization")
    parser.add_argument("--epochs", type=int, default=1, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=1, help="Batch size")
    parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--warmup", type=int, default=10, help="Warmup steps")
    parser.add_argument("--adapter-dir", type=str, default="./adapters", help="Adapter save dir")
    parser.add_argument("--data-dir", type=str, default="../data", help="Data directory")
    
    args = parser.parse_args()
    
    logger.info("="*60)
    logger.info("MISTRAL LoRA TRAINING - UNSLOTH OPTIMIZED")
    logger.info("="*60)
    
    try:
        # Initialize trainer
        trainer = OptimizedLoRATrainer(
            adapter_save_dir=args.adapter_dir,
            data_dir=args.data_dir,
            load_in_4bit=True,
        )
        
        # Load data
        dataset = trainer.load_training_data()
        
        if len(dataset) == 0:
            logger.error("No training data loaded!")
            return
        
        # Train
        trainer.train(
            dataset=dataset,
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.lr,
            warmup_steps=args.warmup,
        )
        
        logger.info("="*60)
        logger.info("✅ TRAINING COMPLETE")
        logger.info("="*60)
        logger.info("Next: python adapter_manager.py list")
        logger.info("Then:  python adapter_manager.py activate <version>")
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise


if __name__ == "__main__":
    main()
