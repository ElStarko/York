  // Global variables
        let socket = null;
        let currentUser = null;
        let currentRoom = null;
        let messageIdCounter = 0;
        const displayedMessageIds = new Set();
        let authToken = null;

        // DOM elements
        const authContainer = document.getElementById('auth-container');
        const chatContainer = document.getElementById('chat-container');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const loginTab = document.getElementById('login-tab');
        const registerTab = document.getElementById('register-tab');
        const authMessage = document.getElementById('auth-message');
        const logoutButton = document.getElementById('logout-button');
        const currentUserElement = document.getElementById('current-user');
        const statusText = document.getElementById('status-text');
        const debugInfo = document.getElementById('debug-info');

        // Server URL - adjust based on your environment
        // For Live Server, we need to use the correct URL and handle CORS
        const SERVER_URL = 'http://localhost:3000'; // Your backend server URL

        // Update debug info
        function updateDebugInfo(message) {
            debugInfo.textContent = `Debug: ${message}`;
            console.log(message);
        }

        // Tab switching
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        });

        registerTab.addEventListener('click', () => {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        });

        // Login form submission
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            
            try {
                updateDebugInfo('Attempting login...');
                const response = await fetch(`${SERVER_URL}/api/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password }),
                    credentials: 'include' // Important for cookies if using them
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Store token
                    authToken = data.token;
                    localStorage.setItem('chatToken', authToken);
                    currentUser = data.user;
                    
                    // Initialize socket connection
                    initializeSocket(authToken);
                    
                    // Switch to chat interface
                    showChatInterface();
                    
                    showAuthMessage('Login successful!', 'success');
                    updateDebugInfo('Login successful');
                    
                    // Load all users
                    loadAllUsers();
                } else {
                    showAuthMessage(data.error, 'error');
                    updateDebugInfo(`Login error: ${data.error}`);
                }
            } catch (error) {
                console.error('Login error:', error);
                showAuthMessage('Login failed. Please try again.', 'error');
                updateDebugInfo(`Login failed: ${error.message}`);
            }
        });

        // Register form submission
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            
            if (password !== confirmPassword) {
                showAuthMessage('Passwords do not match', 'error');
                return;
            }
            
            try {
                updateDebugInfo('Attempting registration...');
                const response = await fetch(`${SERVER_URL}/api/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showAuthMessage('Registration successful. Please login.', 'success');
                    updateDebugInfo('Registration successful');
                    
                    // Switch to login tab
                    loginTab.click();
                    
                    // Pre-fill username
                    document.getElementById('login-username').value = username;
                } else {
                    showAuthMessage(data.error, 'error');
                    updateDebugInfo(`Registration error: ${data.error}`);
                }
            } catch (error) {
                console.error('Registration error:', error);
                showAuthMessage('Registration failed. Please try again.', 'error');
                updateDebugInfo(`Registration failed: ${error.message}`);
            }
        });

        // Logout button
        logoutButton.addEventListener('click', () => {
            if (socket) {
                socket.emit('logout');
                socket.disconnect();
            }
            
            // Clear stored token
            localStorage.removeItem('chatToken');
            authToken = null;
            
            // Reset state
            currentUser = null;
            currentRoom = null;
            socket = null;
            
            // Show auth interface
            showAuthInterface();
            updateDebugInfo('Logged out');
        });

        // Load all users from the server
        async function loadAllUsers() {
            if (!authToken) return;
            
            try {
                updateDebugInfo('Loading users...');
                const response = await fetch(`${SERVER_URL}/api/users`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                if (response.ok) {
                    const users = await response.json();
                    displayAllUsers(users);
                    updateDebugInfo('Users loaded successfully');
                } else {
                    console.error('Failed to load users');
                    updateDebugInfo('Failed to load users');
                }
            } catch (error) {
                console.error('Error loading users:', error);
                updateDebugInfo(`Error loading users: ${error.message}`);
            }
        }

        // Display all users in the UI
        function displayAllUsers(users) {
            const allUsersList = document.getElementById('all-users-list');
            
            if (!users || users.length === 0) {
                allUsersList.innerHTML = '<li>No users found</li>';
                return;
            }
            
            allUsersList.innerHTML = '';
            
            users.forEach(user => {
                const userItem = document.createElement('li');
                
                const userInfoContainer = document.createElement('div');
                userInfoContainer.className = 'user-info-container';
                
                const userAvatar = document.createElement('div');
                userAvatar.className = 'user-avatar';
                userAvatar.textContent = user.username.charAt(0).toUpperCase();
                
                const userName = document.createElement('span');
                userName.textContent = user.username;
                
                userInfoContainer.appendChild(userAvatar);
                userInfoContainer.appendChild(userName);
                
                userItem.appendChild(userInfoContainer);
                
                // Add delete button for users (except current user)
                if (user.username !== currentUser.username) {
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'delete-user-btn';
                    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                    deleteButton.onclick = () => deleteUser(user.id);
                    userItem.appendChild(deleteButton);
                }
                
                allUsersList.appendChild(userItem);
            });
        }

        // Delete a user
        async function deleteUser(userId) {
            if (!authToken || !confirm('Are you sure you want to delete this user?')) return;
            
            try {
                updateDebugInfo('Deleting user...');
                const response = await fetch(`${SERVER_URL}/api/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                if (response.ok) {
                    // Reload the user list
                    loadAllUsers();
                    updateDebugInfo('User deleted successfully');
                } else {
                    console.error('Failed to delete user');
                    updateDebugInfo('Failed to delete user');
                    alert('Failed to delete user. You may not have permission.');
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                updateDebugInfo(`Error deleting user: ${error.message}`);
            }
        }

        // Initialize socket connection
        function initializeSocket(token) {
            updateDebugInfo('Initializing socket connection...');
            
            // Connect to the server with authentication
            socket = io(SERVER_URL, {
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling'] // Try both transports
            });
            
            // Connection status
            socket.on('connect', () => {
                updateDebugInfo('Connected to server');
                statusText.textContent = 'Connected';
                statusText.style.color = '#4CAF50';
                document.querySelector('.status-dot').style.backgroundColor = '#4CAF50';
            });
            
            socket.on('disconnect', () => {
                updateDebugInfo('Disconnected from server');
                statusText.textContent = 'Disconnected';
                statusText.style.color = '#f44336';
                document.querySelector('.status-dot').style.backgroundColor = '#f44336';
            });
            
            socket.on('connect_error', (error) => {
                updateDebugInfo(`Connection error: ${error.message}`);
                statusText.textContent = 'Connection Error';
                statusText.style.color = '#f44336';
                document.querySelector('.status-dot').style.backgroundColor = '#f44336';
                
                // If it's an authentication error, redirect to login
                if (error.message === 'Authentication error') {
                    alert('Authentication failed. Please log in again.');
                    localStorage.removeItem('chatToken');
                    showAuthInterface();
                }
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
                
                addMessage(data.message, data.username, data.username === currentUser.username);
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
            
            // Handle active users updates
            socket.on('activeUsers', (users) => {
                updateActiveUsersList(users);
            });
        }

        // Join room function
        function joinRoom() {
            const room = document.getElementById('room').value;
            
            if (!room) {
                alert('Please enter a room name');
                return;
            }
            
            currentRoom = room;
            
            socket.emit('joinRoom', { room });
            
            // Enable message input
            document.getElementById('message').disabled = false;
            document.querySelector('.message-input button').disabled = false;
            
            addSystemMessage(`You joined room: ${room}`);
            updateDebugInfo(`Joined room: ${room}`);
        }

        // Send message function
        function sendMessage() {
            const message = document.getElementById('message').value;
            
            if (!message) return;
            
            if (!currentRoom) {
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
            addMessage(message, currentUser.username, true);
            
            // Clear input
            document.getElementById('message').value = '';
        }

        // Add message to UI
        function addMessage(content, sender, isSent = false) {
            const messages = document.getElementById('messages');
            const messageElement = document.createElement('div');
            messageElement.classList.add('message-bubble', isSent ? 'sent' : 'received');
            
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
            messageElement.classList.add('message-bubble', 'system-message');
            
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
            if (currentUser && currentUser.username) {
                const currentUserItem = document.createElement('li');
                const userInfoContainer = document.createElement('div');
                userInfoContainer.className = 'user-info-container';
                
                const userAvatar = document.createElement('div');
                userAvatar.className = 'user-avatar';
                userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
                
                const userName = document.createElement('span');
                userName.textContent = 'You (' + currentUser.username + ')';
                
                userInfoContainer.appendChild(userAvatar);
                userInfoContainer.appendChild(userName);
                currentUserItem.appendChild(userInfoContainer);
                userList.appendChild(currentUserItem);
            }
            
            // Add other users
            if (users && Array.isArray(users)) {
                users.forEach(user => {
                    if (user !== currentUser.username) {
                        const userItem = document.createElement('li');
                        const userInfoContainer = document.createElement('div');
                        userInfoContainer.className = 'user-info-container';
                        
                        const userAvatar = document.createElement('div');
                        userAvatar.className = 'user-avatar';
                        userAvatar.textContent = user.charAt(0).toUpperCase();
                        
                        const userName = document.createElement('span');
                        userName.textContent = user;
                        
                        userInfoContainer.appendChild(userAvatar);
                        userInfoContainer.appendChild(userName);
                        userItem.appendChild(userInfoContainer);
                        userList.appendChild(userItem);
                    }
                });
            }
        }

        // Update active users list
        function updateActiveUsersList(users) {
            const onlineCount = document.getElementById('online-count');
            onlineCount.textContent = users.length;
            
            const userList = document.getElementById('user-list');
            userList.innerHTML = '';
            
            // Add current user first
            if (currentUser && currentUser.username) {
                const currentUserItem = document.createElement('li');
                const userInfoContainer = document.createElement('div');
                userInfoContainer.className = 'user-info-container';
                
                const userAvatar = document.createElement('div');
                userAvatar.className = 'user-avatar';
                userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
                
                const userName = document.createElement('span');
                userName.textContent = 'You (' + currentUser.username + ')';
                
                userInfoContainer.appendChild(userAvatar);
                userInfoContainer.appendChild(userName);
                currentUserItem.appendChild(userInfoContainer);
                userList.appendChild(currentUserItem);
            }
            
            // Add all active users
            if (users && Array.isArray(users)) {
                users.forEach(user => {
                    if (user.username !== currentUser.username) {
                        const userItem = document.createElement('li');
                        const userInfoContainer = document.createElement('div');
                        userInfoContainer.className = 'user-info-container';
                        
                        const userAvatar = document.createElement('div');
                        userAvatar.className = 'user-avatar';
                        userAvatar.textContent = user.username.charAt(0).toUpperCase();
                        
                        const userName = document.createElement('span');
                        userName.textContent = user.username;
                        
                        userInfoContainer.appendChild(userAvatar);
                        userInfoContainer.appendChild(userName);
                        userItem.appendChild(userInfoContainer);
                        userList.appendChild(userItem);
                    }
                });
            }
        }

        // Show auth message
        function showAuthMessage(message, type) {
            authMessage.textContent = message;
            authMessage.className = `message ${type}`;
        }

        // Show chat interface
        function showChatInterface() {
            authContainer.classList.add('hidden');
            chatContainer.classList.remove('hidden');
            currentUserElement.textContent = currentUser.username;
        }

        // Show auth interface
        function showAuthInterface() {
            chatContainer.classList.add('hidden');
            authContainer.classList.remove('hidden');
            
            // Clear forms
            loginForm.reset();
            registerForm.reset();
            authMessage.textContent = '';
        }

        // Check if user is already logged in on page load
        window.addEventListener('load', () => {
            const token = localStorage.getItem('chatToken');
            
            if (token) {
                try {
                    // Decode token to get user info (without verification)
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    currentUser = { username: payload.username };
                    authToken = token;
                    
                    // Initialize socket connection
                    initializeSocket(token);
                    
                    // Switch to chat interface
                    showChatInterface();
                    
                    // Load all users
                    loadAllUsers();
                } catch (error) {
                    console.error('Invalid token:', error);
                    // Token is invalid, remove it
                    localStorage.removeItem('chatToken');
                }
            }
        });

        // Allow sending message with Enter key
        document.getElementById('message').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });