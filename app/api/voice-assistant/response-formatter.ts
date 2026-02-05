/**
 * Response Formatter - Creates well-structured, comprehensive explanations
 * Formats AI responses with proper sections, examples, and clarity
 */

interface FormattedResponse {
    title: string
    sections: Array<{
        heading: string
        content: string
        type: 'definition' | 'explanation' | 'example' | 'list' | 'summary'
    }>
}

/**
 * Format response into structured sections
 */
export function formatStructuredResponse(
    query: string,
    rawResponse: string,
    queryType: 'definition' | 'explanation' | 'comparison' | 'howto' | 'general'
): string {
    const topic = extractTopic(query)

    // Define structure based on query type
    switch (queryType) {
        case 'definition':
            return formatDefinitionResponse(topic, rawResponse)
        case 'explanation':
            return formatExplanationResponse(topic, rawResponse)
        case 'comparison':
            return formatComparisonResponse(topic, rawResponse)
        case 'howto':
            return formatHowToResponse(topic, rawResponse)
        default:
            return formatGeneralResponse(topic, rawResponse)
    }
}

/**
 * Format definition-type responses (What is X?)
 */
function formatDefinitionResponse(topic: string, content: string): string {
    return `# ${topic}

## 📖 Definition
${extractDefinition(content)}

## 🔍 Key Points
${extractKeyPoints(content)}

## 💡 Simple Example
${extractExample(content)}

## 🎯 Why It Matters
${extractImportance(content)}

## 📚 Related Concepts
${extractRelatedConcepts(content)}
`
}

/**
 * Format explanation-type responses (How/Why does X work?)
 */
function formatExplanationResponse(topic: string, content: string): string {
    return `# ${topic}

## 🎯 Overview
${extractOverview(content)}

## ⚙️ How It Works
${extractMechanism(content)}

## 📊 Step-by-Step Breakdown
${extractSteps(content)}

## 💡 Real-World Example
${extractRealExample(content)}

## ✅ Key Takeaways
${extractTakeaways(content)}
`
}

/**
 * Format comparison responses (X vs Y)
 */
function formatComparisonResponse(topic: string, content: string): string {
    const [itemA, itemB] = extractComparisonItems(topic)

    return `# ${topic}

## 📊 Quick Comparison

| Aspect | ${itemA} | ${itemB} |
|--------|----------|----------|
${extractComparisonTable(content)}

## 🔍 Detailed Analysis

### ${itemA}
${extractItemDetails(content, itemA)}

### ${itemB}
${extractItemDetails(content, itemB)}

## 🎯 When to Use Each
${extractUseCases(content)}

## ✅ Summary
${extractComparisonSummary(content)}
`
}

/**
 * Format how-to responses
 */
function formatHowToResponse(topic: string, content: string): string {
    return `# ${topic}

## 🎯 Goal
${extractGoal(content)}

## 📋 Prerequisites
${extractPrerequisites(content)}

## 🔧 Step-by-Step Guide
${extractDetailedSteps(content)}

## ⚠️ Common Mistakes
${extractMistakes(content)}

## 💡 Tips & Best Practices
${extractTips(content)}

## ✅ Summary
${extractSummary(content)}
`
}

/**
 * Format general responses
 */
function formatGeneralResponse(topic: string, content: string): string {
    return `# ${topic}

${organizeContent(content)}

---
*Response generated with structured formatting for clarity*
`
}

// ==================== HELPER FUNCTIONS ====================

function extractTopic(query: string): string {
    // Extract main topic from query
    const match = query.match(/(?:what is|explain|tell me about|how does|why does)\s+(.+?)(?:\?|$)/i)
    return match ? capitalizeFirst(match[1].trim()) : 'Response'
}

function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function extractDefinition(content: string): string {
    // Extract first 2-3 sentences as definition
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    return sentences.slice(0, 2).join(' ').trim() || content.substring(0, 200)
}

function extractKeyPoints(content: string): string {
    // Look for bullet points or create from content
    const bullets = content.match(/[-•]\s*(.+)/g)
    if (bullets && bullets.length > 0) {
        return bullets.slice(0, 5).join('\n')
    }

    // Generate key points from sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    return sentences.slice(0, 4)
        .map((s, i) => `${i + 1}. ${s.trim()}`)
        .join('\n')
}

function extractExample(content: string): string {
    // Look for example keywords
    const exampleMatch = content.match(/(?:for example|e\.g\.|such as|like|instance)[^.!?]*[.!?]/i)
    if (exampleMatch) {
        return exampleMatch[0]
    }

    return "Example: " + (content.match(/[^.!?]+[.!?]+/g)?.[2] || "See detailed explanation above")
}

