// auth.js
// Connects to Node.js backend with Firebase Realtime DB for persistent data and OTP delivery

// API_URL: prefer the current origin so the frontend calls the same host that served the page.
// Falls back to localhost for local development.
const API_URL = (typeof window !== 'undefined' && window.location && window.location.origin) || 'http://localhost:3000';

let adminEmail = ''; // Variable to store the email after Step 1

// Timer configuration for token resend
const RESEND_TIMEOUT_SECONDS = 60;
let resendTimerInterval = null;

/* ============================================
    PASSWORD TOGGLE
============================================ */
export function setupPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', () => {
            const targetId = icon.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (targetInput) {
                const type = targetInput.getAttribute('type') === 'password' ? 'text' : 'password';
                targetInput.setAttribute('type', type);
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    });
}

/* ============================================
    AUTH BUTTON HANDLER
============================================ */
export function handleAuthButton() {
    const authButton = document.getElementById('auth-button');
    if (authButton && localStorage.getItem('authToken')) {
        authButton.textContent = 'Logout';
        authButton.href = '#';
        authButton.addEventListener('click', (e) => {
            e.preventDefault();
            logout(); // Calls the exported logout function below
        });
    } else if (authButton) {
        authButton.textContent = 'Login';
        authButton.href = 'login.html';
    }
}

/* ============================================
    LOGOUT FUNCTION
============================================ */
export function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('verificationEmail');
    alert('You have been logged out.');
    window.location.href = 'index.html';
}

/* ============================================
    PAGE PROTECTION (Legacy - can be removed if user-loader.js is used)
============================================ */
// This function is no longer needed since user-loader.js handles all page protection.
// You can safely remove it from here and from any module imports.
export function protectPage() {
    if (!localStorage.getItem('authToken')) {
        alert('You must be logged in to view this page.');
        window.location.href = 'login.html';
    }
}

/* ============================================
    REGISTRATION
============================================ */
export function handleRegistration() {
    const form = document.getElementById('registration-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const password = form['password'].value;
        const confirmPassword = form['confirm_password'].value;
        const passwordErrorDiv = document.getElementById('password-match-error');
        const errorElement = document.getElementById('registration-error');

        if (errorElement) errorElement.textContent = '';

        if (password !== confirmPassword) {
            passwordErrorDiv.style.display = 'block';
            form['confirm_password'].focus();
            return;
        } else {
            passwordErrorDiv.style.display = 'none';
        }

        const fullName = form['full_name'].value;
        const email = form['email'].value;
        const terms = form['terms'].checked;
        const security_question = form['security_question'].value;
        const security_answer = form['security_answer'].value;

        if (!terms) {
            alert("You must agree to the Terms of Service.");
            return;
        }

        if (!security_question || !security_answer) {
            if (errorElement) errorElement.textContent = 'Security question and answer are required.';
            return;
        }

        // Require phone number and date of birth per user request
        const phoneVal = form['phone_number']?.value || '';
        const dobVal = form['date_of_birth']?.value || '';
        if (!phoneVal || !dobVal) {
            if (errorElement) errorElement.textContent = 'Phone number and Date of Birth are required.';
            return;
        }

        try {
            const payload = {
                full_name: fullName,
                email,
                password,
                phone_number: phoneVal,
                date_of_birth: dobVal,
                country: form['country']?.value || '',
                bio: form['bio']?.value || '',
                security_question,
                security_answer
            };

            // Log payload to help debug missing fields (will appear in browser console)
            console.log('Registration payload:', payload);

            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message);
                localStorage.setItem('authToken', result.authToken);
                localStorage.setItem('userName', result.full_name);
                localStorage.setItem('userRole', result.role);
                localStorage.setItem('userEmail', result.email);
                handleAuthButton();
                window.location.href = 'portal.html';
            } else {
                if (errorElement) errorElement.textContent = `Registration Failed: ${result.message}`;
            }
        } catch (error) {
            console.error('Registration Network Error:', error);
            if (errorElement) errorElement.textContent = 'A network error occurred.';
        }
    });
}

