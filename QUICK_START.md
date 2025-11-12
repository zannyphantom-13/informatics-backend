# Quick Start Guide - 5 Minutes to Render Deployment

## 🚀 TL;DR Setup

### 1. Create `.env` file in root (copy from `.env.example`)
```
PORT=3000
NODE_ENV=production
JWT_SECRET=generate-random-string-here

EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=app-password-from-gmail
ADMIN_EMAIL=admin@gmail.com

FIREBASE_SERVICE_ACCOUNT=copy-entire-json-from-firebase
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

### 2. Get Gmail App Password
1. Go to https://myaccount.google.com/security
2. Enable 2FA
3. Generate "App Password" for Mail
4. Use that 16-char password as `EMAIL_PASS`

### 3. Get Firebase Config
1. Go to https://firebase.google.com → New Project
2. Create Realtime Database (Test Mode)
3. Project Settings → Service Accounts → Generate Private Key
4. Copy JSON → Paste into `.env` as `FIREBASE_SERVICE_ACCOUNT`
5. Copy Database URL from Realtime Database panel → `FIREBASE_DATABASE_URL`

### 4. Update Frontend Firebase Config
Edit `Tii/firebase-config.js`:
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
(Get these from Firebase Console → Project Settings)

### 5. Test Locally
```bash
npm install
npm start
# Open http://localhost:3000
```

### 6. Deploy to Render

**Step 1: Push to GitHub**
```bash
git add .
git commit -m "Ready for Render"
git push
```

**Step 2: On https://render.com**
- Click "New +" → "Web Service"
- Connect GitHub repo
- Name: `informatics-backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Plan: Free
- **Click "Create Web Service"**

**Step 3: Add Environment Variables**
In Render dashboard → Environment:
```
NODE_ENV = production
JWT_SECRET = (generate 32-char random string)
EMAIL_SERVICE = gmail
EMAIL_USER = (your gmail)
EMAIL_PASS = (16-char app password)
ADMIN_EMAIL = (admin gmail)
FIREBASE_SERVICE_ACCOUNT = (full JSON)
FIREBASE_DATABASE_URL = (Firebase URL)
```

**Step 4: Update Frontend URL**
After Render deploys, it gives you a URL like `https://informatics-abc123.onrender.com`

In `Tii/auth.js` line 3:
```javascript
const API_URL = 'https://informatics-abc123.onrender.com';
```

Push to GitHub:
```bash
git add Tii/auth.js
git commit -m "Update API URL to Render"
git push
```

**Step 5: Done!** ✅
Your app is now live on Render!

---

## 📁 What Each File Does

| File | Purpose |
|------|---------|
| `server.js` | Node backend (replaces Python). Handles auth, OTP, Firebase |
| `package.json` | Node dependencies + scripts |
| `.env` | **SECRET** - never commit. Contains API keys, Firebase config |
| `.env.example` | Template for `.env` (safe to commit) |
| `.gitignore` | Prevents committing `.env`, `node_modules/` |
| `render.yaml` | Tells Render how to deploy (optional, but recommended) |
| `Tii/auth.js` | Frontend authentication logic (calls backend API) |
| `Tii/firebase-config.js` | Frontend Firebase setup (real-time OTP) |
| `Tii/otp-verification.html` | Registration form + real-time OTP input |
| `README.md` | Full documentation |

---

## 🔑 Key Concepts

### Real-Time OTP Flow
1. User registers → Backend generates OTP → Sends via email
2. Backend stores OTP in Firebase
3. Frontend **listens** to Firebase for changes
4. When OTP arrives, frontend **auto-fills** the input (optional)
5. User clicks "Verify" → Backend checks → Issues JWT token

### Why This Architecture?
- **Static Frontend**: HTML/CSS/JS (fast, cacheable)
- **Node Backend**: Handles auth, emails, database
- **Firebase**: Persistent database (survives server restart) + real-time sync
- **Free Tier**: Render (750 hours), Firebase (100MB + 100 connections), Gmail (unlimited)

### Persistence
Data stored in Firebase Realtime DB **never goes away** — even if:
- Backend restarts
- Render service restarts
- You redeploy code
- Free tier auto-sleeps

---

## ⚡ Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "OTP not received" | Check Gmail app password (not regular password). Check spam folder |
| "Real-time OTP not filling" | Check Firebase config in `Tii/firebase-config.js`. Verify Database URL |
| "Cannot connect to backend" | Check `API_URL` in `Tii/auth.js` matches Render URL |
| "Port already in use" | Kill process: `lsof -i :3000` → `kill -9 <PID>` |
| "Firebase not working" | Ensure Realtime DB is in "Test Mode" (rules). Check service account JSON |

---

## 📞 Support

- **Firebase Issues**: https://firebase.google.com/docs/database/quickstart
- **Render Deployment**: https://render.com/docs/deploy-node-express
- **Gmail App Password**: https://support.google.com/accounts/answer/185833
- **Express.js**: https://expressjs.com/

---

**Need help?** Refer to the full `README.md` for detailed architecture, troubleshooting, and optional enhancements.
