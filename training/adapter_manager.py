"""
Adapter Manager - Switch Between Production & Insider LLM
==========================================================
Manages different LoRA adapter versions without affecting the current system.
Allows seamless switching between adapters for A/B testing and gradual rollout.

Usage:
    python adapter_manager.py --list                    # List all adapters
    python adapter_manager.py --activate <version>      # Activate a specific version
    python adapter_manager.py --compare v1 v2           # Compare two adapter versions
"""

import json
import shutil
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AdapterManager:
    """Manage LoRA adapter versions without affecting production"""
    
    def __init__(
        self,
        adapter_base_dir: str = "./adapters",
        production_link_path: str = "./g-one-v1-mistral-adapter"
    ):
        """
        Initialize adapter manager.
        
        Args:
            adapter_base_dir: Base directory containing all adapter versions
            production_link_path: Path to the symbolic link used by production system
        """
        self.adapter_base_dir = Path(adapter_base_dir)
        self.production_link_path = Path(production_link_path)
        
        self.adapter_base_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Adapter base directory: {self.adapter_base_dir}")
        logger.info(f"Production link path: {self.production_link_path}")
    
    def list_adapters(self) -> List[Dict]:
        """List all available adapters with metadata"""
        adapters = []
        
        for adapter_dir in self.adapter_base_dir.glob("mistral_lora_*"):
            config_path = adapter_dir / "adapter_config.json"
            
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config = json.load(f)
                
                is_active = (
                    self.production_link_path.is_symlink() and 
                    self.production_link_path.resolve() == (adapter_dir / "adapter").resolve()
                )
                
                adapters.append({
                    "version": config.get("adapter_version"),
                    "path": str(adapter_dir),
                    "is_active": is_active,
                    "datasets": config.get("training_datasets", []),
                    "created": adapter_dir.stat().st_mtime
                })
        
        return sorted(adapters, key=lambda x: x["created"], reverse=True)
    
    def activate_adapter(self, version: str) -> bool:
        """
        Activate a specific adapter version without affecting current system.
        
        Args:
            version: Timestamp version (e.g., "20240115_143022")
        
        Returns:
            True if successful, False otherwise
        """
        adapter_dir = self.adapter_base_dir / f"mistral_lora_{version}"
        adapter_path = adapter_dir / "adapter"
        
        if not adapter_path.exists():
            logger.error(f"Adapter not found: {adapter_path}")
            return False
        
        # Remove old symlink if it exists
        if self.production_link_path.is_symlink():
            self.production_link_path.unlink()
        elif self.production_link_path.exists():
            logger.warning(f"Production link path exists but is not a symlink: {self.production_link_path}")
            return False
        
        # Create new symlink
        self.production_link_path.symlink_to(adapter_path.resolve())
        
        logger.info(f"Activated adapter version: {version}")
        logger.info(f"Symlink created: {self.production_link_path} -> {adapter_path}")
        
        return True
    
    def get_active_adapter(self) -> Optional[Dict]:
        """Get information about the currently active adapter"""
        if not self.production_link_path.is_symlink():
            return None
        
        active_path = self.production_link_path.resolve()
        
        # Find matching adapter
        for adapter in self.list_adapters():
            if Path(adapter["path"]).resolve() == active_path.parent.resolve():
                return adapter
        
        return None
    
    def compare_adapters(self, version1: str, version2: str) -> Dict:
        """Compare two adapter versions"""
        adapters = {v["version"]: v for v in self.list_adapters()}
        
        if version1 not in adapters or version2 not in adapters:
            logger.error("One or both adapter versions not found")
            return {}
        
        adapter1 = adapters[version1]
        adapter2 = adapters[version2]
        
        comparison = {
            "version1": {
                "version": version1,
                "datasets": adapter1["datasets"],
                "created": datetime.fromtimestamp(adapter1["created"]).isoformat(),
                "is_active": adapter1["is_active"]
            },
            "version2": {
                "version": version2,
                "datasets": adapter2["datasets"],
                "created": datetime.fromtimestamp(adapter2["created"]).isoformat(),
                "is_active": adapter2["is_active"]
            },
            "differences": {
                "datasets_differ": adapter1["datasets"] != adapter2["datasets"],
                "creation_time_diff": abs(adapter1["created"] - adapter2["created"])
            }
        }
        
        return comparison
    
    def create_checkpoint(self, version: str, name: str) -> bool:
        """Create a named checkpoint of an adapter for safety"""
        adapter_dir = self.adapter_base_dir / f"mistral_lora_{version}"
        
        if not adapter_dir.exists():
            logger.error(f"Adapter not found: {adapter_dir}")
            return False
        
        checkpoint_path = self.adapter_base_dir / f"checkpoint_{name}_{version}"
        
        try:
            shutil.copytree(adapter_dir, checkpoint_path)
            logger.info(f"Checkpoint created: {checkpoint_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to create checkpoint: {e}")
            return False
    
    def get_adapter_info(self) -> Dict:
        """Get comprehensive adapter information"""
        return {
            "active_adapter": self.get_active_adapter(),
            "all_adapters": self.list_adapters(),
            "total_versions": len(self.list_adapters())
        }
    
    def print_adapters_table(self) -> None:
        """Print adapters in a formatted table"""
        adapters = self.list_adapters()
        
        if not adapters:
            logger.info("No adapters found")
            return
        
        logger.info("="*100)
        logger.info(f"{'Version':<20} {'Created':<25} {'Status':<15} {'Datasets':<35}")
        logger.info("="*100)
        
        for adapter in adapters:
            created = datetime.fromtimestamp(adapter["created"]).strftime("%Y-%m-%d %H:%M:%S")
            status = "🟢 ACTIVE" if adapter["is_active"] else "⚪ Inactive"
            datasets = ", ".join([d.replace("_", " ").title() for d in adapter["datasets"][:2]])
            if len(adapter["datasets"]) > 2:
                datasets += f" (+{len(adapter['datasets']) - 2})"
            
            logger.info(f"{adapter['version']:<20} {created:<25} {status:<15} {datasets:<35}")
        
        logger.info("="*100)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Manage LoRA adapter versions")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # List command
    subparsers.add_parser("list", help="List all adapters")
    
    # Activate command
    activate_parser = subparsers.add_parser("activate", help="Activate a specific adapter")
    activate_parser.add_argument("version", help="Adapter version (timestamp)")
    
    # Compare command
    compare_parser = subparsers.add_parser("compare", help="Compare two adapters")
    compare_parser.add_argument("version1", help="First adapter version")
    compare_parser.add_argument("version2", help="Second adapter version")
    
    # Checkpoint command
    checkpoint_parser = subparsers.add_parser("checkpoint", help="Create adapter checkpoint")
    checkpoint_parser.add_argument("version", help="Adapter version")
    checkpoint_parser.add_argument("name", help="Checkpoint name")
    
    # Info command
    subparsers.add_parser("info", help="Get comprehensive adapter info")
    
    args = parser.parse_args()
    
    manager = AdapterManager()
    
    if args.command == "list":
        manager.print_adapters_table()
    
    elif args.command == "activate":
        manager.activate_adapter(args.version)
    
    elif args.command == "compare":
        comparison = manager.compare_adapters(args.version1, args.version2)
        logger.info(json.dumps(comparison, indent=2))
    
    elif args.command == "checkpoint":
        manager.create_checkpoint(args.version, args.name)
    
    elif args.command == "info":
        info = manager.get_adapter_info()
        logger.info(json.dumps(info, indent=2, default=str))
    
    else:
        manager.print_adapters_table()


if __name__ == "__main__":
    main()
