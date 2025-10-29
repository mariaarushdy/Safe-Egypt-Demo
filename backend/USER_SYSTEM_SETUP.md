# User System Setup Guide

## 🎉 What Was Created

A complete user authentication system with support for two types of users:

### 1. **Mobile Users** 
- Citizens who report incidents through the mobile app
- Self-registration capability
- Email/phone verification support

### 2. **Dashboard Users**
- System administrators and operators
- Three role levels: Admin, Moderator, Operator
- Manage incidents and the platform

---

## 📁 Files Created/Modified

### Database Files

1. **`backend/models/setup_db.py`** (Modified)
   - Added `users` table creation
   - Added indexes for performance
   - Creates default admin user on setup

2. **`backend/models/database.py`** (Modified)
   - Updated User model with new fields
   - Added enums for UserType, UserRole, IncidentStatus, VerificationStatus, Severity
   - Added relationships between users and incidents

### Service Files

3. **`backend/services/auth.py`** (New)
   - `AuthService`: JWT token generation and verification
   - `UserService`: User CRUD operations
   - Password hashing with werkzeug
   - Helper function for token-based authentication

### Documentation Files

4. **`backend/services/USER_AUTH_README.md`** (New)
   - Comprehensive usage guide
   - Code examples for registration, login, authentication
   - Flask/FastAPI integration examples
   - Security best practices

5. **`backend/USER_SYSTEM_SETUP.md`** (This file)
   - Quick start guide
   - Step-by-step instructions

### Test Files

6. **`backend/test_user_auth.py`** (New)
   - Automated test script
   - Verifies all authentication functions
   - Tests user creation, login, tokens, etc.

### Configuration Files

7. **`backend/requirements.txt`** (Modified)
   - Added `werkzeug==3.0.1` for password hashing
   - Added `PyJWT==2.8.0` for JWT tokens

8. **`backend/env_template.txt`** (New)
   - Template for environment variables
   - Copy to `.env` and fill in your values

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Setup Environment Variables

Copy the environment template and fill in your values:

```bash
# On Windows PowerShell
Copy-Item env_template.txt .env

# On Linux/Mac
cp env_template.txt .env
```

Edit `.env` and add your database credentials and a secure SECRET_KEY:

```env
DB_NAME=safe_egypt_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Important: Change this to a random string in production!
SECRET_KEY=your-super-secret-key-change-this
```

**Generate a secure SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Step 3: Setup Database

Run the setup script to create all tables and the default admin user:

```bash
python models/setup_db.py
```

You should see output like:
```
✅ Database 'safe_egypt_db' already exists.
🧱 Creating table 'users'...
✅ Table 'locations' already exists.
✅ Table 'incidents' already exists.
✅ Table 'media_files' already exists.
👤 Creating default admin user...
✅ Default admin user created (username: admin, password: Admin@123)
⚠️  Please change the default password after first login!
🎉 Database and tables are ready.
✅ All done!
```

### Step 4: Test the System

Run the test script to verify everything works:

```bash
python test_user_auth.py
```

This will:
- ✅ Verify admin user exists
- ✅ Create and authenticate mobile users
- ✅ Generate and verify JWT tokens
- ✅ Create dashboard operators
- ✅ Test password changes
- ✅ Test user type restrictions

---

## 👤 User Types and Roles

### Mobile Users (`user_type: 'mobile'`)

**Default Role:** `user`

**Capabilities:**
- Report incidents
- Upload photos/videos
- View their own reports
- Receive notifications

**Fields:**
- username, email, password
- full_name (optional)
- phone_number (optional)
- is_verified (requires email/phone verification)

### Dashboard Users (`user_type: 'dashboard'`)

**Roles:**

1. **Admin** (`role: 'admin'`)
   - Full system access
   - Manage all users
   - System configuration
   - View all analytics

2. **Moderator** (`role: 'moderator'`)
   - Verify/reject incidents
   - Manage mobile users
   - Update incident status
   - View analytics

3. **Operator** (`role: 'operator'`)
   - View incidents
   - Update incident status
   - Add notes/comments
   - Limited analytics

**Fields:**
- username, email, password
- full_name (required)
- Auto-verified (is_verified = True)

---

## 🔐 Default Admin Account

**IMPORTANT:** After running `setup_db.py`, a default admin account is created:

```
Username: admin
Password: Admin@123
Email: admin@safeegypt.com
```

**⚠️ SECURITY WARNING:** 
Change this password immediately after first login!

---

## 💻 Usage Examples

### Creating a Mobile User

```python
from services.auth import UserService, AuthService
import psycopg2

# Connect to database
conn = psycopg2.connect(
    dbname="safe_egypt_db",
    user="postgres",
    password="your_password",
    host="localhost"
)

# Create user service
user_service = UserService(conn)

# Register mobile user
user = user_service.create_mobile_user(
    username="john_doe",
    email="john@example.com",
    password="SecurePass123!",
    full_name="John Doe",
    phone_number="+201234567890"
)

# Generate tokens
tokens = AuthService.create_user_tokens(
    user_id=user['id'],
    username=user['username'],
    email=user['email'],
    user_type=user['user_type'],
    role=user['role']
)

print(f"Access Token: {tokens['access_token']}")
conn.close()
```

### Authenticating a User

