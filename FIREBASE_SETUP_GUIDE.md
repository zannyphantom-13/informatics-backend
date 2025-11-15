# Firebase Setup Guide for Render Deployment

## Problem
User credentials are NOT persisting on Render because the app is currently using file-based persistence (`database.json`), which doesn't work on Render's ephemeral storage. Every time Render restarts your app, the data is lost.

## Solution
Configure Firebase Realtime Database on Render so data persists in the cloud.

## Step-by-Step Setup

### 1. Create a Firebase Project
1. Go to [https://firebase.google.com/](https://firebase.google.com/)
2. Sign in with your Google account
3. Click "Go to console"
4. Click "Add project"
5. Enter project name: `informatics-backend`
6. Choose your country and accept terms
7. Click "Create project"
8. Wait for project to be ready, then click "Continue"

### 2. Create a Realtime Database
1. In the left menu, click "Realtime Database"
2. Click "Create Database"
3. Choose your location (pick closest to your users)
4. **Important**: Start in "Test mode" (NOT production) so anyone can read/write for testing
   - Later, update security rules for production
5. Click "Enable"
6. Copy the database URL (format: `https://your-project.firebaseio.com`)
   - **Save this for step 5 below**

### 3. Create a Service Account
1. In the left menu, go to "Project settings" (⚙️ icon, bottom-left)
2. Click the "Service accounts" tab
3. Click "Generate a new private key"
4. **Important**: Downl it will download a JSON file
   - **DO NOT commit this file to GitHub** - it contains secrets
   - This file is your `FIREBASE_SERVICE_ACCOUNT`

### 4. Add to Render Environment Variables
1. Go to your Render deployment dashboard
2. Go to "Environment" → "Environment Variables"
3. Add two new variables:

**Variable 1:**
- Key: `FIREBASE_DATABASE_URL`
- Value: `https://your-project.firebaseio.com` (from step 2)

**Variable 2:**
- Key: `FIREBASE_SERVICE_ACCOUNT`
- Value: Copy the entire contents of the JSON file you downloaded in step 3 (it's a large multi-line JSON object)

4. Click "Save"
5. Your app will automatically redeploy with these new variables

### 5. Test It Works
1. After Render redeploys, go to your app URL
2. Register a new test user
3. Go to your Firebase console → Realtime Database
4. You should see a `users` node with your test user data
5. Restart your Render app (or wait for inactivity timeout)
6. Try to log in with the same user
7. **✅ If login works, credentials persisted!**

## Verification Endpoint
You can check the app's persistence status at:
```
https://your-render-url/api/debug/persistence-status
```

This will show:
- `usingFirebase: true` (if Firebase is properly configured)
- `usingFileBased: false` (if Firebase is active)
- `message: ✅ Using Firebase - data persists across restarts`

## Security Rules (After Testing)
Once you confirm everything works, update your Firebase security rules to be more restrictive:

1. Go to Firebase Console → Realtime Database → Rules
2. Replace with:
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

This restricts read/write access to each user's own data.

## Troubleshooting

### "Illegal arguments: string, undefined" error during login
This means a user record exists but is missing the password field. Make sure you have the fix for this (commit `b687bed`).

### "Firebase not configured" warning
The `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_DATABASE_URL` env vars are not set on Render. Check step 4 above.

### Data still disappearing on restart
1. Verify Firebase is showing as `usingFirebase: true` at `/api/debug/persistence-status`
2. Check Render logs to confirm no errors during startup
3. Verify the database URL is correct (no typos)

