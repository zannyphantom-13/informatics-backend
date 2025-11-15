# URGENT: Fix User Data Persistence on Render

## Why SQLite Doesn't Work
Render's ephemeral storage deletes ALL files on restart (including SQLite `data.db`). Only solution: **Firebase Realtime Database** (cloud-based, not local files).

## Quick 5-Minute Firebase Setup

### Step 1: Create Firebase Project (2 mins)
1. Go to: https://console.firebase.google.com/
2. Click **"Add project"**
3. Name: `informatics-backend`
4. Uncheck "Enable Google Analytics"
5. Click **"Create project"**
6. Wait for project creation

### Step 2: Enable Realtime Database (1 min)
1. In Firebase Console, left sidebar → **"Build"** → **"Realtime Database"**
2. Click **"Create Database"**
3. Location: `us-central1`
4. Rules: Select **"Start in test mode"** (for now)
5. Click **"Enable"**
6. **Copy the Database URL** (looks like: `https://project-name.firebaseio.com`)
   - Save this! You'll need it in 10 seconds

### Step 3: Get Service Account (1 min)
1. Top-left: Click **"⚙️ Project Settings"**
2. Go to **"Service Accounts"** tab
3. Click **"Generate New Private Key"**
4. A JSON file downloads - **KEEP IT SECRET**
5. Copy the entire JSON content (Ctrl+A then Ctrl+C in the file)

### Step 4: Add to Render (1 min)
1. Go to: https://dashboard.render.com/
2. Open your `informatics-backend` service
3. Click **"Environment"** tab
4. Add these 3 variables:

```
FIREBASE_SERVICE_ACCOUNT = <paste the entire JSON from Step 3>
FIREBASE_DATABASE_URL = <paste the URL from Step 2>
NODE_ENV = production
```

5. Click **"Save changes"**
6. Render will auto-redeploy

### Step 5: Verify It Works (30 seconds)
After redeploy, check logs. Should see:
```
✅ Firebase connected successfully
```

Then check: 
```
https://your-render-app.onrender.com/api/debug/persistence-status
```

Should show:
```json
{
  "usingFirebase": true,
  "message": "✅ Using Firebase - data persists across restarts"
}
```

## Test It
1. Register a test user on your Render app
2. Wait 2 minutes
3. Manually restart the Render service (in dashboard)
4. Try to login with same credentials
5. **They should work!** ✅

## CRITICAL: Security Rules
After testing, update Firebase Rules:

1. Firebase Console → **"Realtime Database"** → **"Rules"** tab
2. Replace with:
```json
{
  "rules": {
    "users": {
      ".indexOn": ["email"],
      "$uid": {
        ".read": "root.child('users').child($uid).child('email').val() === auth.token.email || $uid === auth.uid",
        ".write": "root.child('users').child($uid).child('email').val() === auth.token.email || $uid === auth.uid"
      }
    }
  }
}
```
3. Click **"Publish"**

## Troubleshooting

### Still Not Persisting?
- Check Render logs: Go to dashboard → service → logs
- Look for "Firebase connected" message
- If you see "Firebase not configured", variables weren't set correctly

### Can't Find Service Account JSON?
- Firebase Console → Project Settings → Service Accounts
- Click "Generate New Private Key" button again

### Database URL Not Found?
- Firebase Console → Realtime Database
- URL is at the top of the page, looks like: `https://xxxx-xxxxx.firebaseio.com`

## Support
If still having issues, reply with:
1. Screenshot of Render logs showing Firebase error
2. Confirmation that FIREBASE_SERVICE_ACCOUNT and FIREBASE_DATABASE_URL are set in Render dashboard
