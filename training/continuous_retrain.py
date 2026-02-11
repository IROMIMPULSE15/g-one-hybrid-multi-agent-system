"""
Continuous Retraining Scheduler
================================
Monitors collected data and triggers Mistral LoRA retraining
when sufficient high-confidence examples are gathered.

Usage:
    python continuous_retrain.py --loop 3600        # Check every hour
    python continuous_retrain.py --once              # Single check
    python continuous_retrain.py --loop 300 --min 50 # Check every 5min, retrain at 50 examples
"""

import os
import sys
import json
import time
import argparse
import logging
import sqlite3
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ContinuousRetrainer:
    """Monitor and trigger retraining based on collected data"""
    
    def __init__(
        self,
        db_path: str = "../data/learning/knowledge.db",
        min_samples: int = 100,
        min_confidence: float = 0.80,
        adapter_dir: str = "./adapters",
        mistral_script: str = "train_mistral_lora.py"
    ):
        """
        Initialize continuous retrainer.
        
        Args:
            db_path: Path to learning database
            min_samples: Minimum samples needed to trigger retraining
            min_confidence: Minimum confidence threshold for samples
            adapter_dir: Directory to save trained adapters
            mistral_script: Path to Mistral LoRA training script
        """
        self.db_path = db_path
        self.min_samples = min_samples
        self.min_confidence = min_confidence
        self.adapter_dir = Path(adapter_dir)
        self.mistral_script = mistral_script
        
        self.adapter_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Continuous retrainer initialized")
        logger.info(f"  Database: {db_path}")
        logger.info(f"  Min samples for retrain: {min_samples}")
        logger.info(f"  Min confidence: {min_confidence}")
    
    def get_retraining_stats(self) -> Dict:
        """Get current retraining statistics"""
        try:
            if not Path(self.db_path).exists():
                logger.warning(f"Database not found: {self.db_path}")
                return {
                    "total_samples": 0,
                    "new_samples": 0,
                    "average_confidence": 0.0,
                    "high_confidence_samples": 0,
                    "ready_for_retrain": False
                }
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Total samples
            cursor.execute("SELECT COUNT(*) FROM retraining_data")
            total = cursor.fetchone()[0] or 0
            
            # New samples (not used for training)
            cursor.execute("SELECT COUNT(*) FROM retraining_data WHERE used_for_training=0")
            new = cursor.fetchone()[0] or 0
            
            # Average confidence
            cursor.execute("SELECT AVG(confidence) FROM retraining_data WHERE used_for_training=0")
            avg_conf = cursor.fetchone()[0] or 0.0
            
            # High confidence samples
            cursor.execute(f'''
                SELECT COUNT(*) FROM retraining_data 
                WHERE confidence >= {self.min_confidence} AND used_for_training=0
            ''')
            high_conf = cursor.fetchone()[0] or 0
            
            conn.close()
            
            return {
                "total_samples": total,
                "new_samples": new,
                "average_confidence": round(avg_conf, 2),
                "high_confidence_samples": high_conf,
                "ready_for_retrain": new >= self.min_samples
            }
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {
                "total_samples": 0,
                "new_samples": 0,
                "average_confidence": 0.0,
                "high_confidence_samples": 0,
                "ready_for_retrain": False
            }
    
    def prepare_retraining_dataset(self) -> Optional[str]:
        """
        Prepare dataset for retraining from collected samples.
        
        Returns:
            Path to generated training dataset or None if insufficient data
        """
        stats = self.get_retraining_stats()
        
        if not stats["ready_for_retrain"]:
            logger.info(f"Not ready for retrain yet: {stats['new_samples']}/{self.min_samples} samples")
            return None
        
        logger.info(f"Preparing retraining dataset ({stats['new_samples']} samples)")
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get samples for retraining
            cursor.execute('''
                SELECT query, answer FROM retraining_data 
                WHERE used_for_training=0 AND confidence >= ?
                ORDER BY confidence DESC
            ''', (self.min_confidence,))
            
            samples = cursor.fetchall()
            
            # Convert to training format
            training_data = []
            for query, answer in samples:
                training_data.append({
                    "human": query,
                    "bot": answer
                })
            
            # Save to JSON file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            dataset_path = self.adapter_dir.parent / f"retraining_batch_{timestamp}.json"
            
            with open(dataset_path, 'w') as f:
                json.dump(training_data, f, indent=2)
            
            logger.info(f"Created retraining dataset: {dataset_path}")
            
            # Mark samples as used
            cursor.execute('''
                UPDATE retraining_data 
                SET used_for_training=1 
                WHERE used_for_training=0 AND confidence >= ?
            ''', (self.min_confidence,))
            
            conn.commit()
            conn.close()
            
            return str(dataset_path)
        
        except Exception as e:
            logger.error(f"Error preparing retraining dataset: {e}")
            return None
    
    def trigger_mistral_retraining(self, dataset_path: str) -> bool:
        """
        Trigger Mistral LoRA retraining with new data.
        
        Args:
            dataset_path: Path to retraining dataset
        
        Returns:
            True if retraining started successfully
        """
        logger.info(f"Triggering Mistral LoRA retraining with {dataset_path}")
        
        try:
            # Load dataset to create proper format
            with open(dataset_path, 'r') as f:
                data = json.load(f)
            
            # Save formatted data
            formatted_path = dataset_path.replace('.json', '_formatted.json')
            with open(formatted_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Run training script
            cmd = [
                sys.executable,
                self.mistral_script,
                "--epochs", "2",
                "--batch-size", "4",
                "--custom-dataset", formatted_path
            ]
            
            logger.info(f"Running: {' '.join(cmd)}")
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            
            # Monitor training
            for line in process.stdout:
                logger.info(f"[TRAINING] {line.rstrip()}")
            
            returncode = process.wait()
            
            if returncode == 0:
                logger.info("Mistral LoRA retraining completed successfully!")
                return True
            else:
                logger.error(f"Mistral LoRA retraining failed with code {returncode}")
                return False
        
        except Exception as e:
            logger.error(f"Error triggering retraining: {e}")
            return False
    
    def check_and_retrain(self) -> bool:
        """
        Check if retraining is needed and trigger it.
        
        Returns:
            True if retraining was triggered and successful
        """
        stats = self.get_retraining_stats()
        
        logger.info("=" * 60)
        logger.info("RETRAINING STATUS CHECK")
        logger.info(f"  Total samples collected: {stats['total_samples']}")
        logger.info(f"  New samples ready: {stats['new_samples']}/{self.min_samples}")
        logger.info(f"  Average confidence: {stats['average_confidence']}")
        logger.info(f"  High confidence samples: {stats['high_confidence_samples']}")
        logger.info("=" * 60)
        
        if stats["ready_for_retrain"]:
            logger.info("✅ Ready for retraining!")
            
            # Prepare dataset
            dataset_path = self.prepare_retraining_dataset()
            
            if dataset_path:
                # Trigger retraining
                success = self.trigger_mistral_retraining(dataset_path)
                return success
        else:
            logger.info(f"⏳ Waiting for more samples...")
        
        return False
    
    def run_loop(self, interval_seconds: int = 3600):
        """
        Run continuous monitoring loop.
        
        Args:
            interval_seconds: Check interval in seconds (default: 1 hour)
        """
        logger.info(f"Starting continuous retraining loop (check every {interval_seconds}s)")
        
        check_count = 0
        retrain_count = 0
        
        try:
            while True:
                check_count += 1
                logger.info(f"\n[Check #{check_count}] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                
                if self.check_and_retrain():
                    retrain_count += 1
                    logger.info(f"✅ Retraining #{retrain_count} completed!")
                
                logger.info(f"Sleeping for {interval_seconds}s until next check...")
                time.sleep(interval_seconds)
        
        except KeyboardInterrupt:
            logger.info(f"\n\nStopped after {check_count} checks and {retrain_count} retrains")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Continuous Retraining Scheduler")
    parser.add_argument(
        "--loop",
        type=int,
        default=None,
        help="Run continuous loop with interval in seconds (e.g., 3600 for hourly)"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run single check and exit"
    )
    parser.add_argument(
        "--min",
        type=int,
        default=100,
        help="Minimum samples needed for retraining (default: 100)"
    )
    parser.add_argument(
        "--confidence",
        type=float,
        default=0.80,
        help="Minimum confidence threshold (default: 0.80)"
    )
    parser.add_argument(
        "--db",
        default="../data/learning/knowledge.db",
        help="Path to learning database"
    )
    
    args = parser.parse_args()
    
    retrainer = ContinuousRetrainer(
        db_path=args.db,
        min_samples=args.min,
        min_confidence=args.confidence
    )
    
    if args.loop:
        retrainer.run_loop(interval_seconds=args.loop)
    elif args.once:
        retrainer.check_and_retrain()
    else:
        # Default: run loop every hour
        retrainer.run_loop(interval_seconds=3600)


if __name__ == "__main__":
    main()
