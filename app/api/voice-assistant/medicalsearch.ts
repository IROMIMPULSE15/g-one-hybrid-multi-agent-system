// Medical Search Module with Llama 3 and Meditron Integration
// Specialized medical reasoning using:
// - Meditron (medical-specific LLM) - Recommended for medical queries
// - Llama 3 via Ollama (general LLM) - Fallback option

import { generateWithProvider } from './llm_provider';
import { generateMedicalResponse, type MeditronOptions } from './meditron';

// ==================== TYPES ====================

interface MedicalQuery {
    type: 'symptom' | 'condition' | 'drug' | 'procedure' | 'general';
    query: string;
    context?: string;
}

interface MedicalResponse {
    answer: string;
    confidence: number;
    sources: string[];
    disclaimer: string;
    relatedTopics?: string[];
}

// ==================== MEDICAL KNOWLEDGE BASE ====================

const MEDICAL_DISCLAIMER = `
⚠️ MEDICAL DISCLAIMER: This information is for educational purposes only and should not replace professional medical advice. Always consult with a qualified healthcare provider for medical concerns.
`;

// Common medical conditions and symptoms for quick reference
const MEDICAL_KNOWLEDGE = {
    symptoms: [
        'fever', 'headache', 'cough', 'fatigue', 'nausea', 'dizziness',
        'chest pain', 'shortness of breath', 'abdominal pain', 'rash'
    ],
    conditions: [
        'diabetes', 'hypertension', 'asthma', 'arthritis', 'migraine',
        'depression', 'anxiety', 'covid-19', 'influenza', 'pneumonia'
    ],
    specialties: [
        'cardiology', 'neurology', 'oncology', 'pediatrics', 'psychiatry',
        'dermatology', 'orthopedics', 'gastroenterology', 'endocrinology'
    ]
};

// ==================== QUERY CLASSIFICATION ====================

function classifyMedicalQuery(query: string): MedicalQuery['type'] {
    const lowerQuery = query.toLowerCase();

    // Symptom-related keywords
    if (lowerQuery.match(/symptom|feel|pain|ache|hurt|sick|ill|experiencing/i)) {
        return 'symptom';
    }

    // Drug/medication keywords
    if (lowerQuery.match(/drug|medication|medicine|pill|prescription|dosage|side effect/i)) {
        return 'drug';
    }

    // Procedure keywords
    if (lowerQuery.match(/surgery|procedure|operation|treatment|therapy|test/i)) {
        return 'procedure';
    }

    // Condition/disease keywords
    if (lowerQuery.match(/disease|condition|disorder|syndrome|diagnosis|what is/i)) {
        return 'condition';
    }

    return 'general';
}

// ==================== SPECIALIZED PROMPTS ====================

function buildMedicalPrompt(query: MedicalQuery): string {
    const baseContext = `You are a knowledgeable medical AI assistant with expertise in medicine, healthcare, and medical research. Provide accurate, evidence-based information while being clear that you're not replacing professional medical advice.`;

    switch (query.type) {
        case 'symptom':
            return `${baseContext}

TASK: Analyze the following symptom-related query and provide helpful information.

Query: ${query.query}

Please provide:
1. **Possible Causes**: List potential conditions (from most to least common)
2. **When to Seek Care**: Red flags that require immediate medical attention
3. **Self-Care**: Safe home remedies or management strategies
4. **Next Steps**: Recommendations for follow-up

Remember to emphasize that this is general information and not a diagnosis.`;

        case 'condition':
            return `${baseContext}

TASK: Explain the following medical condition in clear, understandable terms.

Query: ${query.query}

Please provide:
1. **Overview**: What is this condition?
2. **Causes**: Common causes and risk factors
3. **Symptoms**: Typical signs and symptoms
4. **Diagnosis**: How it's typically diagnosed
5. **Treatment**: Standard treatment approaches
6. **Prognosis**: Expected outcomes with treatment

Use simple language while maintaining medical accuracy.`;

        case 'drug':
            return `${baseContext}

TASK: Provide information about the following medication query.

Query: ${query.query}

Please provide:
1. **Purpose**: What this medication is used for
2. **Mechanism**: How it works (in simple terms)
3. **Common Dosages**: Typical dosing information
4. **Side Effects**: Common and serious side effects
5. **Interactions**: Important drug interactions
6. **Precautions**: Who should avoid this medication

Always emphasize consulting a pharmacist or doctor for personalized advice.`;

        case 'procedure':
            return `${baseContext}

TASK: Explain the following medical procedure or treatment.

Query: ${query.query}

Please provide:
1. **Purpose**: Why this procedure is performed
2. **Process**: What happens during the procedure
3. **Preparation**: How to prepare
4. **Recovery**: What to expect after
5. **Risks**: Potential complications
6. **Alternatives**: Other treatment options

Maintain a reassuring but honest tone.`;

        default:
            return `${baseContext}

TASK: Answer the following medical question comprehensively.

Query: ${query.query}

Provide a thorough, evidence-based answer that:
- Uses clear, accessible language
- Cites general medical knowledge
- Includes relevant context
- Emphasizes when professional consultation is needed

${query.context ? `\nAdditional Context: ${query.context}` : ''}`;
    }
}

