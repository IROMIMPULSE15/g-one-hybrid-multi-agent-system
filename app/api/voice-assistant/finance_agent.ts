/**
 * FinanceGuard — Financial Risk Advisor Agent
 * =============================================
 * Voice → Financial Analysis → Structured Output
 *
 * Features:
 *   1. Loan EMI Simulation — Calculate EMIs with amortization breakdown
 *   2. Investment Risk Analysis — Assess risk level of investment queries
 *   3. Portfolio Diversification — Suggest optimal allocation strategies
 *   4. Financial Term Explainer — Plain-English breakdown of jargon
 *
 * All calculations are local (zero API cost). LLM is used only for
 * natural-language advice generation when Ollama/Gemini is available.
 */

import { generateWithProvider } from './llm_provider'

// ==================== TYPES ====================

interface EMIResult {
    principal: number
    annualRate: number
    tenureMonths: number
    emi: number
    totalPayment: number
    totalInterest: number
    interestPercent: number
    amortization: AmortizationRow[]
}

interface AmortizationRow {
    month: number
    emi: number
    principalComponent: number
    interestComponent: number
    outstandingBalance: number
}

interface RiskProfile {
    level: 'Low' | 'Moderate' | 'High' | 'Very High'
    score: number          // 1–10
    emoji: string
    color: string
    factors: string[]
    recommendation: string
}

interface PortfolioAllocation {
    asset: string
    percentage: number
    emoji: string
    rationale: string
}

interface FinanceResult {
    response: string
    cotSteps: string[]
    sources: string[]
    cached: boolean
}

interface CacheEntry {
    result: FinanceResult
    timestamp: number
}

// ==================== CONFIGURATION ====================

const CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour (financial calcs rarely change)
const MAX_CACHE_SIZE = 100

// ==================== IN-MEMORY CACHE ====================

const financeCache = new Map<string, CacheEntry>()

function getCacheKey(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ')
}

function getCachedResult(query: string): FinanceResult | null {
    const key = getCacheKey(query)
    const entry = financeCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        financeCache.delete(key)
        return null
    }
    return { ...entry.result, cached: true }
}

function setCachedResult(query: string, result: FinanceResult): void {
    const key = getCacheKey(query)
    if (financeCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = financeCache.keys().next().value
        if (oldestKey) financeCache.delete(oldestKey)
    }
    financeCache.set(key, { result, timestamp: Date.now() })
}

// ==================== INTENT DETECTION ====================

const FINANCE_PATTERNS = [
    // EMI / Loan
    /\b(emi|equated monthly|loan|mortgage|home loan|car loan|personal loan|education loan)\b/i,
    /\b(installment|instalment|monthly payment)\b.*\b(loan|lakh|crore|lacs?|\d)/i,
    /\b(borrow|borrowing|repay|repayment)\b.*\b(bank|loan|amount|\d)/i,
    // Investment / Risk
    /\b(invest|investment|portfolio|mutual fund|sip|stock|share|equity|bond|debenture|gold|crypto|bitcoin|nifty|sensex)\b/i,
    /\b(risk|risky|safe|volatile|volatility|return|roi|cagr|compound|compounding)\b.*\b(invest|money|fund|market|portfolio)/i,
    /\b(finance ?guard|financial? advisor|finance agent)\b/i,
    // Budgeting / Diversification
    /\b(diversif|allocat|asset mix|rebalance)\b/i,
    /\b(budget|saving|savings|retirement|pension|ppf|epf|nps|elss|tax sav)\b/i,
    /\b(fd|fixed deposit|rd|recurring deposit)\b/i,
    // Direct calculation patterns
    /\b\d+\s*(lakh|lac|crore|k)\b.*\b(loan|emi|interest|rate|year|month|percent|%)\b/i,
    /\b(interest rate|rate of interest)\b.*\b\d/i,
]

export function isFinanceIntent(message: string): boolean {
    const m = message.toLowerCase().trim()
    return FINANCE_PATTERNS.some(pattern => pattern.test(m))
}

// ==================== SUB-INTENT CLASSIFIER ====================

type FinanceSubIntent = 'emi' | 'risk_analysis' | 'diversification' | 'general_finance'

