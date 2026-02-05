
import fs from 'fs';
import path from 'path';

const OUTPUT_PATH = path.join(process.cwd(), 'app', 'api', 'voice-assistant', 'data', 'training_corpus.json');

// Expanded vocabulary with slang, typos, and variations
const greetings = {
    formal: ['hello', 'greetings', 'salutations', 'good day'],
    casual: ['hi', 'hey', 'yo', 'sup', 'wassup', 'whats up', 'howdy', 'hiya'],
    typos: ['helo', 'hii', 'hiii', 'heyyy', 'heyy', 'helllo'],
    timeSpecific: ['good morning', 'good afternoon', 'good evening', 'morning', 'afternoon', 'evening'],
    cultural: ['namaste', 'hola', 'bonjour', 'ciao', 'aloha', 'konnichiwa']
};

const farewells = {
    formal: ['goodbye', 'farewell', 'good day'],
    casual: ['bye', 'cya', 'see ya', 'later', 'peace', 'catch you later', 'ttyl'],
    typos: ['byee', 'byeee', 'gud bye', 'gooodbye'],
    timeSpecific: ['good night', 'night', 'have a good day', 'have a great evening'],
    cultural: ['adios', 'au revoir', 'sayonara', 'ciao']
};

const gratitude = {
    formal: ['thank you', 'thanks', 'much appreciated', 'i appreciate it'],
    casual: ['thx', 'ty', 'thanks a lot', 'thanks so much', 'cheers'],
    typos: ['thanx', 'thnx', 'thankss', 'thnks'],
    enthusiastic: ['thank you so much', 'thanks a ton', 'you are awesome', 'appreciate it']
};

const identity = {
    direct: ['who are you', 'what is your name', 'whats your name', 'tell me about yourself'],
    casual: ['who r u', 'whos this', 'what are you', 'introduce yourself'],
    capabilities: ['what can you do', 'how can you help', 'what do you know']
};

const unknown = {
    technical: ['write code', 'debug this', 'explain quantum physics', 'solve equation'],
    creative: ['tell me a story', 'write a poem', 'create a song'],
    factual: ['why is the sky blue', 'what is gravity', 'explain photosynthesis'],
    commands: ['search for', 'find information', 'generate image', 'calculate'],
    medical: ['medical help', 'i have pain', 'symptoms of flu']
};

// Contextual additions (friend, buddy, bot, etc.)
const contextWords = ['', 'friend', 'buddy', 'bot', 'there', 'g-one', 'assistant', 'bro', 'mate'];

// Punctuation variations
const punctuation = ['', '!', '!!', '?', '.', '...'];

function generateData() {
    console.log("🔧 Generating MASSIVE training dataset...");
    const dataset: any[] = [];

    // Helper to add variations
    const addVariations = (baseText: string, label: string, count: number = 3) => {
        // Base version
        dataset.push({ text: baseText, label });

        // With context words
        contextWords.slice(0, 5).forEach(ctx => {
            if (ctx) {
                dataset.push({ text: `${baseText} ${ctx}`, label });
                dataset.push({ text: `${baseText}, ${ctx}`, label });
            }
        });

        // With punctuation
        punctuation.slice(0, 3).forEach(punc => {
            dataset.push({ text: `${baseText}${punc}`, label });
        });

        // Capitalization variations
        dataset.push({ text: baseText.toUpperCase(), label });
        dataset.push({ text: baseText.charAt(0).toUpperCase() + baseText.slice(1), label });
    };

    // GREETINGS
    Object.values(greetings).flat().forEach(greeting => {
        addVariations(greeting, 'greeting', 5);
    });

    // FAREWELLS
    Object.values(farewells).flat().forEach(farewell => {
        addVariations(farewell, 'farewell', 5);
    });

    // GRATITUDE
    Object.values(gratitude).flat().forEach(thanks => {
        addVariations(thanks, 'gratitude', 5);
    });

    // IDENTITY
    Object.values(identity).flat().forEach(question => {
        addVariations(question, 'identity', 3);
    });

    // UNKNOWN (Negative samples - critical for classification)
    Object.values(unknown).flat().forEach(query => {
        addVariations(query, 'unknown', 2);
    });

    // Add noise and edge cases
    const noiseSamples = [
        'asdfgh', 'random text', '123456', 'test test test',
        'lorem ipsum', 'blah blah', 'xyz abc', 'qwerty'
    ];
    noiseSamples.forEach(noise => {
        for (let i = 0; i < 3; i++) {
            dataset.push({ text: noise, label: 'unknown' });
        }
    });

    console.log(`✅ Generated ${dataset.length} training samples.`);

    // Shuffle dataset
    for (let i = dataset.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dataset[i], dataset[j]] = [dataset[j], dataset[i]];
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dataset, null, 2));
    console.log(`💾 Saved to: ${OUTPUT_PATH}`);

    // Statistics
    const stats = dataset.reduce((acc: any, item) => {
        acc[item.label] = (acc[item.label] || 0) + 1;
        return acc;
    }, {});

    console.log('\n📊 Dataset Statistics:');
    Object.entries(stats).forEach(([label, count]) => {
        console.log(`   ${label}: ${count} samples`);
    });
}

generateData();
