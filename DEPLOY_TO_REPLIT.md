# Deploy Backend to Replit

## Quick Deploy (5 minutes)

### Step 1: Create New Replit
1. Go to https://replit.com
2. Click "+ Create Repl"
3. Select **Node.js** template
4. Name: `remind-backend` (or any name)
5. Click "Create Repl"

### Step 2: Upload Files
In the new Replit, you'll see a file editor. Follow these steps:

1. **Delete** the default `index.js` file
2. **Create** these files:

---

#### File: `server.js`
**Copy the entire contents of `backend/server.js` from this project**

---

#### File: `package.json`
**Copy the entire contents of `backend/package.json` from this project**

---

#### File: `.env`
```
PORT=3000
JWT_SECRET=your-secure-random-secret-change-this
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 3: Install & Run
In the Replit Shell:

```bash
npm install
node server.js
```

Or just click the green "Run" button!

### Step 4: Get Your Backend URL
Once running, Replit will show you a URL like:
```
https://remind-backend.your-username.repl.co
```

**Copy this URL!**

### Step 5: Update Frontend
In your **frontend** Replit (this project), update `/utils/api.ts`:

```typescript
const API_BASE_URL = "https://remind-backend.your-username.repl.co";
```

Replace with your actual backend URL from Step 4.

### Step 6: Test
Test the backend:
```
https://your-backend-url.repl.co/health
```

Should return:
```json
{
  "status": "healthy",
  "users": 0,
  "reminders": 0,
  "uptime": 123.45
}
```

---

## Alternative: One-Command Deploy

### Use Replit's Import Feature
1. In new Replit, click "Import from GitHub"
2. Or upload a ZIP of the `backend` folder

---

## Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### "Port already in use"
Replit automatically handles ports. Just use:
```javascript
const PORT = process.env.PORT || 3000;
```
(Already configured in server.js)

### "Module not found"
Make sure you uploaded both:
- server.js
- package.json

Then run `npm install`

---

## After Deployment

### Your URLs:
- **Backend API:** `https://your-backend.repl.co`
- **Frontend App:** `https://your-frontend.repl.co`

### Update Frontend:
Change `/utils/api.ts` to point to your backend URL.

### Keep Backend Running:
Replit will keep your backend running, but may sleep after inactivity.

To keep it awake:
- Use Replit's "Always On" feature (paid)
- Or use a free service like UptimeRobot to ping it every 5 minutes

---

## Security for Production

Before going live:
1. Change JWT_SECRET to a secure random string
2. Implement real database (PostgreSQL)
3. Set up real email service (SendGrid)
4. Configure CORS for specific origins only
5. Enable HTTPS (automatic on Replit)

---

## Done!

Your backend is now deployed and accessible from your phone!

Test signup flow:
1. Open app on phone with Expo Go
2. Click "Sign Up"
3. Enter strong password (12+ chars)
4. Watch Replit backend console for verification code
5. Enter code in app
6. Save recovery key
7. You're in! 🎉
