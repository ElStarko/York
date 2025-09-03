// Determine the server URL based on environment
const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : window.location.origin;

// Connect to the server
const socket = io(serverUrl);
let currentUsername = '';
let currentRoom = '';
let messageIdCounter = 0;
const displayedMessageIds = new Set();

// Connection status
socket.on('connect', () => {
  console.log('Connected to server');
  document.getElementById('status-text').textContent = 'Connected';
  document.getElementById('status-text').style.color = '#4CAF50';
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  document.getElementById('status-text').textContent = 'Disconnected';
  document.getElementById('status-text').style.color = '#ff0000';
});

socket.on('connect_error', (error) => {
  console.log('Connection error:', error);
  document.getElementById('status-text').textContent = 'Connection Error';
  document.getElementById('status-text').style.color = '#ff0000';
});

// Handle incoming messages
socket.on('message', (data) => {
  // Check if we've already displayed this message
  if (data.id && displayedMessageIds.has(data.id)) {
    return; // Skip if already displayed
  }
  
  // Add to displayed messages set
  if (data.id) {
    displayedMessageIds.add(data.id);
  }
  
  addMessage(data.message, data.username, data.username === currentUsername);
});

// Handle user join notifications
socket.on('userJoined', (data) => {
  addSystemMessage(`${data.username} joined the room (${data.count} users)`);
});

// Handle user leave notifications
socket.on('userLeft', (data) => {
  addSystemMessage(`${data.username} left the room (${data.count} users)`);
});

// Handle user list updates
socket.on('userList', (data) => {
  updateUserList(data.users);
});

// Join room function
function joinRoom() {
  const username = document.getElementById('username').value;
  const room = document.getElementById('room').value;
  
  if (!username || !room) {
    alert('Please enter both username and room name');
    return;
  }
  
  currentUsername = username;
  currentRoom = room;
  
  socket.emit('joinRoom', { username, room });
  
  // Update UI
  document.getElementById('username').disabled = true;
  document.getElementById('room').disabled = true;
  document.querySelector('.join-section button').disabled = true;
  document.querySelector('.join-section button').textContent = 'Joined';
  
  addSystemMessage(`You joined room: ${room}`);
}

// Send message function
function sendMessage() {
  const message = document.getElementById('message').value;
  
  if (!message) return;
  
  if (!currentUsername || !currentRoom) {
    alert('Please join a room first');
    return;
  }
  
  // Generate a unique ID for this message
  const messageId = `${Date.now()}-${messageIdCounter++}`;
  
  // Add to displayed messages set immediately to prevent duplicates
  displayedMessageIds.add(messageId);
  
  // Send to server with the ID
  socket.emit('chatMessage', { message, id: messageId });
  
  // Add message to UI immediately (optimistic update)
  addMessage(message, currentUsername, true);
  
  // Clear input
  document.getElementById('message').value = '';
}

// Add message to UI
function addMessage(content, sender, isSent = false) {
  const messages = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', isSent ? 'sent' : 'received');
  
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.textContent = content;
  
  const messageInfo = document.createElement('div');
  messageInfo.classList.add('message-info');
  
  // Format timestamp
  const now = new Date();
  const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  messageInfo.textContent = isSent ? `You • ${timeString}` : `${sender} • ${timeString}`;
  
  messageElement.appendChild(messageContent);
  messageElement.appendChild(messageInfo);
  
  messages.appendChild(messageElement);
  
  // Scroll to bottom
  messages.scrollTop = messages.scrollHeight;
}

// Add system message to UI
function addSystemMessage(content) {
  const messages = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', 'system-message');
  
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.textContent = content;
  
  messageElement.appendChild(messageContent);
  messages.appendChild(messageElement);
  
  // Scroll to bottom
  messages.scrollTop = messages.scrollHeight;
}

// Update user list
function updateUserList(users) {
  const userList = document.getElementById('user-list');
  userList.innerHTML = '';
  
  // Add current user first
  const currentUserItem = document.createElement('li');
  currentUserItem.innerHTML = '<div class="user-avatar">' + (currentUsername ? currentUsername.charAt(0).toUpperCase() : 'Y') + '</div> You' + (currentUsername ? ` (${currentUsername})` : '');
  userList.appendChild(currentUserItem);
  
  // Add other users
  if (users && Array.isArray(users)) {
    users.forEach(user => {
      if (user !== currentUsername) {
        const userItem = document.createElement('li');
        userItem.innerHTML = '<div class="user-avatar">' + user.charAt(0).toUpperCase() + '</div> ' + user;
        userList.appendChild(userItem);
      }
    });
  }
}

// Allow sending message with Enter key
document.getElementById('message').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    sendMessage();
  }
});