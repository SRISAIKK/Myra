require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Post = require('./models/Post');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// ====== CONFIG ======
const PORT = process.env.PORT || 4000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/instalite';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-change-this';

// ====== MIDDLEWARE ======
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Multer setup for image & file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ====== DB CONNECT ======
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('Mongo error:', err));

// ====== AUTH MIDDLEWARE ======
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ====== ROUTES ======

// --- Auth ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser)
      return res.status(400).json({ error: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
    });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ error: 'Wrong password' });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Current user
app.get('/api/users/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user._id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio
  });
});

// Update profile (bio)
app.put('/api/users/me', authMiddleware, async (req, res) => {
  const { bio } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { bio },
    { new: true }
  );
  res.json({
    id: user._id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio
  });
});

// Upload avatar
app.post(
  '/api/users/me/avatar',
  authMiddleware,
  upload.single('avatar'),
  async (req, res) => {
    const fileUrl = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatarUrl: fileUrl },
      { new: true }
    );
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio
    });
  }
);

// --- User search for private chats & profiles ---
app.get('/api/users/search', authMiddleware, async (req, res) => {
  const q = req.query.q || '';
  if (!q.trim()) return res.json([]);

  const regex = new RegExp(q.trim(), 'i');
  const users = await User.find({
    username: regex
  })
    .select('username avatarUrl bio')
    .limit(10)
    .lean();

  res.json(
    users.map(u => ({
      id: u._id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      bio: u.bio || ''
    }))
  );
});

// --- Posts ---

// Create post (image + caption)
app.post(
  '/api/posts',
  authMiddleware,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: 'Image required' });
      const imageUrl = `/uploads/${req.file.filename}`;
      const caption = req.body.caption || '';

      const post = await Post.create({
        user: req.user.id,
        imageUrl,
        caption
      });

      const populated = await post.populate('user', 'username avatarUrl');
      res.json(populated);
    } catch (err) {
      console.error('Create post error:', err);
      res.status(500).json({ error: 'Failed to create post' });
    }
  }
);

// Feed (latest posts) – includes comments
app.get('/api/posts/feed', authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('user', 'username avatarUrl')
      .populate('comments.user', 'username')
      .lean();
    res.json(posts);
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

// Like / Unlike
app.post('/api/posts/:postId/like', authMiddleware, async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const userId = req.user.id;
  const index = post.likes.indexOf(userId);

  if (index === -1) {
    post.likes.push(userId);
  } else {
    post.likes.splice(index, 1);
  }

  await post.save();
  res.json({ likesCount: post.likes.length, liked: index === -1 });
});

// ADD COMMENT
app.post('/api/posts/:postId/comments', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    post.comments.push({ user: req.user.id, text: text.trim() });
    await post.save();

    const populated = await Post.findById(post._id)
      .populate('comments.user', 'username')
      .lean();
    const lastComment = populated.comments[populated.comments.length - 1];

    res.json(lastComment);
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// --- Global News (Reels-like cards) ---
// For now returns static sample data; you can later plug in a real news API.
app.get('/api/news', authMiddleware, (req, res) => {
  const news = [
    {
      id: 1,
      title: 'Tech: AI reshapes the future of work',
      source: 'Tech Journal',
      imageUrl:
        'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800',
      summary:
        'Researchers show how AI tools can augment human creativity instead of replacing it.',
      url: 'https://example.com/ai-work'
    },
    {
      id: 2,
      title: 'Space: New images of distant galaxy',
      source: 'Cosmos Daily',
      imageUrl:
        'https://images.pexels.com/photos/2150/sky-space-dark-galaxy.jpg?auto=compress&cs=tinysrgb&w=800',
      summary:
        'A next-gen telescope reveals a super-detailed look at a galaxy 10 billion light-years away.',
      url: 'https://example.com/space-galaxy'
    },
    {
      id: 3,
      title: 'Culture: Streetwear meets high fashion',
      source: 'Style Now',
      imageUrl:
        'https://images.pexels.com/photos/6311654/pexels-photo-6311654.jpeg?auto=compress&cs=tinysrgb&w=800',
      summary:
        'Designers experiment with bold silhouettes and tech fabrics in this season’s shows.',
      url: 'https://example.com/fashion-drop'
    }
  ];

  res.json(news);
});

// --- Chat messages REST (for private chat history) ---

app.get('/api/messages/:roomId', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(messages.reverse());
  } catch (err) {
    console.error('Messages error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Chat file upload
app.post(
  '/api/upload',
  authMiddleware,
  upload.single('file'),
  (req, res) => {
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      fileUrl,
      originalName: req.file.originalname
    });
  }
);

// ====== SOCKET.IO (PRIVATE CHAT ROOMS) ======

io.on('connection', socket => {
  console.log('User connected', socket.id);

  socket.on('joinRoom', roomId => {
    socket.join(roomId);
  });

  socket.on('leaveRoom', roomId => {
    socket.leave(roomId);
  });

  socket.on('sendMessage', async payload => {
    try {
      const { roomId, sender, text, fileUrl, fileName } = payload;
      if (!roomId || !sender) return;
      const msg = await Message.create({
        roomId,
        sender,
        text,
        fileUrl: fileUrl || null,
        fileName: fileName || null
      });
      io.to(roomId).emit('newMessage', msg);
    } catch (err) {
      console.error('sendMessage error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected', socket.id);
  });
});

// ====== START SERVER (only when run directly) ======
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export app for serverless / Vercel-like usage
module.exports = app;