function classifyFinanceSubIntent(message: string): FinanceSubIntent {
    const m = message.toLowerCase()

    // 1. EMI Calculator (Explicit calculation words)
    if (/\b(emi|calculate payment|monthly payment|loan|mortgage)\b/i.test(m) && /\b(calculate|what is|how much)\b/i.test(m)) {
        return 'emi'
    }

    // 2. Portfolio Diversification (Explicit strategy words)
    if (/\b(diversif|allocat|asset mix|portfolio split|suggest portfolio)\b/i.test(m)) {
        return 'diversification'
    }

    // 3. Risk Analysis (Explicit analysis requests)
    // Only trigger if user asks to "analyze", "check", "rate" risk, or asks "is X safe/risky?"
    // Do NOT trigger for "give me high risk stocks" or "high risk investment"
    if (/\b(analyze|analyse|check|rate|calculate|evaluate)\b.*\b(risk|safety)\b/i.test(m)) {
        return 'risk_analysis'
    }
    if (/^is .+ (safe|risky|good investment)/i.test(m)) {
        return 'risk_analysis'
    }

    // 4. Default: General Finance (LLM)
    // "give 4 high risk stocks", "best stocks to buy", "how to save tax" -> Go to LLM
    return 'general_finance'
}

// ==================== EMI CALCULATOR ====================

function parseAmount(text: string): number | null {
    // Match patterns like "10 lakh", "5 crore", "500000", "50k"
    const patterns = [
        { regex: /([\d,.]+)\s*crore/i, multiplier: 10_000_000 },
        { regex: /([\d,.]+)\s*(?:lakh|lac|lacs)/i, multiplier: 100_000 },
        { regex: /([\d,.]+)\s*k\b/i, multiplier: 1_000 },
        { regex: /(?:rs\.?|₹|inr)\s*([\d,.]+)/i, multiplier: 1 },
        { regex: /([\d,]{4,})/i, multiplier: 1 },  // plain large number
    ]

    for (const { regex, multiplier } of patterns) {
        const match = text.match(regex)
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ''))
            if (!isNaN(num) && num > 0) return num * multiplier
        }
    }
    return null
}

function parseRate(text: string): number | null {
    const match = text.match(/([\d.]+)\s*(%|percent|per\s*cent|interest|rate)/i)
    if (match) {
        const rate = parseFloat(match[1])
        if (!isNaN(rate) && rate > 0 && rate < 100) return rate
    }
    // Fallback: look for a decimal between 1 and 30 near "rate" or "interest"
    if (/\b(rate|interest)\b/i.test(text)) {
        const nums = text.match(/\b(\d{1,2}(?:\.\d{1,2})?)\b/g)
        if (nums) {
            for (const n of nums) {
                const val = parseFloat(n)
                if (val >= 1 && val <= 30) return val
            }
        }
    }
    return null
}

function parseTenure(text: string): number | null {
    // Years
    const yearMatch = text.match(/([\d.]+)\s*(?:year|yr|yrs)/i)
    if (yearMatch) {
        const years = parseFloat(yearMatch[1])
        if (!isNaN(years) && years > 0) return Math.round(years * 12)
    }
    // Months
    const monthMatch = text.match(/([\d.]+)\s*(?:month|mon|mo)\b/i)
    if (monthMatch) {
        const months = parseFloat(monthMatch[1])
        if (!isNaN(months) && months > 0) return Math.round(months)
    }
    return null
}

function calculateEMI(principal: number, annualRate: number, tenureMonths: number): EMIResult {
    const monthlyRate = annualRate / 12 / 100

    let emi: number
    if (monthlyRate === 0) {
        emi = principal / tenureMonths
    } else {
        emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) /
            (Math.pow(1 + monthlyRate, tenureMonths) - 1)
    }

    const totalPayment = emi * tenureMonths
    const totalInterest = totalPayment - principal

    // Build amortization table (first 12 months + last month)
    const amortization: AmortizationRow[] = []
    let balance = principal

    for (let month = 1; month <= tenureMonths; month++) {
        const interestComponent = balance * monthlyRate
        const principalComponent = emi - interestComponent
        balance = Math.max(0, balance - principalComponent)

        // Show first 6, yearly milestones, and last month
        if (month <= 6 || month % 12 === 0 || month === tenureMonths) {
            amortization.push({
                month,
                emi: Math.round(emi),
                principalComponent: Math.round(principalComponent),
                interestComponent: Math.round(interestComponent),
                outstandingBalance: Math.round(balance)
            })
        }
    }

    return {
        principal,
        annualRate,
        tenureMonths,
        emi: Math.round(emi),
        totalPayment: Math.round(totalPayment),
        totalInterest: Math.round(totalInterest),
        interestPercent: Math.round((totalInterest / principal) * 100 * 10) / 10,
        amortization
    }
}

