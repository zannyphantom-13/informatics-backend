import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import random
from datetime import datetime, timedelta
from flask_cors import CORS

# --- CONFIGURATION ---
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'students.db')

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app) 
app.config['SECRET_KEY'] = 'your_strong_secret_key_here' 
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- GLOBAL CONSTANTS ---
ADMIN_RECIPIENT_EMAIL = 'hazytarzan12@gmail.com'

# --- MODELS ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False) 
    role = db.Column(db.String(20), default='student', nullable=False) 

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class OTP(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_email = db.Column(db.String(100), db.ForeignKey('user.email'), nullable=False)
    code = db.Column(db.String(6), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

# --- UTILITIES ---
def send_email(email, subject, body):
    """Mock email sender - email disabled for security."""
    print(f"[EMAIL MOCK] To: {email} | Subject: {subject}")

def generate_otp():
    return str(random.randint(100000, 999999))

# --- ROUTES: STUDENT/GENERAL AUTH ---

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    full_name = data.get('full_name')
    email = data.get('email')
    password = data.get('password')

    if not all([full_name, email, password]):
        return jsonify({'message': 'Missing fields'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'An account with this email already exists.'}), 409

    try:
        # Automatically assign the 'admin' role to the very first user who registers
        if User.query.count() == 0:
            new_user = User(full_name=full_name, email=email, is_verified=True, role='admin')
        else:
            new_user = User(full_name=full_name, email=email, is_verified=True, role='student')
            
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()

        # Auto-verify on registration: OTP flow deprecated for student registration
        db.session.commit()
        return jsonify({ 'message': 'Registration successful (auto-verified).', 'email': email }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error during registration: {e}")
        return jsonify({'message': 'Internal server error during registration.'}), 500


# resend-otp route removed — OTP-based registration verification is deprecated.


# verify-otp route removed — OTP-based verification is deprecated.


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    user = User.query.filter_by(email=email).first()

    if user and user.check_password(password):
        if not user.is_verified:
            return jsonify({
                'message': 'Account not verified. Redirecting to verification page.',
                'action': 'redirect_to_otp', 
                'email': email 
            }), 403
        
        # === FIX: Add 'status': 'success' to match auth.js ===
        return jsonify({
            'status': 'success', # <--- THIS LINE IS THE FIX
            'message': 'Login successful.',
            'authToken': 'temp_secure_token', 
            'full_name': user.full_name, 
            'role': user.role
        }), 200
    
    return jsonify({'message': 'Invalid email or password.'}), 401


# --- ROUTES: ADMIN SPECIFIC ---

@app.route('/admin_login_check', methods=['POST'])
def admin_login_check():
    """
    Step 1: Checks credentials and determines if a token is needed.
    """
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({"message": "Invalid email or password."}), 401
    
    if not user.is_verified:
        return jsonify({'message': 'Account not verified.'}), 403

    # Case 1: Already an Admin - Direct Login Success
    if user.role == 'admin':
        return jsonify({
            'message': 'Admin login successful.',
            'authToken': 'temp_secure_admin_token', 
            'full_name': user.full_name,
            'role': user.role,
            'action': 'login_success'
        }), 200
    
    # Case 2: Not an Admin, but credentials are correct - Require Token
    if user.role == 'student':
        return jsonify({
            "message": "Credentials accepted. Token required.",
            "action": "require_token"
        }), 403 # Using 403 to signal an accepted credential but restricted access


@app.route('/send_admin_token', methods=['POST'])
def send_admin_token():
    """
    Called after Step 1 is passed. Sends the token to the primary admin email.
    """
    data = request.get_json()
    user_email = data.get('email') # The email of the user attempting admin login
    
    if not user_email:
        return jsonify({"message": "Missing email for token generation."}), 400

    # 1. Basic Check: User must exist
    user = User.query.filter_by(email=user_email).first()
    if not user:
        return jsonify({"message": "User not found."}), 404
        
    try:
        # 2. Clear any old tokens for this user
        OTP.query.filter_by(user_email=user_email).delete() 

        # 3. Generate the token and set expiration (3 minutes)
        token = generate_otp()
        expiration_time = datetime.utcnow() + timedelta(minutes=3) 

        # 4. Store the token associated with the user trying to log in
        new_otp = OTP(user_email=user_email, code=token, expires_at=expiration_time)
        db.session.add(new_otp)
        db.session.commit()

        # 5. CRITICAL: Send the token to the hardcoded recipient (for security)
        email_body = (
            f"An attempt was made by user {user_email} to access the Admin Portal.\n\n"
            f"Your one-time Admin Token for this attempt is: {token}\n\n"
            f"This token is valid for 3 minutes."
        )
        send_email(
            email=ADMIN_RECIPIENT_EMAIL,
            subject='Secure Admin Access Token Request',
            body=email_body
        )
        
        return jsonify({
            "message": f"Token successfully generated and sent to the primary Admin email: {ADMIN_RECIPIENT_EMAIL}"
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error during admin token send: {e}")
        return jsonify({"message": "Internal server error during token generation."}), 500


@app.route('/admin_login', methods=['POST'])
def admin_login():
    """
    Step 2: Final verification using credentials AND the token.
    """
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    token = data.get('token')

    # 1. Re-authenticate User Credentials (important for final step)
    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({"message": "Invalid email or password."}), 401

    if user.role == 'admin':
        # Should be caught by admin_login_check, but return success defensively
        return jsonify({
            'message': 'Admin login successful.',
            'authToken': 'temp_secure_admin_token', 
            'full_name': user.full_name,
            'role': user.role
        }), 200


    # 2. Token Verification (Required for role upgrade)
    if not token:
        return jsonify({"message": "Admin token is required for verification."}), 403

    # Check for valid, unexpired token associated with this user's email
    otp_entry = OTP.query.filter_by(user_email=email, code=token) \
                             .filter(OTP.expires_at > datetime.utcnow()) \
                             .order_by(OTP.created_at.desc()) \
                             .first()

    if otp_entry:
        try:
            # Token is valid! Upgrade user role and clean up token.
            user.role = 'admin' 
            db.session.delete(otp_entry)
            db.session.commit()
            
            return jsonify({
                'message': 'Token verified and Admin access granted.',
                'authToken': 'temp_secure_admin_token', 
                'full_name': user.full_name,
                'role': user.role
            }), 200
        except Exception as e:
            db.session.rollback()
            print(f"Error setting admin role: {e}")
            return jsonify({'message': 'Internal error during role update.'}), 500

    else:
        return jsonify({'message': 'Invalid or expired Admin Token.'}), 401


# --- SERVER SETUP ---

@app.route('/')
def index_route():
    return 'Backend Server is Running.'

if __name__ == '__main__':
    with app.app_context():
        # Ensure the database and tables exist
        db.create_all()
        
    app.run(debug=True, port=3000)