# The Informatics Initiative - Full Stack Setup Guide

**Status:** 🚀 Ready for Render deployment (HTML/CSS/JS frontend + Node.js backend with Firebase Realtime DB)

## What's Included

✅ **Frontend** (`Tii/` folder)
- Static HTML/CSS/JS (no build step needed)
- Real-time OTP input via Firebase listener
- Auth system with registration, login, OTP verification, admin access
- Works as-is on Render Static Site or served by Node backend

✅ **Backend** (`server.js`)
- Node.js + Express (no Python)
- Firebase Realtime Database for persistent data (free tier)
- Nodemailer for email OTP delivery
- JWT authentication
- All endpoints: `/register`, `/login`, `/verify-otp`, `/admin_login`, etc.

✅ **Database**
- **Firebase Realtime Database** (free tier, 100 MB storage)
- Data persists indefinitely—survives server restarts
- Real-time listeners on frontend for instant OTP updates

✅ **Deployment**
- Render.com (free tier)
- Both static frontend + backend on one service
- Auto-deploy from GitHub

---

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ installed
- Git
- Firebase account (free)
- Gmail account (for OTP emails)

### 2. Clone / Setup Your Repo
```bash
cd c:\Users\DELL\OneDrive\Desktop\t
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/informatics-backend.git
git branch -M main
git push -u origin main
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Set Up Environment Variables

**Create `.env` file in root (DO NOT commit this)**:
```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-12345

EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@gmail.com

FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

**To get Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication
3. Generate an App Password for "Mail" and "Windows Computer"
4. Use that 16-character password as `EMAIL_PASS`

**To set up Firebase:**
1. Go to https://firebase.google.com → Create Project
2. Create Realtime Database (choose "Test mode" for free)
3. Go to Service Accounts → Generate new private key (JSON)
4. Copy entire JSON and paste into `.env` as `FIREBASE_SERVICE_ACCOUNT`
5. Copy Database URL from Firebase Console as `FIREBASE_DATABASE_URL`

### 5. Update Frontend Firebase Config

Edit `Tii/firebase-config.js` and replace:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456789"
};
```

Get these from Firebase Console → Project Settings.

### 6. Start Backend Locally
```bash
npm start
```
Server runs on `http://localhost:3000`

Test health endpoint:
```bash
curl http://localhost:3000/api/health
```

### 7. Test Frontend Locally

Open `Tii/index.html` in your browser OR serve via a simple HTTP server:
```bash
# Using Python 3
python -m http.server 8000

# Then navigate to http://localhost:8000/Tii/index.html
```

**Update API endpoint in `Tii/auth.js` for local testing:**
```javascript
const API_URL = 'http://localhost:3000';
```

### 8. Test Registration Flow
1. Go to `http://localhost:8000/Tii/register.html`
2. Register with an email
3. Check your email inbox for OTP
4. Enter OTP on verification page
5. If Firebase listener is working, OTP will auto-fill when received

---

## Deploy to Render (Production)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### Step 2: Create Render Service

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Fill in:
   - **Name:** `informatics-backend`
   - **Region:** `Oregon` (or closest to you)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

### Step 3: Add Environment Variables

In Render dashboard, go to Service → Environment:

```
NODE_ENV = production
JWT_SECRET = [generate random 32-char string]

EMAIL_SERVICE = gmail
EMAIL_USER = [your-email@gmail.com]
EMAIL_PASS = [your-16-char-app-password]
ADMIN_EMAIL = [admin@gmail.com]

FIREBASE_SERVICE_ACCOUNT = [paste entire JSON from Firebase]
FIREBASE_DATABASE_URL = https://your-project.firebaseio.com
```

⚠️ **Important:** Never commit `.env` file. Render will use dashboard env vars instead.

### Step 4: Update Frontend to Use Render URL

After Render deploys, it will give you a URL like `https://informatics-backend-abc123.onrender.com`

Update `Tii/auth.js`:
```javascript
const API_URL = 'https://informatics-backend-abc123.onrender.com';
```

And `Tii/firebase-config.js` with your Firebase config (same as before).

### Step 5: Update Frontend Hosting

Option A: Serve frontend from same Node backend (add static middleware to `server.js`)
Option B: Deploy frontend to Render Static Site separately
Option C: Use GitHub Pages or Netlify for frontend

For simplicity, **Option A** is recommended:

Update `server.js` (after CORS middleware):
```javascript
app.use(express.static(path.join(__dirname, 'Tii')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Tii', 'index.html')));
```

Then frontend is accessible at `https://informatics-backend-abc123.onrender.com`

### Step 6: Test on Render

1. Navigate to `https://your-service.onrender.com`
2. Test registration flow
3. Check logs in Render dashboard for errors

---

## File Structure

```
root/
├── server.js                    # Node.js backend (replaces Python)
├── package.json                 # Node dependencies
├── .env                         # Local env vars (DO NOT commit)
├── .env.example                 # Template for env vars
├── .gitignore                   # Exclude .env, node_modules
├── render.yaml                  # Render deployment config
├── README.md                    # This file
│
└── Tii/                         # Frontend (HTML/CSS/JS)
    ├── index.html
    ├── login.html
    ├── register.html
    ├── otp-verification.html
    ├── admin-login.html
    ├── styles.css
    ├── auth.js                  # Main auth logic
    ├── firebase-config.js       # Firebase real-time OTP
    ├── user-loader.js
    └── [other HTML/JS files]
```

---

## Architecture

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │ HTTP
         ▼
┌──────────────────────────┐
│  Frontend (HTML/CSS/JS)  │
│  - Registration form     │
│  - Real-time OTP input   │
│  - Auth UI               │
└────────┬─────────────────┘
         │
         │ HTTPS
         ▼
┌──────────────────────────┐
│  Node.js Backend         │
│  - Express server        │
│  - JWT auth              │
│  - Email (Nodemailer)    │
└────────┬─────────────────┘
         │
         │ HTTPS
         ▼
┌──────────────────────────┐
│  Firebase Realtime DB    │
│  - User data (persists)  │
│  - OTP codes             │
│  - Sessions              │
└──────────────────────────┘
```

---

## OTP Flow (Real-Time)

1. **Registration**: User enters email → Backend generates OTP → Sends via email
2. **Frontend Listener**: Firebase listener watches `/users/{email}/otp`
3. **Backend Update**: OTP stored in Firebase
4. **Real-Time Sync**: Frontend listener triggered → OTP auto-fills input (optional)
5. **Verify**: User submits → Backend checks Firebase → Issues JWT token

---

## Free Tier Limits (Render + Firebase)

| Service | Limit | Notes |
|---------|-------|-------|
| **Render** | 750 hours/month | Always free if one service running |
| **Render** | 100GB/month bandwidth | Generous for student app |
| **Firebase DB** | 100 MB storage | Enough for ~10k users with basic data |
| **Firebase DB** | 100 concurrent connections | Sufficient for small deployments |
| **Gmail** | Unlimited sends | Via Nodemailer (free) |

---

## Troubleshooting

### Issue: "Cannot find module 'firebase-admin'"
**Fix:** Run `npm install firebase-admin`

### Issue: OTP not received in email
- Check `EMAIL_USER` and `EMAIL_PASS` in `.env`
- Gmail: ensure App Password is used (not regular password)
- Check spam/junk folder
- Verify sender email matches `EMAIL_USER`

### Issue: Real-time OTP not auto-filling
- Check Firebase config in `Tii/firebase-config.js`
- Verify Database URL is correct
- Open browser DevTools → Console for errors
- Ensure database rules allow read/write (Realtime DB → Rules → Test mode)

### Issue: "Port is already in use"
```bash
# Windows PowerShell: Find process using port 3000
Get-Process | Where-Object { $_.Handles -like "*3000*" } | Stop-Process -Force
```

### Issue: Server crashes after 30s on Render
- Check logs in Render dashboard
- Ensure `server.js` doesn't crash on startup (Firebase connection optional)
- Verify `PORT` env var is read correctly

---

## Next Steps

1. ✅ Set up Firebase account (free tier)
2. ✅ Generate Gmail App Password
3. ✅ Test locally: `npm start`
4. ✅ Push to GitHub
5. ✅ Connect Render → GitHub
6. ✅ Add env vars in Render dashboard
7. ✅ Deploy and test
8. Optional: Add PostgreSQL (Render free tier includes one database)
9. Optional: Set up custom domain

---

## Support

- **Firebase Docs**: https://firebase.google.com/docs/database
- **Render Docs**: https://render.com/docs
- **Express.js**: https://expressjs.com
- **Nodemailer**: https://nodemailer.com/smtp/

---

**Happy deploying! 🚀**
