# User Authentication System

This document explains how to use the user authentication system for both mobile and dashboard users.

## User Types

The system supports two types of users:

### 1. Mobile Users (`user_type: 'mobile'`)
- **Purpose**: Citizens who report incidents through the mobile app
- **Default Role**: `user`
- **Registration**: Self-registration through mobile app
- **Verification**: Email/phone verification required
- **Features**: 
  - Report incidents
  - View their own reports
  - Receive notifications

### 2. Dashboard Users (`user_type: 'dashboard'`)
- **Purpose**: System administrators and operators who manage the platform
- **Roles**: 
  - `admin`: Full system access
  - `moderator`: Can verify/reject reports and manage users
  - `operator`: Can view and update incident status
- **Registration**: Created by system administrators
- **Verification**: Auto-verified upon creation
- **Features**:
  - View all incidents
  - Update incident status
  - Manage users (admin only)
  - View analytics

## Database Schema

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone_number VARCHAR(20),
    user_type VARCHAR(20) NOT NULL DEFAULT 'mobile',  -- 'mobile' or 'dashboard'
    role VARCHAR(20) NOT NULL DEFAULT 'user',         -- 'user', 'admin', 'moderator', 'operator'
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

## Using the Authentication Service

### Setup

1. First, run the database setup to create tables and default admin:
```bash
python backend/models/setup_db.py
```

This will create:
- All necessary tables
- A default admin user:
  - **Username**: `admin`
  - **Password**: `Admin@123`
  - **⚠️ Change this password immediately after first login!**

### Example: Mobile User Registration

```python
import psycopg2
from services.auth import UserService, AuthService

# Connect to database
conn = psycopg2.connect(
    dbname="your_db",
    user="your_user",
    password="your_password",
    host="localhost",
    port=5432
)

# Create user service
user_service = UserService(conn)

# Register a new mobile user
try:
    user = user_service.create_mobile_user(
        username="john_doe",
        email="john@example.com",
        password="SecurePassword123!",
        full_name="John Doe",
        phone_number="+201234567890"
    )
    print(f"User created: {user}")
    
    # Create tokens for the user
    tokens = AuthService.create_user_tokens(
        user_id=user['id'],
        username=user['username'],
        email=user['email'],
        user_type=user['user_type'],
        role=user['role']
    )
    print(f"Access token: {tokens['access_token']}")
    
except Exception as e:
    print(f"Error: {e}")

conn.close()
```

### Example: Mobile User Login

```python
# Authenticate user
user_service = UserService(conn)
user = user_service.authenticate_user(
    username="john_doe",
    password="SecurePassword123!",
    user_type="mobile"  # Optional: ensures only mobile users can login
)

if user:
    # Create tokens
    tokens = AuthService.create_user_tokens(
        user_id=user['id'],
        username=user['username'],
        email=user['email'],
        user_type=user['user_type'],
        role=user['role']
    )
    print("Login successful!")
    print(f"Token: {tokens['access_token']}")
else:
    print("Invalid credentials or inactive account")
```

### Example: Dashboard User Creation (Admin Only)

```python
# Create a dashboard operator
user_service = UserService(conn)

try:
    operator = user_service.create_dashboard_user(
        username="operator1",
        email="operator1@safeegypt.com",
        password="OperatorPass123!",
        full_name="Ahmed Mohamed",
        role="operator"  # Can be 'admin', 'moderator', or 'operator'
    )
    print(f"Dashboard user created: {operator}")
except Exception as e:
    print(f"Error: {e}")
```

### Example: Dashboard User Login

```python
# Authenticate dashboard user
user = user_service.authenticate_user(
    username="admin",
    password="Admin@123",
    user_type="dashboard"
)

if user:
    tokens = AuthService.create_user_tokens(
        user_id=user['id'],
        username=user['username'],
        email=user['email'],
        user_type=user['user_type'],
        role=user['role']
    )
    print("Dashboard login successful!")
    print(f"Role: {user['role']}")
else:
    print("Invalid credentials")
```

### Example: Verify JWT Token

```python
from services.auth import get_current_user_from_token

# In your API endpoint, extract token from Authorization header
# Authorization: Bearer <token>

token = "eyJ0eXAiOiJKV1QiLCJhbGc..."  # From request header
user = get_current_user_from_token(token, conn)

if user:
    print(f"Authenticated as: {user['username']}")
    print(f"User type: {user['user_type']}")
    print(f"Role: {user['role']}")
else:
    print("Invalid or expired token")
```

### Example: Change Password

```python
user_service = UserService(conn)

success = user_service.change_password(
    user_id=user['id'],
    old_password="OldPassword123!",
    new_password="NewSecurePassword456!"
)

if success:
    print("Password changed successfully")
else:
    print("Failed to change password")
```

## Flask/FastAPI Integration Examples

### Flask Example

