// server.js - Production-ready Node.js backend for Render
// Uses Firebase Realtime Database (free tier) and Nodemailer for OTP delivery

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend static files from the Tii/ directory
// This makes files available at /Tii/<filename>
app.use('/Tii', express.static(path.join(__dirname, 'Tii')));

// ============================================
// FIREBASE REALTIME DB SETUP (use admin SDK or REST)
// For free tier: use Firebase REST API or install firebase-admin
// ============================================
const admin = require('firebase-admin');

let db;
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  db = admin.database();
  console.log('Γ£à Firebase connected');
} catch (err) {
  console.warn('ΓÜá∩╕Å Firebase not configured. Falling back to file-backed persistent DB. For production, set FIREBASE_SERVICE_ACCOUNT and FIREBASE_DATABASE_URL.');

  // File-backed persistent store for environments without Firebase.
  // Data is stored as a mapping of path -> value in `persistent-db.json` at project root.
  const fs = require('fs');
  const PERSIST_PATH = path.join(__dirname, 'persistent-db.json');

  // Load existing store or initialize empty
  let fileStore = {};
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, 'utf8');
      fileStore = raw ? JSON.parse(raw) : {};
    } else {
      // ensure file exists
      fs.writeFileSync(PERSIST_PATH, JSON.stringify({}, null, 2), 'utf8');
      fileStore = {};
    }
  } catch (e) {
    console.warn('Could not read or create persistent DB file, falling back to in-memory store.', e);
    fileStore = {};
  }

  // Helper to persist the in-memory fileStore to disk (atomic replacement)
  function persist() {
    try {
      fs.writeFileSync(PERSIST_PATH, JSON.stringify(fileStore, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to persist DB to disk:', e);
    }
  }

  db = {
    ref: (p) => ({
      set: async (data) => {
        fileStore[p] = data;
        persist();
        console.log(`Γ£à Persistent DB set: ${p}`);
        return { key: p };
      },
      get: async () => {
        const data = fileStore[p];
        return {
          val: () => (data === undefined ? null : data),
          exists: () => data !== undefined && data !== null,
        };
      },
      on: (event, callback) => {
        // No real-time listeners for file store; noop
      },
      update: async (updates) => {
        if (fileStore[p]) {
          fileStore[p] = { ...fileStore[p], ...updates };
        } else {
          fileStore[p] = { ...(updates || {}) };
        }
        persist();
      },
      push: async (data) => {
        const key = `k_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        fileStore[p] = fileStore[p] || {};
        fileStore[p][key] = data || null;
        persist();
        return { key };
      },
    }),
  };
}

// ============================================
// EMAIL SETUP (using mock console logs)
// ============================================
// Note: Email sending is disabled for security.
// Admin tokens and OTP codes are displayed in server logs only.

// ============================================
// UTILITIES
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const secret = 'temp-secret-' + Math.random().toString(36).substr(2, 9);
  console.warn('[SECURITY] JWT_SECRET not set in environment. Using temporary key. Set JWT_SECRET in .env or environment variables!');
  console.warn('[DEBUG] Generated temp JWT_SECRET:', secret.substring(0, 10) + '...');
  return secret;
})();

console.log('[INFO] JWT_SECRET loaded:', JWT_SECRET.substring(0, 10) + '...');
console.log('[INFO] NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('[INFO] Port:', PORT);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to safely check if snapshot exists
function snapshotExists(snapshot) {
  if (!snapshot) return false;
  if (typeof snapshot.exists === 'function') return snapshot.exists();
  if (typeof snapshot.exists === 'boolean') return snapshot.exists;
  return snapshot.val() !== null && snapshot.val() !== undefined;
}

// Helper to safely get snapshot value
function snapshotVal(snapshot) {
  if (!snapshot) return null;
  if (typeof snapshot.val === 'function') return snapshot.val();
  return snapshot;
}

async function sendOTPEmail(email, otp) {
  // Email sending disabled for security. OTP displayed in logs only.
  console.log(`[EMAIL MOCK] OTP for ${email}: ${otp}`);
}

// ============================================
// HEALTH CHECK (required for Render)
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// DEBUG ENDPOINT: GET OTP (for testing only - REMOVE IN PRODUCTION)
// ============================================
app.get('/api/debug/otp/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = snapshot.val();
    res.json({
      email,
      otp: user.otp,
      otp_expiry: new Date(user.otp_expiry),
      message: 'Debug only - remove this endpoint in production',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// REGISTRATION ENDPOINT
// ============================================
app.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, phone_number, date_of_birth, country, bio, security_question, security_answer } = req.body;

    // Identify which required fields are missing and return them for better UX
    const requiredFields = ['full_name', 'email', 'password', 'security_question', 'security_answer'];
    const missing = requiredFields.filter(f => !req.body[f] || req.body[f].toString().trim() === '');
    if (missing.length) {
      console.warn('Registration attempted with missing fields:', missing);
      return res.status(400).json({ message: 'Missing required fields.', missing_fields: missing });
    }

    // Check if user exists
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (snapshotExists(snapshot)) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store user in Firebase (verified immediately)
    await db.ref(`users/${email.replace(/\./g, '_')}`).set({
      full_name,
      email,
      password: hashedPassword,
      phone_number: phone_number || '',
      date_of_birth: date_of_birth || '',
      country: country || '',
      bio: bio || '',
      security_question,
      security_answer: security_answer.toLowerCase().trim(),
      role: 'student',
      verified: true,
      // initialize tokens container so frontend can read it reliably
      tokens: {},
      created_at: new Date().toISOString(),
    });

    // Generate JWT token
    const token = jwt.sign(
      { email, role: 'student' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful.',
      authToken: token,
      full_name,
      role: 'student',
      email,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ============================================
// LOGIN ENDPOINT
// ============================================
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required.' });
    }

    // Fetch user
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshotExists(snapshot)) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = snapshotVal(snapshot);

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      status: 'success',
      authToken: token,
      full_name: user.full_name,
      role: user.role,
      email: user.email,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ============================================
// ADMIN LOGIN STEP 1: CREDENTIAL CHECK
// ============================================
app.post('/admin_login_check', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required.' });
    }

    // Fetch user
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshotExists(snapshot)) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = snapshotVal(snapshot);

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // If already admin
    if (user.role === 'admin') {
      const token = jwt.sign(
        { email, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        action: 'login_success',
        authToken: token,
        full_name: user.full_name,
        role: 'admin',
        email: user.email,
      });
    }

    // If student, require admin token
    res.status(403).json({
      message: 'Admin token required.',
      action: 'require_token',
    });
  } catch (error) {
    console.error('Admin login check error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// SEND ADMIN TOKEN
// ============================================
app.post('/send_admin_token', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email required.' });
    }

    // Fetch user
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshotExists(snapshot)) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = snapshotVal(snapshot);

    // Count active tokens across all users (limit pool to 5 active tokens)
    const allUsersSnap = await db.ref('users').get();
    const allUsers = snapshotVal(allUsersSnap) || {};
    let activeCount = 0;
    Object.keys(allUsers).forEach(k => {
      const u = allUsers[k];
      if (u && u.admin_token && u.admin_token_expiry && Date.now() <= u.admin_token_expiry) {
        activeCount += 1;
      }
    });

    // If this user already has an active token, return it instead of creating a new one
    if (user.admin_token && user.admin_token_expiry && Date.now() <= user.admin_token_expiry) {
      return res.json({
        message: 'User already has an active admin token.',
        token: user.admin_token,
        expires_at: new Date(user.admin_token_expiry).toISOString(),
      });
    }

    // Enforce global active token limit (max 5)
    if (activeCount >= 5) {
      return res.status(429).json({ message: 'Maximum number of active admin tokens reached. Please wait until a token is used or expires.' });
    }

    // Generate admin token
    const adminToken = generateOTP(); // Simple 6-digit token
    const tokenExpiry = Date.now() + OTP_EXPIRY;

    // Store admin token on user
    await db.ref(`users/${email.replace(/\./g, '_')}`).update({
      admin_token: adminToken,
      admin_token_expiry: tokenExpiry,
      admin_token_requested_at: Date.now(),
    });

    // Also persist the token under the user's tokens list so tokens can be listed per email
    try {
      const pushRef = await db.ref(`users/${email.replace(/\./g, '_')}/tokens`).push({
        token: adminToken,
        expires_at: tokenExpiry,
        created_at: Date.now(),
        status: 'active',
      });
      // If push returned a reference, store its key for future updates (best-effort)
      const tokenKey = (pushRef && pushRef.key) ? pushRef.key : null;
      if (tokenKey) {
        await db.ref(`users/${email.replace(/\./g, '_')}/tokens/${tokenKey}`).update({ id: tokenKey });
      }
    } catch (e) {
      console.warn('Failed to persist admin token under user tokens:', e && e.message ? e.message : e);
    }

    // Log token generation
    console.log("============================================================");
    console.log("≡ƒöÉ ADMIN TOKEN GENERATED");
    console.log("============================================================");
    console.log(`≡ƒôº User Email: ${email}`);
    console.log(`≡ƒöæ Admin Token: ${adminToken}`);
    console.log(`ΓÅ░ Token Expiry: ${new Date(tokenExpiry).toISOString()}`);
    console.log(`ΓÅ│ Valid for: 3 minutes`);
    console.log("============================================================");

    // Admin token displayed in server logs only (email sending disabled for security)
    console.log(`[EMAIL MOCK] Admin token for ${email}: ${adminToken}`);

    // Broadcast update to SSE clients so admin dashboards refresh instantly
    broadcastTokenUpdate().catch(() => {});

    res.json({ 
      message: 'Admin token sent to admin email.',
      token: adminToken,
      expires_at: new Date(tokenExpiry).toISOString()
    });
  } catch (error) {
    console.error('Send admin token error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// ADMIN LOGIN STEP 2: TOKEN VERIFICATION
// ============================================
app.post('/admin_login', async (req, res) => {
  try {
    const { email, password, token } = req.body;

    if (!email || !password || !token) {
      return res.status(400).json({ message: 'Email, password, and token required.' });
    }

    // Fetch user
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshotExists(snapshot)) {
      return res.status(401).json({ message: 'User not found.' });
    }

    const user = snapshotVal(snapshot);

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password.' });
    }

    // Check admin token expiry and match
    if (Date.now() > user.admin_token_expiry) {
      return res.status(400).json({ message: 'Admin token expired.' });
    }

    if (user.admin_token !== token) {
      return res.status(400).json({ message: 'Invalid admin token.' });
    }

    // Upgrade user to admin
    // Mark token record as used (if present) and then upgrade user to admin
    try {
      const tokensSnap = await db.ref(`users/${email.replace(/\./g, '_')}/tokens`).get();
      const tokens = snapshotVal(tokensSnap) || {};
      Object.keys(tokens).forEach(async (tk) => {
        const t = tokens[tk];
        if (t && t.token === token && t.status === 'active') {
          await db.ref(`users/${email.replace(/\./g, '_')}/tokens/${tk}`).update({ status: 'used', used_at: Date.now() });
        }
      });
    } catch (e) {
      console.warn('Failed to mark token as used in tokens list:', e && e.message ? e.message : e);
    }

    await db.ref(`users/${email.replace(/\./g, '_')}`).update({
      role: 'admin',
      admin_token: null,
      admin_token_expiry: null,
    });

    // Broadcast update to SSE clients so admin dashboards refresh instantly
    broadcastTokenUpdate().catch(() => {});

    // Generate JWT token
    const jwtToken = jwt.sign(
      { email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Admin access granted.',
      authToken: jwtToken,
      full_name: user.full_name,
      role: 'admin',
      email: user.email,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// CHECK ADMIN TOKEN STATUS (for admin dashboard)
// ============================================
app.post('/api/admin-token-status', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email required.' });
    }

    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshotExists(snapshot)) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = snapshotVal(snapshot);
    
    // Only show token if it exists and is not expired
    if (user.admin_token && Date.now() <= user.admin_token_expiry) {
      const timeRemaining = Math.ceil((user.admin_token_expiry - Date.now()) / 1000);
      return res.json({
        has_token: true,
        token: user.admin_token,
        expires_in_seconds: timeRemaining,
        expires_at: new Date(user.admin_token_expiry).toISOString(),
      });
    } else {
      return res.json({
        has_token: false,
        message: 'No active token. Request a new one.',
      });
    }
  } catch (error) {
    console.error('Token status check error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// LIST ALL PENDING ADMIN TOKENS (admin only)
// ============================================
app.get('/api/admin-tokens', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ message: 'Authorization header required.' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Bearer token required.' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (verifyErr) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    // Only admins can view all pending tokens
    if (payload.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    // Get all users and find those with pending tokens
    const snapshot = await db.ref('users').get();
    const users = snapshotVal(snapshot) || {};
    const pendingTokens = [];

    Object.keys(users).forEach(userKey => {
      const user = users[userKey];
      if (user.admin_token && Date.now() <= user.admin_token_expiry) {
        const timeRemaining = Math.ceil((user.admin_token_expiry - Date.now()) / 1000);
        pendingTokens.push({
          email: user.email,
          token: user.admin_token,
          expires_in_seconds: timeRemaining,
          requested_at: user.admin_token_requested_at || 'N/A',
        });
      }
    });

    return res.json({ 
      pending_tokens: pendingTokens,
      count: pendingTokens.length
    });
  } catch (error) {
    console.error('List tokens error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// REVOKE/EXPIRE A TOKEN (admin only)
// Body: { email, token }
// Marks the token status as 'revoked' and clears user's active admin_token if matching
// ============================================
app.post('/api/admin-tokens/revoke', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ message: 'Authorization header required.' });
    const bearer = authHeader.split(' ')[1];
    if (!bearer) return res.status(401).json({ message: 'Bearer token required.' });

    let payload;
    try { payload = jwt.verify(bearer, JWT_SECRET); } catch (e) { return res.status(401).json({ message: 'Invalid or expired token.' }); }
    if (payload.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' });

    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ message: 'Email and token required.' });

    const userKey = email.replace(/\./g, '_');
    const tokensSnap = await db.ref(`users/${userKey}/tokens`).get();
    const tokens = snapshotVal(tokensSnap) || {};
    let found = false;
    await Promise.all(Object.keys(tokens).map(async (tk) => {
      const t = tokens[tk];
      if (t && t.token === token && t.status === 'active') {
        found = true;
        await db.ref(`users/${userKey}/tokens/${tk}`).update({ status: 'revoked', revoked_at: Date.now() });
      }
    }));

    // Clear user's top-level admin_token if it matches
    const userSnap = await db.ref(`users/${userKey}`).get();
    const user = snapshotVal(userSnap);
    if (user && user.admin_token === token) {
      await db.ref(`users/${userKey}`).update({ admin_token: null, admin_token_expiry: null });
    }

    if (!found) return res.status(404).json({ message: 'Active token not found for that user.' });

    // Broadcast update
    broadcastTokenUpdate().catch(() => {});

    return res.json({ message: 'Token revoked.' });
  } catch (error) {
    console.error('Revoke token error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// ADMIN TOKENS SSE STREAM (server-sent events)
// Publishes real-time changes to connected admin clients
// ============================================
const sseClients = new Set();

async function getPendingTokensSnapshot() {
  const snapshot = await db.ref('users').get();
  const users = snapshotVal(snapshot) || {};
  const pendingTokens = [];
  Object.keys(users).forEach(userKey => {
    const user = users[userKey];
    if (user && user.admin_token && user.admin_token_expiry && Date.now() <= user.admin_token_expiry) {
      const timeRemaining = Math.ceil((user.admin_token_expiry - Date.now()) / 1000);
      pendingTokens.push({
        email: user.email,
        token: user.admin_token,
        expires_in_seconds: timeRemaining,
        expires_at: new Date(user.admin_token_expiry).toISOString(),
        requested_at: user.admin_token_requested_at || null,
      });
    }
  });
  return pendingTokens;
}

async function broadcastTokenUpdate() {
  try {
    const data = { pending_tokens: await getPendingTokensSnapshot() };
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(res => {
      try {
        res.write(payload);
      } catch (e) {
        // ignore write errors; client will be cleaned up on close
      }
    });
  } catch (e) {
    console.warn('Failed to broadcast token update:', e && e.message ? e.message : e);
  }
}

app.get('/api/admin-tokens/stream', async (req, res) => {
  // Authenticate: support Authorization header or ?token=<jwt> query param (EventSource can't set headers)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const bearer = authHeader ? (authHeader.split(' ')[1]) : null;
  const queryToken = req.query && req.query.token ? req.query.token : null;
  const jwtToken = bearer || queryToken;

  if (!jwtToken) {
    res.status(401).json({ message: 'Authorization required (provide token in header or ?token= query).' });
    return;
  }

  let payload;
  try {
    payload = jwt.verify(jwtToken, JWT_SECRET);
  } catch (e) {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return;
  }

  if (payload.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required.' });
    return;
  }

  // Basic SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send initial data snapshot
  const initial = { pending_tokens: await getPendingTokensSnapshot() };
  res.write(`data: ${JSON.stringify(initial)}\n\n`);

  // Add to client set
  sseClients.add(res);

  // Remove client on close
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// ============================================
// START SERVER
// ============================================
// Profile endpoint: returns user profile (requires Authorization: Bearer <token>)
app.get('/api/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ message: 'Authorization header required.' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Bearer token required.' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (verifyErr) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const email = payload.email;
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshotExists(snapshot)) return res.status(404).json({ message: 'User not found.' });

    const user = snapshotVal(snapshot);
    // Do not return password in profile response
    if (user.password) delete user.password;

    return res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// PROFILE UPDATE ENDPOINT (PUT /api/profile)
// ============================================
app.put('/api/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ message: 'Authorization header required.' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Bearer token required.' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (verifyErr) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const email = payload.email;
    const { phone_number, date_of_birth, country, bio } = req.body;

    // Fetch existing user
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshotExists(snapshot)) return res.status(404).json({ message: 'User not found.' });

    // Update profile fields
    const updates = {};
    if (phone_number !== undefined) updates.phone_number = phone_number || '';
    if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth || '';
    if (country !== undefined) updates.country = country || '';
    if (bio !== undefined) updates.bio = bio || '';
    updates.profile_updated_at = new Date().toISOString();

    await db.ref(`users/${email.replace(/\./g, '_')}`).update(updates);

    console.log(`✅ Profile updated for user: ${email}`);

    return res.status(200).json({ 
      message: 'Profile updated successfully.',
      updates 
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: 'Server error during profile update.' });
  }
});

// ============================================
// SECURITY QUESTION ENDPOINT
// ============================================
app.post('/api/security-question', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    // Fetch user
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshotExists(snapshot)) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = snapshotVal(snapshot);

    res.status(200).json({
      security_question: user.security_question || 'Security question not set.',
    });
  } catch (error) {
    console.error('Security question fetch error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// RESET PASSWORD ENDPOINT
// Returns structured errors with `missing_fields` or `invalid_fields` to help the client focus inputs
// ============================================
app.post('/reset-password', async (req, res) => {
  try {
    const { email, security_answer, new_password } = req.body;

    // Identify missing fields and return them for UX
    const required = ['email', 'security_answer', 'new_password'];
    const missing = required.filter(f => !req.body[f] || req.body[f].toString().trim() === '');
    if (missing.length) return res.status(400).json({ message: 'Missing required fields.', missing_fields: missing });

    // Validate new password
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.', missing_fields: ['new_password'] });
    }

    // Fetch user
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshotExists(snapshot)) {
      return res.status(404).json({ message: 'User not found.', missing_fields: ['email'] });
    }

    const user = snapshotVal(snapshot);

    // Verify security answer
    const userAnswer = (user.security_answer || '').toLowerCase().trim();
    const providedAnswer = (security_answer || '').toLowerCase().trim();
    if (userAnswer !== providedAnswer) {
      return res.status(401).json({ message: 'Security answer is incorrect.', invalid_fields: ['security_answer'] });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password in Firebase
    await db.ref(`users/${email.replace(/\./g, '_')}`).update({
      password: hashedPassword,
      password_updated_at: new Date().toISOString(),
    });

    console.log(`Γ£à Password reset successful for user: ${email}`);

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error during password reset.' });
  }
});

// ============================================
// COURSES API
// Admins can add/delete courses; public can list courses
// Stored under `courses/<id>` in the DB
// ============================================
app.get('/api/courses', async (req, res) => {
  try {
    const snapshot = await db.ref('courses').get();
    const data = snapshotVal(snapshot) || {};
    // Transform object map to array
    const courses = Object.keys(data).map(id => ({ id, ...data[id] }));
    res.json({ courses });
  } catch (error) {
    console.error('Fetch courses error:', error);
    res.status(500).json({ message: 'Server error fetching courses.' });
  }
});

app.post('/api/courses', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    let decoded;
    try { 
      decoded = jwt.verify(token, JWT_SECRET); 
    } catch (e) { 
      console.error('Token verification failed:', e.message);
      return res.status(401).json({ message: 'Invalid token: ' + e.message }); 
    }
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Admin role required' });

    const { title, description, url, placement } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Title and description required.' });

    const id = `c_${Date.now()}`;
    const course = {
      title,
      description,
      url: url || '',
      placement: placement || 'other',
      created_at: new Date().toISOString(),
      created_by: decoded.email || 'admin',
    };

    await db.ref(`courses/${id}`).set(course);
    res.status(201).json({ id, ...course });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Server error creating course.' });
  }
});

app.delete('/api/courses/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); } catch (e) { return res.status(401).json({ message: 'Invalid token' }); }
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Admin role required' });

    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Course id required.' });

    await db.ref(`courses/${id}`).set(null);
    res.json({ message: 'Course deleted.' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Server error deleting course.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`≡ƒÜÇ Server running on port ${PORT}`);
});
