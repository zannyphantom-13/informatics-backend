// server.js - Production-ready Node.js backend for Render
// Uses Firebase Realtime Database (free tier) and Nodemailer for OTP delivery

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sgMail = require('@sendgrid/mail');
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
  console.log('✅ Firebase connected');
} catch (err) {
  console.warn('⚠️ Firebase not configured. Using mock DB. For production, set FIREBASE_SERVICE_ACCOUNT and FIREBASE_DATABASE_URL.');
  // Fallback mock DB (in-memory; data will be lost on restart)
  // For real persistence, configure Firebase
  db = {
    ref: (path) => ({
      set: async (data) => { console.log(`Mock DB set: ${path}`, data); },
      get: async () => ({ val: () => null }),
      on: (event, callback) => { },
    }),
  };
}

// ============================================
// SENDGRID EMAIL SETUP (works on Render!)
// ============================================
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured and ready to send emails');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not set. Emails will not be sent. Add it to Render Environment.');
}

// ============================================
// UTILITIES
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp) {
  try {
    const msg = {
      to: email,
      from: process.env.EMAIL_USER || 'noreply@informatics-initiative.com',
      subject: '🔐 Your One-Time Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #2a6e62; text-align: center;">The Informatics Initiative</h2>
            <p style="color: #333; font-size: 16px;">Your verification code is:</p>
            <div style="background: #f0f0f0; border-left: 4px solid #2a6e62; padding: 15px; text-align: center;">
              <h1 style="color: #2a6e62; font-size: 36px; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 15px;">
              This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>
      `,
    };

    if (process.env.SENDGRID_API_KEY) {
      await sgMail.send(msg);
      console.log(`✅ OTP email sent via SendGrid to ${email}`);
    } else {
      console.warn(`⚠️ SENDGRID_API_KEY not configured. OTP stored but email not sent.`);
    }
  } catch (emailError) {
    console.warn(`⚠️ Email sending failed for ${email}:`, emailError.message);
    console.warn('OTP is still valid in the system. User can proceed.');
  }
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
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    // Check if user exists
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (snapshot.exists()) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store user in Firebase (verified immediately)
    await db.ref(`users/${email.replace(/\./g, '_')}`).set({
      full_name,
      email,
      password: hashedPassword,
      role: 'student',
      verified: true,
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
    if (!snapshot.exists()) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = snapshot.val();

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
    if (!snapshot.exists()) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = snapshot.val();

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
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Generate admin token
    const adminToken = generateOTP(); // Simple 6-digit token
    const tokenExpiry = Date.now() + OTP_EXPIRY;

    // Store admin token
    await db.ref(`users/${email.replace(/\./g, '_')}`).update({
      admin_token: adminToken,
      admin_token_expiry: tokenExpiry,
    });

    // Log token generation
    console.log("============================================================");
    console.log("🔐 ADMIN TOKEN GENERATED");
    console.log("============================================================");
    console.log(`📧 User Email: ${email}`);
    console.log(`🔑 Admin Token: ${adminToken}`);
    console.log(`⏰ Token Expiry: ${new Date(tokenExpiry).toISOString()}`);
    console.log(`⏳ Valid for: 10 minutes`);
    console.log("============================================================");

    // Send token via SendGrid email
    const msg = {
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@informatics-initiative.com',
      from: process.env.EMAIL_USER || 'noreply@informatics-initiative.com',
      subject: `🔐 Admin Access Request from ${email}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #2a6e62; text-align: center;">The Informatics Initiative</h2>
            <p style="color: #333; font-size: 16px;">Admin Access Request</p>
            <p style="color: #666;">A user is attempting to access the Admin Portal:</p>
            <p><strong>User Email:</strong> ${email}</p>
            <div style="background: #f0f0f0; border-left: 4px solid #2a6e62; padding: 15px; text-align: center; margin: 20px 0;">
              <p style="margin: 0; color: #666;">Your Admin Token:</p>
              <h1 style="color: #2a6e62; font-size: 36px; letter-spacing: 5px; margin: 10px 0;">${adminToken}</h1>
            </div>
            <p style="color: #666; font-size: 14px;">
              This token expires in <strong>10 minutes</strong>. Do not share this token with anyone.
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              If you didn't initiate this request, please ignore this email.
            </p>
          </div>
        </div>
      `,
    };

    if (process.env.SENDGRID_API_KEY) {
      await sgMail.send(msg);
      console.log(`✅ Admin token email sent to: ${msg.to}`);
    } else {
      console.warn(`⚠️ SENDGRID_API_KEY not configured. Token not emailed. Token: ${adminToken}`);
    }

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
    if (!snapshot.exists()) {
      return res.status(401).json({ message: 'User not found.' });
    }

    const user = snapshot.val();

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
    await db.ref(`users/${email.replace(/\./g, '_')}`).update({
      role: 'admin',
      admin_token: null,
      admin_token_expiry: null,
    });

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
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