function formatCurrency(amount: number): string {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`
    if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)} Lakh`
    return `₹${amount.toLocaleString('en-IN')}`
}

function formatEMIResponse(emi: EMIResult): string {
    const parts: string[] = [
        `FinanceGuard - Loan EMI Simulation`,
        '',
        `Loan Summary:`,
        `  Loan Amount: ${formatCurrency(emi.principal)}`,
        `  Interest Rate: ${emi.annualRate}% per annum`,
        `  Tenure: ${emi.tenureMonths} months (${(emi.tenureMonths / 12).toFixed(1)} years)`,
        `  Monthly EMI: ${formatCurrency(emi.emi)}`,
        `  Total Payment: ${formatCurrency(emi.totalPayment)}`,
        `  Total Interest: ${formatCurrency(emi.totalInterest)} (${emi.interestPercent}% of principal)`,
        '',
    ]

    // Amortization highlights
    if (emi.amortization.length > 0) {
        parts.push('Amortization Schedule:')
        for (const row of emi.amortization) {
            parts.push(
                `  Month ${row.month}: EMI ${formatCurrency(row.emi)}, Principal ${formatCurrency(row.principalComponent)}, Interest ${formatCurrency(row.interestComponent)}, Balance ${formatCurrency(row.outstandingBalance)}`
            )
        }
        parts.push('')
    }

    // Insight
    const interestRatio = emi.totalInterest / emi.principal
    if (interestRatio > 1) {
        parts.push('Warning: You are paying more in interest than the loan itself! Consider a shorter tenure or lower rate.')
    } else if (interestRatio > 0.5) {
        parts.push('Tip: Interest is over 50% of your principal. Even a 0.5% rate reduction saves significantly.')
    } else {
        parts.push('Good: Interest-to-principal ratio looks healthy.')
    }
    parts.push('')
    parts.push('SEBI Disclaimer: For educational purposes only.')

    return parts.join('\n')
}

// ==================== RISK ANALYSIS ====================

function analyzeInvestmentRisk(message: string): RiskProfile {
    const m = message.toLowerCase()
    let score = 5  // baseline moderate
    const factors: string[] = []

    // Asset-class scoring
    if (/\b(crypto|bitcoin|btc|ethereum|altcoin|meme coin|nft)\b/.test(m)) {
        score += 4; factors.push('Cryptocurrency — extreme volatility')
    }
    if (/\b(penny stock|small cap|microcap|options?|futures?|derivatives?|f&o)\b/.test(m)) {
        score += 3; factors.push('High-risk instrument detected')
    }
    if (/\b(stock|equity|share|nifty|sensex|index fund|etf)\b/.test(m)) {
        score += 1; factors.push('Equity exposure — moderate-to-high volatility')
    }
    if (/\b(mutual fund|sip|systematic)\b/.test(m)) {
        score += 0; factors.push('Mutual funds — diversified, moderate risk')
    }
    if (/\b(gold|silver|commodity)\b/.test(m)) {
        score -= 1; factors.push('Commodities — traditionally low-moderate risk')
    }
    if (/\b(fd|fixed deposit|rd|ppf|epf|nps|government bond|g-sec|savings account)\b/.test(m)) {
        score -= 2; factors.push('Fixed-income / government-backed — low risk')
    }
    if (/\b(real estate|property|land|flat|apartment)\b/.test(m)) {
        score += 0; factors.push('Real estate — illiquid, moderate risk')
    }

    // Time horizon
    if (/\b(short term|quick|1 year|6 month|monthly)\b/.test(m)) {
        score += 1; factors.push('Short time horizon increases risk')
    }
    if (/\b(long term|10 year|20 year|retirement|decades?)\b/.test(m)) {
        score -= 1; factors.push('Long time horizon reduces effective risk')
    }

    // Leverage
    if (/\b(margin|leverage|borrow|loan to invest)\b/.test(m)) {
        score += 2; factors.push('⚠️ Leverage amplifies both gains and losses')
    }

    // Clamp score
    score = Math.max(1, Math.min(10, score))

    let level: RiskProfile['level']
    let emoji: string
    let color: string

    if (score <= 3) { level = 'Low'; emoji = '🟢'; color = 'green' }
    else if (score <= 5) { level = 'Moderate'; emoji = '🟡'; color = 'yellow' }
    else if (score <= 7) { level = 'High'; emoji = '🟠'; color = 'orange' }
    else { level = 'Very High'; emoji = '🔴'; color = 'red' }

    const recommendations: Record<RiskProfile['level'], string> = {
        'Low': 'This looks relatively safe. Suitable for conservative investors seeking capital preservation.',
        'Moderate': 'Balanced risk-reward. Ensure you have an emergency fund (6 months expenses) before investing.',
        'High': 'High return potential but significant downside. Only invest money you can afford to lose. Diversify!',
        'Very High': '⚠️ Extremely risky. Not recommended for beginners. Only allocate a small percentage (5-10%) of your portfolio here.'
    }

    if (factors.length === 0) {
        factors.push('General financial query — no specific risk factors detected')
    }

    return {
        level,
        score,
        emoji,
        color,
        factors,
        recommendation: recommendations[level]
    }
}

