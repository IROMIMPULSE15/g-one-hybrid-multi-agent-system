import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────
// upload-paper/route.ts
// Accepts .pdf or .txt file uploads, extracts raw text,
// and returns it so ScholarMind can analyze it.
// ─────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

/**
 * Extract readable text from a PDF buffer.
 * Uses a regex-based approach to extract text from raw PDF bytes
 * without requiring external libraries.
 */
function extractTextFromPDF(buffer: Buffer): string {
    const pdfString = buffer.toString('latin1')

    // Extract text between BT (Begin Text) and ET (End Text) markers
    const textParts: string[] = []

    // Match PDF text objects: BT ... ET blocks
    const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g
    let btMatch: RegExpExecArray | null

    while ((btMatch = btEtRegex.exec(pdfString)) !== null) {
        const block = btMatch[1]

        // Extract strings from Tj and TJ operators
        // Tj: (text)Tj  — literal string
        const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || []
        for (const m of tjMatches) {
            const inner = m.match(/\(([^)]*)\)/)
            if (inner?.[1]) textParts.push(inner[1])
        }

        // TJ: [(text) n (text)] TJ — array of strings with kerning
        const tjArrayMatches = block.match(/\[([^\]]*)\]\s*TJ/g) || []
        for (const m of tjArrayMatches) {
            const strings = m.match(/\(([^)]*)\)/g) || []
            for (const s of strings) {
                const inner = s.match(/\(([^)]*)\)/)
                if (inner?.[1]) textParts.push(inner[1])
            }
        }
    }

    // Also try to extract from stream objects (for compressed PDFs)
    // Look for readable ASCII sequences that appear to be text
    const readableText = pdfString
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')  // keep printable ASCII
        .replace(/\s{3,}/g, '\n')              // collapse whitespace
        .trim()

    let extractedText = textParts.join(' ').trim()

    // If BT/ET extraction yielded very little, fall back to readable ASCII extraction
    if (extractedText.length < 200 && readableText.length > extractedText.length) {
        // Filter out PDF syntax noise
        extractedText = readableText
            .replace(/\b(obj|endobj|stream|endstream|xref|trailer|startxref|%%EOF)\b/g, ' ')
            .replace(/<<[^>]*>>/g, ' ')
            .replace(/\b\d+\s+\d+\s+R\b/g, ' ')
            .replace(/\/(Font|Type|Page|Pages|Resources|Contents|MediaBox|Rotate|Filter|Length|Width|Height|BitsPerComponent|ColorSpace|Name|Subtype|BaseFont|Encoding)[^\n]*/g, ' ')
            .replace(/\s{3,}/g, '\n')
            .trim()
    }

    // Clean up common PDF escape sequences
    extractedText = extractedText
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, ' ')
        .replace(/\\r/g, '')
        .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\n{4,}/g, '\n\n')
        .trim()

    return extractedText
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // File size check
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.` },
                { status: 413 }
            )
        }

        const fileName = file.name.toLowerCase()
        const isPDF = fileName.endsWith('.pdf') || file.type === 'application/pdf'
        const isTXT = fileName.endsWith('.txt') || file.type === 'text/plain'
        const isDOCX = fileName.endsWith('.docx')

        if (!isPDF && !isTXT && !isDOCX) {
            return NextResponse.json(
                { error: 'Unsupported file type. Please upload a PDF or TXT file.' },
                { status: 415 }
            )
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        let extractedText = ''
        let method = 'unknown'

        if (isTXT) {
            // Plain text — just decode it
            extractedText = buffer.toString('utf-8')
            method = 'plain_text'
        } else if (isPDF) {
            extractedText = extractTextFromPDF(buffer)
            method = 'pdf_extraction'
        } else if (isDOCX) {
            // DOCX is a ZIP; extract readable text by finding XML content
            // We do a simple text-only approach
            const docxStr = buffer.toString('latin1')
            const xmlMatches = docxStr.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || []
            extractedText = xmlMatches
                .map(m => m.replace(/<[^>]+>/g, ''))
                .join(' ')
                .trim()
            method = 'docx_extraction'
        }

        // Quality check
        if (!extractedText || extractedText.length < 50) {
            return NextResponse.json({
                error: 'Could not extract meaningful text from this file. The PDF may be scanned/image-based. Please paste the text directly instead.',
                extractedText: '',
                method,
                charCount: 0,
                success: false
            }, { status: 422 })
        }

        // Truncate to a reasonable limit for the research agent
        const MAX_CHARS = 15000
        const truncated = extractedText.length > MAX_CHARS
        const finalText = truncated ? extractedText.substring(0, MAX_CHARS) : extractedText

        console.log(`📄 Paper upload: ${file.name} — ${method} — ${finalText.length} chars`)

        return NextResponse.json({
            success: true,
            extractedText: finalText,
            method,
            charCount: finalText.length,
            truncated,
            originalSize: extractedText.length,
            fileName: file.name
        }, { status: 200 })

    } catch (error: unknown) {
        console.error('❌ Paper upload error:', error)
        return NextResponse.json(
            { error: `Failed to process file: ${(error as Error).message}` },
            { status: 500 }
        )
    }
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        message: 'Paper Upload API — POST a PDF or TXT file as FormData with key "file"',
        maxSizeMB: MAX_FILE_SIZE_MB,
        supportedFormats: ['pdf', 'txt', 'docx']
    })
}
