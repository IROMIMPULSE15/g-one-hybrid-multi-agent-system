/**
 * Professional Response Formatter - Enterprise-Grade Output
 * Enhanced with synthesis metadata, confidence scores, and citations
 */

interface EnhancedResponse {
    // Core content
    content: {
        title: string
        summary: string
        sections: Section[]
    }

    // Metadata
    metadata: {
        confidence: number
        sources: string[]
        synthesized: boolean
        timestamp: string
        queryType: QueryType
    }

    // Quality indicators
    quality: {
        completeness: number
        accuracy: number
        clarity: number
    }

    // User experience
    ux: {
        readingTime: string
        complexity: 'beginner' | 'intermediate' | 'advanced'
        relatedQueries: string[]
    }
}

interface Section {
    heading: string
    content: string
    type: 'definition' | 'explanation' | 'example' | 'list' | 'summary' | 'warning' | 'tip'
    icon?: string
    priority: number
}

type QueryType = 'definition' | 'explanation' | 'comparison' | 'howto' | 'medical' | 'technical' | 'general'

/**
 * Main formatter with synthesis integration
 */
export class ProfessionalResponseFormatter {

    /**
     * Format synthesized answer with full metadata
     */
    static formatSynthesizedResponse(
        query: string,
        synthesisResult: {
            synthesized_answer: string
            confidence: number
            reasoning?: string
            sources?: string[]
        }
    ): EnhancedResponse {
        const queryType = this.detectQueryType(query)
        const topic = this.extractTopic(query)

        // Parse and structure the content
        const sections = this.createSections(
            synthesisResult.synthesized_answer,
            queryType
        )

        // Calculate quality metrics
        const quality = this.calculateQuality(
            synthesisResult.synthesized_answer,
            synthesisResult.confidence
        )

        // Generate UX enhancements
        const ux = this.enhanceUserExperience(
            synthesisResult.synthesized_answer,
            query,
            queryType
        )

        return {
            content: {
                title: topic,
                summary: this.generateSummary(synthesisResult.synthesized_answer),
                sections
            },
            metadata: {
                confidence: synthesisResult.confidence,
                sources: synthesisResult.sources || ['AI Synthesis'],
                synthesized: true,
                timestamp: new Date().toISOString(),
                queryType
            },
            quality,
            ux
        }
    }

    /**
     * Convert to markdown for display
     */
    static toMarkdown(response: EnhancedResponse): string {
        const { content, metadata, quality, ux } = response

        let markdown = `# ${content.title}\n\n`

        // Add summary with icon
        markdown += `## 📋 Quick Summary\n${content.summary}\n\n`

        // Add metadata bar
        markdown += this.generateMetadataBar(metadata, ux) + '\n\n'

        // Add sections
        for (const section of content.sections) {
            markdown += `## ${section.icon || ''} ${section.heading}\n`
            markdown += `${section.content}\n\n`
        }

        // Add quality indicators
        markdown += this.generateQualityFooter(quality, metadata) + '\n\n'

        // Add related queries
        if (ux.relatedQueries.length > 0) {
            markdown += `## 💡 Related Questions\n`
            markdown += ux.relatedQueries.map(q => `- ${q}`).join('\n') + '\n\n'
        }

        // Add sources
        if (metadata.sources.length > 0) {
            markdown += `---\n**Reference**: ${metadata.sources.join(', ')}\n`
        }

        return markdown
    }

    /**
     * Convert to JSON for API responses
     */
    static toJSON(response: EnhancedResponse): string {
        return JSON.stringify(response, null, 2)
    }

