# Advanced AI Chat Application

A sophisticated web chat application featuring Claude Sonnet 4.5 with Gemini AI integration and Myanmar language translation.

## Features

🤖 **Three-Step AI Workflow:**
- Gemini 2.5 Pro → Enhances user input into detailed prompts
- Claude Sonnet 4.5 → Generates comprehensive, detailed responses
- Gemini 2.5 Flash → Translates to playful Myanmar language with emojis

💬 **Chat Features:**
- Persistent chat history (localStorage)
- Multiple conversation management
- Real-time typing indicators
- Auto-resizing text input
- Dark-themed modern UI

🔄 **Robust API Integration:**
- 55 Gemini API keys with automatic rotation
- Intelligent retry logic with 2-second delays
- Handles rate limits gracefully
- Error recovery and logging

## Installation

1. Clone the repository:
```bash
git clone https://github.com/EvilzCoder/gpt.git
cd gpt
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open browser:
```
http://localhost:3000
```

## Technology Stack

- **Backend:** Node.js, Express
- **AI Models:** 
  - Claude Sonnet 4.5 (Anthropic)
  - Gemini 2.5 Pro & Flash (Google)
- **Frontend:** Vanilla JavaScript, HTML5, CSS3

## Project Structure

```
├── server.js              # Main server file with AI workflow
├── package.json           # Dependencies
├── .env                   # API keys configuration
├── keys.txt              # Gemini API keys (55 keys)
├── public/
│   ├── index.html        # Main HTML interface
│   ├── styles.css        # Dark theme styling
│   └── app.js            # Frontend JavaScript logic
```

## How It Works

1. User sends a message
2. Gemini 2.5 Pro enhances the prompt for better results
3. Claude Sonnet 4.5 generates a detailed English response
4. Gemini 2.5 Flash translates to Myanmar with personality and emojis
5. Response displayed with chat history saved

## License

