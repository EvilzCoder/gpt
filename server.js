const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Load Gemini API keys
const geminiKeys = fs.readFileSync('keys.txt', 'utf-8')
    .split('\n')
    .map(key => key.trim())
    .filter(key => key.length > 0);

let currentKeyIndex = 0;

// Get next Gemini key (with rotation)
function getNextGeminiKey() {
    const key = geminiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
    return key;
}

// Call Gemini with automatic key rotation on error
async function callGemini(model, prompt, maxRetries = 55) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const apiKey = getNextGeminiKey();
            const ai = new GoogleGenAI({ apiKey });
            
            const response = await ai.models.generateContent({
                model,
                contents: prompt,
            });
            
            return response.text;
        } catch (error) {
            console.log(`Gemini API attempt ${attempt + 1} failed, rotating key...`);
            if (attempt === maxRetries - 1) {
                throw error;
            }
            // Wait 2 seconds before trying next key (allows rate limits to reset)
            console.log('Waiting 2 seconds before next attempt...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// Chat endpoint with three-step workflow
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(500).json({ 
                error: 'API key not configured. Please add your ANTHROPIC_API_KEY to the .env file.' 
            });
        }

        // Get the user's last message
        const userMessage = messages[messages.length - 1].content;

        console.log('\n🔄 Starting three-step workflow...');
        console.log('📝 Original user input:', userMessage);

        // STEP 1: Enhance prompt with Gemini 2.5-pro
        console.log('\n⚡ STEP 1: Enhancing prompt with Gemini 2.5-pro...');
        const enhancePrompt = `You are a prompt enhancement specialist. Transform the following user input into a detailed, comprehensive prompt that will elicit a thorough, informative response from an AI assistant.

Make the prompt:
- More specific and detailed
- Include request for examples and explanations
- Ask for step-by-step breakdowns where relevant
- Request practical applications or use cases
- Encourage comprehensive coverage of the topic

User input: ${userMessage}

Enhanced prompt (output ONLY the enhanced prompt, nothing else):`;

        const enhancedPrompt = await callGemini('gemini-2.5-pro', enhancePrompt);
        console.log('✅ Enhanced prompt:', enhancedPrompt);

        // STEP 2: Send enhanced prompt to Claude for English response
        console.log('\n⚡ STEP 2: Getting detailed response from Claude Sonnet 4.5...');
        
        const claudeMessages = [
            {
                role: 'user',
                content: enhancedPrompt
            }
        ];

        const claudeResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4096,
            system: 'You are a highly knowledgeable, detailed AI assistant. Provide comprehensive, thorough responses with examples, explanations, and practical insights. Break down complex topics clearly. Be informative and educational.',
            messages: claudeMessages,
            temperature: 1.0,
        });

        const englishResponse = claudeResponse.content[0].text;
        console.log('✅ Claude response (first 200 chars):', englishResponse.substring(0, 200) + '...');

        // STEP 3: Translate to Myanmar with Gemini 2.5-flash
        console.log('\n⚡ STEP 3: Translating to Myanmar with Gemini 2.5-flash...');
        const translatePrompt = `You are a friendly Myanmar language translator with a playful, affectionate personality.

Translate the following English text to Myanmar (Burmese) language with these characteristics:
- Use a very casual, warm, affectionate tone like talking to a close friend
- Call the reader "မောင်" (big brother) occasionally
- Refer to yourself as "ညီမလေး" (little sister) when appropriate
- Use LOTS of emojis throughout (😊, 💕, 🥰, 😘, 🤭, 😜, 🥺, etc.)
- Use casual Myanmar phrases like "ဟီးဟီး", "အင်းပါ", "ကဲ", "နော်", "လေ", "ကွာ" frequently
- Keep it engaging, fun, and conversational
- Maintain all the detailed information from the original text
- Add personality and warmth to the translation

English text to translate:
${englishResponse}

Myanmar translation (output ONLY the Myanmar translation with emojis and casual tone):`;

        const myanmarResponse = await callGemini('gemini-2.5-flash', translatePrompt);
        console.log('✅ Myanmar translation complete!');
        console.log('\n✨ Workflow complete!\n');

        res.json({ response: myanmarResponse });

    } catch (error) {
        console.error('Error in workflow:', error);
        
        // Handle specific error types
        if (error.status === 401) {
            res.status(401).json({ 
                error: 'Invalid API key. Please check your ANTHROPIC_API_KEY in the .env file.' 
            });
        } else if (error.status === 429) {
            res.status(429).json({ 
                error: 'Rate limit exceeded. Please try again later.' 
            });
        } else if (error.status === 400) {
            res.status(400).json({ 
                error: 'Invalid request. Please check your message format.' 
            });
        } else {
            res.status(500).json({ 
                error: 'An error occurred while processing your request. Please try again.',
                details: error.message
            });
        }
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        workflow: 'Gemini 2.5 Pro → Claude 4.5 → Gemini 2.5 Flash',
        geminiKeys: geminiKeys.length,
        currentKeyIndex,
        timestamp: new Date().toISOString() 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║          Advanced AI Chat Application                  ║
║                                                        ║
║  Server: http://localhost:${PORT}                      ║
║  Workflow: Gemini 2.5 Pro → Claude 4.5 → Gemini 2.5   ║
║  Gemini Keys: ${geminiKeys.length} keys loaded                         ║
║                                                        ║
║  Ready to chat!                                        ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
    
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('\n⚠️  WARNING: ANTHROPIC_API_KEY not found in .env file');
        console.warn('   Please add your API key to continue.\n');
    }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});