    /**
     * Convert to HTML for web display
     */
    static toHTML(response: EnhancedResponse): string {
        const { content, metadata, quality, ux } = response

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.title}</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #1a1a1a;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 2.5rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #667eea;
            font-size: 2.5rem;
            margin-bottom: 1rem;
            font-weight: 700;
        }
        .metadata-bar {
            display: flex;
            gap: 1.5rem;
            padding: 1rem;
            background: #f3f4f6;
            border-radius: 8px;
            margin-bottom: 2rem;
            font-size: 0.9rem;
        }
        .metadata-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .summary {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 1.5rem;
            margin-bottom: 2rem;
            border-radius: 4px;
        }
        .section {
            margin-bottom: 2rem;
        }
        .section h2 {
            color: #374151;
            font-size: 1.5rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .section-content {
            color: #4b5563;
            line-height: 1.8;
        }
        .quality-footer {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 2px solid #e5e7eb;
        }
        .quality-metric {
            text-align: center;
            padding: 1rem;
            background: #f9fafb;
            border-radius: 8px;
        }
        .quality-score {
            font-size: 2rem;
            font-weight: 700;
            color: #667eea;
        }
        .quality-label {
            font-size: 0.85rem;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .related-queries {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 1.5rem;
            border-radius: 4px;
            margin-top: 2rem;
        }
        .related-queries h3 {
            margin-top: 0;
            color: #92400e;
        }
        .related-queries ul {
            margin: 0;
            padding-left: 1.5rem;
        }
        .sources {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e5e7eb;
            font-size: 0.85rem;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${content.title}</h1>
        
        <div class="summary">
            <strong>📋 Quick Summary:</strong><br>
            ${content.summary}
        </div>
        
        ${this.generateMetadataBarHTML(metadata, ux)}
        
        ${content.sections.map(section => `
            <div class="section">
                <h2>${section.icon || ''} ${section.heading}</h2>
                <div class="section-content">${this.formatContent(section.content)}</div>
            </div>
        `).join('')}
        
        ${this.generateQualityFooterHTML(quality)}
        
        ${ux.relatedQueries.length > 0 ? `
            <div class="related-queries">
                <h3>💡 Related Questions</h3>
                <ul>
                    ${ux.relatedQueries.map(q => `<li>${q}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        
        <div class="sources">
            <strong>Reference:</strong> ${metadata.sources.join(', ')}
        </div>
    </div>
</body>
</html>
        `
    }

    // ==================== PRIVATE HELPER METHODS ====================

    private static createSections(content: string, queryType: QueryType): Section[] {
        const sections: Section[] = []

        switch (queryType) {
            case 'definition':
                sections.push(
                    { heading: 'Definition', content: this.extractDefinition(content), type: 'definition', icon: '📖', priority: 1 },
                    { heading: 'Key Points', content: this.extractKeyPoints(content), type: 'list', icon: '🔍', priority: 2 },
                    { heading: 'Example', content: this.extractExample(content), type: 'example', icon: '💡', priority: 3 },
                    { heading: 'Why It Matters', content: this.extractImportance(content), type: 'explanation', icon: '🎯', priority: 4 }
                )
                break

            case 'medical':
                sections.push(
                    { heading: 'Overview', content: this.extractOverview(content), type: 'explanation', icon: '🏥', priority: 1 },
                    { heading: 'Symptoms', content: this.extractSymptoms(content), type: 'list', icon: '⚠️', priority: 2 },
                    { heading: 'Treatment', content: this.extractTreatment(content), type: 'explanation', icon: '💊', priority: 3 },
                    { heading: 'When to See a Doctor', content: this.extractWarnings(content), type: 'warning', icon: '🚨', priority: 4 }
                )
                break

            case 'howto':
                sections.push(
                    { heading: 'Goal', content: this.extractGoal(content), type: 'explanation', icon: '🎯', priority: 1 },
                    { heading: 'Step-by-Step Guide', content: this.extractSteps(content), type: 'list', icon: '📋', priority: 2 },
                    { heading: 'Tips & Best Practices', content: this.extractTips(content), type: 'tip', icon: '💡', priority: 3 }
                )
                break

            case 'explanation':
                sections.push(
                    { heading: 'Detailed Explanation', content: content, type: 'explanation', icon: '📝', priority: 1 }
                )
                break

            default:
                sections.push(
                    { heading: 'Information', content: content, type: 'explanation', icon: '📝', priority: 1 }
                )
        }

        return sections.sort((a, b) => a.priority - b.priority)
    }

    private static calculateQuality(content: string, confidence: number): {
        completeness: number
        accuracy: number
        clarity: number
    } {
        const wordCount = content.split(/\s+/).length
        const sentenceCount = (content.match(/[.!?]+/g) || []).length

        // Completeness based on length and structure
        const completeness = Math.min(100, (wordCount / 200) * 100)

        // Accuracy from confidence score
        const accuracy = confidence * 100

        // Clarity based on sentence structure
        const avgWordsPerSentence = wordCount / Math.max(sentenceCount, 1)
        const clarity = Math.max(0, 100 - Math.abs(avgWordsPerSentence - 15) * 2)

        return {
            completeness: Math.round(completeness),
            accuracy: Math.round(accuracy),
            clarity: Math.round(clarity)
        }
    }

    private static enhanceUserExperience(content: string, query: string, queryType: QueryType): {
        readingTime: string
        complexity: 'beginner' | 'intermediate' | 'advanced'
        relatedQueries: string[]
    } {
        const wordCount = content.split(/\s+/).length
        const readingTime = `${Math.ceil(wordCount / 200)} min read`

        // Determine complexity
        const technicalTerms = (content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []).length
        const complexity = technicalTerms > 10 ? 'advanced' : technicalTerms > 5 ? 'intermediate' : 'beginner'

        // Generate related queries
        const relatedQueries = this.generateRelatedQueries(query, queryType)

        return { readingTime, complexity, relatedQueries }
    }

    private static generateRelatedQueries(query: string, queryType: QueryType): string[] {
        const topic = this.extractTopic(query)

        const templates = {
            definition: [
                `How does ${topic} work?`,
                `What are the benefits of ${topic}?`,
                `Examples of ${topic}`
            ],
            medical: [
                `How to prevent ${topic}?`,
                `Treatment options for ${topic}`,
                `Complications of ${topic}`
            ],
            howto: [
                `Common mistakes when ${topic}`,
                `Advanced tips for ${topic}`,
                `Tools needed for ${topic}`
            ],
            general: [
                `More about ${topic}`,
                `${topic} explained simply`,
                `Latest updates on ${topic}`
            ],
            technical: [
                `Technical details of ${topic}`,
                `How to implement ${topic}`,
                `Best practices for ${topic}`
            ],
            explanation: [
                `Deep dive into ${topic}`,
                `Why ${topic} matters`,
                `History of ${topic}`
            ],
            comparison: [
                `Alternatives to ${topic}`,
                `Pros and cons of ${topic}`,
                `${topic} vs competitors`
            ]
        }

        return templates[queryType] || templates.general
    }

    private static generateConfidenceBadge(confidence: number): string {
        const level = confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low'
        const emoji = confidence >= 0.8 ? '✅' : confidence >= 0.6 ? '⚠️' : '❓'
        return `${emoji} **Confidence**: ${level} (${(confidence * 100).toFixed(0)}%)`
    }

    private static generateConfidenceBadgeHTML(confidence: number): string {
        const level = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low'
        const text = confidence >= 0.8 ? 'High Confidence' : confidence >= 0.6 ? 'Medium Confidence' : 'Low Confidence'
        return `<div class="confidence-badge confidence-${level}">${text} (${(confidence * 100).toFixed(0)}%)</div>`
    }

    private static generateMetadataBar(metadata: any, ux: any): string {
        return `📊 **Reading Time**: ${ux.readingTime} | 🎓 **Level**: ${ux.complexity} | 🕒 **Updated**: ${new Date(metadata.timestamp).toLocaleString()}`
    }

    private static generateMetadataBarHTML(metadata: any, ux: any): string {
        return `
            <div class="metadata-bar">
                <div class="metadata-item">📊 <strong>Reading Time:</strong> ${ux.readingTime}</div>
                <div class="metadata-item">🎓 <strong>Level:</strong> ${ux.complexity}</div>
                <div class="metadata-item">🕒 <strong>Updated:</strong> ${new Date(metadata.timestamp).toLocaleString()}</div>
            </div>
        `
    }

    private static generateQualityFooter(quality: any, metadata: any): string {
        return `---
**Quality Metrics**
- Completeness: ${quality.completeness}%
- Accuracy: ${quality.accuracy}%
- Clarity: ${quality.clarity}%`
    }

    private static generateQualityFooterHTML(quality: any): string {
        return `
            <div class="quality-footer">
                <div class="quality-metric">
                    <div class="quality-score">${quality.completeness}%</div>
                    <div class="quality-label">Completeness</div>
                </div>
                <div class="quality-metric">
                    <div class="quality-score">${quality.accuracy}%</div>
                    <div class="quality-label">Accuracy</div>
                </div>
                <div class="quality-metric">
                    <div class="quality-score">${quality.clarity}%</div>
                    <div class="quality-label">Clarity</div>
                </div>
            </div>
        `
    }

    private static formatContent(content: string): string {
        // Convert markdown-style formatting to HTML
        return content
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
    }

    private static generateSummary(content: string): string {
        const sentences = content.match(/[^.!?]+[.!?]+/g) || []
        return sentences.slice(0, 2).join(' ').trim() || content.substring(0, 200) + '...'
    }

    // Extraction methods (reuse from existing formatter)
    private static extractTopic(query: string): string {
        const match = query.match(/(?:what is|explain|tell me about|how does|why does)\s+(.+?)(?:\?|$)/i)
        return match ? this.capitalizeFirst(match[1].trim()) : 'Response'
    }

    private static capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1)
    }

    private static detectQueryType(query: string): QueryType {
        const lowerQuery = query.toLowerCase()

        if (/diabetes|disease|symptom|treatment|medical|health|doctor/.test(lowerQuery)) {
            return 'medical'
        }
        if (/^what is|^define|^meaning of/.test(lowerQuery)) {
            return 'definition'
        }
        if (/^how to|^how do i|^how can i/.test(lowerQuery)) {
            return 'howto'
        }
        if (/algorithm|programming|code|technical|software/.test(lowerQuery)) {
            return 'technical'
        }
        if (/^how does|^why does|^explain/.test(lowerQuery)) {
            return 'explanation'
        }
        if (/\bvs\b|\bversus\b|compare/.test(lowerQuery)) {
            return 'comparison'
        }

        return 'general'
    }

    // Content extraction methods (simplified versions)
    private static extractDefinition(content: string): string {
        const sentences = content.match(/[^.!?]+[.!?]+/g) || []
        return sentences.slice(0, 2).join(' ').trim()
    }

    private static extractKeyPoints(content: string): string {
        const sentences = content.match(/[^.!?]+[.!?]+/g) || []
        return sentences.slice(0, 4).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')
    }

    private static extractExample(content: string): string {
        const match = content.match(/(?:for example|e\.g\.|such as|like|instance)[^.!?]*[.!?]/i)
        return match ? match[0] : "See detailed explanation above"
    }

    private static extractImportance(content: string): string {
        const match = content.match(/(?:important|significant|matters|crucial|essential)[^.!?]*[.!?]/i)
        return match ? match[0] : "This concept is fundamental to understanding the broader topic."
    }

    private static extractOverview(content: string): string {
        const sentences = content.match(/[^.!?]+[.!?]+/g) || []
        return sentences.slice(0, 3).join(' ')
    }

    private static extractDetails(content: string): string {
        const sentences = content.match(/[^.!?]+[.!?]+/g) || []
        return sentences.slice(2, -2).join(' ')
    }

    private static extractTakeaways(content: string): string {
        const sentences = content.match(/[^.!?]+[.!?]+/g) || []
        return sentences.slice(-3).map((s, i) => `✓ ${s.trim()}`).join('\n')
    }

    private static extractSymptoms(content: string): string {
        const match = content.match(/symptoms?[^.!?]*[.!?]/i)
        return match ? match[0] : "Consult with a healthcare professional for accurate diagnosis."
    }

    private static extractTreatment(content: string): string {
        const match = content.match(/treatment[^.!?]*[.!?]/i)
        return match ? match[0] : "Treatment options vary. Consult with a healthcare professional."
    }

    private static extractWarnings(content: string): string {
        return "⚠️ **Important**: This information is for educational purposes only. Always consult with a qualified healthcare professional for medical advice."
    }

    private static extractGoal(content: string): string {
        const sentences = content.match(/[^.!?]+[.!?]+/g) || []
        return sentences[0] || "Complete the task successfully"
    }

    private static extractSteps(content: string): string {
        const steps = content.match(/\d+\.\s*[^.!?]+[.!?]/g)
        if (steps && steps.length > 0) {
            return steps.join('\n')
        }
        const sentences = content.match(/[^.!?]+[.!?]+/g) || []
        return sentences.slice(0, 5).map((s, i) => `**Step ${i + 1}**: ${s.trim()}`).join('\n\n')
    }

    private static extractTips(content: string): string {
        return `💡 **Tip 1**: Take your time and follow each step carefully\n💡 **Tip 2**: Practice makes perfect\n💡 **Tip 3**: Don't hesitate to ask for help`
    }
}

// Export for use in API routes
export default ProfessionalResponseFormatter
