# Render Deployment Setup Guide

## Environment Variables on Render

To ensure the application works correctly on Render (especially token authentication), you **must set `JWT_SECRET`** in your Render environment.

### Steps to Set JWT_SECRET on Render

1. **Log in to Render Dashboard**
   - Go to https://dashboard.render.com

2. **Select Your Service**
   - Click on your `informatics-backend` service

3. **Go to Environment**
   - Click the **"Environment"** tab on the left sidebar

4. **Add Environment Variable**
   - Click **"Add Environment Variable"**
   - **Key:** `JWT_SECRET`
   - **Value:** Generate a secure random string using one of these methods:

   **Option A: macOS/Linux**
   ```bash
   openssl rand -base64 32
   ```

   **Option B: Windows PowerShell**
   ```powershell
   [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
   ```

   **Option C: Online Generator**
   - Use an online generator like https://www.uuidgenerator.net/ or similar
   - Copy a 32+ character random string

   Example secure value:
   ```
   aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890
   ```

5. **Save and Deploy**
   - Click **"Save"** 
   - Render will automatically redeploy your service with the new variable

### Verify JWT_SECRET is Set

After deployment:
1. Go to **"Logs"** tab
2. Look for log entries containing `JWT_SECRET` (you should see it either loaded from env or see a warning if not set)
3. Try adding a course via admin panel — it should work now

### Optional: Firebase Setup

If you want to use Firebase instead of the file-backed database:

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Click "Create Project"
   - Name it and enable free tier

2. **Create Realtime Database**
   - In Firebase Console, go to "Realtime Database"
   - Click "Create Database" in test mode

3. **Generate Service Account Key**
   - Go to Settings ⚙️ → Service Accounts
   - Click "Generate New Private Key"
   - Copy the JSON content

4. **Add to Render Environment**
   - Add variable `FIREBASE_SERVICE_ACCOUNT` with the JSON content
   - Add variable `FIREBASE_DATABASE_URL` with your database URL (format: `https://YOUR-PROJECT.firebaseio.com`)

### File-Backed Database (Default if Firebase not configured)

If you don't set up Firebase, the app uses `persistent-db.json` in the project directory:
- ✅ **Pros:** Simple, no setup required, data persists between restarts
- ⚠️ **Cons:** Not suitable for concurrent requests or multi-instance deployments

For production with multiple instances, **use Firebase**.

---

### Troubleshooting

**"Invalid token" error when adding courses**
- JWT_SECRET is not set or is different between deployments
- Follow the steps above to set `JWT_SECRET` in Render Environment

**Changes not reflected after setting variable**
- Render auto-redeploys, but check the Logs tab to confirm deployment finished
- Give it 1-2 minutes and refresh the page

**"Unauthorized" error**
- Ensure you're logged in as an admin account (`role: 'admin'` in database)
- Check browser console (F12) for the token being sent
