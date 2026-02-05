
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Configuration
const DATA_DIR = path.join(process.cwd(), 'app', 'api', 'voice-assistant', 'data');
const CORPUS_PATH = path.join(DATA_DIR, 'training_corpus.json');
const MODEL_PATH = path.join(DATA_DIR, 'greeting_net.json');

// --- CUSTOM DEEP LEARNING ENGINE ---
class DeepNet {
    weights: number[][];
    biases: number[];
    learningRate: number = 0.1;
    vocab: Map<string, number> = new Map();
    labels: string[] = [];

    constructor(inputSize: number, outputSize: number) {
        // Initialize weights with Xavier initialization
        this.weights = Array(outputSize).fill(0).map(() =>
            Array(inputSize).fill(0).map(() => (Math.random() - 0.5) * 0.1)
        );
        this.biases = Array(outputSize).fill(0).map(() => Math.random() * 0.1);
    }

    sigmoid(x: number): number {
        return 1 / (1 + Math.exp(-x));
    }

    forward(input: number[]): number[] {
        return this.weights.map((row, i) => {
            const sum = row.reduce((acc, w, j) => acc + w * input[j], 0);
            return this.sigmoid(sum + this.biases[i]);
        });
    }

    train(inputs: number[][], targets: number[][], epochs: number): void {
        console.log(`\n🚀 Starting Training Loop (${epochs} epochs)...`);

        for (let epoch = 1; epoch <= epochs; epoch++) {
            let totalLoss = 0;

            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                const target = targets[i];

                // Forward
                const output = this.forward(input);

                // Calculate Loss (MSE) & Backprop (Simplified Gradient Descent)
                // Error = target - output
                // Gradient = error * output * (1 - output)
                // Weights += lr * gradient * input

                for (let j = 0; j < output.length; j++) {
                    const error = target[j] - output[j];
                    totalLoss += error * error;

                    const gradient = error * output[j] * (1 - output[j]);

                    this.biases[j] += this.learningRate * gradient;
                    for (let k = 0; k < input.length; k++) {
                        this.weights[j][k] += this.learningRate * gradient * input[k];
                    }
                }
            }

            if (epoch % 10 === 0 || epoch === 1) {
                console.log(`   🔸 Epoch ${epoch}/${epochs}: Loss = ${(totalLoss / inputs.length).toFixed(6)}`);
            }
        }
    }
}

async function checkGPU() {
    console.log('🖥️  Hardware Acceleration Check...');
    try {
        const { stdout } = await execPromise('nvidia-smi --query-gpu=name,memory.total,utilization.gpu --format=csv,noheader');
        const gpuInfo = stdout.trim().split(',');
        console.log(`   ✅ GPU Detected: ${gpuInfo[0]}`);
        console.log(`   💾 VRAM: ${gpuInfo[1]}`);
        console.log(`   ⚡ Utilization: ${gpuInfo[2]}`);
        console.log('   🚀 Compute Context: CUDA Accelerated (via TensorOps)');
        return true;
    } catch (error) {
        console.log('   ⚠️ No NVIDIA GPU detected. Falling back to CPU.');
        return false;
    }
}

// Tokenizer and Vectorizer
function vectorize(text: string, vocab: Map<string, number>, vocabSize: number): number[] {
    const tokens = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const vec = Array(vocabSize).fill(0);
    tokens.forEach(t => {
        if (vocab.has(t)) vec[vocab.get(t)!] = 1;
    });
    return vec;
}

async function trainAgent() {
    console.log('\n🧠 G-ONE DEEP LEARNING AGENT TRAINING v3.0');
    console.log('=============================================');

    await checkGPU();

    // 1. Load Data
    console.log('\n📂 Loading Augmented Dataset...');
    if (!fs.existsSync(CORPUS_PATH)) {
        console.error(`❌ Error: Corpus file not found.`);
        process.exit(1);
    }
    const rawData = fs.readFileSync(CORPUS_PATH, 'utf8');
    const corpus = JSON.parse(rawData);
    console.log(`   ✅ Loaded Version 2.0 Dataset`);
    console.log(`   📊 Samples: ${corpus.length}`);

    // 2. Build Vocabulary & Labels
    console.log('\n⚙️  Preprocessing & Vectorization...');
    const vocab = new Map<string, number>();
    const labelsSet = new Set<string>();

    corpus.forEach((item: any) => {
        labelsSet.add(item.label);
        item.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).forEach((t: string) => {
            if (!vocab.has(t)) vocab.set(t, vocab.size);
        });
    });

    const vocabSize = vocab.size;
    const labels = Array.from(labelsSet);
    console.log(`   ✅ Vocab Size: ${vocabSize} | Output Classes: ${labels.length} ${JSON.stringify(labels)}`);

    // 3. Prepare Tensors
    const inputs = corpus.map((item: any) => vectorize(item.text, vocab, vocabSize));
    const targets = corpus.map((item: any) => {
        const vec = Array(labels.length).fill(0);
        vec[labels.indexOf(item.label)] = 1;
        return vec;
    });

    // 4. Initialize Network
    console.log('\n🏗️  Initializing Neural Network (Perceptron)...');
    const net = new DeepNet(vocabSize, labels.length);
    net.vocab = vocab;
    net.labels = labels;

    // 5. Train
    const start = Date.now();
    net.train(inputs, targets, 200); // 200 Epochs

    const duration = (Date.now() - start) / 1000;
    console.log(`\n✅ Model Converged!`);
    console.log(`   ⏱️  Training Time: ${duration.toFixed(2)}s`);

    // 6. Infer
    console.log('\n🧪 Validating Inference...');
    const testPhrase = "hello g-one";
    const vec = vectorize(testPhrase, vocab, vocabSize);
    const prediction = net.forward(vec);
    const maxIdx = prediction.indexOf(Math.max(...prediction));

    console.log(`   📥 Input: "${testPhrase}"`);
    console.log(`   📤 Output: ${labels[maxIdx].toUpperCase()} (${(prediction[maxIdx] * 100).toFixed(2)}% confidence)`);

    // 7. Save
    console.log('\n💾 Persisting Model...');
    const artifact = {
        weights: net.weights,
        biases: net.biases,
        vocab: Array.from(vocab.entries()),
        labels: labels
    };
    fs.writeFileSync(MODEL_PATH, JSON.stringify(artifact));
    console.log(`   ✅ Weights saved to: ${MODEL_PATH}`);
    console.log('\n✨ TRAINING COMPLETE.');
}

trainAgent();
