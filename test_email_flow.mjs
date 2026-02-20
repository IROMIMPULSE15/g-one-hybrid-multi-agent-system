
const API_URL = 'http://localhost:3000/api/voice-assistant';

async function sendQuery(text) {
    console.log(`\nUser: "${text}"`);
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                activeMode: 'email',
                // Inject a fake session ID or user context if possible?
                // Since I am unauth, I am anonymous.
            })
        });

        if (!res.ok) {
            console.error('Error:', res.status, await res.text());
            return;
        }

        const data = await res.json();
        console.log('Agent Response:', data.response);

        if (data.metadata?.cotSteps) {
            console.log('CoT Steps:', data.metadata.cotSteps);
        }
    } catch (e) {
        console.error('Fetch Failed:', e.message);
    }
}

async function runTest() {
    console.log('--- STARTING EMAIL AGENT TEST ---');

    // Turn 1
    await sendQuery('Write email to anmoldaneti@gmail.com');

    // Turn 2
    await sendQuery('It is about sick leave for 2 days');

    console.log('--- TEST COMPLETE ---');
}

runTest();
