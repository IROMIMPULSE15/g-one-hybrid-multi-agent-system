import { NextRequest, NextResponse } from 'next/server';
import { generateImage, processImage, type ImageGenerationOptions, type ImageProcessingOptions } from '../image-generation';

// ==================== IMAGE GENERATION ENDPOINT ====================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, ...options } = body;

        if (action === 'generate') {
            // Generate new image
            const generationOptions: ImageGenerationOptions = {
                prompt: options.prompt,
                negativePrompt: options.negativePrompt,
                model: options.model || 'flux',
                width: options.width,
                height: options.height,
                steps: options.steps,
                guidanceScale: options.guidanceScale,
                seed: options.seed,
                numImages: options.numImages || 1,
                style: options.style,
                provider: options.provider || 'huggingface'
            };

            if (!generationOptions.prompt) {
                return NextResponse.json(
                    { success: false, error: 'Prompt is required' },
                    { status: 400 }
                );
            }

            console.log(`🎨 Image generation request: "${generationOptions.prompt.substring(0, 50)}..."`);

            const result = await generateImage(generationOptions);

            return NextResponse.json(result, { status: 200 });

        } else if (action === 'process') {
            // Process existing image
            const processingOptions: ImageProcessingOptions = {
                operation: options.operation,
                imageUrl: options.imageUrl,
                imageBase64: options.imageBase64,
                scale: options.scale,
                mask: options.mask,
                prompt: options.prompt
            };

            if (!processingOptions.operation) {
                return NextResponse.json(
                    { success: false, error: 'Operation is required' },
                    { status: 400 }
                );
            }

            if (!processingOptions.imageUrl && !processingOptions.imageBase64) {
                return NextResponse.json(
                    { success: false, error: 'Image URL or base64 is required' },
                    { status: 400 }
                );
            }

            console.log(`🔧 Image processing request: ${processingOptions.operation}`);

            const result = await processImage(processingOptions);

            return NextResponse.json(result, { status: 200 });

        } else {
            return NextResponse.json(
                { success: false, error: 'Invalid action. Use "generate" or "process"' },
                { status: 400 }
            );
        }

    } catch (error: any) {
        console.error('❌ Image API error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Image generation/processing failed',
                details: error.stack
            },
            { status: 500 }
        );
    }
}

// ==================== GET ENDPOINT (Info) ====================

export async function GET(request: NextRequest) {
    return NextResponse.json({
        success: true,
        message: 'Image Generation & Processing API',
        version: '1.0.0',
        endpoints: {
            POST: {
                generate: {
                    description: 'Generate images from text prompts',
                    parameters: {
                        action: 'generate',
                        prompt: 'string (required)',
                        negativePrompt: 'string (optional)',
                        model: 'sdxl | flux | sd3 | sd-1.5 (default: flux)',
                        width: 'number (optional)',
                        height: 'number (optional)',
                        steps: 'number (optional)',
                        guidanceScale: 'number (optional)',
                        seed: 'number (optional)',
                        numImages: 'number (default: 1)',
                        style: 'realistic | artistic | anime | digital-art | photography',
                        provider: 'comfyui | huggingface | replicate (default: huggingface)'
                    },
                    example: {
                        action: 'generate',
                        prompt: 'A beautiful sunset over mountains',
                        model: 'flux',
                        style: 'realistic',
                        width: 1024,
                        height: 1024
                    }
                },
                process: {
                    description: 'Process existing images',
                    parameters: {
                        action: 'process',
                        operation: 'upscale | enhance | remove-background | inpaint',
                        imageUrl: 'string (required if no imageBase64)',
                        imageBase64: 'string (required if no imageUrl)',
                        scale: 'number (for upscale, default: 2)',
                        mask: 'string (for inpaint)',
                        prompt: 'string (for style-transfer)'
                    },
                    example: {
                        action: 'process',
                        operation: 'upscale',
                        imageUrl: 'https://example.com/image.jpg',
                        scale: 2
                    }
                }
            }
        },
        models: {
            flux: 'FLUX.1 - State-of-the-art quality (4 steps)',
            sdxl: 'Stable Diffusion XL - High quality (30 steps)',
            sd3: 'Stable Diffusion 3 - Latest version (28 steps)',
            'sd-1.5': 'Stable Diffusion 1.5 - Fast & lightweight (25 steps)'
        },
        providers: {
            huggingface: 'Free, easy setup (requires API key)',
            comfyui: 'Local, full control (requires installation)',
            replicate: 'High quality, paid (requires API key)'
        },
        setup: {
            huggingface: 'Set HUGGINGFACE_API_KEY in .env',
            replicate: 'Set REPLICATE_API_KEY in .env',
            comfyui: 'Install ComfyUI and set COMFYUI_URL in .env'
        }
    }, { status: 200 });
}
