// server.js - Production-ready Node.js backend for Render
// Uses Firebase Realtime Database (free tier) and Nodemailer for OTP delivery

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
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
// NODEMAILER SETUP
// ============================================
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use app password for Gmail
  },
});

// ============================================
// UTILITIES
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
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

  return transporter.sendMail(mailOptions);
}

// ============================================
// HEALTH CHECK (required for Render)
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + OTP_EXPIRY;

    // Store user with OTP in Firebase
    await db.ref(`users/${email.replace(/\./g, '_')}`).set({
      full_name,
      email,
      password: hashedPassword,
      role: 'student',
      verified: false,
      otp,
      otp_expiry: otpExpiry,
      created_at: new Date().toISOString(),
    });

    // Send OTP via email
    await sendOTPEmail(email, otp);

    res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      email,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ============================================
// OTP VERIFICATION ENDPOINT
// ============================================
app.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp_code } = req.body;

    if (!email || !otp_code) {
      return res.status(400).json({ message: 'Email and OTP required.' });
    }

    // Fetch user from Firebase
    const snapshot = await db.ref(`users/${email.replace(/\./g, '_')}`).get();
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = snapshot.val();

    // Check OTP expiry
    if (Date.now() > user.otp_expiry) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP
    if (user.otp !== otp_code) {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    // Mark user as verified
    await db.ref(`users/${email.replace(/\./g, '_')}`).update({
      verified: true,
      otp: null,
      otp_expiry: null,
    });

    // Generate JWT token
    const token = jwt.sign(
      { email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Email verified successfully.',
      authToken: token,
      full_name: user.full_name,
      role: user.role,
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error during verification.' });
  }
});

// ============================================
// RESEND OTP ENDPOINT
// ============================================
app.post('/resend-otp', async (req, res) => {
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

    const user = snapshot.val();

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + OTP_EXPIRY;

    // Update user with new OTP
    await db.ref(`users/${email.replace(/\./g, '_')}`).update({
      otp,
      otp_expiry: otpExpiry,
    });

    // Send new OTP
    await sendOTPEmail(email, otp);

    res.json({ message: 'New OTP sent to your email.' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error while resending OTP.' });
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

    // Check if verified
    if (!user.verified) {
      // Generate OTP for verification
      const otp = generateOTP();
      const otpExpiry = Date.now() + OTP_EXPIRY;

      await db.ref(`users/${email.replace(/\./g, '_')}`).update({
        otp,
        otp_expiry: otpExpiry,
      });

      await sendOTPEmail(email, otp);

      return res.status(403).json({
        message: 'Please verify your email first.',
        action: 'redirect_to_otp',
      });
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

    // Send token via email (send to admin email from env)
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: `Admin Access Request from ${email}`,
      html: `<p>Admin token: <strong>${adminToken}</strong></p><p>User: ${email}</p>`,
    });

    res.json({ message: 'Admin token sent to admin email.' });
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
