const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
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
        console.log('\n🔄 Processing with Claude Sonnet 4.5...');
        console.log('📝 User input:', userMessage);

        // Build message history for Claude
        const claudeMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const claudeResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4096,
            system: 'You are a highly knowledgeable, helpful AI assistant. Provide clear, comprehensive, and well-structured responses. Be conversational yet professional.',
            messages: claudeMessages,
            temperature: 1.0,
        });

        const response = claudeResponse.content[0].text;
        console.log('✅ Response generated\n');

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
        model: 'Claude Sonnet 4.5',
        timestamp: new Date().toISOString() 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║          Claude Chat Application                      ║
║                                                       ║
║  Server: http://localhost:${PORT}                     ║
║  Model: Claude Sonnet 4.5 (20250929)                 ║
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