function formatRiskResponse(query: string, risk: RiskProfile): string {
    const parts = [
        `FinanceGuard - Investment Risk Analysis`,
        '',
        `Query: ${query}`,
        '',
        `${risk.emoji} Risk Level: ${risk.level} (${risk.score} out of 10)`,
        '',
        'Risk Factors:',
        ...risk.factors.map((f, i) => `  ${i + 1}. ${f}`),
        '',
        `Recommendation: ${risk.recommendation}`,
        '',
        'SEBI Disclaimer: For educational purposes only.'
    ]
    return parts.join('\n')
}

// ==================== PORTFOLIO DIVERSIFICATION ====================

function suggestPortfolio(message: string): PortfolioAllocation[] {
    const m = message.toLowerCase()

    // Determine investor profile from message
    let profile: 'conservative' | 'balanced' | 'aggressive' = 'balanced'

    if (/\b(safe|conservative|low risk|retirement|senior|pension|capital protect)\b/.test(m)) {
        profile = 'conservative'
    } else if (/\b(aggressive|high return|maximum|growth|young|25|under 30)\b/.test(m)) {
        profile = 'aggressive'
    }

    const portfolios: Record<typeof profile, PortfolioAllocation[]> = {
        conservative: [
            { asset: 'Fixed Deposits / Debt Funds', percentage: 40, emoji: '🏦', rationale: 'Capital protection with stable returns (6-7% p.a.)' },
            { asset: 'Government Bonds / PPF', percentage: 25, emoji: '🏛️', rationale: 'Tax-free returns, sovereign guarantee' },
            { asset: 'Large-Cap Mutual Funds', percentage: 15, emoji: '📊', rationale: 'Blue-chip stability with equity upside' },
            { asset: 'Gold (ETF/SGB)', percentage: 10, emoji: '🥇', rationale: 'Inflation hedge and crisis protection' },
            { asset: 'Emergency Cash Reserve', percentage: 10, emoji: '💵', rationale: '6 months of expenses, always liquid' },
        ],
        balanced: [
            { asset: 'Equity Mutual Funds (SIP)', percentage: 35, emoji: '📈', rationale: 'Diversified equity for long-term wealth (12-15% CAGR historical)' },
            { asset: 'Fixed Deposits / Debt Funds', percentage: 25, emoji: '🏦', rationale: 'Stability anchor for the portfolio' },
            { asset: 'Index Funds (Nifty 50/S&P 500)', percentage: 15, emoji: '📊', rationale: 'Low-cost market exposure' },
            { asset: 'Gold / Commodities', percentage: 10, emoji: '🥇', rationale: 'Portfolio diversification and inflation hedge' },
            { asset: 'PPF / NPS', percentage: 10, emoji: '🏛️', rationale: 'Tax benefits under Sec 80C + retirement' },
            { asset: 'Emergency Fund', percentage: 5, emoji: '💵', rationale: 'Liquid savings for unexpected needs' },
        ],
        aggressive: [
            { asset: 'Mid & Small-Cap Funds', percentage: 30, emoji: '🚀', rationale: 'High growth potential (15-20%+ CAGR historical)' },
            { asset: 'Direct Equity / Stocks', percentage: 25, emoji: '📈', rationale: 'Concentrated bets in high-conviction stocks' },
            { asset: 'Index Funds', percentage: 15, emoji: '📊', rationale: 'Core stable equity exposure' },
            { asset: 'International Funds', percentage: 10, emoji: '🌍', rationale: 'Geographic diversification (US, Europe, Asia)' },
            { asset: 'Crypto / Alternative', percentage: 10, emoji: '₿', rationale: 'High-risk, high-reward satellite allocation' },
            { asset: 'Debt / Emergency', percentage: 10, emoji: '🏦', rationale: 'Safety net and rebalancing reserve' },
        ]
    }

    return portfolios[profile]
}

