# Chat Application - Real-Time Messaging Platform

A full-featured real-time chat application built with Node.js, Express, Socket.IO, and MongoDB. Features user authentication, room-based chatting, and user management.

## 🌟 Features

- **User Authentication**: Register and login with JWT-based authentication
- **Real-Time Messaging**: Instant message delivery using Socket.IO
- **Room-Based Chatting**: Create and join different chat rooms
- **User Management**: View all users and manage your account
- **Message Persistence**: All messages are stored in MongoDB
- **Responsive Design**: Works on desktop and mobile devices
- **Online User Tracking**: See who's online in real-time

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Real-Time Communication**: Socket.IO
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT)
- **Password Hashing**: bcryptjs
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Deployment**: Render (Frontend & Backend)

## 🚀 Live Demo

https://york-0dir.onrender.com

## 📦 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB installation
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/chat-app.git
   cd chat-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**
   Create a `.env` file in the root directory:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

### Production Deployment

1. **Set up MongoDB Atlas**
   - Create a cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Get your connection string
   - Whitelist IP addresses (use `0.0.0.0/0` for all IPs)

2. **Deploy to Render**
   - Connect your GitHub repository to Render
   - Set environment variables in Render dashboard:
     - `MONGODB_URI`: Your MongoDB Atlas connection string
     - `JWT_SECRET`: A strong secret key for JWT
     - `NODE_ENV`: production

## 🧪 Postman Documentation

https://documenter.getpostman.com/view/26234378/2sB3HqHxx7

For detailed API documentation and testing, check our Postman collection:

1. **Import the collection**
   - Download the collection JSON file from `/docs/postman-collection.json`
   - Import into Postman

2. **Environment setup**
   - Create a new environment in Postman
   - Add variables:
     - `baseUrl`: Your API base URL (e.g., https://your-backend-app.onrender.com)
     - `token`: Will be automatically set after login

3. **Testing workflow**
   - Start with the registration or login request
   - Use the returned token in subsequent requests
   - Test the protected endpoints with the token

### Example Requests

**Register a new user:**
```bash
curl -X POST https://york-0dir.onrender.com/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123","email":"test@example.com"}'
```

**Login:**
```bash
curl -X POST https://york-0dir.onrender.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

**Get all users (authenticated):**
```bash
curl -X GET https://york-0dir.onrender.com/api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🎯 Usage Guide

### For Users

1. **Registration & Login**
   - Create an account with username, email, and password
   - Log in with your credentials to access the chat

2. **Joining a Room**
   - Enter a room name in the sidebar and click "Join Room"
   - Start chatting with others in the same room

3. **Sending Messages**
   - Type your message in the input field at the bottom
   - Press Enter or click the send button

4. **Managing Your Account**
   - Click "Delete Account" to remove your account permanently
   - Click "Logout" to sign out of the application

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/chat-app` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-secret-key` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

### Socket.IO Events

**Client to Server:**
- `joinRoom`: Join a chat room
- `chatMessage`: Send a message
- `getRoomUsers`: Request users in current room
- `logout`: User logout

**Server to Client:**
- `message`: New message received
- `userJoined`: User joined the room
- `userLeft`: User left the room
- `userList`: List of users in room
- `roomUsersUpdate`: Updated room users list
- `messageHistory`: Previous messages in room
- `activeUsers`: List of all active users

## 🤝 Contributing

We welcome contributions to improve this chat application!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow JavaScript best practices
- Write clear commit messages
- Test your changes thoroughly
- Update documentation as needed

## 🙏 Acknowledgments

- Socket.IO team for the excellent real-time communication library
- MongoDB for the powerful database solution
- Render for the seamless deployment platform
- All contributors who have helped improve this application
