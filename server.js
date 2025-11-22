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

// Available Gemini models (in order of preference)
const GEMINI_MODELS = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b'
];

// Call Gemini with automatic key and model rotation
async function callGemini(preferredModel, prompt, maxRetries = 10) {
    let modelIndex = GEMINI_MODELS.indexOf(preferredModel);
    if (modelIndex === -1) modelIndex = 0;
    
    for (let modelAttempt = 0; modelAttempt < GEMINI_MODELS.length; modelAttempt++) {
        const currentModel = GEMINI_MODELS[(modelIndex + modelAttempt) % GEMINI_MODELS.length];
        console.log(`Trying model: ${currentModel}`);
        
        for (let keyAttempt = 0; keyAttempt < maxRetries; keyAttempt++) {
            try {
                const apiKey = getNextGeminiKey();
                const ai = new GoogleGenAI({ apiKey });
                
                const response = await ai.models.generateContent({
                    model: currentModel,
                    contents: prompt,
                });
                
                console.log(`✅ Success with model: ${currentModel}`);
                return response.text;
            } catch (error) {
                console.log(`Key attempt ${keyAttempt + 1}/${maxRetries} failed for ${currentModel}`);
                
                if (keyAttempt === maxRetries - 1) {
                    console.log(`All keys exhausted for ${currentModel}, trying next model...`);
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    
    throw new Error('All Gemini models and keys exhausted');
}

// Chat endpoint - Direct Claude Sonnet 4.5
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

        const userMessage = messages[messages.length - 1].content;
        console.log('\n🔄 Starting two-step workflow...');
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

        let enhancedPrompt;
        try {
            enhancedPrompt = await callGemini('gemini-2.5-pro', enhancePrompt);
            console.log('✅ Enhanced prompt created');
        } catch (error) {
            console.log('⚠️ Prompt enhancement failed, using original prompt');
            enhancedPrompt = userMessage;
        }

        // STEP 2: Send enhanced prompt to Claude for response
        console.log('\n⚡ STEP 2: Getting response from Claude Sonnet 4.5...');
        
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

        const response = claudeResponse.content[0].text;
        console.log('✅ Response generated');
        console.log('\n✨ Workflow complete!\n');

        res.json({ response });

    } catch (error) {
        console.error('Error:', error);
        
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
        workflow: 'Gemini 2.5 Pro → Claude Sonnet 4.5',
        geminiKeys: geminiKeys.length,
        timestamp: new Date().toISOString() 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║          AI Chat Application                          ║
║                                                       ║
║  Server: http://localhost:${PORT}                     ║
║  Workflow: Gemini 2.5 Pro → Claude Sonnet 4.5        ║
║  Gemini Keys: ${geminiKeys.length} keys loaded                        ║
║                                                       ║
║  Ready to chat!                                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
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
