
import sys
import os

# Set HF Cache to D: drive to avoid C: drive full errors
os.environ["HF_HOME"] = "D:/V64(M2)GIT/hf_cache"

import torch
from diffusers import StableDiffusionPipeline
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure cache directory exists
os.makedirs(os.environ["HF_HOME"], exist_ok=True)



def generate_image(prompt, output_path, model_path):
    print(f"DEBUG: Starting generation...", flush=True)
    print(f"DEBUG: Model path: {model_path}", flush=True)
    
    try:
        # Load pipeline from local safetensors file
        print(f"DEBUG: Loading pipeline dependencies...", flush=True)
        # Explicitly check imports
        import diffusers
        import transformers
        import accelerate
        print("DEBUG: All imports successful", flush=True)



        print(f"DEBUG: Loading pipeline from Hugging Face Hub (runwayml/stable-diffusion-v1-5)...", flush=True)
        # Use from_pretrained which is more robust
        pipe = StableDiffusionPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            torch_dtype=torch.float16,
            use_safetensors=True
        )
        print(f"DEBUG: Pipeline loaded successfully", flush=True)

        
        # Move to GPU
        logger.info("Moving to GPU...")
        pipe = pipe.to("cuda")
        
        # Enable memory optimizations
        pipe.enable_attention_slicing()
        
        logger.info(f"Generating image for prompt: '{prompt}'")
        image = pipe(
            prompt, 
            height=512, 
            width=512, 
            num_inference_steps=20
        ).images[0]
        
        logger.info(f"Saving to {output_path}")
        image.save(output_path)
        print(f"SUCCESS: {output_path}")
        
    except Exception as e:
        logger.error(f"Error: {e}")
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generate_image.py <prompt> <output_path> [model_path]")
        sys.exit(1)
        
    prompt = sys.argv[1]
    output_path = sys.argv[2]
    model_path = sys.argv[3] if len(sys.argv) > 3 else "D:/V64(M2)GIT/ComfyUI/models/checkpoints/v1-5-pruned-emaonly.safetensors"
    
    generate_image(prompt, output_path, model_path)