```python
from flask import Flask, request, jsonify
from functools import wraps
import psycopg2
from services.auth import UserService, AuthService, get_current_user_from_token

app = Flask(__name__)

# Database connection helper
def get_db_connection():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT")
    )

# Authentication decorator
def require_auth(user_type=None, roles=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({"error": "Missing or invalid token"}), 401
            
            token = auth_header.split(' ')[1]
            conn = get_db_connection()
            user = get_current_user_from_token(token, conn)
            conn.close()
            
            if not user:
                return jsonify({"error": "Invalid or expired token"}), 401
            
            # Check user type if specified
            if user_type and user['user_type'] != user_type:
                return jsonify({"error": "Unauthorized user type"}), 403
            
            # Check role if specified
            if roles and user['role'] not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            
            # Attach user to request
            request.current_user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Mobile user registration endpoint
@app.route('/api/mobile/register', methods=['POST'])
def mobile_register():
    data = request.json
    conn = get_db_connection()
    user_service = UserService(conn)
    
    try:
        user = user_service.create_mobile_user(
            username=data['username'],
            email=data['email'],
            password=data['password'],
            full_name=data.get('full_name'),
            phone_number=data.get('phone_number')
        )
        
        tokens = AuthService.create_user_tokens(
            user_id=user['id'],
            username=user['username'],
            email=user['email'],
            user_type=user['user_type'],
            role=user['role']
        )
        
        conn.close()
        return jsonify({
            "message": "Registration successful",
            "user": user,
            "tokens": tokens
        }), 201
        
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400

# Mobile user login endpoint
@app.route('/api/mobile/login', methods=['POST'])
def mobile_login():
    data = request.json
    conn = get_db_connection()
    user_service = UserService(conn)
    
    user = user_service.authenticate_user(
        username=data['username'],
        password=data['password'],
        user_type='mobile'
    )
    
    if not user:
        conn.close()
        return jsonify({"error": "Invalid credentials"}), 401
    
    tokens = AuthService.create_user_tokens(
        user_id=user['id'],
        username=user['username'],
        email=user['email'],
        user_type=user['user_type'],
        role=user['role']
    )
    
    conn.close()
    return jsonify({
        "message": "Login successful",
        "user": user,
        "tokens": tokens
    }), 200

# Dashboard login endpoint
@app.route('/api/dashboard/login', methods=['POST'])
def dashboard_login():
    data = request.json
    conn = get_db_connection()
    user_service = UserService(conn)
    
    user = user_service.authenticate_user(
        username=data['username'],
        password=data['password'],
        user_type='dashboard'
    )
    
    if not user:
        conn.close()
        return jsonify({"error": "Invalid credentials"}), 401
    
    tokens = AuthService.create_user_tokens(
        user_id=user['id'],
        username=user['username'],
        email=user['email'],
        user_type=user['user_type'],
        role=user['role']
    )
    
    conn.close()
    return jsonify({
        "message": "Login successful",
        "user": user,
        "tokens": tokens
    }), 200

# Protected endpoint - requires mobile user
@app.route('/api/mobile/profile', methods=['GET'])
@require_auth(user_type='mobile')
def get_mobile_profile():
    user = request.current_user
    return jsonify({"user": user}), 200

# Protected endpoint - requires dashboard user with admin role
@app.route('/api/dashboard/users', methods=['POST'])
@require_auth(user_type='dashboard', roles=['admin'])
def create_dashboard_user():
    data = request.json
    conn = get_db_connection()
    user_service = UserService(conn)
    
    try:
        user = user_service.create_dashboard_user(
            username=data['username'],
            email=data['email'],
            password=data['password'],
            full_name=data['full_name'],
            role=data.get('role', 'operator')
        )
        conn.close()
        return jsonify({
            "message": "Dashboard user created",
            "user": user
        }), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
```

## Security Best Practices

1. **Password Requirements**
   - Minimum 8 characters
   - Include uppercase, lowercase, numbers, and special characters
   - Never store plain-text passwords

2. **Token Management**
   - Store tokens securely on client side
   - Implement token refresh mechanism
   - Invalidate tokens on logout

3. **Environment Variables**
   - Store `SECRET_KEY` in environment variables
   - Use strong, random secret keys
   - Rotate keys periodically

4. **User Verification**
   - Implement email/phone verification for mobile users
   - Send verification codes
   - Require verification before allowing certain actions

5. **Rate Limiting**
   - Implement rate limiting on login endpoints
   - Lock accounts after multiple failed attempts
   - Add CAPTCHA for suspicious activity

## Default Admin Credentials

After running `setup_db.py`, a default admin user is created:

- **Username**: `admin`
- **Email**: `admin@safeegypt.com`
- **Password**: `Admin@123`
- **User Type**: `dashboard`
- **Role**: `admin`

**⚠️ IMPORTANT**: Change the default password immediately after first login!

## Environment Variables

Add these to your `.env` file:

```env
# Database
DB_NAME=safe_egypt_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# JWT Secret (change this!)
SECRET_KEY=your-super-secret-key-change-this-in-production
```

## Testing the Setup

Run this script to test the user system:

```python
# test_user_auth.py
import psycopg2
from services.auth import UserService, AuthService
from dotenv import load_dotenv
import os

load_dotenv()

def test_auth_system():
    # Connect to database
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT")
    )
    
    user_service = UserService(conn)
    
    # Test 1: Create mobile user
    print("Test 1: Creating mobile user...")
    try:
        mobile_user = user_service.create_mobile_user(
            username="test_mobile",
            email="mobile@test.com",
            password="TestPass123!",
            full_name="Test Mobile User"
        )
        print(f"✅ Mobile user created: {mobile_user['username']}")
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    # Test 2: Authenticate mobile user
    print("\nTest 2: Authenticating mobile user...")
    user = user_service.authenticate_user("test_mobile", "TestPass123!", "mobile")
    if user:
        print(f"✅ Authentication successful")
        tokens = AuthService.create_user_tokens(
            user['id'], user['username'], user['email'],
            user['user_type'], user['role']
        )
        print(f"✅ Token generated: {tokens['access_token'][:50]}...")
    else:
        print("❌ Authentication failed")
    
    # Test 3: Authenticate dashboard admin
    print("\nTest 3: Authenticating dashboard admin...")
    admin = user_service.authenticate_user("admin", "Admin@123", "dashboard")
    if admin:
        print(f"✅ Admin authentication successful")
        print(f"   Role: {admin['role']}")
    else:
        print("❌ Admin authentication failed")
    
    conn.close()
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    test_auth_system()
```

