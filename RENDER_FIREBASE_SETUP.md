# Firebase Setup for Render - CRITICAL FOR DATA PERSISTENCE

## Problem
User login credentials are NOT persisting on Render because the app is using file-based storage (`database.json`), which uses ephemeral storage. Files created during runtime are deleted when the container restarts.

## Solution
Configure Firebase Realtime Database and set the environment variables on Render.

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `informatics-backend` (or similar)
4. Continue through the setup
5. Enable Realtime Database

### Step 2: Get Firebase Service Account
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Go to **Service Accounts** tab
3. Click **Generate New Private Key**
4. A JSON file will download - **keep this safe**
5. Copy the entire JSON content

### Step 3: Get Database URL
1. In Firebase Console, go to **Realtime Database**
2. Copy the database URL (looks like: `https://project-name.firebaseio.com`)

### Step 4: Set Environment Variables on Render
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Open your `informatics-backend` service
3. Go to **Environment** tab
4. Add these variables:

```
FIREBASE_SERVICE_ACCOUNT = <paste the entire JSON from Step 2>
FIREBASE_DATABASE_URL = <paste the URL from Step 3>
JWT_SECRET = <any random string, e.g., "your-super-secret-key-12345">
NODE_ENV = production
```

5. Click "Save changes"
6. Service will redeploy automatically

### Step 5: Test
After redeploy:
1. Check Render logs - should see "✅ Firebase connected successfully"
2. Register a test user
3. Restart the service - user data should still exist

## Verification
- Check Render service logs for: `✅ Firebase connected successfully`
- Visit: `https://your-render-app.onrender.com/api/debug/persistence-status`
- Should show: `"usingFirebase": true`

## If Firebase Setup is Taking Too Long
As a temporary workaround, I've added SQLite support - see RENDER_SQLITE_SETUP.md
