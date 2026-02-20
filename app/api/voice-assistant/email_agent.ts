// ─────────────────────────────────────────────────────────────────────────────
// email_agent.ts  —  Deterministic Email Agent
//
// ARCHITECTURE:
//   TypeScript  →  owns ALL state machine logic (routing, intent, extraction)
//   Ollama LLM  →  does ONE job only: write the email subject + body
//
// This means the LLM can NEVER accidentally reset state, ask repeated questions,
// or misclassify "email jagananmoldaneti@gmail.com" as a reset command.
// ─────────────────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3';

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
    role: 'user' | 'agent';
    content: string;
}

export interface DraftState {
    to: string;
    subject: string;
    body: string;
}

export interface AgentContext {
    conversationHistory: ConversationMessage[];
    emailDraft: DraftState;
    userName: string;
    userEmail: string;
}

export interface EmailAgentResult {
    response: string;
    updatedContext: AgentContext;
    draftSaved?: boolean;
    gmailDraftId?: string;
    ragResults?: unknown;
    cotSteps?: string[];
    shouldResetContext?: boolean; // <--- ADDED FLAG
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_DRAFT: DraftState = { to: '', subject: '', body: '' };

// Matches any valid email address anywhere in a string
const EMAIL_IN_TEXT_RX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

// Strict full-address validation
const VALID_EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — TYPESCRIPT STATE MACHINE (no LLM involved)
// Extracts all knowable information from the message + history deterministically
// ─────────────────────────────────────────────────────────────────────────────
// ... (imports/functions omitted for brevity) ...

/** Extract email from ONLY the current message (not history) */
function extractEmailFromCurrentMessage(msg: string): string {
    const m = msg.match(EMAIL_IN_TEXT_RX);
    return m ? m[0].toLowerCase().trim() : '';
}

/** Scan entire conversation history for an email address */
function extractEmailFromHistory(history: ConversationMessage[], currentMsg: string): string {
    const all = [...history.map(m => m.content), currentMsg];
    for (const text of all) {
        const m = text.match(EMAIL_IN_TEXT_RX);
        if (m) return m[0].toLowerCase().trim();
    }
    return '';
}

/** Extract the topic/purpose from the current message and full history */
function extractTopicFromHistory(history: ConversationMessage[], currentMsg: string): string {
    const all = [...history.map(m => m.role === 'user' ? m.content : ''), currentMsg]
        .filter(Boolean);

    // Strip out pure email addresses and greetings — what's left is the topic
    const topicParts: string[] = [];
    for (const text of all) {
        const cleaned = text
            .replace(EMAIL_IN_TEXT_RX, '')           // remove email addresses
            // Remove common command phrases at start
            .replace(/^(hi|hello|hey|start|email agent|write mail|write email|send email|send mail|lets|let's|start to|write a mail|write an email|write another mail|write another email|start new email|start fresh)\b/gi, '')
            .replace(/\b(to my colleague|to my friend|to my boss|to my manager|to my team)\b/gi, '')
            // Remove specific action verbs
            .replace(/\b(write|send|compose|draft|email|mail)\b/gi, '')
            .replace(/^(regarding|about|re:|re )\s*/i, '')
            // Remove confirmation words
            .replace(/^(yes|proceed|go ahead|sure|ok|okay|do it|confirm)\b/gi, '')
            // Remove greetings
            .replace(/\b(hi|hello|hey|greetings)\b/gi, '')
            // Remove modification words
            .replace(/^(change|another|different|new|fresh)\s+(topic|subject|email|mail|draft)?\b/gi, '')
            // Remove standalone command modifiers that might remain
            .replace(/\b(another|new|fresh|different)\b/gi, '')
            // Remove negative commands
            .replace(/^(no|wait|stop)\b/gi, '')
            .trim();

        if (cleaned.length > 3) topicParts.push(cleaned);
    }

    // Prefer the most recent meaningful input
    return topicParts[topicParts.length - 1] ?? '';
}

/** Detect explicit reset intent — ONLY from very specific phrases */
function detectReset(msg: string): boolean {
    const t = msg.toLowerCase().trim();
    // These are the ONLY phrases that trigger a reset
    // Single words like "email", "hi", "start" are NOT resets
    return (
        /^(write another (mail|email)|new (email|mail)|compose new|start over|start fresh|reset|clear draft|different (email|mail))$/.test(t) ||
        /\b(write another (mail|email)|new email|new mail|start over|start fresh|compose new|clear draft)\b/.test(t)
    );
}

/** Detect save/confirm intent */
function detectSaveIntent(msg: string): boolean {
    const t = msg.toLowerCase().trim();
    return /\b(save|send|confirm|yes|ok|looks good|that's good|perfect|go ahead|do it|submit|save it|send it)\b/.test(t);
}

/** Detect proceed/generation intent */
function detectProceedIntent(msg: string): boolean {
    const t = msg.toLowerCase().trim();
    return /\b(proceed|go ahead|yes|yeah|yep|sure|ok|okay|do it|start|generate|create|write)\b/.test(t);
}

/** Detect discard intent */
function detectDiscardIntent(msg: string): boolean {
    const t = msg.toLowerCase().trim();
    return /\b(discard|cancel|no|never mind|nevermind|delete|remove|don't send|dont send|abort)\b/.test(t);
}

/** Detect change/modify intent */
function detectChangeIntent(msg: string): boolean {
    const t = msg.toLowerCase().trim();
    return /^(change|modify|update|edit)\s+(topic|subject|recipient|to|email)/i.test(t) ||
        /^(no|wait),?\s+(change|different)/i.test(t);
}

/** Detect if this is a greeting-only message */
function detectGreeting(msg: string): boolean {
    const t = msg.trim().toLowerCase();
    // Only match if it's JUST a greeting, nothing else
    return /^(hi|hello|hey|good (morning|afternoon|evening))\s*[!.]*$/i.test(t) && t.length < 20;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — OLLAMA: ONLY writes email content (subject + body)
// The LLM has NO control over routing, state, or conversation flow
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_WRITER_PROMPT = (senderName: string) =>
    `You are a professional email writer. Your ONLY job is to write an email.
Return ONLY valid JSON with exactly these two fields:
{
  "subject": "<concise professional subject line>",
  "body": "<full professional email body>"
}

Email body structure: greeting → purpose → relevant details → polite close → signature.
Signature must use the sender's real name: ${senderName}
Do NOT include placeholder text like [Name], [Date], [Company].
Do NOT add any explanation outside the JSON.`;

interface EmailContent {
    subject: string;
    body: string;
}

async function writeEmailWithOllama(
    to: string,
    topic: string,
    senderName: string,
    senderEmail: string,
    history: ConversationMessage[],
): Promise<EmailContent> {

    // Build context from user messages so the LLM has all the details
    const userContext = history
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n');

    const userPrompt = [
        `Write a professional email with the following details:`,
        `To: ${to}`,
        `From: ${senderName} <${senderEmail}>`,
        `Topic/Purpose: ${topic}`,
        `Additional context from conversation:\n${userContext}`,
    ].join('\n');

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            stream: false,
            format: 'json',
            options: { temperature: 0.3, num_predict: 1600 },
            messages: [
                { role: 'system', content: EMAIL_WRITER_PROMPT(senderName) },
                { role: 'user', content: userPrompt },
            ],
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const raw = (data.message?.content ?? data.response ?? '')
        .replace(/```json[\s\S]*?```/gi, '')
        .replace(/```/g, '')
        .trim();

    let parsed: Partial<EmailContent>;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(`LLM returned invalid JSON: ${raw.slice(0, 300)}`);
    }

    return {
        subject: (parsed.subject ?? 'Important Matter').trim(),
        body: cleanBody(parsed.body ?? '', senderName),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// GMAIL
// ─────────────────────────────────────────────────────────────────────────────

async function createGmailDraft(
    accessToken: string,
    draft: DraftState,
    sender: { name: string; email: string },
): Promise<{ success: true; id: string } | { success: false; error: string }> {
    try {
        const subjectEncoded = `=?utf-8?B?${Buffer.from(draft.subject).toString('base64')}?=`;
        const raw = [
            `From: ${sender.name} <${sender.email}>`,
            `To: ${draft.to}`,
            `Subject: ${subjectEncoded}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: quoted-printable',
            '',
            draft.body,
        ].join('\r\n');

        const encoded = Buffer.from(raw)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { raw: encoded } }),
        });

        if (!res.ok) {
            const errText = await res.text();
            if (res.status === 401 || res.status === 403)
                throw new Error('Gmail auth failed. Reconnect with gmail.compose scope.');
            throw new Error(`Gmail API ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return { success: true, id: data.id as string };
    } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
    return VALID_EMAIL_RX.test(email);
}

function cleanBody(body: string, senderName: string): string {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return body
        .replace(/\[Your Name\]/gi, senderName)
        .replace(/\[Sender Name\]/gi, senderName)
        .replace(/\[Name\]/gi, senderName)
        .replace(/\[Your Email\]/gi, '')
        .replace(/\[Date\]/gi, today)
        .replace(/\[.*?\]/g, '')          // remove any remaining placeholders
        .trim();
}

function appendToHistory(
    history: ConversationMessage[],
    userMsg: string,
    agentMsg: string,
): ConversationMessage[] {
    return [
        ...history,
        { role: 'user', content: userMsg },
        { role: 'agent', content: agentMsg },
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER — pure TypeScript state machine
// ─────────────────────────────────────────────────────────────────────────────

export async function handleEmailQuery(
    message: string,
    context: AgentContext,
    accessToken?: string,
): Promise<EmailAgentResult> {

    const msg = message.trim();

    const { conversationHistory: history, emailDraft: draft, userName, userEmail } = context;

    // ── GREETING ────────────────────────────────────────────────────────────────
    if (detectGreeting(msg)) {
        const reply = draft.to
            ? `Hello! I have a draft in progress for ${draft.to}. What would you like to add or change?`
            : `Hello! Tell me who you'd like to email and what it's about — I'll draft it for you.`;
        return {
            response: reply,
            updatedContext: { ...context, conversationHistory: appendToHistory(history, msg, reply) },
        };
    }

    // ── EXPLICIT RESET ──────────────────────────────────────────────────────────
    if (detectReset(msg)) {
        const reply = 'Sure! Who would you like to email this time?';
        return {
            response: reply,
            updatedContext: {
                ...context,
                conversationHistory: [], // <--- CLEAR HISTORY so old topics don't leak
                emailDraft: { ...EMPTY_DRAFT },
            },
            shouldResetContext: true, // <--- SIGNAL RESET TO ROUTE
        };
    }

    // ── SAVE/CONFIRM an existing ready draft ────────────────────────────────────
    if (detectSaveIntent(msg) && draft.to && draft.body) {
        if (!accessToken) {
            const reply = `⚠️ Cannot save to Gmail - please sign in with your Google account first.`;
            return {
                response: reply,
                updatedContext: { ...context, conversationHistory: appendToHistory(history, msg, reply) },
            };
        }

        try {
            const result = await createGmailDraft(accessToken, draft, { name: userName, email: userEmail });
            if (result.success) {
                const reply = `✅ Draft saved to Gmail Drafts!\n\n📧 To: ${draft.to}\n📌 Subject: ${draft.subject}\n\nYour draft is ready in Gmail. Open Gmail to review and send it.\n\nSay "write another mail" to compose a new one.`;
                return {
                    response: reply,
                    draftSaved: true,
                    gmailDraftId: result.id,
                    updatedContext: {
                        ...context,
                        conversationHistory: appendToHistory(history, msg, reply),
                        emailDraft: { ...EMPTY_DRAFT },
                    },
                };
            } else {
                const reply = `❌ Could not save to Gmail: ${result.error}\n\nYou can copy the draft above manually.`;
                return {
                    response: reply,
                    updatedContext: { ...context, conversationHistory: appendToHistory(history, msg, reply) },
                };
            }
        } catch (e: unknown) {
            const reply = `❌ Gmail error: ${(e as Error).message}`;
            return {
                response: reply,
                updatedContext: { ...context, conversationHistory: appendToHistory(history, msg, reply) },
            };
        }
    }

    // ── DISCARD ─────────────────────────────────────────────────────────────────
    if (detectDiscardIntent(msg) && draft.to) {
        const reply = 'Draft discarded. Who would you like to email?';
        return {
            response: reply,
            updatedContext: {
                ...context,
                conversationHistory: appendToHistory(history, msg, reply),
                emailDraft: { ...EMPTY_DRAFT },
            },
        };
    }

    // ── EXTRACT: email address from current message (NOT old history to avoid ghosts) ──
    const allHistory: ConversationMessage[] = [...history, { role: 'user', content: msg }];

    // If we already have a recipient in the draft, keep it
    // Otherwise, ONLY look in the current message (not full history)
    const recipientEmail = draft.to || extractEmailFromCurrentMessage(msg);

    // ── NO RECIPIENT YET ────────────────────────────────────────────────────────
    if (!recipientEmail || !isValidEmail(recipientEmail)) {
        const updatedDraft = { ...draft };
        const reply = 'Who should I send this email to? Please provide their email address.';
        return {
            response: reply,
            updatedContext: {
                ...context,
                conversationHistory: appendToHistory(history, msg, reply),
                emailDraft: updatedDraft,
            },
        };
    }

    // ── EXTRACT: topic from full history + current message ──────────────────────
    const topic = extractTopicFromHistory(history, msg);

    // ── NO TOPIC YET ────────────────────────────────────────────────────────────
    if (!topic) {
        const reply = `Got it — emailing ${recipientEmail}. What is this email about?`;
        return {
            response: reply,
            updatedContext: {
                ...context,
                conversationHistory: appendToHistory(history, msg, reply),
                emailDraft: { ...draft, to: recipientEmail },
            },
        };
    }

    // ── PREVENT ACCIDENTAL RE-GENERATION ──────────────────────────────────────
    // If we already have a draft, and the user input is ambiguous or merely "email status" check
    if (draft.body && draft.to && msg.length < 10 && !extractTopicFromHistory([], msg)) {
        const reply = `I have a draft ready for ${draft.to}.\n\nSubject: ${draft.subject}\n\nSay "save it," "discard," or tell me specific changes to make.`;
        return {
            response: reply,
            updatedContext: { ...context, conversationHistory: appendToHistory(history, msg, reply) },
        };
    }

    // If we have a draft but the user says something new that ISN'T a save/discard command,
    // we assume it's a refinement request. We fall through to allow Ollama to re-write it.

    // ── HAVE BOTH RECIPIENT + TOPIC ─────────────────────────────────────────────

    // ── HANDLE CHANGE REQUESTS ──────────────────────────────────────────────────
    // If user says "change topic" or similar, ask for the new topic
    if (detectChangeIntent(msg) && !draft.body) {
        const reply = `Sure! What would you like the new topic to be?`;
        return {
            response: reply,
            updatedContext: {
                ...context,
                conversationHistory: appendToHistory(history, msg, reply),
                emailDraft: { ...draft, to: recipientEmail }, // Keep recipient
            },
        };
    }

    // If we don't have a body yet (drafting phase), we MUST ask for confirmation first
    if (!draft.body) {
        // Check if user explicitly confirmed to proceed
        // We look at the very last message for confirmation
        const isConfirmed = detectProceedIntent(msg);

        // However, if the user provided the topic in *this* very message, we shouldn't ask for confirmation yet?
        // Actually, the user wants: "then user will say proceed". So we ALWAYS need a distinct "Proceed" step.
        // UNLESS the user said "Email bob about meeting and proceed" (which is rare).

        // Let's be strict: If the last message was just setting the topic/recipient, we ask for confirmation.
        // If the last message was "proceed", then we generate.

        if (!isConfirmed) {
            const reply = `I have the details:\n\n📧 To: ${recipientEmail}\n📝 Topic: ${topic}\n\nShall I proceed with writing this email? (Say "proceed" or "yes")`;
            return {
                response: reply,
                updatedContext: {
                    ...context,
                    conversationHistory: appendToHistory(history, msg, reply),
                    emailDraft: { ...draft, to: recipientEmail }, // Preserve recipient, topic is implicitly in history
                },
            };
        }
    }

    // ── GENERATE DRAFT (Ollama) ─────────────────────────────────────────────────
    try {
        const emailContent = await writeEmailWithOllama(
            recipientEmail,
            topic,
            userName,
            userEmail,
            allHistory,
        );

        const nextDraft: DraftState = {
            to: recipientEmail,
            subject: emailContent.subject,
            body: emailContent.body,
        };

        // AUTO-SAVE to Gmail (as requested by user flow)
        let saveStatusMsg = "";
        let draftId = "";
        let isSaved = false;

        if (accessToken) {
            const saveResult = await createGmailDraft(accessToken, nextDraft, { name: userName, email: userEmail });
            if (saveResult.success) {
                saveStatusMsg = `✅ Auto-saved to Gmail Drafts`;
                draftId = saveResult.id;
                isSaved = true;
            } else {
                saveStatusMsg = `⚠️ Could not save to Gmail: ${saveResult.error}\n\nℹ️ Please reconnect your Google account with Gmail permissions.`;
            }
        } else {
            saveStatusMsg = `ℹ️ Draft created (Sign in with Google to enable auto-save to Gmail)`;
        }

        const reply = [
            saveStatusMsg,
            ``,
            `✉️ To: ${recipientEmail}`,
            `📌 Subject: ${nextDraft.subject}`,
            ``,
            `─── Email Body ───`,
            nextDraft.body,
            `─────────────────`,
            ``,
            `Say "write another mail" to compose a new one, or "change topic" to revise.`,
        ].join('\n');

        return {
            response: reply,
            updatedContext: {
                ...context,
                conversationHistory: appendToHistory(history, msg, reply),
                emailDraft: nextDraft,
            },
            draftSaved: isSaved,
            gmailDraftId: draftId,
            cotSteps: [`ollama/${OLLAMA_MODEL}`, `to:${recipientEmail}`, `topic:${topic}`, isSaved ? 'gmail_save:success' : 'gmail_save:skipped'],
        };

    } catch (err: unknown) {
        const errorMsg = (err as Error).message ?? 'Unknown error';
        const isConnError = /fetch|ECONNREFUSED|ENOTFOUND|network/i.test(errorMsg);

        const reply = isConnError
            ? `❌ Cannot reach Ollama at ${OLLAMA_BASE_URL}.\n\nStart it with:\n  OLLAMA_ORIGINS=* ollama serve\n\nEnsure model is pulled:\n  ollama pull ${OLLAMA_MODEL}`
            : `❌ Failed to write email: ${errorMsg}`;

        return {
            response: reply,
            updatedContext: {
                ...context,
                conversationHistory: appendToHistory(history, msg, reply),
                emailDraft: { ...draft, to: recipientEmail },
            },
            cotSteps: ['error', errorMsg],
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export async function handleVoiceEmailQuery(
    audioBlob: Blob,
    context: AgentContext,
    accessToken?: string,
): Promise<EmailAgentResult & { transcript: string }> {
    const transcript = await transcribeAudio(audioBlob);
    const result = await handleEmailQuery(transcript, context, accessToken);
    speakText(result.response);
    return { ...result, transcript };
}

// ─────────────────────────────────────────────────────────────────────────────
// STT STUB
// ─────────────────────────────────────────────────────────────────────────────

export async function transcribeAudio(_audioBlob: Blob): Promise<string> {
    // Whisper:
    // const form = new FormData();
    // form.append('file', _audioBlob, 'audio.webm');
    // form.append('model', 'whisper-1');
    // const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    //   method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
    // });
    // return (await res.json()).text as string;

    // Deepgram:
    // const res = await fetch('https://api.deepgram.com/v1/listen?punctuate=true', {
    //   method: 'POST',
    //   headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': _audioBlob.type },
    //   body: _audioBlob,
    // });
    // return (await res.json()).results.channels[0].alternatives[0].transcript as string;

    throw new Error('transcribeAudio: plug in Whisper or Deepgram');
}

// ─────────────────────────────────────────────────────────────────────────────
// TTS STUB
// ─────────────────────────────────────────────────────────────────────────────

export function speakText(text: string): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0; u.pitch = 1.0;
        window.speechSynthesis.speak(u);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createEmptyContext(userName: string, userEmail: string): AgentContext {
    return {
        conversationHistory: [],
        emailDraft: { ...EMPTY_DRAFT },
        userName,
        userEmail,
    };
}