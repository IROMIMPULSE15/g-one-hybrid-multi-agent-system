/**
 * Lightweight Greeting Agent
 * ==========================
 * Handles greetings and small talk efficiently without LLM overhead
 * This reduces token usage and improves response time for simple interactions
 */

// ==================== GREETING PATTERNS ====================

const GREETING_PATTERNS = [
    /^(hi|hello|hey|hiya|howdy|greetings|yo|sup|wassup|what's up|whats up)[\s!.?]*$/i,
    /^good\s+(morning|afternoon|evening|day|night)[\s!.?]*$/i,
    /^(hi|hello|hey)\s+(there|everyone|all|guys|folks)[\s!.?]*$/i,
];

const FAREWELL_PATTERNS = [
    /^(bye|goodbye|see\s+you|see\s+ya|later|catch\s+you|take\s+care|cya|peace|adios|farewell)[\s!.?]*$/i,
    /^good\s+(night|bye)[\s!.?]*$/i,
    /^(talk|speak)\s+to\s+you\s+(later|soon)[\s!.?]*$/i,
];

const GRATITUDE_PATTERNS = [
    /^(thanks|thank\s+you|thx|ty|appreciate\s+it|cheers)[\s!.?]*$/i,
    /^(thanks|thank\s+you)\s+(so\s+much|a\s+lot|very\s+much)[\s!.?]*$/i,
];

const SMALL_TALK_PATTERNS = [
    /^(how\s+are\s+you|how're\s+you|how\s+r\s+u|hows\s+it\s+going|how's\s+it\s+going)[\s!.?]*$/i,
    /^(what's\s+up|whats\s+up|wassup|sup)[\s!.?]*$/i,
];

// ==================== RESPONSE TEMPLATES ====================

const GREETING_RESPONSES = [
    "Hello! 👋 How can I assist you today?",
    "Hi there! 😊 What can I help you with?",
    "Hey! Ready to help. What's on your mind?",
    "Hello! I'm here to assist. What would you like to know?",
];

const FAREWELL_RESPONSES = [
    "Goodbye! 👋 Feel free to return anytime!",
    "Take care! Come back if you need anything.",
    "See you later! 😊 Have a great day!",
    "Bye! Don't hesitate to ask if you need help again.",
];

const GRATITUDE_RESPONSES = [
    "You're welcome! 😊 Happy to help!",
    "My pleasure! Let me know if you need anything else.",
    "Glad I could help! 👍",
    "Anytime! Feel free to ask more questions.",
];

const SMALL_TALK_RESPONSES = [
    "I'm doing great, thanks for asking! How can I assist you?",
    "All good here! What can I help you with today?",
    "I'm ready to help! What would you like to know?",
    "Doing well! What brings you here today?",
];

// ==================== DETECTION FUNCTIONS ====================

export function isGreeting(message: string): boolean {
    const trimmed = message.trim();
    return GREETING_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function isFarewell(message: string): boolean {
    const trimmed = message.trim();
    return FAREWELL_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function isGratitude(message: string): boolean {
    const trimmed = message.trim();
    return GRATITUDE_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function isSmallTalk(message: string): boolean {
    const trimmed = message.trim();
    return SMALL_TALK_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function isGreetingOrSmallTalk(message: string): boolean {
    return isGreeting(message) || isFarewell(message) || isGratitude(message) || isSmallTalk(message);
}

// ==================== RESPONSE GENERATION ====================

function getRandomResponse(responses: string[]): string {
    return responses[Math.floor(Math.random() * responses.length)];
}

export function generateGreetingResponse(message: string): string | null {
    const trimmed = message.trim();

    if (isGreeting(trimmed)) {
        return getRandomResponse(GREETING_RESPONSES);
    }

    if (isFarewell(trimmed)) {
        return getRandomResponse(FAREWELL_RESPONSES);
    }

    if (isGratitude(trimmed)) {
        return getRandomResponse(GRATITUDE_RESPONSES);
    }

    if (isSmallTalk(trimmed)) {
        return getRandomResponse(SMALL_TALK_RESPONSES);
    }

    return null;
}

// ==================== STATISTICS ====================

interface GreetingStats {
    totalGreetings: number;
    greetingsSaved: number;
    tokensSaved: number;
    avgTokensPerGreeting: number;
}

let greetingCount = 0;
const AVG_LLM_TOKENS_PER_GREETING = 150; // Estimated tokens saved per greeting

export function recordGreetingHandled(): void {
    greetingCount++;
}

export function getGreetingStats(): GreetingStats {
    return {
        totalGreetings: greetingCount,
        greetingsSaved: greetingCount,
        tokensSaved: greetingCount * AVG_LLM_TOKENS_PER_GREETING,
        avgTokensPerGreeting: AVG_LLM_TOKENS_PER_GREETING,
    };
}

export function resetGreetingStats(): void {
    greetingCount = 0;
}

// ==================== EXPORT ====================

export default {
    isGreeting,
    isFarewell,
    isGratitude,
    isSmallTalk,
    isGreetingOrSmallTalk,
    generateGreetingResponse,
    recordGreetingHandled,
    getGreetingStats,
    resetGreetingStats,
};