// ==================== MAIN MEDICAL SEARCH FUNCTION ====================

export async function searchMedical(
    userQuery: string,
    options?: {
        model?: string;
        temperature?: number;
        includeRelated?: boolean;
        useMeditron?: boolean; // New option to use Meditron
        userPlan?: 'Free' | 'Pro' | 'Enterprise'; // For model selection
    }
): Promise<MedicalResponse> {
    try {
        // Classify the query
        const queryType = classifyMedicalQuery(userQuery);

        const medicalQuery: MedicalQuery = {
            type: queryType,
            query: userQuery
        };

        console.log(`🏥 Medical query classified as: ${queryType}`);

        // Build specialized prompt
        const prompt = buildMedicalPrompt(medicalQuery);

        // Determine if we should use Meditron
        const useMeditron = options?.useMeditron ?? true; // Default to Meditron
        const isPro = options?.userPlan === 'Pro' || options?.userPlan === 'Enterprise';

        let llmResponse: any;
        let modelUsed: string;

        if (useMeditron) {
            try {
                // Pro users get access to Meditron-70B for better accuracy
                const meditronModel = isPro ? 'meditron-70b' : 'meditron-7b';

                console.log(`🏥 Using Meditron ${isPro ? '70B (Pro)' : '7B'} for medical query...`);

                const meditronResponse = await generateMedicalResponse(prompt, {
                    model: meditronModel,
                    temperature: options?.temperature || 0.3,
                    maxTokens: 2048,
                    useLocal: true // Prefer local Ollama
                });

                llmResponse = {
                    text: meditronResponse.text,
                    model: meditronResponse.model,
                    provider: meditronResponse.provider,
                    confidence: meditronResponse.confidence
                };

                modelUsed = `Meditron ${isPro ? '70B' : '7B'} (${meditronResponse.provider})`;

                // Add medical context to response if available
                if (meditronResponse.medicalContext) {
                    console.log(`📊 Medical context: ${JSON.stringify(meditronResponse.medicalContext)}`);
                }

            } catch (meditronError: any) {
                console.warn('⚠️ Meditron failed, falling back to Llama 3:', meditronError.message);

                // Fallback to Llama 3
                llmResponse = await generateWithProvider(prompt, {
                    model: options?.model || 'llama3',
                    temperature: options?.temperature || 0.3,
                    maxTokens: 2048,
                    systemPrompt: `You are a medical knowledge assistant. Provide accurate, evidence-based information while always emphasizing that users should consult healthcare professionals for personalized medical advice.`
                });

                modelUsed = `Llama 3 (fallback)`;
            }
        } else {
            // Use Llama 3 directly if Meditron is disabled
            llmResponse = await generateWithProvider(prompt, {
                model: options?.model || 'llama3',
                temperature: options?.temperature || 0.3,
                maxTokens: 2048,
                systemPrompt: `You are a medical knowledge assistant. Provide accurate, evidence-based information while always emphasizing that users should consult healthcare professionals for personalized medical advice.`
            });

            modelUsed = llmResponse.model || 'Llama 3';
        }

        // Extract related topics if requested
        let relatedTopics: string[] | undefined;
        if (options?.includeRelated) {
            relatedTopics = extractRelatedTopics(llmResponse.text, queryType);
        }

        // Calculate confidence based on response quality
        const confidence = llmResponse.confidence || calculateConfidence(llmResponse.text, queryType);

        console.log(`✅ Medical response generated using ${modelUsed} (confidence: ${(confidence * 100).toFixed(1)}%)`);

        return {
            answer: llmResponse.text,
            confidence,
            sources: [
                'General Medical Knowledge',
                `AI Model: ${modelUsed}`,
                'Evidence-based medical literature',
                ...(isPro ? ['Enhanced with Pro features'] : [])
            ],
            disclaimer: MEDICAL_DISCLAIMER,
            relatedTopics
        };

    } catch (error: any) {
        console.error('❌ Medical search error:', error);

        // Fallback response
        return {
            answer: `I apologize, but I encountered an error processing your medical query. Please try rephrasing your question or consult a healthcare professional directly.`,
            confidence: 0,
            sources: [],
            disclaimer: MEDICAL_DISCLAIMER
        };
    }
}

