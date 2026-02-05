import fs from 'fs';
import path from 'path';
import { AgentMetrics } from './metrics';

interface GreetingContext {
    userName: string | null;
    userMood: string;
    timeOfDay: string;
}

// Minimal Inference Engine matching the Training Script
class DeepNetEngine {
    weights: number[][] = [];
    biases: number[] = [];
    vocab: Map<string, number> = new Map();
    labels: string[] = [];

    load(modelPath: string) {
        const raw = fs.readFileSync(modelPath, 'utf8');
        const artifact = JSON.parse(raw);
        this.weights = artifact.weights;
        this.biases = artifact.biases;
        this.vocab = new Map(artifact.vocab);
        this.labels = artifact.labels;
    }

    sigmoid(x: number): number {
        return 1 / (1 + Math.exp(-x));
    }

    private vectorize(text: string): number[] {
        const tokens = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        const vec = Array(this.vocab.size).fill(0);
        tokens.forEach(t => {
            if (this.vocab.has(t)) vec[this.vocab.get(t)!] = 1;
        });
        return vec;
    }

    predict(text: string): { label: string, confidence: number, distribution: Record<string, number> } {
        const input = this.vectorize(text);

        // Forward Pass
        const output = this.weights.map((row, i) => {
            const sum = row.reduce((acc, w, j) => acc + w * input[j], 0);
            return this.sigmoid(sum + this.biases[i]);
        });

        // Softmax-ish (just finding max for single label classification)
        let maxVal = -Infinity;
        let maxIdx = -1;
        const distribution: Record<string, number> = {};

        output.forEach((val, idx) => {
            distribution[this.labels[idx]] = val;
            if (val > maxVal) {
                maxVal = val;
                maxIdx = idx;
            }
        });

        return {
            label: this.labels[maxIdx],
            confidence: maxVal,
            distribution
        };
    }
}

export class GreetingAgent {
    private name: string = "GreetingAgent [DeepNet v3]";
    private engine: DeepNetEngine;
    private isReady: boolean = false;
    private metrics: AgentMetrics;

    private modelPath = path.join(process.cwd(), 'app', 'api', 'voice-assistant', 'data', 'greeting_net.json');

    constructor() {
        this.engine = new DeepNetEngine();
        this.metrics = new AgentMetrics('greeting_agent');
        this.initialize();
    }

    private initialize() {
        if (fs.existsSync(this.modelPath)) {
            try {
                console.log(`[GreetingAgent] 📂 Loading Neural Weights from ${this.modelPath}...`);
                this.engine.load(this.modelPath);
                this.isReady = true;
                console.log(`[GreetingAgent] ✅ DeepNet Loaded. ready for inference.`);
            } catch (e) {
                console.error(`[GreetingAgent] ❌ Failed to load model:`, e);
            }
        } else {
            console.warn(`[GreetingAgent] ⚠️ No trained model found. Please run 'npm run train:agent'.`);
        }
    }

    // Fallback: Rule-based classification (if model fails or low confidence)
    private fallbackClassify(text: string): { label: string, confidence: number } {
        const lower = text.toLowerCase().trim();

        // Greeting patterns
        if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|yo|sup|hiya)/i.test(lower)) {
            return { label: 'greeting', confidence: 0.9 };
        }

        // Farewell patterns
        if (/^(bye|goodbye|see\s+you|farewell|cya|later|night|good\s+night)/i.test(lower)) {
            return { label: 'farewell', confidence: 0.9 };
        }

        // Gratitude patterns
        if (/(thank|thanks|thx|appreciate|grateful)/i.test(lower)) {
            return { label: 'gratitude', confidence: 0.85 };
        }

        // Identity patterns
        if (/(who\s+are\s+you|what\s+is\s+your\s+name|introduce\s+yourself)/i.test(lower)) {
            return { label: 'identity', confidence: 0.85 };
        }

        return { label: 'unknown', confidence: 0.5 };
    }

    public stripGreeting(message: string): { hasGreeting: boolean, cleanMessage: string, greetingPart: string } {
        // Regex for common starts - Broadened to catch typos like "hello frind"
        // Matches: greeting word + (optional space + optional word) + boundary
        const greetingStart = /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|yo|hey\s+there)(\s+\w+)?\b/i;
        const match = message.trim().match(greetingStart);

        if (match) {
            const greetingPart = match[0];
            // Remove greeting and any following punctuation/comma
            let cleanMessage = message.replace(greetingStart, '').trim();
            cleanMessage = cleanMessage.replace(/^[,!.]\s*/, '').trim();

            // If nothing left, it was just a greeting (should have been caught by DeepNet, but safety first)
            if (!cleanMessage) return { hasGreeting: true, cleanMessage: "", greetingPart };

            return { hasGreeting: true, cleanMessage, greetingPart };
        }

        return { hasGreeting: false, cleanMessage: message, greetingPart: "" };
    }

    public shouldHandle(message: string): boolean {
        const startTime = Date.now();
        const handledClasses = ['greeting', 'farewell', 'gratitude', 'identity'];
        const threshold = 0.65;
        const fallbackThreshold = 0.7;
        let usedFallback = false;
        let predictedLabel = 'unknown';
        let confidence = 0;
        let willHandle = false;

        if (!this.isReady) {
            // Model not loaded - use fallback
            const fallback = this.fallbackClassify(message);
            console.log(`[GreetingAgent] Using FALLBACK: ${fallback.label} (${(fallback.confidence * 100).toFixed(1)}%)`);
            usedFallback = true;
            predictedLabel = fallback.label;
            confidence = fallback.confidence;
            willHandle = handledClasses.includes(fallback.label) && fallback.confidence > fallbackThreshold;
        } else {
            const result = this.engine.predict(message);
            predictedLabel = result.label;
            confidence = result.confidence;

            // If confidence is very low, try fallback
            if (result.confidence < 0.5) {
                console.log(`[GreetingAgent] Low NN confidence, trying fallback...`);
                const fallback = this.fallbackClassify(message);
                if (fallback.confidence > result.confidence) {
                    console.log(`[GreetingAgent] Fallback better: ${fallback.label} (${(fallback.confidence * 100).toFixed(1)}%)`);
                    usedFallback = true;
                    predictedLabel = fallback.label;
                    confidence = fallback.confidence;
                    willHandle = handledClasses.includes(fallback.label) && fallback.confidence > fallbackThreshold;
                }
            }

            if (!usedFallback) {
                // Production Logging
                willHandle = handledClasses.includes(result.label) && result.confidence > threshold;

                console.log(`[GreetingAgent] Prediction: ${result.label} (${(result.confidence * 100).toFixed(1)}%) | Handle: ${willHandle}`);

                // Log low-confidence cases for retraining
                if (result.confidence < 0.75 && handledClasses.includes(result.label)) {
                    console.warn(`[GreetingAgent] ⚠️ Low confidence: "${message}" -> ${result.label} (${(result.confidence * 100).toFixed(1)}%)`);
                }
            }
        }

        // Log metrics
        const responseTime = Date.now() - startTime;
        this.metrics.log({
            message: message.substring(0, 100), // Truncate for privacy
            predictedLabel,
            confidence,
            handled: willHandle,
            usedFallback,
            responseTime
        });

        return willHandle;
    }

    public generateResponse(message: string, context: GreetingContext): { response: string; reasoning: string[] } {
        const cleanMsg = message.trim().toLowerCase();
        const result = this.engine.predict(cleanMsg);

        // Backend logging (not shown to user)
        console.log(`[GreetingAgent] Response Generation: ${result.label} (${(result.confidence * 100).toFixed(2)}%)`);

        // Minimal reasoning for system tracking (not displayed to end user in UI)
        const reasoning: string[] = [
            `Agent: ${this.name}`,
            `Source: Trained Model`,
            `Response Time: <10ms`
        ];

        const label = result.label;

        if (label === 'greeting') {
            return { response: this.getGreetingResponse(context), reasoning };
        }

        if (label === 'farewell') {
            return { response: this.getFarewellResponse(context), reasoning };
        }

        if (label === 'gratitude') {
            return { response: this.getGratitudeResponse(context), reasoning };
        }

        if (label === 'identity') {
            return {
                response: "I am G-One, running on a custom Recursive Neural Network architecture optimized for edge interaction.",
                reasoning
            };
        }

        return {
            response: "Hello!",
            reasoning: [...reasoning, 'Fallback']
        };
    }

    private getGreetingResponse(context: GreetingContext): string {
        const { userName, userMood, timeOfDay } = context;
        const nameStr = userName ? ` ${userName}` : '';

        // Smarter Time Logic
        let greeting = "Hello";
        if (timeOfDay === 'morning') greeting = "Good morning";
        else if (timeOfDay === 'afternoon') greeting = "Good afternoon";
        else if (timeOfDay === 'evening') greeting = "Good evening";
        else if (timeOfDay === 'night') greeting = "Hello"; // Neutral for late night (12AM - 4AM)

        if (userName) {
            return `${greeting}${nameStr}! Great to see you. How can I help?`;
        }
        return `${greeting}! I'm listening.`;
    }

    private getFarewellResponse(context: GreetingContext): string {
        return "Goodbye! Session terminated.";
    }

    private getGratitudeResponse(context: GreetingContext): string {
        return "You are welcome. Operational efficiency is my priority.";
    }
}
