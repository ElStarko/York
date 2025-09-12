const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors({
    origin: ["https://york-0dir.onrender.com", "http://127.0.0.1:5500", "http://localhost:5500", "http://localhost:3000"],
    credentials: true
}));

// Configure Socket.IO for production
const io = socketIo(server, {
  cors: {
    origin: ["https://york-0dir.onrender.com", "http://127.0.0.1:5500", "http://localhost:5500", "http://localhost:3000"], // Allow all origins for now, tighten this later
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory user storage (use a database in production)
const users = new Map();
// Store active users and rooms
const activeUsers = new Map();
const rooms = new Map();

// JWT secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'nonearme';

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    console.log('Registration attempt:', req.body);
    const { username, password, email } = req.body;
    
    // Input validation
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Username, password, and email are required' });
    }
    
    if (users.has(username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Store user
    users.set(username, {
      username,
      password: hashedPassword,
      email,
      createdAt: new Date()
    });
    
    // Generate token
    const token = jwt.sign({ username }, JWT_SECRET);
    
    console.log('User registered successfully:', username);
    res.status(201).json({ 
      message: 'User created successfully', 
      token,
      user: { username, email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    console.log('Login attempt:', req.body);
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = users.get(username);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign({ username }, JWT_SECRET);
    
    console.log('User logged in successfully:', username);
    res.json({ 
      message: 'Logged in successfully', 
      token,
      user: { username, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    users: users.size,
    activeUsers: activeUsers.size,
    rooms: rooms.size
  });
});

// Socket.IO middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log('Authentication attempt with token', token)

  if (!token) {
    console.log('Authentication error: No token provided');
    return next(new Error('Authentication error'));
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('Authentication error: Invalid token');
      return next(new Error('Authentication error'));
    }
    socket.user = decoded;
    next();
  });
});

// Handle socket connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.user.username);
  
  // Store active user
  activeUsers.set(socket.user.username, {
    socketId: socket.id,
    username: socket.user.username,
    connectedAt: new Date()
  });
  
  // Send active users list to all clients
  io.emit('activeUsers', Array.from(activeUsers.values()));
  
  socket.on('joinRoom', (data) => {
    const { room } = data;
    const username = socket.user.username;
    
    // Input validation
    if (!room) {
      console.log('Join room error: No room specified');
      return;
    }
    
    // Store user information
    socket.username = username;
    socket.room = room;
    
    // Join the room
    socket.join(room);
    
    // Add user to room
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room).add(username);
    
    // Notify others in the room
    socket.to(room).emit('userJoined', {
      username,
      count: rooms.get(room).size
    });
    
    // Send current user list to the new user
    socket.emit('userList', {
      users: Array.from(rooms.get(room))
    });

    console.log(`${username} joined room: ${room}`);
  });

  socket.on('chatMessage', (data) => {
    const user = users.get(socket.username);
    if (user && socket.room) {
      io.to(socket.room).emit('message', {
        username: socket.username,
        message: data.message,
        id: data.id || Date.now().toString(),
        timestamp: new Date()
      });
    } else {
      console.log('Chat message error: User not in a room');
    }
  });

  socket.on('logout', () => {
    // Remove from active users
    activeUsers.delete(socket.user.username);
    io.emit('activeUsers', Array.from(activeUsers.values()));
    
    // Leave room if in one
    if (socket.room) {
      if (rooms.has(socket.room)) {
        rooms.get(socket.room).delete(socket.username);
        
        // Notify others in the room
        socket.to(socket.room).emit('userLeft', {
          username: socket.username,
          count: rooms.get(socket.room).size
        });
        
        // Remove room if empty
        if (rooms.get(socket.room).size === 0) {
          rooms.delete(socket.room);
        }
      }
    }
    
    console.log('User logged out:', socket.user.username);
  });

  socket.on('disconnect', () => {
    // Remove from active users
    activeUsers.delete(socket.user.username);
    io.emit('activeUsers', Array.from(activeUsers.values()));
    
    // Leave room if in one
    if (socket.room) {
      if (rooms.has(socket.room)) {
        rooms.get(socket.room).delete(socket.username);
        
        // Notify others in the room
        socket.to(socket.room).emit('userLeft', {
          username: socket.username,
          count: rooms.get(socket.room).size
        });
        
        // Remove room if empty
        if (rooms.get(socket.room).size === 0) {
          rooms.delete(socket.room);
        }
      }
    }
    
    console.log('User disconnected:', socket.user.username);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});