/* ============================================
    LOGIN (Student)
============================================ */
export function handleLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = form['email'].value;
        const password = form['password'].value;
        const errorElement = document.getElementById('login-error');
        if (errorElement) errorElement.textContent = '';

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                localStorage.setItem('authToken', result.authToken);
                localStorage.setItem('userName', result.full_name);
                localStorage.setItem('userRole', result.role);
                localStorage.setItem('userEmail', result.email);

                handleAuthButton();

                // Redirect based on role
                if (result.role === 'admin') {
                    window.location.href = 'admin-portal.html';
                } else {
                    window.location.href = 'portal.html';
                }
            } else {
                if (errorElement) errorElement.textContent = `Login Failed: ${result.message}`;
            }
        } catch (error) {
            console.error('Login Network Error:', error);
            if (errorElement) errorElement.textContent = 'A network error occurred.';
        }
    });
}


/* ============================================
    HELPER: DISPLAY ADMIN ERROR
============================================ */
function displayAdminError(message) {
    const errorElement = document.getElementById('admin-login-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = message ? 'block' : 'none'; // Only show if there's a message
    }
}

/* ============================================
    RESEND TIMER LOGIC
============================================ */
function startResendTimer() {
    const resendButton = document.getElementById('resend-token-btn');
    const timerDisplay = document.getElementById('resend-timer');
    let timeLeft = RESEND_TIMEOUT_SECONDS;

    // Clear any existing interval
    if (resendTimerInterval) {
        clearInterval(resendTimerInterval);
    }
    
    // Disable button and show timer immediately
    resendButton.disabled = true;
    timerDisplay.textContent = `Resend in ${timeLeft}s`;

    resendTimerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Resend in ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(resendTimerInterval);
            resendButton.disabled = false;
            timerDisplay.textContent = 'Ready to Resend';
        }
    }, 1000);
}

