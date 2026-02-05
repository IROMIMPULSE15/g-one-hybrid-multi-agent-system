/**
 * Simplified ComfyUI Image Generation - Fixed for SD 1.5
 * Uses basic workflow that's guaranteed to work
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';


const execPromise = util.promisify(exec);

export interface ImageGenerationOptions {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    seed?: number;
}

export interface ImageGenerationResponse {
    success: boolean;
    images: string[];
    model: string;
    provider: string;
    metadata: {
        prompt: string;
        width: number;
        height: number;
        steps: number;
        seed: number;
    };
    error?: string;
}


const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'generate_image.py');
const MODEL_PATH = "D:/V64(M2)GIT/ComfyUI/models/checkpoints/v1-5-pruned-emaonly.safetensors";
const TEMP_DIR = path.join(process.cwd(), 'public', 'temp');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export async function generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    console.log(`🎨 [DirectGPU] Generating: "${options.prompt}"`);

    const timestamp = Date.now();
    const outputFilename = `gen_${timestamp}.png`;
    const outputPath = path.join(TEMP_DIR, outputFilename);
    const pythonCommand = `python "${SCRIPT_PATH}" "${options.prompt.replace(/"/g, '\\"')}" "${outputPath}" "${MODEL_PATH}"`;

    try {
        console.log(`🚀 Executing Python script...`);


        // Timeout after 5 minutes for initial download
        const { stdout, stderr } = await execPromise(pythonCommand, { timeout: 300000 });

        if (stdout.includes("ERROR:")) {
            throw new Error(stdout.split("ERROR:")[1].trim());
        }

        if (!fs.existsSync(outputPath)) {
            throw new Error("Parameters valid but output file was not created. Check logs.");
        }

        // Read file and convert to base64
        const imageBuffer = fs.readFileSync(outputPath);
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

        // Clean up temp file
        fs.unlinkSync(outputPath);

        console.log(`✅ [DirectGPU] Image generated successfully!`);

        return {
            success: true,
            images: [base64Image],
            model: 'v1-5-pruned-emaonly.safetensors',
            provider: 'local-gpu',
            metadata: {
                prompt: options.prompt,
                width: 512,
                height: 512,
                steps: 20,
                seed: 0
            }
        };

    } catch (error: any) {
        console.error('❌ [DirectGPU] Error:', error.message);
        if (error.stderr) console.error('Python Stderr:', error.stderr);
        throw new Error(`GPU generation failed: ${error.message}`);
    }
}
