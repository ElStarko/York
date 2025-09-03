const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms and their users
const activeRooms = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle joining a room
  socket.on('joinRoom', (data) => {
    const { username, room } = data;
    
    // Leave any existing rooms
    if (socket.room) {
      socket.leave(socket.room);
      
      // Remove user from active rooms data
      if (activeRooms.has(socket.room)) {
        const users = activeRooms.get(socket.room);
        const index = users.findIndex(user => user.id === socket.id);
        if (index !== -1) {
          users.splice(index, 1);
          if (users.length === 0) {
            activeRooms.delete(socket.room);
          } else {
            activeRooms.set(socket.room, users);
          }
        }
      }
    }

    // Join the new room
    socket.join(room);
    socket.room = room;
    socket.username = username;

    // Add user to active rooms data
    if (!activeRooms.has(room)) {
      activeRooms.set(room, []);
    }
    const users = activeRooms.get(room);
    users.push({ id: socket.id, username });
    activeRooms.set(room, users);

    // Notify room that a user has joined
    socket.to(room).emit('userJoined', {
      username,
      count: users.length
    });

    // Send current users list to the new user
    socket.emit('userList', {
      users: users.map(user => user.username),
      count: users.length
    });

    console.log(`${username} joined room: ${room}`);
  });

  // Handle chat messages
  socket.on('chatMessage', (message) => {
    if (socket.room) {
      io.to(socket.room).emit('message', {
        username: socket.username,
        message: message,
        timestamp: new Date().toISOString()
      });
      console.log(`Message in ${socket.room} from ${socket.username}: ${message}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.room && activeRooms.has(socket.room)) {
      const users = activeRooms.get(socket.room);
      const index = users.findIndex(user => user.id === socket.id);
      
      if (index !== -1) {
        const username = users[index].username;
        users.splice(index, 1);
        
        if (users.length === 0) {
          activeRooms.delete(socket.room);
        } else {
          activeRooms.set(socket.room, users);
        }

        // Notify room that a user has left
        socket.to(socket.room).emit('userLeft', {
          username: username,
          count: users.length
        });
        
        console.log(`${username} left room: ${socket.room}`);
      }
    }
    
    console.log('User disconnected:', socket.id);
  });
});

  // Send the current user count to the newly connected client
    const userCount = io.engine.clientsCount;
    io.emit('user count', userCount);


// API endpoint to get active rooms
app.get('/api/rooms', (req, res) => {
  const rooms = [];
  for (const [room, users] of activeRooms.entries()) {
    rooms.push({
      name: room,
      userCount: users.length
    });
  }
  res.json(rooms);
});

// API endpoint to get users in a specific room
app.get('/api/rooms/:room/users', (req, res) => {
  const room = req.params.room;
  if (activeRooms.has(room)) {
    const users = activeRooms.get(room).map(user => user.username);
    res.json({ room, users, count: users.length });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});