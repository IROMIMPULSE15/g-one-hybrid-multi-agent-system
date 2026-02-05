/**
 * Text-to-Image and Image Processing Integration
 * 
 * Supported Models:
 * 1. Stable Diffusion XL (SDXL) - High quality, versatile
 * 2. FLUX.1 - State-of-the-art, best quality
 * 3. Stable Diffusion 3 - Latest version
 * 4. ControlNet - Guided image generation
 * 
 * Providers:
 * - Local ComfyUI (Recommended for production)
 * - Hugging Face Inference API (Easy setup)
 * - Replicate API (High quality, paid)
 * - Stability AI API (Official, paid)
 */

import axios from 'axios';
import FormData from 'form-data';

// ==================== TYPES ====================

export interface ImageGenerationOptions {
    prompt: string;
    negativePrompt?: string;
    model?: 'sdxl' | 'flux' | 'sd3' | 'sd-1.5';
    width?: number;
    height?: number;
    steps?: number;
    guidanceScale?: number;
    seed?: number;
    numImages?: number;
    style?: 'realistic' | 'artistic' | 'anime' | 'digital-art' | 'photography';
    provider?: 'comfyui' | 'huggingface' | 'replicate' | 'stability';
}

export interface ImageProcessingOptions {
    operation: 'upscale' | 'enhance' | 'remove-background' | 'inpaint' | 'outpaint' | 'style-transfer';
    imageUrl?: string;
    imageBase64?: string;
    scale?: number; // For upscaling
    mask?: string; // For inpainting
    prompt?: string; // For style transfer
}

export interface ImageGenerationResponse {
    success: boolean;
    images: string[]; // Base64 or URLs
    model: string;
    provider: string;
    metadata: {
        prompt: string;
        width: number;
        height: number;
        steps: number;
        seed: number;
        generationTime?: number;
    };
    error?: string;
}

export interface ImageProcessingResponse {
    success: boolean;
    image: string; // Base64 or URL
    operation: string;
    provider: string;
    error?: string;
}

// ==================== MODEL CONFIGURATIONS ====================

const MODEL_CONFIGS = {
    'sdxl': {
        huggingface: 'stabilityai/stable-diffusion-2-1', // Using SD 2.1 (more reliable on HF)
        replicate: 'stability-ai/sdxl',
        comfyui: 'sd_xl_base_1.0.safetensors',
        description: 'Stable Diffusion 2.1 - High quality, reliable',
        defaultSize: { width: 768, height: 768 },
        steps: 30
    },
    'flux': {
        huggingface: 'stabilityai/stable-diffusion-2-1', // Fallback to SD 2.1
        replicate: 'black-forest-labs/flux-schnell',
        comfyui: 'flux1-schnell.safetensors',
        description: 'FLUX.1 - State-of-the-art quality',
        defaultSize: { width: 1024, height: 1024 },
        steps: 4 // FLUX Schnell is fast
    },
    'sd3': {
        huggingface: 'stabilityai/stable-diffusion-2-1', // Using SD 2.1
        replicate: 'stability-ai/stable-diffusion-3',
        comfyui: 'sd3_medium.safetensors',
        description: 'Stable Diffusion 2.1 - Latest working version',
        defaultSize: { width: 768, height: 768 },
        steps: 28
    },
    'sd-1.5': {
        huggingface: 'runwayml/stable-diffusion-v1-5',
        replicate: 'stability-ai/stable-diffusion',
        comfyui: 'v1-5-pruned-emaonly.safetensors', // Updated to match downloaded file
        description: 'Stable Diffusion 1.5 - Fast, lightweight',
        defaultSize: { width: 512, height: 512 },
        steps: 25
    }
};

const STYLE_PROMPTS = {
    'realistic': 'photorealistic, highly detailed, 8k uhd, professional photography',
    'artistic': 'artistic, painterly, creative, expressive, vibrant colors',
    'anime': 'anime style, manga, japanese animation, detailed anime art',
    'digital-art': 'digital art, concept art, trending on artstation, highly detailed',
    'photography': 'professional photography, dslr, bokeh, perfect lighting'
};