```python
# Login
user = user_service.authenticate_user(
    username="john_doe",
    password="SecurePass123!",
    user_type="mobile"  # Optional: restrict to mobile users
)

if user:
    tokens = AuthService.create_user_tokens(
        user_id=user['id'],
        username=user['username'],
        email=user['email'],
        user_type=user['user_type'],
        role=user['role']
    )
    print("Login successful!")
else:
    print("Invalid credentials")
```

### Creating Dashboard Users (Admin Only)

```python
# Create a dashboard operator
operator = user_service.create_dashboard_user(
    username="operator1",
    email="operator@safeegypt.com",
    password="OpPass123!",
    full_name="Ahmed Mohamed",
    role="operator"  # admin, moderator, or operator
)
```

### Verifying JWT Token

```python
from services.auth import get_current_user_from_token

# Extract token from Authorization header
# Authorization: Bearer <token>

token = request.headers.get('Authorization').split(' ')[1]
user = get_current_user_from_token(token, conn)

if user:
    print(f"Authenticated: {user['username']}")
    print(f"Role: {user['role']}")
else:
    print("Invalid token")
```

---

## 🔧 API Integration

### Flask Example

See `backend/services/USER_AUTH_README.md` for complete Flask integration examples including:
- Registration endpoints
- Login endpoints
- Protected routes
- Authentication decorators
- Role-based access control

### Key Endpoints to Implement

```python
POST /api/mobile/register     # Mobile user registration
POST /api/mobile/login        # Mobile user login
GET  /api/mobile/profile      # Get mobile user profile (protected)

POST /api/dashboard/login     # Dashboard user login
POST /api/dashboard/users     # Create dashboard user (admin only)
GET  /api/dashboard/profile   # Get dashboard user profile (protected)
```

---

## 🗄️ Database Schema

### Users Table

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone_number VARCHAR(20),
    
    -- User classification
    user_type VARCHAR(20) NOT NULL DEFAULT 'mobile',  -- 'mobile' or 'dashboard'
    role VARCHAR(20) NOT NULL DEFAULT 'user',         -- 'user', 'admin', 'moderator', 'operator'
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
```

### Updated Incidents Table

The incidents table now includes:
- `reporter_id`: Foreign key to users table
- `is_anonymous`: Boolean flag for anonymous reports

```sql
reporter_id INT REFERENCES users(id) ON DELETE SET NULL,
is_anonymous BOOLEAN DEFAULT FALSE,
```

---

## 🔒 Security Features

1. **Password Hashing**: Using werkzeug's secure hashing
2. **JWT Tokens**: Stateless authentication
3. **Token Expiration**: Access tokens expire after 24 hours
4. **User Type Separation**: Mobile and dashboard users are separate
5. **Role-Based Access**: Different permissions for admin/moderator/operator
6. **Account Status**: Ability to deactivate users
7. **Email Verification**: Support for verifying mobile users

---

## 📋 Next Steps

### For Backend Development:

1. ✅ Create API endpoints for user registration/login
2. ✅ Implement authentication middleware
3. ✅ Add role-based authorization
4. ⬜ Add email verification system
5. ⬜ Implement password reset functionality
6. ⬜ Add rate limiting for login attempts
7. ⬜ Create admin panel for user management

### For Mobile App:

1. ⬜ Implement registration screen
2. ⬜ Implement login screen
3. ⬜ Store JWT tokens securely
4. ⬜ Add token refresh logic
5. ⬜ Implement profile screen
6. ⬜ Add logout functionality

### For Dashboard:

1. ⬜ Implement admin login screen
2. ⬜ Create user management interface
3. ⬜ Add role-based UI restrictions
4. ⬜ Implement admin dashboard
5. ⬜ Add user activity logs

---

## 🐛 Troubleshooting

### "Table 'users' does not exist"
Run the setup script:
```bash
python models/setup_db.py
```

### "ModuleNotFoundError: No module named 'werkzeug'"
Install dependencies:
```bash
pip install -r requirements.txt
```

### "Admin authentication failed"
Make sure you ran `setup_db.py` to create the default admin user.

### "Invalid token"
Check that:
1. SECRET_KEY is set in .env
2. Token hasn't expired
3. Token format is correct: `Bearer <token>`

---

## 📚 Additional Resources

- **Full Usage Guide**: `backend/services/USER_AUTH_README.md`
- **Test Script**: `backend/test_user_auth.py`
- **Database Models**: `backend/models/database.py`
- **Setup Script**: `backend/models/setup_db.py`

---

## 📝 Notes

- All passwords are hashed using werkzeug's security functions
- JWT tokens include user_id, username, email, user_type, and role
- Access tokens expire after 24 hours (configurable)
- Refresh tokens expire after 30 days (configurable)
- The system supports both anonymous and authenticated incident reports

---

## ✅ Checklist

Before going to production:

- [ ] Change default admin password
- [ ] Set strong SECRET_KEY in .env
- [ ] Enable HTTPS for all API calls
- [ ] Implement rate limiting
- [ ] Add email verification
- [ ] Add password reset functionality
- [ ] Implement CAPTCHA on login
- [ ] Set up monitoring and logging
- [ ] Review and test all authentication flows
- [ ] Conduct security audit

---

**Need Help?** Check the comprehensive guide in `USER_AUTH_README.md` or run the test script to see working examples.

