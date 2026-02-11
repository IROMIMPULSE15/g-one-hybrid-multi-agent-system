"""
Mistral LoRA Fine-Tuning Module
================================
Trains Mistral-7B with LoRA adapters on custom data piles
without affecting the current production response system.

This builds an "insider LLM" for production-ready deployment after full training.

Usage:
    python train_mistral_lora.py --epochs 3 --batch-size 4
    python train_mistral_lora.py --data-set empathetic  # Train on specific dataset
"""

import os
import json
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime

import torch
import numpy as np
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from datasets import Dataset
from peft import get_peft_model, LoraConfig, TaskType

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MistralLoRATrainer:
    """Train Mistral-7B with LoRA adapters on custom datasets"""
    
    def __init__(
        self,
        model_name: str = "mistralai/Mistral-7B-Instruct-v0.1",
        adapter_save_dir: str = "./adapters",
        data_dir: str = "../data",
        device: str = "cuda" if torch.cuda.is_available() else "cpu"
    ):
        """
        Initialize the trainer.
        
        Args:
            model_name: HuggingFace model identifier
            adapter_save_dir: Directory to save trained adapters
            data_dir: Directory containing training data
            device: torch device (cuda/cpu)
        """
        self.model_name = model_name
        self.adapter_save_dir = Path(adapter_save_dir)
        self.data_dir = Path(data_dir)
        self.device = device
        
        # Create adapter directory if it doesn't exist
        self.adapter_save_dir.mkdir(parents=True, exist_ok=True)
        
        # Timestamp for versioning
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.version_dir = self.adapter_save_dir / f"mistral_lora_{self.timestamp}"
        self.version_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Trainer initialized for {model_name}")
        logger.info(f"Adapter save directory: {self.version_dir}")
        logger.info(f"Device: {self.device}")
        
        # Load tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        
        # Set pad token before loading model
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        logger.info("Loading model (this may take a minute)...")
        
        # Load model with proper device handling for memory optimization
        if self.device == "cuda":
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="auto",  # Automatically distributes across available memory
                trust_remote_code=True,
                low_cpu_mem_usage=True,
            )
        else:
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float32,
                trust_remote_code=True,
                low_cpu_mem_usage=True,
            ).to(self.device)
        
        logger.info("Model and tokenizer loaded successfully")
    
    def load_training_data(self, dataset_names: List[str] = None) -> Dataset:
        """
        Load training data from JSON files.
        
        Args:
            dataset_names: List of dataset names to load. If None, loads all.
                          Supported: 'customer_support', 'empathetic', 'human_vs_robot', 'task_oriented'
        
        Returns:
            Merged dataset
        """
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
            
            # Format conversation pairs
            for item in data:
                if isinstance(item, dict) and 'human' in item and 'bot' in item:
                    # Create conversational format for Mistral
                    text = f"""[INST] {item['human']} [/INST] {item['bot']}</s>"""
                    all_texts.append(text)
                    
                    logger.debug(f"Added conversation pair from {dataset_name}")
        
        logger.info(f"Total training examples: {len(all_texts)}")
        
        # Create dataset
        dataset = Dataset.from_dict({"text": all_texts})
        return dataset
    
    def tokenize_function(self, examples):
        """Tokenize text for training"""
        # Set pad token if not already set
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Tokenize the text
        outputs = self.tokenizer(
            examples["text"],
            padding=True,
            truncation=True,
            max_length=512,
        )
        
        # Add labels (same as input_ids for causal language modeling)
        outputs["labels"] = outputs["input_ids"].copy()
        return outputs
    
    def setup_lora(self) -> None:
        """Configure and apply LoRA to the model"""
        
        logger.info("Setting up LoRA configuration...")
        
        lora_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=16,  # LoRA rank
            lora_alpha=32,  # LoRA alpha (scaling)
            lora_dropout=0.05,  # Dropout
            bias="none",
            target_modules=["q_proj", "v_proj"],  # Mistral attention modules
            modules_to_save=["lm_head"],  # Save these modules
        )
        
        # Apply LoRA to model
        self.model = get_peft_model(self.model, lora_config)
        
        # Enable gradient checkpointing for memory efficiency
        if hasattr(self.model, 'gradient_checkpointing_enable'):
            self.model.gradient_checkpointing_enable()
        elif hasattr(self.model.base_model, 'gradient_checkpointing_enable'):
            self.model.base_model.gradient_checkpointing_enable()
        
        self.model.print_trainable_parameters()
        
        logger.info("LoRA applied successfully")
        logger.info("Gradient checkpointing enabled for memory efficiency")
    
    def train(
        self,
        dataset: Dataset,
        epochs: int = 3,
        batch_size: int = 4,
        learning_rate: float = 2e-4,
        warmup_steps: int = 100
    ) -> None:
        """
        Train the model with LoRA.
        
        Args:
            dataset: Training dataset
            epochs: Number of training epochs
            batch_size: Batch size
            learning_rate: Learning rate
            warmup_steps: Warmup steps
        """
        
        logger.info("Preparing dataset for training...")
        
        # Ensure pad token is set
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Tokenize dataset - use single process to avoid hanging
        logger.info("Tokenizing dataset...")
        tokenized_dataset = dataset.map(
            self.tokenize_function,
            batched=False,  # Process one example at a time for stability
            remove_columns=dataset.column_names,
            num_proc=None,  # Single process
            desc="Tokenizing"
        )
        
        logger.info(f"Tokenized dataset size: {len(tokenized_dataset)}")
        
        # Training arguments with memory optimization
        training_args = TrainingArguments(
            output_dir=str(self.version_dir / "checkpoints"),
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            learning_rate=learning_rate,
            warmup_steps=warmup_steps,
            weight_decay=0.01,
            logging_steps=1,
            save_steps=len(tokenized_dataset),  # Save after each epoch
            save_total_limit=2,
            logging_dir=str(self.version_dir / "logs"),
            report_to=[],  # Disable wandb/tensorboard
            optim="adamw_8bit",  # More memory efficient optimizer
            fp16=self.device == "cuda",  # Use mixed precision on GPU
            gradient_checkpointing=True,  # Memory efficient gradient computation
            gradient_accumulation_steps=2,  # Accumulate gradients
            max_grad_norm=1.0,
            load_best_model_at_end=False,
            remove_unused_columns=False,  # Keep all columns for data collator
        )
        
        # Create trainer
        logger.info("Creating trainer...")
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=tokenized_dataset,
            data_collator=DataCollatorForLanguageModeling(self.tokenizer, mlm=False),
        )
        
        logger.info("Starting training...")
        try:
            trainer.train()
            logger.info("Training completed successfully!")
        except Exception as e:
            logger.error(f"Training failed: {e}")
            raise
        
        # Save the adapter
        self._save_adapter()
    
    def _save_adapter(self) -> None:
        """Save the trained LoRA adapter"""
        
        logger.info("Saving trained adapter...")
        
        # Save LoRA adapter
        adapter_path = self.version_dir / "adapter"
        self.model.save_pretrained(str(adapter_path))
        self.tokenizer.save_pretrained(str(adapter_path))
        
        # Save adapter config
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
            "config": {
                "r": 16,
                "lora_alpha": 32,
                "lora_dropout": 0.05,
                "target_modules": ["q_proj", "v_proj"]
            }
        }
        
        config_path = self.version_dir / "adapter_config.json"
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"Adapter saved to: {adapter_path}")
        logger.info(f"Config saved to: {config_path}")
    
    def get_adapter_info(self) -> Dict:
        """Get information about the trained adapter"""
        config_path = self.version_dir / "adapter_config.json"
        if config_path.exists():
            with open(config_path, 'r') as f:
                return json.load(f)
        return {}