/* ============================================
    ADMIN TOKEN SEND
============================================ */
export async function sendAdminToken(email) {
    displayAdminError(''); // Clear error

    try {
        const response = await fetch(`${API_URL}/send_admin_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Send the email captured from Step 1
            body: JSON.stringify({ email }),
        });

        const data = await response.json();
        if (response.ok) {
            // Store the token and expiration time for display in admin portal
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminTokenExpires', data.expires_at);
            displayAdminError(`✅ ${data.message}`);
            return { token: data.token, expires_at: data.expires_at };
        } else {
            displayAdminError(`❌ ${data.message}`);
            return null;
        }
    } catch (error) {
        console.error('Error sending admin token:', error);
        displayAdminError('Failed to send token.');
        return null;
    }
}


/* ============================================
    ADMIN LOGIN STEP 1: CREDENTIALS CHECK
============================================ */
async function handleAdminLoginStep1(event) {
    event.preventDefault();
    displayAdminError(''); // Clear previous errors

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
        displayAdminError('Please enter both email and password.');
        return;
    }

    // Store email globally for Step 2 and Resend Token
    adminEmail = email;

    const step1Form = document.getElementById('admin-login-step1-form');
    const step2Form = document.getElementById('admin-login-step2-form');

    try {
        // New endpoint for credential check
        const response = await fetch(`${API_URL}/admin_login_check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const result = await response.json();

        if (response.ok && result.action === 'login_success') {
            // Case 1: Already an Admin - Direct Login
            localStorage.setItem('authToken', result.authToken);
            localStorage.setItem('userName', result.full_name);
            localStorage.setItem('userRole', result.role);
            localStorage.setItem('userEmail', result.email);
            window.location.href = 'admin-portal.html';
        } else if (response.status === 403 && result.action === 'require_token') {
            // Case 2: Credentials correct, but token required (e.g., student trying to become admin)
            displayAdminError("Credentials accepted. A one-time admin token has been requested. Please check the Admin Email.");
            
            // Hide Step 1, Show Step 2
            step1Form.classList.add('hidden');
            step2Form.classList.remove('hidden');
            
            // Immediately send the first token and start the timer
            await sendAdminToken(adminEmail);
            startResendTimer();
        } else {
            // Case 3: General login failure (401)
            displayAdminError(`Login Failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Admin Login Step 1 Network Error:', error);
        displayAdminError('A network error occurred.');
    }
}


/* ============================================
    ADMIN LOGIN STEP 2: TOKEN VERIFICATION
============================================ */
async function handleAdminTokenVerification(event) {
    event.preventDefault();
    displayAdminError(''); // Clear previous errors

    const token = document.getElementById('token').value.trim();
    // Get password from the now-hidden input (adminEmail is global)
    const password = document.getElementById('password').value.trim(); 

    if (!token) {
        displayAdminError('Please enter the Admin Token.');
        return;
    }
    
    // Final verification with email, password, and token
    try {
        const response = await fetch(`${API_URL}/admin_login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: adminEmail, password, token }),
        });

        const result = await response.json();

        if (response.ok) {
            // Login success - token verified, role possibly upgraded
            localStorage.setItem('authToken', result.authToken);
            localStorage.setItem('userName', result.full_name);
            localStorage.setItem('userRole', result.role);
            localStorage.setItem('userEmail', adminEmail);
            window.location.href = 'admin-portal.html';
        } else {
            // Token verification failure
            displayAdminError(`Verification Failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Admin Token Verification Network Error:', error);
        displayAdminError('A network error occurred.');
    }
}

/* ============================================
    PROFILE FETCH (Unchanged)
============================================ */
export async function handleProfileFetch() {
    const userName = localStorage.getItem('userName') || 'Student';
    const welcomeText = document.getElementById('welcome-text');
    if (welcomeText) welcomeText.textContent = `👋 Welcome, ${userName.split(' ')[0]}!`;
}

/* ============================================
    PORTAL LINK SWITCH (Student ↔ Admin) (Unchanged)
============================================ */
export function updatePortalLink() {
    const nav = document.querySelector('.main-nav');
    if (!nav) return;

    const userRole = localStorage.getItem('userRole');
    const portalLink = Array.from(nav.querySelectorAll('a')).find(a =>
        a.textContent.includes('Portal')
    );

    if (!portalLink) return;

    if (userRole === 'admin') {
        portalLink.textContent = 'Admin Portal';
        portalLink.href = 'admin-portal.html';
    } else {
        portalLink.textContent = 'Student Portal';
        portalLink.href = 'portal.html';
    }
}


/* ============================================
    INIT ADMIN LOGIN PAGE
============================================ */
export function initializeAdminLogin() {
    setupPasswordToggles();
    
    const step1Form = document.getElementById('admin-login-step1-form');
    const step2Form = document.getElementById('admin-login-step2-form');
    const resendButton = document.getElementById('resend-token-btn');
    
    // Ensure forms are correctly initialized (Step 1 visible, Step 2 hidden)
    if (step1Form && step2Form) {
        // We ensure Step 2 is hidden initially, in case of browser back button behavior
        step1Form.classList.remove('hidden');
        step2Form.classList.add('hidden');
    }
    
    // Attach event listeners
    if (step1Form) {
        step1Form.addEventListener('submit', handleAdminLoginStep1);
    }
    
    if (step2Form) {
        step2Form.addEventListener('submit', handleAdminTokenVerification);
    }
    
    if (resendButton) {
        // Corrected: Use async callback for await
        resendButton.addEventListener('click', async () => {
            if (adminEmail) {
                await sendAdminToken(adminEmail); // Ensure we wait for the send operation
                startResendTimer();
            } else {
                displayAdminError('Please complete Step 1 first.');
            }
        });
    }
}