function formatPortfolioResponse(query: string, allocations: PortfolioAllocation[], profile: string): string {
    const parts: string[] = [
        `FinanceGuard - Portfolio Diversification`,
        '',
        `Profile: ${profile.charAt(0).toUpperCase() + profile.slice(1)} Investor`,
        '',
        'Suggested Allocation:',
        '',
    ]

    for (const a of allocations) {
        parts.push(`  ${a.emoji} ${a.asset}: ${a.percentage}% - ${a.rationale}`)
    }

    parts.push('')
    parts.push('SEBI Disclaimer: Educational guidance only. Consult a registered financial advisor.')

    return parts.join('\n')
}

// ==================== GENERAL FINANCE (LLM-POWERED) ====================

const GENERAL_FINANCE_SYSTEM_PROMPT = `You are FinanceGuard, an expert Indian financial advisor AI.
You MUST respond ONLY with a JSON object (no markdown, no code fences, no extra text).

JSON format:
{
  "title": "Short descriptive title (3-6 words)",
  "items": [
    {"name": "Item name", "category": "Category/Sector", "reason": "Why this is good — 1-2 sentences", "riskLevel": "Low/Medium/High"},
    ...
  ],
  "tips": ["Practical tip 1", "Practical tip 2", "Practical tip 3"],
  "warning": "One sentence risk warning"
}

Rules:
- ALWAYS give SPECIFIC, ACTIONABLE answers. If user asks for stocks, give real company names and sectors.
- If user asks for N items, give exactly N items.
- Use Indian context (NSE/BSE listed companies, INR, SEBI) unless specified otherwise.
- For stocks: include real well-known companies (Reliance, TCS, HDFC, etc.) with genuine reasoning.
- For mutual funds: name real fund categories (Nifty 50 Index, Flexi Cap, ELSS, etc.).
- riskLevel must be exactly "Low", "Medium", or "High".
- Each reason should be factual — mention sector, market position, or growth driver.
- DO NOT invent price targets or fake returns. Focus on fundamentals.
- tips should be things the user can actually do.`

async function handleGeneralFinance(message: string): Promise<string> {
    try {
        const llmResponse = await generateWithProvider(message, {
            maxTokens: 2048,
            temperature: 0.5,
            systemPrompt: GENERAL_FINANCE_SYSTEM_PROMPT
        })

        // Parse structured JSON from LLM
        const responseText = llmResponse.text.trim()
        let jsonStr = responseText
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) jsonStr = jsonMatch[0]

        const parsed = JSON.parse(jsonStr)

        const title = parsed.title || 'Financial Insight'
        const items: any[] = parsed.items || []
        const tips: string[] = parsed.tips || []
        const warning: string = parsed.warning || 'All investments carry risk. Past performance does not guarantee future results.'

        const parts: string[] = [
            `FinanceGuard - ${title}`,
            '',
        ]

        // Render items as clean numbered list
        if (items.length > 0) {
            items.forEach((item: any, i: number) => {
                const riskLabel = item.riskLevel || 'Medium'
                parts.push(`${i + 1}. ${item.name} (${item.category || 'General'}) - Risk: ${riskLabel}`)
                if (item.reason) {
                    parts.push(`   ${item.reason}`)
                }
            })
            parts.push('')
        }

        // Practical tips
        if (tips.length > 0) {
            parts.push('Practical Tips:')
            tips.forEach((tip: string, i: number) => {
                parts.push(`  ${i + 1}. ${tip}`)
            })
            parts.push('')
        }

        parts.push(`${warning}`)
        parts.push('')
        parts.push('SEBI Disclaimer: Educational purposes only. Consult a registered financial advisor.')

        return parts.join('\n')
    } catch (error: any) {
        console.error('❌ FinanceGuard LLM error:', error?.message)

        // Fallback
        return [
            'FinanceGuard',
            '',
            'I can help you with:',
            '  1. EMI Calculator - Say "EMI for 20 lakh at 9% for 15 years"',
            '  2. Risk Analyzer - Say "Is crypto safe for beginners?"',
            '  3. Portfolio Advisor - Say "Suggest portfolio for aggressive investor"',
            '  4. General Advice - Say "Best stocks to invest in India"',
            '',
            'Try asking a specific financial question!'
        ].join('\n')
    }
}

