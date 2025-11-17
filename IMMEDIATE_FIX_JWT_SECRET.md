# IMMEDIATE FIX: Render JWT_SECRET Setup

## Problem
You're getting "Invalid token: invalid signature" because Render does **not have JWT_SECRET** set as an environment variable. Each time the server starts, it generates a new random temporary secret, so tokens signed on login don't match tokens verified on course add.

## Solution: Add JWT_SECRET to Render (5 minutes)

### Step 1: Go to Render Dashboard
- Open https://dashboard.render.com
- Click on **informatics-backend** service

### Step 2: Open Environment Tab
- Click **Settings** (or look for "Environment" option)
- Find the **Environment Variables** section

### Step 3: Add JWT_SECRET
- Click **Add Environment Variable**
- **Key:** `JWT_SECRET`
- **Value:** Copy from your local `.env` file: `tii-web-jwt-secret-key-2025-informatics-initiative`
  - Or use a new secure random string: `openssl rand -base64 32` (on macOS/Linux)
  - Or PowerShell: `[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))`

### Step 4: Save and Deploy
- Click **Save**
- Render auto-redeploys (watch the Logs tab)
- Wait 1-2 minutes for deployment to complete

### Step 5: Test
1. Go to login page: https://informatics-backend.onrender.com/Tii/admin-login.html
2. Log in as admin
3. Go to upload course: https://informatics-backend.onrender.com/Tii/upload-course.html
4. Add a course
5. Check server logs (should show success, not "invalid signature")

## Verify It Worked
- In Render Logs tab, you should see:
  ```
  [INFO] JWT_SECRET loaded: tii-web-jw...
  ```
- NOT: `[SECURITY] JWT_SECRET not set in environment`

---

## Why This Happens
- During development (local), your `.env` file provides `JWT_SECRET`
- On Render, `.env` files don't exist — you **must** set env vars in Render dashboard
- Without it, the server generates a random temp secret each restart, breaking token verification

## Check If Your Render JWT_SECRET Is Set
1. Go to Render dashboard
2. Click your service
3. Click **Settings** → **Environment**
4. Look for `JWT_SECRET` in the list

**If you see it, but it's still failing:** Render might not have redeployed yet. Wait 2+ minutes and refresh.

