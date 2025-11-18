# ReMind Backend Server

Privacy-focused backend for the ReMind location-based reminder app with end-to-end encryption support.

## Features

✅ **Authentication**
- User signup with email verification
- Client-side + server-side password hashing (SHA-256 + bcrypt)
- JWT-based authentication
- Email verification with 6-digit codes
- Password change
- Account deletion

✅ **Security**
- Rate limiting on auth endpoints
- Helmet.js security headers
- CORS enabled
- Bcrypt password hashing (12 rounds)
- JWT tokens with 7-day expiration

✅ **Privacy**
- Minimal data collection (email + user ID only)
- Support for client-side encrypted reminders
- User data export functionality
- Complete account deletion

✅ **API Endpoints**
- Full CRUD for reminders
- User settings management
- Batch operations (archive/delete)
- Data export

## Quick Start

### 1. Install Dependencies

\`\`\`bash
cd backend
npm install
\`\`\`

### 2. Configure Environment

Copy \`.env.example\` to \`.env\` and update values:

\`\`\`bash
cp .env.example .env
\`\`\`

**Important:** Change the JWT_SECRET in production!

Generate a secure secret:
\`\`\`bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

### 3. Start Server

**Development:**
\`\`\`bash
npm run dev
\`\`\`

**Production:**
\`\`\`bash
npm start
\`\`\`

Server will run on \`http://localhost:3000\`

### 4. Test the Server

\`\`\`bash
curl http://localhost:3000/health
\`\`\`

## API Documentation

### Base URL
\`\`\`
http://localhost:3000
\`\`\`

### Authentication Endpoints

#### POST /auth/signup
Create a new user account.

**Request:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "hashed-password-from-client",
  "publicKey": "base64-encoded-nacl-public-key"
}
\`\`\`

**Response:**
\`\`\`json
{
  "message": "User created successfully. Please check your email for verification code.",
  "userId": "1234567890"
}
\`\`\`

**Note:** Verification code is printed to console (mock email service).

---

#### POST /auth/login
Login to existing account.

**Request:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "hashed-password-from-client"
}
\`\`\`

**Response (verified user):**
\`\`\`json
{
  "token": "jwt-token",
  "user": {
    "id": "1234567890",
    "email": "user@example.com"
  }
}
\`\`\`

**Response (unverified user):**
\`\`\`json
{
  "needsVerification": true,
  "message": "Please verify your email. A new verification code has been sent."
}
\`\`\`

---

#### POST /auth/verify-email
Verify email with 6-digit code.

**Request:**
\`\`\`json
{
  "code": "123456"
}
\`\`\`

**Response:**
\`\`\`json
{
  "token": "jwt-token",
  "user": {
    "id": "1234567890",
    "email": "user@example.com"
  }
}
\`\`\`

---

#### POST /auth/resend-verification
Resend verification code (requires auth token).

**Headers:**
\`\`\`
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Verification code sent successfully"
}
\`\`\`

---

#### POST /auth/logout
Logout (requires auth token).

**Headers:**
\`\`\`
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Logged out successfully"
}
\`\`\`

---

#### POST /auth/change-password
Change password (requires auth token).

**Headers:**
\`\`\`
Authorization: Bearer <token>
\`\`\`

**Request:**
\`\`\`json
{
  "currentPassword": "old-hashed-password",
  "newPassword": "new-hashed-password"
}
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Password changed successfully"
}
\`\`\`

---

#### DELETE /auth/delete-account
Delete account and all data (requires auth token).

**Headers:**
\`\`\`
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Account deleted successfully"
}
\`\`\`

---

### Reminders Endpoints

All reminder endpoints require authentication.

**Headers:**
\`\`\`
Authorization: Bearer <token>
\`\`\`

#### GET /reminders
Get all reminders for authenticated user.

**Query params:**
- \`status\` (optional): "active" or "archived" (default: "active")

**Response:**
\`\`\`json
[
  {
    "id": "reminder_123",
    "title": "encrypted-title",
    "description": "encrypted-description",
    "location": { "lat": 40.7128, "lng": -74.0060 },
    "radius": 100,
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
\`\`\`

---

#### POST /reminders
Create a new reminder.

**Request:**
\`\`\`json
{
  "title": "encrypted-title",
  "description": "encrypted-description",
  "location": { "lat": 40.7128, "lng": -74.0060 },
  "radius": 100
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "reminder_123",
  "title": "encrypted-title",
  "description": "encrypted-description",
  "location": { "lat": 40.7128, "lng": -74.0060 },
  "radius": 100,
  "status": "active",
  "userId": "1234567890",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
\`\`\`

---

#### PATCH /reminders/:id
Update a reminder.

**Request:**
\`\`\`json
{
  "title": "new-encrypted-title"
}
\`\`\`

---

#### DELETE /reminders/:id
Delete a reminder.

---

#### POST /reminders/:id/archive
Archive a reminder.

---

#### POST /reminders/batch-archive
Archive multiple reminders.

**Request:**
\`\`\`json
{
  "ids": ["reminder_1", "reminder_2", "reminder_3"]
}
\`\`\`

---

#### POST /reminders/batch-delete
Delete multiple reminders.

**Request:**
\`\`\`json
{
  "ids": ["reminder_1", "reminder_2", "reminder_3"]
}
\`\`\`

---

### Settings Endpoints

#### GET /settings
Get user settings (requires auth token).

**Response:**
\`\`\`json
{
  "notifications": true,
  "theme": "light",
  "locationAccuracy": "high"
}
\`\`\`

---

#### PATCH /settings
Update user settings (requires auth token).

**Request:**
\`\`\`json
{
  "theme": "dark",
  "notifications": false
}
\`\`\`

---

### Export Endpoint

#### GET /export
Export all user data (requires auth token).

**Response:**
\`\`\`json
{
  "user": {
    "id": "1234567890",
    "email": "user@example.com",
    "publicKey": "base64-key",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "reminders": [...],
  "settings": {...},
  "exportedAt": "2024-01-01T00:00:00.000Z"
}
\`\`\`

---

## Security Features

### Password Handling
1. Client hashes password with SHA-256 (email as salt)
2. Server receives hashed password
3. Server hashes again with bcrypt (12 rounds)
4. Double-hashing provides defense-in-depth

### Rate Limiting
- Auth endpoints: 10 requests per 15 minutes per IP
- Verification endpoints: 5 requests per 5 minutes per IP

### Token Security
- JWT tokens expire after 7 days
- Tokens include user ID and email only
- Tokens verified on every protected endpoint

### Headers (via Helmet.js)
- XSS protection
- Content Security Policy
- HSTS
- Frame protection
- And more...

## Database

Currently using **in-memory storage** (Map objects).

**⚠️ Warning:** All data is lost when server restarts!

### For Production

Replace in-memory storage with a real database:

**PostgreSQL:**
\`\`\`bash
npm install pg
\`\`\`

**MongoDB:**
\`\`\`bash
npm install mongoose
\`\`\`

**SQLite (for small deployments):**
\`\`\`bash
npm install better-sqlite3
\`\`\`

## Email Service

Currently using **console.log** to display verification codes.

### For Production

Integrate a real email service:

**SendGrid:**
\`\`\`bash
npm install @sendgrid/mail
\`\`\`

**AWS SES:**
\`\`\`bash
npm install @aws-sdk/client-ses
\`\`\`

**Resend:**
\`\`\`bash
npm install resend
\`\`\`

## Deployment

### Replit
1. Create new Replit
2. Upload backend files
3. Run \`npm install\`
4. Set environment variables in Secrets
5. Click "Run"

### Heroku
\`\`\`bash
heroku create your-app-name
git push heroku main
heroku config:set JWT_SECRET=your-secret-here
\`\`\`

### Railway
1. Connect GitHub repository
2. Select backend directory
3. Add environment variables
4. Deploy

### DigitalOcean App Platform
1. Create new app
2. Link repository
3. Set build/run commands
4. Configure environment variables

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 3000 | Server port |
| JWT_SECRET | Yes | (insecure default) | Secret for JWT signing |
| EMAIL_SERVICE | No | - | Email service provider |
| EMAIL_API_KEY | No | - | Email service API key |
| DATABASE_URL | No | - | Database connection string |

## Development

### Run with nodemon (auto-restart)
\`\`\`bash
npm run dev
\`\`\`

### Test endpoints with curl

**Signup:**
\`\`\`bash
curl -X POST http://localhost:3000/auth/signup \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","password":"hashed-password","publicKey":"abc123"}'
\`\`\`

**Login:**
\`\`\`bash
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","password":"hashed-password"}'
\`\`\`

## Troubleshooting

### Issue: "User already exists"
- Database is in-memory, restart server to clear
- Or use different email address

### Issue: "Invalid or expired verification code"
- Codes expire after 15 minutes
- Check console for the printed code
- Request new code with /auth/resend-verification

### Issue: "Invalid credentials"
- Ensure password is hashed on client-side
- Use same email as signup
- Check that user is in database

### Issue: "CORS errors"
- CORS is enabled for all origins in development
- For production, configure allowed origins in server.js

## Production Checklist

- [ ] Change JWT_SECRET to secure random string
- [ ] Implement real database (PostgreSQL/MongoDB)
- [ ] Set up real email service (SendGrid/AWS SES)
- [ ] Configure CORS for specific origins only
- [ ] Enable HTTPS
- [ ] Implement token refresh mechanism
- [ ] Add token blacklisting for logout
- [ ] Set up monitoring (Sentry, DataDog, etc.)
- [ ] Configure logging (Winston, Bunyan, etc.)
- [ ] Set up backups
- [ ] Implement rate limiting on all endpoints
- [ ] Add request validation (joi, express-validator)
- [ ] Set up CI/CD pipeline
- [ ] Perform security audit
- [ ] Load testing
- [ ] Documentation for API consumers

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
