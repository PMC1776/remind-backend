const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { query, initDatabase } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
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

// Helper functions
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendEmail = async (to, subject, body) => {
  // Mock email service - replace with real service in production
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
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password (already hashed client-side, hashing again server-side)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Insert user
    const userResult = await query(
      'INSERT INTO users (email, password_hash, public_key) VALUES ($1, $2, $3) RETURNING id',
      [email, hashedPassword, publicKey]
    );

    const userId = userResult.rows[0].id;

    // Store verification code
    await query(
      'INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, verificationCode, expiresAt]
    );

    // Send verification email
    await sendEmail(
      email,
      'Verify Your Email - ReMind',
      `Your verification code is: ${verificationCode}\n\nThis code will expire in 15 minutes.`
    );

    res.status(201).json({
      message: 'User created successfully. Please check your email for verification code.',
      userId: userId.toString()
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

    // Get user
    const userResult = await query(
      'SELECT id, email, password_hash, verified FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if verified
    if (!user.verified) {
      // Generate new verification code
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Delete old codes
      await query('DELETE FROM verification_codes WHERE email = $1', [email]);

      // Insert new code
      await query(
        'INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)',
        [email, verificationCode, expiresAt]
      );

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
        id: user.id.toString(),
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

    // Find verification code
    const codeResult = await query(
      'SELECT email FROM verification_codes WHERE code = $1 AND expires_at > NOW()',
      [code]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const email = codeResult.rows[0].email;

    // Get user
    const userResult = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Mark user as verified
    await query('UPDATE users SET verified = TRUE WHERE email = $1', [email]);

    // Delete verification code
    await query('DELETE FROM verification_codes WHERE email = $1', [email]);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id.toString(),
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
    const userResult = await query(
      'SELECT email, verified FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.verified) {
      return res.status(400).json({ message: 'User is already verified' });
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Delete old codes
    await query('DELETE FROM verification_codes WHERE email = $1', [user.email]);

    // Insert new code
    await query(
      'INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [user.email, verificationCode, expiresAt]
    );

    await sendEmail(
      user.email,
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
    // In production: add token to blacklist with expiration
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

    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /auth/delete-account
app.delete('/auth/delete-account', authenticateToken, async (req, res) => {
  try {
    // Delete user (cascades to reminders, settings, verification codes)
    await query('DELETE FROM users WHERE id = $1', [req.user.id]);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== REMINDERS ENDPOINTS ====================

// GET /reminders
app.get('/reminders', authenticateToken, async (req, res) => {
  try {
    const { status = 'active' } = req.query;

    const result = await query(
      'SELECT * FROM reminders WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
      [req.user.id, status]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /reminders
app.post('/reminders', authenticateToken, async (req, res) => {
  try {
    const { title, description, location, radius } = req.body;

    const result = await query(
      `INSERT INTO reminders (user_id, title, description, location, radius)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, title, description, JSON.stringify(location), radius]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /reminders/:id
app.patch('/reminders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const checkResult = await query(
      'SELECT user_id FROM reminders WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    if (checkResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (req.body.title !== undefined) {
      updates.push(`title = $${valueIndex++}`);
      values.push(req.body.title);
    }
    if (req.body.description !== undefined) {
      updates.push(`description = $${valueIndex++}`);
      values.push(req.body.description);
    }
    if (req.body.location !== undefined) {
      updates.push(`location = $${valueIndex++}`);
      values.push(JSON.stringify(req.body.location));
    }
    if (req.body.radius !== undefined) {
      updates.push(`radius = $${valueIndex++}`);
      values.push(req.body.radius);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    values.push(id);

    const result = await query(
      `UPDATE reminders SET ${updates.join(', ')} WHERE id = $${valueIndex} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /reminders/:id
app.delete('/reminders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /reminders/:id/archive
app.post('/reminders/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE reminders
       SET status = 'archived', archived_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Archive reminder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /reminders/batch-archive
app.post('/reminders/batch-archive', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: 'ids must be an array' });
    }

    const result = await query(
      `UPDATE reminders
       SET status = 'archived', archived_at = NOW()
       WHERE id = ANY($1::int[]) AND user_id = $2
       RETURNING *`,
      [ids, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Batch archive error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /reminders/batch-delete
app.post('/reminders/batch-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: 'ids must be an array' });
    }

    const result = await query(
      'DELETE FROM reminders WHERE id = ANY($1::int[]) AND user_id = $2',
      [ids, req.user.id]
    );

    res.json({ message: `${result.rowCount} reminders deleted successfully` });
  } catch (error) {
    console.error('Batch delete error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== SETTINGS ENDPOINTS ====================

// GET /settings
app.get('/settings', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM settings WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Return default settings
      return res.json({
        notifications: true,
        theme: 'light',
        location_accuracy: 'high'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /settings
app.patch('/settings', authenticateToken, async (req, res) => {
  try {
    // Upsert settings
    const { notifications, theme, location_accuracy } = req.body;

    const result = await query(
      `INSERT INTO settings (user_id, notifications, theme, location_accuracy)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET
         notifications = COALESCE($2, settings.notifications),
         theme = COALESCE($3, settings.theme),
         location_accuracy = COALESCE($4, settings.location_accuracy)
       RETURNING *`,
      [req.user.id, notifications, theme, location_accuracy]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== EXPORT ENDPOINT ====================

// GET /export
app.get('/export', authenticateToken, async (req, res) => {
  try {
    const userResult = await query(
      'SELECT id, email, public_key, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    const remindersResult = await query(
      'SELECT * FROM reminders WHERE user_id = $1',
      [req.user.id]
    );

    const settingsResult = await query(
      'SELECT * FROM settings WHERE user_id = $1',
      [req.user.id]
    );

    const exportData = {
      user: userResult.rows[0],
      reminders: remindersResult.rows,
      settings: settingsResult.rows[0] || null,
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
    version: '2.0.0',
    database: 'PostgreSQL',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const result = await query('SELECT COUNT(*) as user_count FROM users');
    const userCount = parseInt(result.rows[0].user_count);

    const remindersResult = await query('SELECT COUNT(*) FROM reminders');
    const remindersCount = parseInt(remindersResult.rows[0].count);

    res.json({
      status: 'healthy',
      database: 'connected',
      users: userCount,
      reminders: remindersCount,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// ==================== START SERVER ====================

const startServer = async () => {
  try {
    // Initialize database
    await initDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 ReMind Backend Server (PostgreSQL) running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 JWT Secret: ${JWT_SECRET === 'your-secret-key-change-this-in-production' ? '⚠️  USING DEFAULT - CHANGE IN PRODUCTION!' : '✅ Custom'}`);
      console.log(`🗄️  Database: PostgreSQL`);
      console.log(`📧 Email: Mock service (console.log)\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
