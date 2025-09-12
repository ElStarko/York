const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongoose = require('mongoose');

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

const MONGODB_URL = process.env.MONGOOSE_URL || 'mongodb://localhost:27017/chat-app';

mongoose.connect(MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('COnnected to MongoDB');
})
.catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

//User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

//Create User Model
const User = mongoose.model('User', userSchema);

// Simple in-memory user storage 
const users = new Map();
// Store active users and rooms
const activeUsers = new Map();
const rooms = new Map();

// JWT secret
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

    const existingUser = await User.findOne({username})
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });

     // Save user to database
    const savedUser = await newUser.save();
    
     // Generate token
    const token = jwt.sign({ 
      username: savedUser.username, 
      id: savedUser._id 
    }, JWT_SECRET);
    
    console.log('User registered successfully:', savedUser.username);
    res.status(201).json({ 
      message: 'User created successfully', 
      token,
      user: { 
        username: savedUser.username, 
        email: savedUser.email, 
        id: savedUser._id 
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
     // Generate token
    const token = jwt.sign({ 
      username: user.username, 
      id: user._id 
    }, JWT_SECRET);
    
    console.log('User logged in successfully:', user.username);
    res.json({ 
      message: 'Logged in successfully', 
      token,
      user: { 
        username: user.username, 
        email: user.email, 
        id: user._id 
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    jwt.verify(token, JWT_SECRET);
    
    // Get all users from database
    const users = await User.find({}, 'username email createdAt').sort({ username: 1 });
    
    res.json(users);
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(403).json({ error: 'Invalid token' });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.params.id;
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Users can only delete themselves (or add admin logic here)
    if (decoded.id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own account' });
    }
    
    // Delete user from database
    const result = await User.findByIdAndDelete(userId);
    
    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(403).json({ error: 'Invalid token' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    users: users.size,
    activeUsers: activeUsers.size,
    rooms: rooms.size,
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});