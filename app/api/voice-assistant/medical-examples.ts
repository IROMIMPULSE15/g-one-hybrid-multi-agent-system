// Example: Integrating Medical Search with Voice Assistant
// This shows how to use Llama 3 for medical reasoning in your voice assistant

import { searchMedical, checkSymptoms, checkDrugInteractions, explainMedicalTerm } from './medicalsearch';

// ==================== EXAMPLE 1: Basic Medical Query ====================

async function example1_BasicMedicalQuery() {
    console.log('🏥 Example 1: Basic Medical Query\n');

    const response = await searchMedical(
        "What are the symptoms of diabetes?",
        {
            model: 'llama3',
            temperature: 0.3,
            includeRelated: true
        }
    );

    console.log('Answer:', response.answer);
    console.log('\nConfidence:', response.confidence);
    console.log('Sources:', response.sources);
    console.log('Related Topics:', response.relatedTopics);
    console.log('\n' + response.disclaimer);
}
// ==================== EXAMPLE 2: Symptom Checker ====================

async function example2_SymptomChecker() {
    console.log('🏥 Example 2: Symptom Checker\n');

    const response = await checkSymptoms(
        ['fever', 'cough', 'fatigue', 'body aches'],
        {
            age: 35,
            duration: '3 days',
            severity: 'moderate'
        }
    );

    console.log('Analysis:', response.answer);
    console.log('\nConfidence:', response.confidence);
    console.log('\n' + response.disclaimer);
}

// ==================== EXAMPLE 3: Drug Interactions ====================

async function example3_DrugInteractions() {
    console.log('🏥 Example 3: Drug Interaction Check\n');

    const response = await checkDrugInteractions([
        'aspirin',
        'ibuprofen',
        'warfarin'
    ]);

    console.log('Interaction Analysis:', response.answer);
    console.log('\nConfidence:', response.confidence);
    console.log('\n' + response.disclaimer);
}

// ==================== EXAMPLE 4: Medical Term Explainer ====================

async function example4_MedicalTermExplainer() {
    console.log('🏥 Example 4: Medical Term Explainer\n');

    const response = await explainMedicalTerm('hypertension');

    console.log('Explanation:', response.answer);
    console.log('\nRelated Topics:', response.relatedTopics);
    console.log('\n' + response.disclaimer);
}

// ==================== EXAMPLE 5: Integration with Voice Assistant ====================

export async function handleMedicalQuery(userMessage: string) {
    // Detect if the query is medical-related
    const medicalKeywords = [
        'symptom', 'disease', 'condition', 'medication', 'drug',
        'pain', 'ache', 'sick', 'ill', 'doctor', 'treatment',
        'diagnosis', 'health', 'medical', 'fever', 'cough'
    ];

    const isMedical = medicalKeywords.some(keyword =>
        userMessage.toLowerCase().includes(keyword)
    );

    if (!isMedical) {
        return null; // Not a medical query
    }

    console.log('🏥 Detected medical query, using Llama 3...');

    try {
        const response = await searchMedical(userMessage, {
            model: 'llama3',
            temperature: 0.3,
            includeRelated: true
        });

        return {
            text: response.answer + '\n\n' + response.disclaimer,
            confidence: response.confidence,
            sources: response.sources,
            relatedTopics: response.relatedTopics,
            provider: 'ollama',
            model: 'llama3',
            category: 'medical'
        };

    } catch (error) {
        console.error('Medical query error:', error);
        return {
            text: 'I apologize, but I encountered an error processing your medical query. Please consult a healthcare professional.',
            confidence: 0,
            sources: [],
            provider: 'error',
            category: 'medical'
        };
    }
}

// ==================== EXAMPLE 6: Multi-Turn Medical Conversation ====================

class MedicalConversation {
    private context: string = '';
    private history: Array<{ query: string; response: string }> = [];