// ==================== HELPER FUNCTIONS ====================

function extractRelatedTopics(response: string, queryType: MedicalQuery['type']): string[] {
    const topics: string[] = [];

    // Extract medical terms from the response
    const medicalTerms = response.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];

    // Filter and deduplicate
    const uniqueTerms = [...new Set(medicalTerms)]
        .filter(term => term.length > 3)
        .slice(0, 5);

    return uniqueTerms;
}

function calculateConfidence(response: string, queryType: MedicalQuery['type']): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence if response is comprehensive
    if (response.length > 500) confidence += 0.1;
    if (response.length > 1000) confidence += 0.1;

    // Check for medical terminology
    const hasMedicalTerms = /diagnosis|treatment|symptom|condition|medication/i.test(response);
    if (hasMedicalTerms) confidence += 0.05;

    // Check for structured information
    const hasStructure = /\d\.|•|\*\*|###/.test(response);
    if (hasStructure) confidence += 0.05;

    return Math.min(confidence, 0.95); // Cap at 95%
}

// ==================== SYMPTOM CHECKER ====================

export async function checkSymptoms(
    symptoms: string[],
    additionalInfo?: {
        age?: number;
        gender?: string;
        duration?: string;
        severity?: 'mild' | 'moderate' | 'severe';
    }
): Promise<MedicalResponse> {
    const symptomList = symptoms.join(', ');

    let query = `I am experiencing the following symptoms: ${symptomList}.`;

    if (additionalInfo) {
        if (additionalInfo.duration) query += ` Duration: ${additionalInfo.duration}.`;
        if (additionalInfo.severity) query += ` Severity: ${additionalInfo.severity}.`;
        if (additionalInfo.age) query += ` Age: ${additionalInfo.age}.`;
    }

    query += ` What could be causing these symptoms, and when should I seek medical attention?`;

    return await searchMedical(query, {
        temperature: 0.2, // Very low temperature for symptom analysis
        includeRelated: true
    });
}

// ==================== DRUG INTERACTION CHECKER ====================

export async function checkDrugInteractions(
    medications: string[]
): Promise<MedicalResponse> {
    if (medications.length < 2) {
        return {
            answer: 'Please provide at least two medications to check for interactions.',
            confidence: 0,
            sources: [],
            disclaimer: MEDICAL_DISCLAIMER
        };
    }

    const query = `What are the potential interactions between these medications: ${medications.join(', ')}? Are there any serious concerns or precautions I should be aware of?`;

    return await searchMedical(query, {
        temperature: 0.2,
        includeRelated: false
    });
}

// ==================== MEDICAL TERMINOLOGY EXPLAINER ====================

export async function explainMedicalTerm(term: string): Promise<MedicalResponse> {
    const query = `Explain the medical term "${term}" in simple, easy-to-understand language. Include what it means, when it's used, and any related concepts.`;

    return await searchMedical(query, {
        temperature: 0.3,
        includeRelated: true
    });
}

// ==================== EXPORTS ====================

export type {
    MedicalQuery,
    MedicalResponse
};

export {
    MEDICAL_KNOWLEDGE,
    classifyMedicalQuery
};