// ==================== MAIN HANDLER ====================

export async function handleFinanceQuery(
    message: string,
    userId: string = 'anonymous'
): Promise<FinanceResult> {
    const startTime = Date.now()
    const cotSteps: string[] = []
    const sources: string[] = []

    // 1. Classify sub-intent
    const subIntent = classifyFinanceSubIntent(message)
    cotSteps.push(`finance_intent:${subIntent}`)
    console.log(`💰 FinanceGuard — intent: ${subIntent} (from: "${message}")`)

    // 2. Check cache
    const cached = getCachedResult(message)
    if (cached) {
        console.log(`✅ FinanceGuard cache hit`)
        cotSteps.push('cache:hit')
        return cached
    }
    cotSteps.push('cache:miss')

    let response: string

    // 3. Route to sub-handler
    if (subIntent === 'emi') {
        const principal = parseAmount(message)
        const rate = parseRate(message)
        const tenure = parseTenure(message)

        if (principal && rate && tenure) {
            const emiResult = calculateEMI(principal, rate, tenure)
            response = formatEMIResponse(emiResult)
            cotSteps.push(`emi:${emiResult.emi}`)
            sources.push('local_calculation')
        } else {
            // Missing parameters — ask for them
            const missing: string[] = []
            if (!principal) missing.push('loan amount (e.g., "20 lakh")')
            if (!rate) missing.push('interest rate (e.g., "9%")')
            if (!tenure) missing.push('tenure (e.g., "15 years")')

            response = [
                `## 💰 FinanceGuard: EMI Calculator`,
                '',
                `I need a few more details to calculate your EMI:`,
                '',
                ...missing.map(m => `- ❓ **${m}**`),
                '',
                `**Example:** "Calculate EMI for 20 lakh at 9% for 15 years"`,
                '',
                principal ? `✅ Loan Amount: ${formatCurrency(principal)}` : '',
                rate ? `✅ Interest Rate: ${rate}%` : '',
                tenure ? `✅ Tenure: ${tenure} months` : '',
            ].filter(Boolean).join('\n')
            cotSteps.push(`emi:missing_params:${missing.join(',')}`)
        }
    } else if (subIntent === 'risk_analysis') {
        const risk = analyzeInvestmentRisk(message)
        response = formatRiskResponse(message, risk)
        cotSteps.push(`risk:${risk.level}:${risk.score}`)
        sources.push('local_analysis')
    } else if (subIntent === 'diversification') {
        const m = message.toLowerCase()
        let profile: 'conservative' | 'balanced' | 'aggressive' = 'balanced'
        if (/\b(safe|conservative|low risk|retirement|senior)\b/.test(m)) profile = 'conservative'
        else if (/\b(aggressive|high return|growth|young)\b/.test(m)) profile = 'aggressive'

        const allocations = suggestPortfolio(message)
        response = formatPortfolioResponse(message, allocations, profile)
        cotSteps.push(`portfolio:${profile}`)
        sources.push('local_analysis')
    } else {
        // General finance — use LLM
        response = await handleGeneralFinance(message)
        cotSteps.push('llm_finance')
        sources.push('llm')
    }

    cotSteps.push(`response_time:${Date.now() - startTime}ms`)

    const result: FinanceResult = {
        response,
        cotSteps,
        sources,
        cached: false
    }

    setCachedResult(message, result)
    cotSteps.push('cached:true')

    return result
}

// ==================== STATISTICS ====================

interface FinanceGuardStats {
    totalQueries: number
    emiCalculations: number
    riskAnalyses: number
    portfolioSuggestions: number
    cacheSize: number
}

let queryCount = 0
let emiCount = 0
let riskCount = 0
let portfolioCount = 0

export function recordFinanceQuery(subIntent: string): void {
    queryCount++
    if (subIntent === 'emi') emiCount++
    if (subIntent === 'risk_analysis') riskCount++
    if (subIntent === 'diversification') portfolioCount++
}

export function getFinanceGuardStats(): FinanceGuardStats {
    return {
        totalQueries: queryCount,
        emiCalculations: emiCount,
        riskAnalyses: riskCount,
        portfolioSuggestions: portfolioCount,
        cacheSize: financeCache.size
    }
}

// ==================== EXPORT ====================

export default {
    isFinanceIntent,
    handleFinanceQuery,
    recordFinanceQuery,
    getFinanceGuardStats
}