// ==================== COMFYUI INTEGRATION (LOCAL) ====================

/**
 * Generate images using local ComfyUI installation
 * Best for production - full control, no API costs
 */
async function generateWithComfyUI(
    options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
    const comfyUrl = process.env.COMFYUI_URL || 'http://localhost:8188';
    const model = options.model || 'flux';
    const config = MODEL_CONFIGS[model];

    console.log(`🎨 Generating image with ComfyUI (${model})...`);

    try {
        // Build ComfyUI workflow
        const workflow = buildComfyUIWorkflow(options);

        // Queue the prompt
        const queueResponse = await axios.post(`${comfyUrl}/prompt`, {
            prompt: workflow,
            client_id: `voice-assistant-${Date.now()}`
        });

        const promptId = queueResponse.data.prompt_id;

        // Poll for completion
        const image = await pollComfyUIResult(comfyUrl, promptId);

        return {
            success: true,
            images: [image],
            model: config.comfyui,
            provider: 'comfyui',
            metadata: {
                prompt: options.prompt,
                width: options.width || config.defaultSize.width,
                height: options.height || config.defaultSize.height,
                steps: options.steps || config.steps,
                seed: options.seed || Math.floor(Math.random() * 1000000)
            }
        };

    } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error(
                'ComfyUI is not running. Please start ComfyUI:\n' +
                '1. Download from: https://github.com/comfyanonymous/ComfyUI\n' +
                '2. Run: python main.py\n' +
                '3. Or use Hugging Face API as fallback'
            );
        }
        throw new Error(`ComfyUI error: ${error.message}`);
    }
}