def main():
    parser = argparse.ArgumentParser(description="Train Mistral with LoRA adapters")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Batch size")
    parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--warmup-steps", type=int, default=100, help="Warmup steps")
    parser.add_argument("--adapter-dir", type=str, default="./adapters", help="Adapter save directory")
    parser.add_argument("--data-dir", type=str, default="../data", help="Data directory")
    parser.add_argument("--datasets", type=str, nargs="+", default=None, help="Specific datasets to train on")
    
    args = parser.parse_args()
    
    logger.info("="*60)
    logger.info("MISTRAL LoRA TRAINING - INSIDER LLM BUILDER")
    logger.info("="*60)
    
    # Initialize trainer
    trainer = MistralLoRATrainer(
        adapter_save_dir=args.adapter_dir,
        data_dir=args.data_dir
    )
    
    # Load training data
    dataset = trainer.load_training_data(dataset_names=args.datasets)
    
    if len(dataset) == 0:
        logger.error("No training data loaded. Exiting.")
        return
    
    # Setup LoRA
    trainer.setup_lora()
    
    # Train
    trainer.train(
        dataset=dataset,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        warmup_steps=args.warmup_steps
    )
    
    # Print adapter info
    adapter_info = trainer.get_adapter_info()
    logger.info("="*60)
    logger.info("TRAINING COMPLETE")
    logger.info("="*60)
    logger.info(f"Adapter saved: {adapter_info.get('adapter_path')}")
    logger.info(f"Version: {adapter_info.get('adapter_version')}")


if __name__ == "__main__":
    main()
