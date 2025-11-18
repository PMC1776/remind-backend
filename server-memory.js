const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// In-memory database (replace with real database in production)
const users = new Map();
const verificationCodes = new Map();
const reminders = new Map();
const settings = new Map();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

const verificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: 'Too many verification attempts, please try again later.'
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Helper function to generate 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to send email (mock for now)
const sendEmail = async (to, subject, body) => {
  // In production, use a real email service like SendGrid, AWS SES, etc.
  console.log(`\n📧 EMAIL SENT TO: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}\n`);
  return true;
};

// ==================== AUTH ENDPOINTS ====================

// POST /auth/signup
app.post('/auth/signup', authLimiter, async (req, res) => {
  try {
    const { email, password, publicKey } = req.body;

    if (!email || !password || !publicKey) {
      return res.status(400).json({ message: 'Email, password, and publicKey are required' });
    }

    // Check if user already exists
    if (users.has(email)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // The password is already hashed client-side with SHA-256
    // We hash it again on the server with bcrypt for additional security
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Store user
    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      publicKey,
      verified: false,
      createdAt: new Date().toISOString()
    };

    users.set(email, user);
    verificationCodes.set(email, {
      code: verificationCode,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes
    });

    // Send verification email
    await sendEmail(
      email,
      'Verify Your Email - ReMind',
      `Your verification code is: ${verificationCode}\n\nThis code will expire in 15 minutes.`
    );

    res.status(201).json({
      message: 'User created successfully. Please check your email for verification code.',
      userId: user.id
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/login
app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = users.get(email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare the client-hashed password with the server-hashed password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is verified
    if (!user.verified) {
      // Generate new verification code
      const verificationCode = generateVerificationCode();
      verificationCodes.set(email, {
        code: verificationCode,
        expiresAt: Date.now() + 15 * 60 * 1000
      });

      await sendEmail(
        email,
        'Verify Your Email - ReMind',
        `Your verification code is: ${verificationCode}\n\nThis code will expire in 15 minutes.`
      );

      return res.status(200).json({
        needsVerification: true,
        message: 'Please verify your email. A new verification code has been sent.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/verify-email
app.post('/auth/verify-email', verificationLimiter, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Verification code is required' });
    }

    // Find user by verification code
    let userEmail = null;
    for (const [email, data] of verificationCodes.entries()) {
      if (data.code === code && data.expiresAt > Date.now()) {
        userEmail = email;
        break;
      }
    }

    if (!userEmail) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const user = users.get(userEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Mark user as verified
    user.verified = true;
    users.set(userEmail, user);
    verificationCodes.delete(userEmail);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/resend-verification
app.post('/auth/resend-verification', verificationLimiter, authenticateToken, async (req, res) => {
  try {
    const user = users.get(req.user.email);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verified) {
      return res.status(400).json({ message: 'User is already verified' });
    }

    const verificationCode = generateVerificationCode();
    verificationCodes.set(req.user.email, {
      code: verificationCode,
      expiresAt: Date.now() + 15 * 60 * 1000
    });

    await sendEmail(
      req.user.email,
      'Verify Your Email - ReMind',
      `Your verification code is: ${verificationCode}\n\nThis code will expire in 15 minutes.`
    );

    res.json({ message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/logout
app.post('/auth/logout', authenticateToken, async (req, res) => {
  try {
    // In a production app with token blacklisting:
    // - Add token to blacklist with expiration
    // - Clear any server-side sessions

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/change-password
app.post('/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    const user = users.get(req.user.email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    users.set(req.user.email, user);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /auth/delete-account
app.delete('/auth/delete-account', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;

    // Delete user data
    users.delete(email);
    verificationCodes.delete(email);

    // Delete user's reminders
    for (const [key, reminder] of reminders.entries()) {
      if (reminder.userId === req.user.id) {
        reminders.delete(key);
      }
    }

    // Delete user's settings
    settings.delete(req.user.id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== REMINDERS ENDPOINTS ====================

// GET /reminders
app.get('/reminders', authenticateToken, (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const userReminders = [];

    for (const [id, reminder] of reminders.entries()) {
      if (reminder.userId === req.user.id && reminder.status === status) {
        userReminders.push({ id, ...reminder });
      }
    }

    res.json(userReminders);
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /reminders
app.post('/reminders', authenticateToken, (req, res) => {
  try {
    const reminder = {
      ...req.body,
      userId: req.user.id,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    reminders.set(id, reminder);

    res.status(201).json({ id, ...reminder });
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /reminders/:id
app.patch('/reminders/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const reminder = reminders.get(id);

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    if (reminder.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updatedReminder = {
      ...reminder,
      ...req.body,
      userId: req.user.id, // Prevent userId override
      updatedAt: new Date().toISOString()
    };

    reminders.set(id, updatedReminder);
    res.json({ id, ...updatedReminder });
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /reminders/:id
app.delete('/reminders/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const reminder = reminders.get(id);

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    if (reminder.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    reminders.delete(id);
    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /reminders/:id/archive
app.post('/reminders/:id/archive', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const reminder = reminders.get(id);

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    if (reminder.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    reminder.status = 'archived';
    reminder.archivedAt = new Date().toISOString();
    reminders.set(id, reminder);

    res.json({ id, ...reminder });
  } catch (error) {
    console.error('Archive reminder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /reminders/batch-archive
app.post('/reminders/batch-archive', authenticateToken, (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: 'ids must be an array' });
    }

    const archived = [];
    for (const id of ids) {
      const reminder = reminders.get(id);
      if (reminder && reminder.userId === req.user.id) {
        reminder.status = 'archived';
        reminder.archivedAt = new Date().toISOString();
        reminders.set(id, reminder);
        archived.push({ id, ...reminder });
      }
    }

    res.json(archived);
  } catch (error) {
    console.error('Batch archive error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /reminders/batch-delete
app.post('/reminders/batch-delete', authenticateToken, (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: 'ids must be an array' });
    }

    let deleted = 0;
    for (const id of ids) {
      const reminder = reminders.get(id);
      if (reminder && reminder.userId === req.user.id) {
        reminders.delete(id);
        deleted++;
      }
    }

    res.json({ message: `${deleted} reminders deleted successfully` });
  } catch (error) {
    console.error('Batch delete error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== SETTINGS ENDPOINTS ====================

// GET /settings
app.get('/settings', authenticateToken, (req, res) => {
  try {
    const userSettings = settings.get(req.user.id) || {
      notifications: true,
      theme: 'light',
      locationAccuracy: 'high'
    };

    res.json(userSettings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /settings
app.patch('/settings', authenticateToken, (req, res) => {
  try {
    const currentSettings = settings.get(req.user.id) || {};
    const updatedSettings = {
      ...currentSettings,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    settings.set(req.user.id, updatedSettings);
    res.json(updatedSettings);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== EXPORT ENDPOINT ====================

// GET /export
app.get('/export', authenticateToken, (req, res) => {
  try {
    const user = users.get(req.user.email);
    const userReminders = [];

    for (const [id, reminder] of reminders.entries()) {
      if (reminder.userId === req.user.id) {
        userReminders.push({ id, ...reminder });
      }
    }

    const userSettings = settings.get(req.user.id);

    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        publicKey: user.publicKey,
        createdAt: user.createdAt
      },
      reminders: userReminders,
      settings: userSettings,
      exportedAt: new Date().toISOString()
    };

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/', (req, res) => {
  res.json({
    name: 'ReMind Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    users: users.size,
    reminders: reminders.size,
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 ReMind Backend Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET === 'your-secret-key-change-this-in-production' ? '⚠️  USING DEFAULT - CHANGE IN PRODUCTION!' : '✅ Custom'}`);
  console.log(`\n📝 In-memory database active (data will be lost on restart)`);
  console.log(`   Consider implementing PostgreSQL/MongoDB for production\n`);
});