function buildComfyUIWorkflow(options: ImageGenerationOptions): any {
    const model = options.model || 'flux';
    const config = MODEL_CONFIGS[model];
    const stylePrompt = options.style ? STYLE_PROMPTS[options.style] : '';
    const fullPrompt = `${options.prompt}${stylePrompt ? ', ' + stylePrompt : ''}`;

    // Simplified workflow for FLUX/SDXL
    return {
        "3": {
            "inputs": {
                "seed": options.seed || Math.floor(Math.random() * 1000000),
                "steps": options.steps || config.steps,
                "cfg": options.guidanceScale || 7.5,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            },
            "class_type": "KSampler"
        },
        "4": {
            "inputs": {
                "ckpt_name": config.comfyui
            },
            "class_type": "CheckpointLoaderSimple"
        },
        "5": {
            "inputs": {
                "width": options.width || config.defaultSize.width,
                "height": options.height || config.defaultSize.height,
                "batch_size": options.numImages || 1
            },
            "class_type": "EmptyLatentImage"
        },
        "6": {
            "inputs": {
                "text": fullPrompt,
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "7": {
            "inputs": {
                "text": options.negativePrompt || "ugly, blurry, low quality, distorted",
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "8": {
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "9": {
            "inputs": {
                "filename_prefix": "ComfyUI",
                "images": ["8", 0]
            },
            "class_type": "SaveImage"
        }
    };
}

async function pollComfyUIResult(
    comfyUrl: string,
    promptId: string,
    maxAttempts: number = 60
): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const historyResponse = await axios.get(`${comfyUrl}/history/${promptId}`);
            const history = historyResponse.data[promptId];

            if (history && history.outputs) {
                // Get the saved image
                const output = Object.values(history.outputs)[0] as any;
                if (output.images && output.images.length > 0) {
                    const imageInfo = output.images[0];
                    const imageUrl = `${comfyUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type}`;

                    // Download and convert to base64
                    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    const base64 = Buffer.from(imageResponse.data).toString('base64');
                    return `data:image/png;base64,${base64}`;
                }
            }
        } catch (error) {
            // Continue polling
        }
    }

    throw new Error('ComfyUI generation timeout');
}

// ==================== HUGGING FACE INTEGRATION ====================

/**
 * Generate images using Hugging Face Inference API
 * Easy setup, no local installation required
 */
async function generateWithHuggingFace(
    options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        throw new Error(
            'HUGGINGFACE_API_KEY not set. Get your free API key from:\n' +
            'https://huggingface.co/settings/tokens'
        );
    }

    const model = options.model || 'flux';
    const config = MODEL_CONFIGS[model];
    const stylePrompt = options.style ? STYLE_PROMPTS[options.style] : '';
    const fullPrompt = `${options.prompt}${stylePrompt ? ', ' + stylePrompt : ''}`;

    console.log(`🎨 Generating image with Hugging Face (${model})...`);

    const apiUrl = `https://api-inference.huggingface.co/models/${config.huggingface}`;

    try {
        const response = await axios.post(
            apiUrl,
            {
                inputs: fullPrompt,
                parameters: {
                    negative_prompt: options.negativePrompt || "ugly, blurry, low quality",
                    num_inference_steps: options.steps || config.steps,
                    guidance_scale: options.guidanceScale || 7.5,
                    width: options.width || config.defaultSize.width,
                    height: options.height || config.defaultSize.height,
                    seed: options.seed
                },
                options: {
                    wait_for_model: true
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer',
                timeout: 120000 // 2 minute timeout
            }
        );

        const base64 = Buffer.from(response.data).toString('base64');
        const imageData = `data:image/png;base64,${base64}`;

        console.log(`✅ Image generated with Hugging Face (${model})`);

        return {
            success: true,
            images: [imageData],
            model: config.huggingface,
            provider: 'huggingface',
            metadata: {
                prompt: options.prompt,
                width: options.width || config.defaultSize.width,
                height: options.height || config.defaultSize.height,
                steps: options.steps || config.steps,
                seed: options.seed || 0
            }
        };

    } catch (error: any) {
        if (error.response?.status === 503) {
            throw new Error(
                'Model is loading on Hugging Face. This may take 1-2 minutes.\n' +
                'Please try again shortly, or use local ComfyUI for instant generation.'
            );
        }

        throw new Error(`Hugging Face error: ${error.message}`);
    }
}

// ==================== REPLICATE INTEGRATION ====================

/**
 * Generate images using Replicate API
 * High quality, paid service
 */
async function generateWithReplicate(
    options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
    const apiKey = process.env.REPLICATE_API_KEY;

    if (!apiKey) {
        throw new Error('REPLICATE_API_KEY not set. Get it from: https://replicate.com/account');
    }

    const model = options.model || 'flux';
    const config = MODEL_CONFIGS[model];
    const stylePrompt = options.style ? STYLE_PROMPTS[options.style] : '';
    const fullPrompt = `${options.prompt}${stylePrompt ? ', ' + stylePrompt : ''}`;

    console.log(`🎨 Generating image with Replicate (${model})...`);

    try {
        // Create prediction
        const response = await axios.post(
            'https://api.replicate.com/v1/predictions',
            {
                version: config.replicate,
                input: {
                    prompt: fullPrompt,
                    negative_prompt: options.negativePrompt,
                    width: options.width || config.defaultSize.width,
                    height: options.height || config.defaultSize.height,
                    num_inference_steps: options.steps || config.steps,
                    guidance_scale: options.guidanceScale || 7.5,
                    seed: options.seed
                }
            },
            {
                headers: {
                    'Authorization': `Token ${apiKey}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        const predictionId = response.data.id;

        // Poll for completion
        const result = await pollReplicateResult(predictionId, apiKey);

        return {
            success: true,
            images: result.output,
            model: config.replicate,
            provider: 'replicate',
            metadata: {
                prompt: options.prompt,
                width: options.width || config.defaultSize.width,
                height: options.height || config.defaultSize.height,
                steps: options.steps || config.steps,
                seed: options.seed || 0
            }
        };

    } catch (error: any) {
        throw new Error(`Replicate error: ${error.message}`);
    }
}

async function pollReplicateResult(
    predictionId: string,
    apiKey: string,
    maxAttempts: number = 60
): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const response = await axios.get(
            `https://api.replicate.com/v1/predictions/${predictionId}`,
            {
                headers: {
                    'Authorization': `Token ${apiKey}`,
                }
            }
        );

        if (response.data.status === 'succeeded') {
            return response.data;
        } else if (response.data.status === 'failed') {
            throw new Error('Replicate generation failed');
        }
    }

    throw new Error('Replicate generation timeout');
}

// ==================== MAIN GENERATION FUNCTION ====================

/**
 * Generate images with ComfyUI only
 */
export async function generateImage(
    options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
    const provider = options.provider || 'comfyui'; // Default to ComfyUI

    console.log(`🎨 Generating image: "${options.prompt.substring(0, 50)}..."`);

    try {
        switch (provider) {
            case 'comfyui':
                return await generateWithComfyUI(options);

            case 'replicate':
                if (!process.env.REPLICATE_API_KEY) {
                    throw new Error('REPLICATE_API_KEY not configured. Using ComfyUI instead.');
                }
                return await generateWithReplicate(options);

            default:
                // Always use ComfyUI as default
                return await generateWithComfyUI(options);
        }
    } catch (error: any) {
        console.error(`❌ Image generation failed:`, error.message);

        // Provide helpful error message
        if (error.code === 'ECONNREFUSED' || error.message.includes('ComfyUI is not running')) {
            throw new Error(
                'ComfyUI is not running. Please start ComfyUI:\n' +
                '1. Open terminal in ComfyUI folder\n' +
                '2. Run: python main.py\n' +
                '3. Verify at http://localhost:8188\n\n' +
                'Or use the batch script: restart-comfyui-gpu.bat'
            );
        }

        throw error;
    }
}

// ==================== IMAGE PROCESSING ====================

/**
 * Process images (upscale, enhance, remove background, etc.)
 */
export async function processImage(
    options: ImageProcessingOptions
): Promise<ImageProcessingResponse> {
    console.log(`🔧 Processing image: ${options.operation}`);

    switch (options.operation) {
        case 'upscale':
            return await upscaleImage(options);

        case 'remove-background':
            return await removeBackground(options);

        case 'enhance':
            return await enhanceImage(options);

        default:
            throw new Error(`Unsupported operation: ${options.operation}`);
    }
}

async function upscaleImage(
    options: ImageProcessingOptions
): Promise<ImageProcessingResponse> {
    // Use Real-ESRGAN via Replicate or local
    const apiKey = process.env.REPLICATE_API_KEY;

    if (!apiKey) {
        throw new Error('REPLICATE_API_KEY required for upscaling');
    }

    const response = await axios.post(
        'https://api.replicate.com/v1/predictions',
        {
            version: 'nightmareai/real-esrgan',
            input: {
                image: options.imageUrl || options.imageBase64,
                scale: options.scale || 2
            }
        },
        {
            headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': 'application/json',
            }
        }
    );

    const result = await pollReplicateResult(response.data.id, apiKey);

    return {
        success: true,
        image: result.output,
        operation: 'upscale',
        provider: 'replicate'
    };
}

async function removeBackground(
    options: ImageProcessingOptions
): Promise<ImageProcessingResponse> {
    // Use rembg or similar
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        throw new Error('HUGGINGFACE_API_KEY required for background removal');
    }

    const response = await axios.post(
        'https://api-inference.huggingface.co/models/briaai/RMBG-1.4',
        options.imageBase64 || options.imageUrl,
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            responseType: 'arraybuffer'
        }
    );

    const base64 = Buffer.from(response.data).toString('base64');

    return {
        success: true,
        image: `data:image/png;base64,${base64}`,
        operation: 'remove-background',
        provider: 'huggingface'
    };
}

async function enhanceImage(
    options: ImageProcessingOptions
): Promise<ImageProcessingResponse> {
    // Use GFPGAN or similar for face enhancement
    throw new Error('Image enhancement not yet implemented');
}

// ==================== EXPORTS ====================

export {
    MODEL_CONFIGS,
    STYLE_PROMPTS
};
