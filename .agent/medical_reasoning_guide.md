# 🏥 Medical Reasoning with Llama 3 + Ollama

## Overview

This guide explains how to use Llama 3 with Ollama for medical reasoning in the V64 voice assistant system.

## Why Llama 3 for Medical Reasoning?

### Advantages

1. **Privacy & Security** 🔒
   - All medical data stays on your local machine
   - HIPAA-compliant (no data sent to external APIs)
   - Perfect for sensitive health information

2. **Cost-Effective** 💰
   - No API costs for medical queries
   - Unlimited usage without rate limits
   - One-time setup, free forever

3. **Strong Reasoning** 🧠
   - Llama 3 has excellent logical reasoning capabilities
   - Handles complex medical terminology well
   - Can perform multi-step medical analysis

4. **Customizable** ⚙️
   - Can be fine-tuned on medical datasets
   - Adjustable temperature for accuracy
   - Specialized prompts for different medical queries

## Setup Instructions

### Step 1: Install Ollama

Download and install Ollama from [ollama.ai](https://ollama.ai)

### Step 2: Pull Llama 3 Models

You have several Llama 3 options:

```bash
# Llama 3.2 (3B) - Fast, good for general queries
ollama pull llama3.2:3b

# Llama 3.2 (1B) - Very fast, lighter reasoning
ollama pull llama3.2:1b

# Llama 3.1 (8B) - Better reasoning, slower
ollama pull llama3.1:8b

# Llama 3 (8B) - Original, excellent quality
ollama pull llama3

# Llama 3 (70B) - Best quality, requires powerful GPU
ollama pull llama3:70b
```

### Step 3: Recommended Model for Medical Reasoning

For the best balance of speed and accuracy:

```bash
ollama pull llama3
```

This is the standard Llama 3 8B model, which provides:
- Excellent medical reasoning
- Good speed on most hardware
- Comprehensive responses

### Step 4: Configure Environment

Update your `.env` file:

```env
# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Set Ollama as primary provider
LLM_PROVIDER=ollama
```

### Step 5: Start Ollama

```bash
# On Windows/Mac: Ollama runs automatically
# On Linux:
ollama serve
```

## Medical Search Features

### 1. General Medical Search

```typescript
import { searchMedical } from './medicalsearch';

const response = await searchMedical(
  "What are the symptoms of diabetes?",
  {
    model: 'llama3',
    temperature: 0.3,
    includeRelated: true
  }
);

console.log(response.answer);
console.log(response.confidence);
console.log(response.relatedTopics);
```

### 2. Symptom Checker

```typescript
import { checkSymptoms } from './medicalsearch';

const response = await checkSymptoms(
  ['fever', 'cough', 'fatigue'],
  {
    age: 35,
    duration: '3 days',
    severity: 'moderate'
  }
);
```

### 3. Drug Interaction Checker

```typescript
import { checkDrugInteractions } from './medicalsearch';

const response = await checkDrugInteractions([
  'aspirin',
  'ibuprofen',
  'warfarin'
]);
```

### 4. Medical Term Explainer

```typescript
import { explainMedicalTerm } from './medicalsearch';

const response = await explainMedicalTerm('hypertension');
```

## Query Types

The system automatically classifies medical queries into:

### 1. **Symptom Queries**
- Keywords: symptom, feel, pain, ache, hurt, sick
- Example: "I have a headache and fever"
- Response includes: possible causes, when to seek care, self-care tips

### 2. **Condition Queries**
- Keywords: disease, condition, disorder, diagnosis
- Example: "What is diabetes?"
- Response includes: overview, causes, symptoms, treatment

### 3. **Drug Queries**
- Keywords: drug, medication, medicine, prescription
- Example: "What are the side effects of aspirin?"
- Response includes: purpose, mechanism, dosage, side effects

### 4. **Procedure Queries**
- Keywords: surgery, procedure, operation, treatment
- Example: "What happens during an MRI?"
- Response includes: purpose, process, preparation, recovery

### 5. **General Medical Queries**
- Everything else
- Example: "How does the immune system work?"

## Temperature Settings

For medical queries, use lower temperatures for accuracy:

```typescript
// High accuracy (recommended for medical)
temperature: 0.2 - 0.3

// Balanced
temperature: 0.5

// Creative (not recommended for medical)
temperature: 0.7 - 1.0
```

## Integration with Voice Assistant

The medical search module integrates seamlessly with your voice assistant:

```typescript
// In your voice assistant route
import { searchMedical } from './medicalsearch';

// Detect medical queries
if (isMedicalQuery(userMessage)) {
  const medicalResponse = await searchMedical(userMessage);
  
  return {
    text: medicalResponse.answer + '\n\n' + medicalResponse.disclaimer,
    confidence: medicalResponse.confidence,
    sources: medicalResponse.sources
  };
}
```

## Best Practices

### 1. Always Include Disclaimers
```typescript
const MEDICAL_DISCLAIMER = `
⚠️ This information is for educational purposes only. 
Always consult with a qualified healthcare provider.
`;
```

### 2. Use Low Temperature
```typescript
// For medical accuracy
temperature: 0.2 - 0.3
```

### 3. Provide Context
```typescript
const prompt = `
You are a medical knowledge assistant.
Provide accurate, evidence-based information.
Always emphasize consulting healthcare professionals.

Query: ${userQuery}
`;
```

### 4. Validate Responses
```typescript
// Check response quality
const confidence = calculateConfidence(response);
if (confidence < 0.5) {
  // Suggest consulting a professional
}
```

## Performance Optimization

### 1. Model Selection

| Model | Speed | Quality | RAM Required | Use Case |
|-------|-------|---------|--------------|----------|
| llama3.2:1b | ⚡⚡⚡ | ⭐⭐ | 2GB | Quick lookups |
| llama3.2:3b | ⚡⚡ | ⭐⭐⭐ | 4GB | General queries |
| llama3 (8B) | ⚡ | ⭐⭐⭐⭐ | 8GB | **Recommended** |
| llama3.1:8b | ⚡ | ⭐⭐⭐⭐⭐ | 8GB | Complex reasoning |
| llama3:70b | 🐌 | ⭐⭐⭐⭐⭐ | 40GB+ | Research-grade |

### 2. Caching

The LLM provider includes automatic caching:

```typescript
// Responses are cached for 1 hour
// Identical queries return instantly
const response = await searchMedical(query); // Cached!
```

### 3. Batch Processing

For multiple queries:

```typescript
const queries = [
  "What is diabetes?",
  "What is hypertension?",
  "What is asthma?"
];

const responses = await Promise.all(
  queries.map(q => searchMedical(q))
);
```

## Advanced Features

### 1. Custom Medical Prompts

```typescript
const customPrompt = `
You are a pediatric specialist.
Focus on child-friendly explanations.

Query: ${userQuery}
`;
```

### 2. Multi-Turn Conversations

```typescript
// Maintain context across queries
let context = "";

const response1 = await searchMedical("What is diabetes?");
context += response1.answer;

const response2 = await searchMedical(
  "What are the treatment options?",
  { context }
);
```

### 3. Confidence Scoring

```typescript
const response = await searchMedical(query);

if (response.confidence > 0.8) {
  // High confidence - reliable information
} else if (response.confidence > 0.5) {
  // Moderate confidence - suggest verification
} else {
  // Low confidence - recommend professional consultation
}
```

## Troubleshooting

### Issue: "Ollama is not running"

**Solution:**
```bash
# Start Ollama service
ollama serve

# Or restart the Ollama app
```

### Issue: "Model not found"

**Solution:**
```bash
# Pull the model
ollama pull llama3

# Verify it's installed
ollama list
```

### Issue: "Slow responses"

**Solutions:**
1. Use a smaller model: `llama3.2:3b`
2. Reduce max_tokens: `maxTokens: 1024`
3. Enable GPU acceleration (if available)

### Issue: "Out of memory"

**Solutions:**
1. Use smaller model: `llama3.2:1b`
2. Close other applications
3. Increase system swap space

## Testing

### Test the Medical Search

```bash
# Create a test file
node -e "
const { searchMedical } = require('./medicalsearch');

searchMedical('What is diabetes?').then(response => {
  console.log('Answer:', response.answer);
  console.log('Confidence:', response.confidence);
  console.log('Sources:', response.sources);
});
"
```

### Test Ollama Connection

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3",
  "prompt": "What is diabetes?",
  "stream": false
}'
```

## Security Considerations

1. **Data Privacy**: All medical data stays local
2. **No Logging**: Disable logging for sensitive queries
3. **Encryption**: Use HTTPS for web interface
4. **Access Control**: Implement user authentication
5. **Disclaimers**: Always include medical disclaimers

## Future Enhancements

1. **Fine-tuning**: Train on medical datasets
2. **RAG Integration**: Add medical knowledge base
3. **Multi-modal**: Support medical images
4. **Specialized Models**: Use medical-specific LLMs
5. **Clinical Decision Support**: Advanced diagnostic tools

## Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Llama 3 Model Card](https://ai.meta.com/llama/)
- [Medical AI Ethics](https://www.who.int/publications/i/item/9789240029200)
- [HIPAA Compliance](https://www.hhs.gov/hipaa/index.html)

## Support

For issues or questions:
1. Check Ollama logs: `ollama logs`
2. Review system requirements
3. Consult the troubleshooting section
4. Open an issue on GitHub

---

**Remember**: This is an educational tool. Always consult qualified healthcare professionals for medical advice, diagnosis, or treatment.
