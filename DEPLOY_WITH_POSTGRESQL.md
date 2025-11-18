# Deploy Backend with PostgreSQL

Your backend is now production-ready with PostgreSQL! Choose your deployment platform:

**Recommended:**
- ⭐ **Railway** - Easiest, $5/month, PostgreSQL included
- ⭐ **Render** - Free tier available (with limitations)

---

## Option 1: Deploy to Railway (Recommended)

**Cost:** $5/month for 512MB RAM + PostgreSQL
**Time:** 10 minutes
**Best for:** Production apps

### Step 1: Sign Up for Railway
1. Go to https://railway.app
2. Sign in with GitHub
3. Verify your email

### Step 2: Create New Project
1. Click "+ New Project"
2. Choose "Deploy from GitHub repo"
3. Select your backend repository (or upload files)
4. Railway will auto-detect Node.js

### Step 3: Add PostgreSQL Database
1. Click "+ New" in your project
2. Select "Database" → "PostgreSQL"
3. Wait for database to provision (~30 seconds)
4. **DATABASE_URL is automatically set!**

### Step 4: Configure Environment Variables
1. Click on your backend service
2. Go to "Variables" tab
3. Add these variables:
   ```
   PORT=3000
   NODE_ENV=production
   JWT_SECRET=<generate-secure-random-32-byte-hex>
   ```

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Note:** DATABASE_URL is automatically provided by Railway!

### Step 5: Deploy
1. Railway auto-deploys on git push
2. Or click "Deploy" button
3. Watch the build logs
4. Done! 🎉

### Step 6: Get Your URL
1. Go to "Settings" tab
2. Under "Domains", click "Generate Domain"
3. Copy your URL: `https://your-app.up.railway.app`

### Step 7: Update Frontend
In your frontend project (`utils/api.ts`):
```typescript
const API_BASE_URL = "https://your-app.up.railway.app";
```

### Test It!
```bash
curl https://your-app.up.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "database": "connected",
  "users": 0,
  "reminders": 0
}
```

---

## Option 2: Deploy to Render

**Cost:** Free tier (sleeps after 15 min inactivity) or $7/month always-on
**Time:** 15 minutes
**Best for:** Testing, hobby projects

### Step 1: Sign Up for Render
1. Go to https://render.com
2. Sign up with GitHub/GitLab
3. Verify email

### Step 2: Create PostgreSQL Database
1. Click "+ New" → "PostgreSQL"
2. Name: `remind-db`
3. Database: `remind`
4. User: `remind_user`
5. Region: Choose closest to you
6. Plan: Free (or Starter $7/month)
7. Click "Create Database"
8. **Copy the Internal Database URL** (starts with `postgresql://`)

### Step 3: Create Web Service
1. Click "+ New" → "Web Service"
2. Connect your GitHub repository
3. Or choose "Public Git repository" and enter URL
4. Settings:
   - **Name:** `remind-backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (or Starter $7/month)

### Step 4: Add Environment Variables
In the "Environment" section, add:

```
PORT=3000
NODE_ENV=production
JWT_SECRET=<your-secure-random-secret>
DATABASE_URL=<paste-internal-database-url-from-step-2>
```

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait for build & deploy (~3-5 minutes)
3. Watch logs for "🚀 ReMind Backend Server running"

### Step 6: Get Your URL
Your Render URL: `https://remind-backend.onrender.com`

### Step 7: Update Frontend
```typescript
const API_BASE_URL = "https://remind-backend.onrender.com";
```

### Important: Free Tier Limitations
- Sleeps after 15 minutes of inactivity
- Takes 30-60 seconds to wake up on first request
- Use UptimeRobot.com to ping every 14 minutes to keep awake (free)

---

## Option 3: Deploy to Replit (Quick Test)

**For quick testing only - not recommended for production**

### Step 1: Create Replit
1. Create new Node.js Repl
2. Upload all files from `backend/` folder
3. Create `.env` file with your values

### Step 2: Add PostgreSQL
Replit doesn't provide managed PostgreSQL. Use external:

**Option A:** Use Render's free PostgreSQL (from Option 2, Step 2)

**Option B:** Use Supabase PostgreSQL:
1. Create account at https://supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy connection string
5. Add to .env as DATABASE_URL

### Step 3: Run
```bash
npm install
node server.js
```

---

## Verification Checklist

After deployment:

- [ ] Backend responds at /health
- [ ] Database connection shows "connected"
- [ ] Can create account (POST /auth/signup)
- [ ] Verification code appears in logs
- [ ] Can verify email (POST /auth/verify-email)
- [ ] Can login (POST /auth/login)
- [ ] JWT token received
- [ ] Frontend API_BASE_URL updated
- [ ] App can connect from phone

---

## Database Management

### View Database (Railway)
1. Open your project
2. Click PostgreSQL service
3. Click "Data" tab
4. Browse tables

### View Database (Render)
1. Use their web shell (Dashboard → Connect → Web Shell)
2. Or use external tool like pgAdmin/TablePlus:
   - Host: From Render dashboard
   - Port: Usually 5432
   - Database: remind
   - User: remind_user
   - Password: From Render dashboard

### Backup Database

**Railway:**
```bash
railway run pg_dump > backup.sql
```

**Render:**
Use Render's automatic backups (Starter plan)

Or manual:
```bash
pg_dump <DATABASE_URL> > backup.sql
```

---

## Troubleshooting

### "Database connection failed"
- Check DATABASE_URL is correct
- Ensure database is running
- Check network/firewall rules
- Verify SSL mode (add `?sslmode=require` to URL if needed)

### "Cannot find module 'pg'"
```bash
npm install
```

### "Port already in use"
Railway/Render handle ports automatically. Don't override PORT in code.

### "Verification codes not appearing"
Check deployment logs:
- Railway: Click service → "Logs"
- Render: Dashboard → "Logs"

### Backend sleeps (Render free tier)
- Upgrade to Starter plan ($7/month)
- Or use UptimeRobot to ping every 14 minutes

---

## Cost Comparison

| Platform | Free Tier | Paid Plan | PostgreSQL | Best For |
|----------|-----------|-----------|------------|----------|
| **Railway** | $5 credit | $5/month | ✅ Included | Production |
| **Render** | ✅ Yes* | $7/month | $7/month | Testing |
| **Replit** | ✅ Yes | $7/month | ❌ External | Quick test |
| **Heroku** | ❌ No | $5/month | $5/month | Enterprise |

*Render free tier sleeps after 15 min inactivity

---

## Production Checklist

Before going live:

- [ ] Change JWT_SECRET to secure random value
- [ ] Set NODE_ENV=production
- [ ] Use managed PostgreSQL (not local)
- [ ] Enable SSL for database connection
- [ ] Set up real email service (SendGrid/AWS SES)
- [ ] Configure custom domain
- [ ] Set up monitoring (UptimeRobot/Better Uptime)
- [ ] Enable automatic backups
- [ ] Set up error tracking (Sentry)
- [ ] Review database indexes
- [ ] Test with realistic data load

---

## Next Steps

1. ✅ Deploy backend to Railway or Render
2. ✅ Update frontend API_BASE_URL
3. ✅ Test full authentication flow
4. ✅ Monitor logs for errors
5. ✅ Set up email service when ready
6. ✅ Add custom domain

---

## Need Help?

Common issues and solutions in README.md

Happy deploying! 🚀
