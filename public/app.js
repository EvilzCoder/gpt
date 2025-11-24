// Chat Application
class ChatApp {
    constructor() {
        this.currentChatId = null;
        this.chats = this.loadChats();
        this.isLoading = false;
        
        this.initializeElements();
        this.initializeEventListeners();
        this.loadChatHistory();
        
        // Start with a new chat
        if (Object.keys(this.chats).length === 0) {
            this.createNewChat();
        } else {
            // Load the most recent chat
            const chatIds = Object.keys(this.chats).sort((a, b) => 
                this.chats[b].updatedAt - this.chats[a].updatedAt
            );
            this.loadChat(chatIds[0]);
        }
    }

    initializeElements() {
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.messages = document.getElementById('messages');
        this.chatHistory = document.getElementById('chatHistory');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.charCount = document.getElementById('charCount');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.sidebar = document.querySelector('.sidebar');
    }

    initializeEventListeners() {
        // Send button
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Enter to send, Shift+Enter for new line
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Input validation and auto-resize
        this.messageInput.addEventListener('input', () => {
            this.updateCharCount();
            this.autoResizeTextarea();
            this.sendBtn.disabled = this.messageInput.value.trim() === '';
        });

        // New chat button
        this.newChatBtn.addEventListener('click', () => this.createNewChat());

        // Example prompts
        document.querySelectorAll('.prompt-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                this.messageInput.value = prompt;
                this.updateCharCount();
                this.sendBtn.disabled = false;
                this.messageInput.focus();
            });
        });

        // Sidebar toggle
        this.sidebarToggle.addEventListener('click', () => {
            this.toggleSidebar();
        });
    }

    toggleSidebar() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // Mobile: toggle 'open' class
            this.sidebar.classList.toggle('open');
        } else {
            // Desktop: toggle 'closed' class
            this.sidebar.classList.toggle('closed');
        }
    }

    updateCharCount() {
        const length = this.messageInput.value.length;
        this.charCount.textContent = `${length}/4000`;
    }

    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 200) + 'px';
    }

    loadChats() {
        const chatsData = localStorage.getItem('claude_chats');
        return chatsData ? JSON.parse(chatsData) : {};
    }

    saveChats() {
        localStorage.setItem('claude_chats', JSON.stringify(this.chats));
    }

    createNewChat() {
        const chatId = Date.now().toString();
        this.chats[chatId] = {
            id: chatId,
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.saveChats();
        this.loadChat(chatId);
        this.loadChatHistory();
    }

    loadChat(chatId) {
        this.currentChatId = chatId;
        this.messages.innerHTML = '';
        
        const chat = this.chats[chatId];
        if (chat && chat.messages.length > 0) {
            this.welcomeScreen.style.display = 'none';
            chat.messages.forEach(msg => {
                this.displayMessage(msg.role, msg.content, false);
            });
        } else {
            this.welcomeScreen.style.display = 'flex';
        }

        this.updateActiveChat();
        this.scrollToBottom();
    }

    updateActiveChat() {
        document.querySelectorAll('.chat-history-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.chatId === this.currentChatId) {
                item.classList.add('active');
            }
        });
    }

    loadChatHistory() {
        this.chatHistory.innerHTML = '';
        
        const sortedChats = Object.values(this.chats).sort((a, b) => 
            b.updatedAt - a.updatedAt
        );

        sortedChats.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'chat-history-item';
            item.dataset.chatId = chat.id;
            
            if (chat.id === this.currentChatId) {
                item.classList.add('active');
            }

            item.innerHTML = `
                <span class="chat-title">${this.escapeHtml(chat.title)}</span>
                <button class="delete-btn" data-chat-id="${chat.id}">✕</button>
            `;

            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-btn')) {
                    this.loadChat(chat.id);
                }
            });

            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            });

            this.chatHistory.appendChild(item);
        });
    }

    deleteChat(chatId) {
        if (confirm('Are you sure you want to delete this chat?')) {
            delete this.chats[chatId];
            this.saveChats();
            
            if (chatId === this.currentChatId) {
                const remainingChats = Object.keys(this.chats);
                if (remainingChats.length > 0) {
                    this.loadChat(remainingChats[0]);
                } else {
                    this.createNewChat();
                }
            }
            
            this.loadChatHistory();
        }
    }

    async sendMessage() {
        const content = this.messageInput.value.trim();
        
        if (!content || this.isLoading) return;

        // Hide welcome screen
        this.welcomeScreen.style.display = 'none';

        // Display user message
        this.displayMessage('user', content);
        this.messageInput.value = '';
        this.updateCharCount();
        this.sendBtn.disabled = true;
        this.autoResizeTextarea();

        // Save user message
        this.addMessageToChat('user', content);

        // Show typing indicator
        this.isLoading = true;
        const typingIndicator = this.showTypingIndicator();

        try {
            // Send to backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: this.chats[this.currentChatId].messages
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Remove typing indicator
            typingIndicator.remove();

            // Display assistant response
            this.displayMessage('assistant', data.response);
            this.addMessageToChat('assistant', data.response);

            // Update chat title if it's the first message
            if (this.chats[this.currentChatId].messages.length === 2) {
                this.updateChatTitle(content);
            }

        } catch (error) {
            console.error('Error:', error);
            typingIndicator.remove();
            this.displayMessage('assistant', 'Sorry, there was an error connecting to Claude. Please check your API key and try again.');
        } finally {
            this.isLoading = false;
        }
    }

    addMessageToChat(role, content) {
        const chat = this.chats[this.currentChatId];
        chat.messages.push({ role, content });
        chat.updatedAt = Date.now();
        this.saveChats();
    }

    updateChatTitle(firstMessage) {
        const title = firstMessage.length > 50 
            ? firstMessage.substring(0, 50) + '...' 
            : firstMessage;
        
        this.chats[this.currentChatId].title = title;
        this.saveChats();
        this.loadChatHistory();
    }

    displayMessage(role, content, animate = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        if (!animate) {
            messageDiv.style.animation = 'none';
        }

        const roleText = role === 'user' ? 'You' : 'Claude';
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-role">${roleText}</span>
            </div>
            <div class="message-content">${this.formatMessage(content)}</div>
        `;

        this.messages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-role">Claude</span>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        this.messages.appendChild(messageDiv);
        this.scrollToBottom();
        return messageDiv;
    }

    formatMessage(content) {
        // Escape HTML
        let formatted = this.escapeHtml(content);
        
        // Format code blocks
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        // Format inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Format line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messages.parentElement.scrollTop = this.messages.parentElement.scrollHeight;
        }, 100);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