function extractImportance(content: string): string {
    const importanceKeywords = /(?:important|significant|matters|crucial|essential|key)[^.!?]*[.!?]/i
    const match = content.match(importanceKeywords)
    return match ? match[0] : "This concept is fundamental to understanding the broader topic."
}

function extractRelatedConcepts(content: string): string {
    // Extract capitalized terms that might be related concepts
    const concepts = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
    const unique = [...new Set(concepts)].slice(0, 5)
    return unique.length > 0 ? unique.map(c => `- ${c}`).join('\n') : "- See related topics in the explanation"
}

function extractOverview(content: string): string {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    return sentences.slice(0, 3).join(' ')
}

function extractMechanism(content: string): string {
    // Look for "how" or "works" explanations
    const mechanismMatch = content.match(/(?:works by|functions by|operates by|mechanism)[^.!?]*[.!?]/i)
    return mechanismMatch ? mechanismMatch[0] : extractOverview(content)
}

function extractSteps(content: string): string {
    // Look for numbered steps
    const steps = content.match(/\d+\.\s*[^.!?]+[.!?]/g)
    if (steps && steps.length > 0) {
        return steps.join('\n')
    }

    // Create steps from sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    return sentences.slice(0, 5)
        .map((s, i) => `**Step ${i + 1}**: ${s.trim()}`)
        .join('\n\n')
}

function extractRealExample(content: string): string {
    return extractExample(content)
}

function extractTakeaways(content: string): string {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    return sentences.slice(-3)
        .map((s, i) => `✓ ${s.trim()}`)
        .join('\n')
}

function extractComparisonItems(topic: string): [string, string] {
    const match = topic.match(/(.+?)\s+(?:vs|versus|compared to|vs\.)\s+(.+)/i)
    if (match) {
        return [match[1].trim(), match[2].trim()]
    }
    return ['Option A', 'Option B']
}

function extractComparisonTable(content: string): string {
    // Simple table generation
    return `| Feature 1 | Details A | Details B |
| Feature 2 | Details A | Details B |
| Feature 3 | Details A | Details B |`
}

function extractItemDetails(content: string, item: string): string {
    // Extract content related to specific item
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    return sentences.slice(0, 3).join(' ')
}

function extractUseCases(content: string): string {
    return `- **Use Case 1**: ${content.substring(0, 100)}
- **Use Case 2**: See detailed analysis above`
}

function extractComparisonSummary(content: string): string {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    return sentences.slice(-2).join(' ')
}

function extractGoal(content: string): string {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    return sentences[0] || "Complete the task successfully"
}

function extractPrerequisites(content: string): string {
    return `- Basic understanding of the topic
- Required tools or resources
- Time commitment: Varies`
}

function extractDetailedSteps(content: string): string {
    return extractSteps(content)
}

function extractMistakes(content: string): string {
    return `- Common mistake 1: Not following steps in order
- Common mistake 2: Skipping important details
- Common mistake 3: Not verifying results`
}

function extractTips(content: string): string {
    return `💡 **Tip 1**: Take your time and follow each step carefully
💡 **Tip 2**: Practice makes perfect
💡 **Tip 3**: Don't hesitate to ask for help`
}

function extractSummary(content: string): string {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    return sentences.slice(-2).join(' ') || "See detailed explanation above"
}

function organizeContent(content: string): string {
    // Add basic structure to unstructured content
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []

    if (sentences.length <= 3) {
        return content
    }

    const intro = sentences.slice(0, 2).join(' ')
    const body = sentences.slice(2, -2).join(' ')
    const conclusion = sentences.slice(-2).join(' ')

    return `## Overview
${intro}

## Details
${body}

## Summary
${conclusion}`
}

/**
 * Detect query type from question
 */
export function detectQueryType(query: string): 'definition' | 'explanation' | 'comparison' | 'howto' | 'general' {
    const lowerQuery = query.toLowerCase()

    if (/^what is|^define|^meaning of/.test(lowerQuery)) {
        return 'definition'
    }

    if (/^how does|^why does|^explain|^how come/.test(lowerQuery)) {
        return 'explanation'
    }

    if (/\bvs\b|\bversus\b|compare|difference between/.test(lowerQuery)) {
        return 'comparison'
    }

    if (/^how to|^how do i|^how can i/.test(lowerQuery)) {
        return 'howto'
    }

    return 'general'
}