    async ask(query: string) {
        console.log(`\n🏥 User: ${query}`);

        // Build context from conversation history
        const contextPrompt = this.history.length > 0
            ? `Previous conversation:\n${this.history.map(h =>
                `Q: ${h.query}\nA: ${h.response}`
            ).join('\n\n')}\n\nCurrent question: ${query}`
            : query;

        const response = await searchMedical(contextPrompt, {
            model: 'llama3',
            temperature: 0.3
        });

        // Store in history
        this.history.push({
            query,
            response: response.answer
        });

        console.log(`\n🤖 Assistant: ${response.answer}`);
        console.log(`\nConfidence: ${response.confidence}`);

        return response;
    }

    clear() {
        this.context = '';
        this.history = [];
        console.log('🔄 Conversation cleared');
    }
}

// ==================== EXAMPLE 7: Batch Medical Queries ====================

async function example7_BatchQueries() {
    console.log('🏥 Example 7: Batch Medical Queries\n');

    const queries = [
        "What is diabetes?",
        "What is hypertension?",
        "What is asthma?",
        "What is arthritis?"
    ];

    console.log('Processing', queries.length, 'queries in parallel...\n');

    const startTime = Date.now();

    const responses = await Promise.all(
        queries.map(query => searchMedical(query, { model: 'llama3' }))
    );

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    responses.forEach((response, index) => {
        console.log(`\n${index + 1}. ${queries[index]}`);
        console.log(`   Answer: ${response.answer.substring(0, 100)}...`);
        console.log(`   Confidence: ${response.confidence}`);
    });

    console.log(`\n✅ Processed ${queries.length} queries in ${totalTime}s`);
    console.log(`   Average: ${(parseFloat(totalTime) / queries.length).toFixed(2)}s per query`);
}

// ==================== EXAMPLE 8: Voice Assistant Integration ====================

export async function processVoiceQuery(
    userMessage: string,
    sessionId: string
) {
    // Check if it's a medical query
    const medicalResponse = await handleMedicalQuery(userMessage);

    if (medicalResponse) {
        // It's a medical query - use Llama 3
        return {
            response: medicalResponse.text,
            metadata: {
                provider: 'ollama',
                model: 'llama3',
                category: 'medical',
                confidence: medicalResponse.confidence,
                sources: medicalResponse.sources,
                relatedTopics: medicalResponse.relatedTopics
            }
        };
    }

    // Not a medical query - use regular LLM provider
    // (your existing voice assistant logic)
    return null;
}

// ==================== RUN EXAMPLES ====================

async function runAllExamples() {
    console.log('🏥 Medical Reasoning Examples with Llama 3\n');
    console.log('='.repeat(50));

    try {
        // Example 1
        await example1_BasicMedicalQuery();
        console.log('\n' + '='.repeat(50) + '\n');

        // Example 2
        await example2_SymptomChecker();
        console.log('\n' + '='.repeat(50) + '\n');

        // Example 3
        await example3_DrugInteractions();
        console.log('\n' + '='.repeat(50) + '\n');

        // Example 4
        await example4_MedicalTermExplainer();
        console.log('\n' + '='.repeat(50) + '\n');

        // Example 6: Multi-turn conversation
        console.log('🏥 Example 6: Multi-Turn Conversation\n');
        const conversation = new MedicalConversation();
        await conversation.ask("What is diabetes?");
        await conversation.ask("What are the treatment options?");
        await conversation.ask("Can it be prevented?");
        console.log('\n' + '='.repeat(50) + '\n');

        // Example 7
        await example7_BatchQueries();
        console.log('\n' + '='.repeat(50) + '\n');

        console.log('✅ All examples completed!');

    } catch (error) {
        console.error('❌ Error running examples:', error);
    }
}

// Uncomment to run examples
// runAllExamples();

// Export for use in other modules
export {
    example1_BasicMedicalQuery,
    example2_SymptomChecker,
    example3_DrugInteractions,
    example4_MedicalTermExplainer,
    MedicalConversation,
    runAllExamples
};
