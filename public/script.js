document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const userCountElement = document.getElementById('user-count');
    const statusText = document.getElementById('status-text');

    // Connect to the server
    const socket = io();

    // Handle connection events
    socket.on('connect', () => {
        statusText.textContent = 'Connected';
        statusText.style.color = '#4CAF50';
    });

    socket.on('disconnect', () => {
        statusText.textContent = 'Disconnected';
        statusText.style.color = '#ff0000';
    });

    // Handle user count updates
    socket.on('user count', (count) => {
        userCountElement.textContent = count;
    });

    // Handle incoming chat messages
    socket.on('chat message', (data) => {
        addMessage(data.message, data.sender, false, data.time);
    });

    // Function to add a message to the chat
    function addMessage(content, sender, isSent = false, timestamp = new Date()) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', isSent ? 'sent' : 'received');
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        messageContent.textContent = content;
        
        const messageInfo = document.createElement('div');
        messageInfo.classList.add('message-info');
        
        // Format timestamp
        const time = new Date(timestamp);
        const timeString = time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        messageInfo.textContent = `${sender} • ${timeString}`;
        
        messageElement.appendChild(messageContent);
        messageElement.appendChild(messageInfo);
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Send message function
    function sendMessage() {
        const content = messageInput.value.trim();
        if (content === '') return;
        
        // Emit the message to the server
        socket.emit('chat message', content);
        
        // Add the message to the UI immediately (optimistic update)
        addMessage(content, 'You', true);
        
        // Clear input
        messageInput.value = '';
    }
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});