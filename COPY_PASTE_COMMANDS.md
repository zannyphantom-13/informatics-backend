# 🔧 Copy-Paste Commands for Each Step

## Overview

```
DON'T READ DOCUMENTATION - JUST COPY & PASTE COMMANDS BELOW!

Each section has exact commands for that step.
```

---

## ⚠️ IMPORTANT SETUP FIRST

### Get Discord/Email Notification Ready
**Why?** Firebase and Gmail need verification links. You'll need email open.

---

## STEP 1: Create .env File

### Command (Windows PowerShell)
```powershell
cd c:\Users\DELL\OneDrive\Desktop\t
Copy-Item .env.example .env
notepad .env
```

**Then in Notepad:**
- Find and replace `YOUR_API_KEY` → your actual values (from steps 2-3)
- Fill in all 8 variables
- Save: `Ctrl+S`
- Close: `Alt+F4`

---

## STEP 2: Firebase Setup

### Command: Download gcloud CLI (Optional - Firebase Console is easier)

**Go to: https://firebase.google.com**

Then follow these steps (can't use CLI without setup):

1. **Create Project**
   - Click "Get Started" or "Go to Console"
   - Click "Create a project"
   - Name: `informatics-initiative`
   - Click "Create"

2. **Create Realtime Database**
   - Left sidebar → "Build" → "Realtime Database"
   - Click "Create Database"
   - Location: `us-central1`
   - Rules: `Start in test mode`
   - Click "Enable"

3. **Copy Database URL**
   - Go to Realtime Database tab
   - Look at top - copy URL like: `https://informatics-abc123.firebaseio.com`
   - Save it

4. **Get Service Account JSON**
   - Click ⚙️ (Settings)
   - Click "Project Settings"
   - Go to "Service Accounts" tab
   - Click "Generate New Private Key"
   - File downloads automatically
   - Open with Notepad
   - Select all: `Ctrl+A`
   - Copy: `Ctrl+C`

---

## STEP 3: Gmail App Password

### Go to: https://myaccount.google.com

**Commands not needed - this is web-based:**

1. Go to https://myaccount.google.com/security
2. Look for "2-Step Verification"
3. If OFF: Click it and enable
4. Scroll down to "App passwords"
5. Dropdowns:
   - First: "Mail"
   - Second: "Windows Computer"
6. Click "Generate"
7. Copy the 16-character password
8. Save it

---

## STEP 4: Fill .env File

### Open and Fill File

```powershell
cd c:\Users\DELL\OneDrive\Desktop\t
notepad .env
```

**Fill these exactly** (copy-paste from steps 2-3):

```
PORT=3000
NODE_ENV=development
JWT_SECRET=abcdef1234567890abcdef1234567890
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=xxxx-xxxx-xxxx-xxxx
ADMIN_EMAIL=your-email@gmail.com
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...entire JSON..."}
FIREBASE_DATABASE_URL=https://informatics-abc123.firebaseio.com
```

**Save:** `Ctrl+S` then close

---

## STEP 5: Update Firebase Config in Frontend

### Open File and Replace

```powershell
# Open file in Notepad
notepad c:\Users\DELL\OneDrive\Desktop\t\Tii\firebase-config.js
```

**Find this section (around line 8-17):**
```javascript
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
```

**Replace with your actual Firebase config:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD1234567890abcdef",
  authDomain: "informatics-abc123.firebaseapp.com",
  databaseURL: "https://informatics-abc123.firebaseio.com",
  projectId: "informatics-abc123",
  storageBucket: "informatics-abc123.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

**Save:** `Ctrl+S` then close

---

## STEP 6: Test Locally

### Commands (PowerShell)

```powershell
# Navigate to project
cd c:\Users\DELL\OneDrive\Desktop\t

# Start server
npm start
```

**You should see:**
```
🚀 Server running on port 3000
✅ Firebase connected
```

**In NEW PowerShell window, test:**
```powershell
curl http://localhost:3000/api/health
```

**Expected output:**
```json
{"status":"ok","timestamp":"2025-11-12T..."}
```

**To stop server:**
- Press `Ctrl+C` in the terminal running npm start

---

## STEP 7: Push to GitHub

### Create Repository on GitHub

Go to: https://github.com/new

**Fill form:**
- Repository name: `informatics-backend`
- Description: `Informatics Initiative - Auth System`
- Visibility: Private (recommended) or Public
- Do NOT check "Initialize with README"
- Click "Create repository"

### Copy GitHub Repository

**GitHub will show you commands. Copy them exactly:**

```powershell
cd c:\Users\DELL\OneDrive\Desktop\t

git init

git add .

git commit -m "Initial commit - Informatics Initiative with Firebase"

git remote add origin https://github.com/YOUR_USERNAME/informatics-backend.git

git branch -M main

git push -u origin main
```

**When asked for credentials:**
- Username: Your GitHub username
- Password: Use a GitHub personal access token (not your password)

**To get GitHub token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token"
3. Select "Generate new token (classic)"
4. Give it "repo" scope
5. Click "Generate token"
6. Copy and paste when asked for password

---

## STEP 8: Deploy to Render

### Go to Render Dashboard

Go to: https://dashboard.render.com

**Create New Service:**
1. Click "New +" button
2. Select "Web Service"
3. Click "Connect account" (if first time)
4. Authorize GitHub access

**Select Repository:**
- Click your `informatics-backend` repo
- Branch: `main`

**Configure Service:**

```
Name:              informatics-backend
Environment:       Node
Region:            Oregon
Build Command:     npm install
Start Command:     npm start
Plan:              Free
```

### Add Environment Variables

**In Render dashboard → Environment section:**

**Copy each line exactly as-is:**

```
NODE_ENV=production
JWT_SECRET=abcdef1234567890abcdef1234567890
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=xxxx-xxxx-xxxx-xxxx
ADMIN_EMAIL=your-email@gmail.com
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_DATABASE_URL=https://informatics-abc123.firebaseio.com
```

**Click "Create Web Service"**

**Wait 2-3 minutes for build to complete** ⏳

**When done, you get URL like:**
```
https://informatics-backend-abc123.onrender.com
```

**SAVE THIS URL**

---

## STEP 9: Update Frontend API URL

### Edit auth.js

```powershell
notepad c:\Users\DELL\OneDrive\Desktop\t\Tii\auth.js
```

**Find line 3 that says:**
```javascript
const API_URL = process.env.API_URL || 'http://localhost:3000';
```

**Replace with:**
```javascript
const API_URL = 'https://informatics-backend-abc123.onrender.com';
```

*(Replace `abc123` with your actual Render service ID)*

**Save:** `Ctrl+S` then close

### Push Changes

```powershell
cd c:\Users\DELL\OneDrive\Desktop\t

git add Tii/auth.js

git commit -m "Update API URL to Render service"

git push
```

**Wait 2-3 minutes for Render auto-build** ⏳

---

## STEP 10: Final Verification

### Test Registration

**Open browser and go to:**
```
https://informatics-backend-abc123.onrender.com/Tii/register.html
```

*(Replace `abc123` with your Render service ID)*

**Test form:**
1. Full Name: `Test User`
2. Email: `your-email@gmail.com`
3. Password: `Test123!`
4. Confirm Password: `Test123!`
5. Check "I agree to terms"
6. Click "Register"

**Check your email:**
- Look for email with OTP code
- Copy the 6-digit code

**Enter OTP:**
1. Paste 6-digit code
2. Click "Verify Account"
3. Should redirect to portal ✅

**Test Login:**
1. Go to: `https://informatics-backend-abc123.onrender.com/Tii/login.html`
2. Email: `your-email@gmail.com`
3. Password: `Test123!`
4. Click "Login to Portal"
5. Should redirect to student portal ✅

**If all works: 🎉 YOU'RE LIVE!**

---

## 🆘 Troubleshooting Commands

### Check if .env exists and has content
```powershell
cd c:\Users\DELL\OneDrive\Desktop\t
Get-Content .env
```

### Check if .env is in .gitignore (it should be)
```powershell
Get-Content .gitignore
```

### Check if files are in git (should NOT show .env)
```powershell
git ls-files
```

### Check Render logs (if something breaks)
- Go to https://dashboard.render.com
- Click your service
- Click "Logs" tab
- Look for error messages

### Re-test locally
```powershell
cd c:\Users\DELL\OneDrive\Desktop\t
npm start
```

### Check node is installed
```powershell
node --version
npm --version
```

### Force reinstall dependencies
```powershell
rm -r node_modules
npm install
```

---

## 📋 Copy-Paste Checklist

```
STEP 1: ✅ .env file created with 8 variables filled
STEP 2: ✅ Firebase project created + URL copied
STEP 3: ✅ Gmail app password generated (16 chars)
STEP 4: ✅ .env file has all values
STEP 5: ✅ Tii/firebase-config.js updated
STEP 6: ✅ Local test passed (npm start works)
STEP 7: ✅ Code pushed to GitHub
STEP 8: ✅ Service deployed to Render + env vars added
STEP 9: ✅ Tii/auth.js updated + pushed
STEP 10: ✅ Live registration test passed

RESULT: 🎉 YOUR APP IS LIVE!
```

---

## Final Summary

| Step | Command | Time |
|------|---------|------|
| 1 | `Copy-Item .env.example .env` | 5 min |
| 2 | Go to firebase.google.com | 5 min |
| 3 | Go to myaccount.google.com/security | 3 min |
| 4 | `notepad .env` (fill values) | 2 min |
| 5 | `notepad Tii/firebase-config.js` | 2 min |
| 6 | `npm start` + test | 5 min |
| 7 | `git push` | 3 min |
| 8 | Render dashboard deploy | 8 min |
| 9 | Update auth.js + `git push` | 4 min |
| 10 | Test live app | 5 min |
| **TOTAL** | **Copy & paste commands** | **~40 min** |

---

**You're ready! Follow the commands above step-by-step. 🚀**
