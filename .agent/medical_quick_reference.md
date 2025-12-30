# 🏥 Medical Reasoning Quick Reference

## Quick Start

### 1. Pull Llama 3
```bash
ollama pull llama3
```

### 2. Import and Use
```typescript
import { searchMedical } from './medicalsearch';

const response = await searchMedical("What is diabetes?");
console.log(response.answer);
```

## Common Use Cases

### General Medical Question
```typescript
const response = await searchMedical("What causes high blood pressure?", {
  model: 'llama3',
  temperature: 0.3
});
```

### Symptom Analysis
```typescript
import { checkSymptoms } from './medicalsearch';

const response = await checkSymptoms(
  ['fever', 'cough', 'fatigue'],
  { age: 35, duration: '3 days', severity: 'moderate' }
);
```

### Drug Information
```typescript
const response = await searchMedical(
  "What are the side effects of aspirin?",
  { temperature: 0.2 } // Lower temp for accuracy
);
```

### Drug Interactions
```typescript
import { checkDrugInteractions } from './medicalsearch';

const response = await checkDrugInteractions([
  'aspirin',
  'ibuprofen'
]);
```

### Medical Term Explanation
```typescript
import { explainMedicalTerm } from './medicalsearch';

const response = await explainMedicalTerm('hypertension');
```

## Temperature Guide

| Use Case | Temperature | Reason |
|----------|-------------|--------|
| Diagnosis/Symptoms | 0.2 | Maximum accuracy |
| Drug Information | 0.2-0.3 | High accuracy needed |
| General Medical Info | 0.3-0.4 | Balanced |
| Medical Education | 0.4-0.5 | Slightly creative |

## Model Recommendations

| Model | RAM | Speed | Quality | Best For |
|-------|-----|-------|---------|----------|
| llama3.2:1b | 2GB | ⚡⚡⚡ | ⭐⭐ | Quick lookups |
| llama3.2:3b | 4GB | ⚡⚡ | ⭐⭐⭐ | General use |
| **llama3** | 8GB | ⚡ | ⭐⭐⭐⭐ | **Recommended** |
| llama3.1:8b | 8GB | ⚡ | ⭐⭐⭐⭐⭐ | Complex reasoning |

## Response Structure

```typescript
interface MedicalResponse {
  answer: string;           // The medical information
  confidence: number;       // 0-1 confidence score
  sources: string[];        // Information sources
  disclaimer: string;       // Medical disclaimer
  relatedTopics?: string[]; // Related medical topics
}
```

## Integration with Voice Assistant

```typescript
// In your route.ts
import { handleMedicalQuery } from './medical-examples';

// Check if query is medical
const medicalResponse = await handleMedicalQuery(userMessage);

if (medicalResponse) {
  return NextResponse.json({
    response: medicalResponse.text,
    provider: 'ollama',
    model: 'llama3',
    category: 'medical'
  });
}
```

## Environment Variables

```env
# .env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
LLM_PROVIDER=ollama
```

## Common Commands

```bash
# List installed models
ollama list

# Pull a model
ollama pull llama3

# Remove a model
ollama rm llama3

# Check Ollama status
curl http://localhost:11434/api/tags

# Test a query
ollama run llama3 "What is diabetes?"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Ollama not running" | Run `ollama serve` or start Ollama app |
| "Model not found" | Run `ollama pull llama3` |
| Slow responses | Use smaller model: `llama3.2:3b` |
| Out of memory | Use `llama3.2:1b` or close other apps |

## Best Practices

✅ **DO:**
- Use low temperature (0.2-0.3) for medical accuracy
- Always include medical disclaimers
- Validate response confidence
- Cache common queries
- Use specific medical prompts

❌ **DON'T:**
- Use high temperature for medical queries
- Skip disclaimers
- Provide diagnoses
- Store sensitive medical data
- Ignore low confidence scores

## Safety Guidelines

1. **Always include disclaimers** - Medical info is educational only
2. **Recommend professional consultation** - For serious symptoms
3. **Don't diagnose** - Provide information, not diagnoses
4. **Validate responses** - Check confidence scores
5. **Privacy first** - Keep medical data local

## Example Queries

### Good Queries ✅
- "What are the symptoms of diabetes?"
- "How does aspirin work?"
- "What is the difference between Type 1 and Type 2 diabetes?"
- "What are common treatments for hypertension?"

### Avoid ❌
- "Do I have cancer?" (diagnosis)
- "Should I stop taking my medication?" (medical advice)
- "What's wrong with me?" (too vague)

## Performance Tips

1. **Use caching** - Identical queries return instantly
2. **Batch queries** - Use `Promise.all()` for multiple queries
3. **Choose right model** - Balance speed vs. quality
4. **Optimize prompts** - Be specific and clear
5. **Monitor confidence** - Low confidence = suggest professional help

## Resources

- 📖 Full Guide: `.agent/medical_reasoning_guide.md`
- 💻 Examples: `app/api/voice-assistant/medical-examples.ts`
- 🔧 Setup Script: `setup-medical-reasoning.ps1`
- 🏥 Medical Module: `app/api/voice-assistant/medicalsearch.ts`

## Support

For issues:
1. Check Ollama logs: `ollama logs`
2. Verify model is installed: `ollama list`
3. Test connection: `curl http://localhost:11434/api/tags`
4. Review troubleshooting guide above

---

**Remember**: This is an educational tool. Always consult qualified healthcare professionals for medical advice.
