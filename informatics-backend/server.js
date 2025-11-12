// --- 1. Import Dependencies ---
const express = require('express');
const bodyParser = require('body-parser'); 
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const nodemailer = require('nodemailer'); 
const cors = require('cors'); // <-- ADD THIS

// --- 2. Setup Express App ---
const app = express();
const PORT = 3000; 
const JWT_SECRET = 'your-super-secret-key'; // <--- CHANGE THIS FOR SECURITY

// --- 3. Middleware ---
app.use(cors()); // <-- ADD THIS
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- 4. Mock Database (RESETS ON SERVER RESTART) ---
let usersDB = [
    {
        username: 'admin',
        passwordHash: '$2a$10$f/..lE.sJ/tP.eS.9.N.C.sN9A.y/lG5E1I.w/a.u.yJ.v/e.w', // "adminpass123"
        role: 'admin'
    }
];
let feedbackDB = []; // Mock DB for feedback

// --- 5. Utility Functions ---
function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }
async function sendOTPEmail(email, otp) {
    console.log('--- MOCK EMAIL SENDER ---');
    console.log(`To: ${email}`);
    console.log(`Your 6-digit verification code is: ${otp}`);
    console.log('-------------------------');
}


// --- 6. API Routes ---

/** STUDENT REGISTRATION (POST /register) */
app.post('/register', async (req, res) => {
    // ... (This route is unchanged from before) ...
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ message: 'All fields are required' });
    const existingUser = usersDB.find(user => user.email === email);
    if (existingUser) return res.status(400).json({ message: 'Email already in use' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const otp = generateOTP();
    const newUser = { fullName: full_name, email, passwordHash, isVerified: false, otp, role: 'student' };
    usersDB.push(newUser);
    await sendOTPEmail(email, otp);
    console.log('New user registered:', newUser);
    res.status(201).json({ message: 'Registration successful. Please check your email for a verification code.' });
});

/** OTP VERIFICATION (POST /verify-otp) - UPDATED */
app.post('/verify-otp', (req, res) => {
    const { email, otp_code } = req.body; 
    if (!email || !otp_code) return res.status(400).json({ message: 'Email and OTP code are required.' });
    const user = usersDB.find(user => user.email === email);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isVerified) return res.status(400).json({ message: 'Account already verified.' });

    if (user.otp === otp_code) {
        user.isVerified = true;
        user.otp = null; 
        console.log('User verified:', email);

        const token = jwt.sign({ email: user.email, role: user.role, fullName: user.fullName }, JWT_SECRET, { expiresIn: '1h' });

        // !! UPDATED RESPONSE !!
        res.status(200).json({ 
            message: 'Account verified successfully!', 
            token: token,
            // Send user data back
            user: { fullName: user.fullName, email: user.email }
        });
    } else {
        res.status(400).json({ message: 'Invalid verification code.' });
    }
});

/** STUDENT LOGIN (POST /login) - UPDATED */
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    const user = usersDB.find(user => user.email === email && user.role === 'student');
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });
    if (!user.isVerified) return res.status(403).json({ message: 'Account not verified. Please check your email.' });
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign({ email: user.email, role: user.role, fullName: user.fullName }, JWT_SECRET, { expiresIn: '1h' });

    // !! UPDATED RESPONSE !!
    res.status(200).json({ 
        message: 'Login successful!', 
        token: token,
        // Send user data back
        user: { fullName: user.fullName, email: user.email }
    });
});

/** ADMIN LOGIN (POST /admin/authenticate) */
app.post('/admin/authenticate', async (req, res) => {
    // ... (This route is unchanged from before) ...
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
    const adminUser = usersDB.find(user => user.username === username && user.role === 'admin');
    if (!adminUser) return res.status(401).json({ message: 'Invalid credentials.' });
    const isMatch = await bcrypt.compare(password, adminUser.passwordHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });
    const token = jwt.sign({ username: adminUser.username, role: adminUser.role }, JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: 'Admin login successful!', token: token });
});


/** NEW ROUTE: FEEDBACK (POST /submit-feedback) */
app.post('/submit-feedback', (req, res) => {
    // Note: This is a simplified auth check.
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: You must be logged in.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { satisfaction, comment } = req.body;
        
        const feedback = {
            userEmail: decoded.email,
            satisfaction: satisfaction,
            comment: comment,
            date: new Date()
        };
        
        feedbackDB.push(feedback);
        console.log('New feedback received:', feedback);
        res.status(201).json({ message: 'Feedback submitted successfully.' });
        
    } catch (error) {
        res.status(401).json({ message: 'Invalid token.' });
    }
});


// --- 7. Start the Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});