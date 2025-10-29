# 👥 User System - Quick Reference

## 🎯 Overview

You now have a complete user authentication system supporting:
- **Mobile App Users** - Citizens reporting incidents
- **Dashboard Users** - Admins/moderators managing the system

---

## 📊 User Structure

```
┌─────────────────────────────────────────────────────┐
│                    USERS TABLE                       │
├─────────────────────────────────────────────────────┤
│  • id                                                │
│  • username (unique)                                 │
│  • email (unique)                                    │
│  • password_hash                                     │
│  • full_name                                         │
│  • phone_number                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ USER_TYPE (determines access method)         │   │
│  │  ├─ mobile     → Mobile App Users            │   │
│  │  └─ dashboard  → Admin/Staff Users           │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ ROLE (determines permissions)                │   │
│  │  ├─ user      → Regular mobile user          │   │
│  │  ├─ operator  → View & update incidents      │   │
│  │  ├─ moderator → + Verify/reject reports      │   │
│  │  └─ admin     → + Manage all users & system  │   │
│  └─────────────────────────────────────────────┘   │
│  • is_active                                         │
│  • is_verified                                       │
│  • created_at                                        │
│  • last_login                                        │
└─────────────────────────────────────────────────────┘
```

---

## 🔑 Default Admin Account

```
📧 Email:    admin@safeegypt.com
👤 Username: admin
🔒 Password: Admin@123
⚡ Role:     admin
📱 Type:     dashboard
```

**⚠️ CHANGE THIS PASSWORD IMMEDIATELY!**

---

## 🚀 Quick Start Commands

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Setup environment
copy env_template.txt .env    # Windows
cp env_template.txt .env      # Linux/Mac
# Edit .env with your database credentials

# 3. Create database & tables
python models/setup_db.py

# 4. Test the system
python test_user_auth.py
```

---

## 📝 Files Created

| File | Purpose |
|------|---------|
| `models/setup_db.py` | ✏️ Modified - Creates users table |
| `models/database.py` | ✏️ Modified - User model with enums |
| `services/auth.py` | ✨ New - Authentication service |
| `test_user_auth.py` | ✨ New - Test script |
| `USER_SYSTEM_SETUP.md` | 📖 Setup guide |
| `services/USER_AUTH_README.md` | 📖 Complete documentation |
| `USER_SYSTEM_SUMMARY.md` | 📖 This quick reference |
| `env_template.txt` | 📖 Environment template |
| `requirements.txt` | ✏️ Modified - Added werkzeug & PyJWT |

---

## 🔐 Authentication Flow

### Mobile User Registration
```
1. User submits: username, email, password, name, phone
   ↓
2. System hashes password with werkzeug
   ↓
3. Creates user with user_type='mobile', role='user'
   ↓
4. Returns user data + JWT tokens
   ↓
5. Mobile app stores tokens for future requests
```

### Login (Mobile or Dashboard)
```
1. User submits: username, password, [user_type]
   ↓
2. System verifies credentials
   ↓
3. Generates JWT access token (24h expiry)
   ↓
4. Generates JWT refresh token (30d expiry)
   ↓
5. Updates last_login timestamp
   ↓
6. Returns tokens + user info
```

### Protected API Request
```
1. Client sends: Authorization: Bearer <token>
   ↓
2. Server extracts and verifies token
   ↓
3. Checks token expiration
   ↓
4. Extracts user_id from token payload
   ↓
5. Fetches user from database
   ↓
6. Verifies user is active
   ↓
7. Checks user_type & role permissions
   ↓
8. Processes request if authorized
```

---

## 💻 Code Examples

### Create Mobile User
```python
from services.auth import UserService, AuthService
user_service = UserService(db_conn)

user = user_service.create_mobile_user(
    username="citizen123",
    email="citizen@email.com",
    password="SecurePass123!",
    full_name="Ahmed Ali",
    phone_number="+201234567890"
)

tokens = AuthService.create_user_tokens(
    user['id'], user['username'], user['email'],
    user['user_type'], user['role']
)
```

### Login
```python
user = user_service.authenticate_user(
    username="citizen123",
    password="SecurePass123!",
    user_type="mobile"  # Optional restriction
)

if user:
    tokens = AuthService.create_user_tokens(...)
```

### Verify Token
```python
from services.auth import get_current_user_from_token

user = get_current_user_from_token(token, db_conn)
if user:
    print(f"Authenticated as {user['username']}")
    print(f"Role: {user['role']}")
```

---

## 🛡️ Security Features

✅ **Password Hashing** - werkzeug.security  
✅ **JWT Tokens** - Stateless authentication  
✅ **Token Expiration** - Access (24h), Refresh (30d)  
✅ **User Type Separation** - Mobile vs Dashboard  
✅ **Role-Based Access** - 4 permission levels  
✅ **Account Status** - Active/inactive control  
✅ **Verification Support** - Email/phone verification  
✅ **Last Login Tracking** - Audit trail  

---

## 📋 API Endpoints to Implement

### Mobile App Endpoints
```
POST   /api/mobile/register          - Create mobile user
POST   /api/mobile/login             - Authenticate mobile user
GET    /api/mobile/profile           - Get user profile (protected)
PUT    /api/mobile/profile           - Update profile (protected)
POST   /api/mobile/change-password   - Change password (protected)
POST   /api/mobile/verify-email      - Verify email (protected)
```

### Dashboard Endpoints
```
POST   /api/dashboard/login          - Authenticate dashboard user
GET    /api/dashboard/profile        - Get admin profile (protected)
POST   /api/dashboard/users          - Create dashboard user (admin)
GET    /api/dashboard/users          - List all users (admin/moderator)
GET    /api/dashboard/users/:id      - Get user details (admin/moderator)
PUT    /api/dashboard/users/:id      - Update user (admin)
DELETE /api/dashboard/users/:id      - Deactivate user (admin)
```

---

## 🎭 Role Permissions Matrix

| Action | User (Mobile) | Operator | Moderator | Admin |
|--------|---------------|----------|-----------|-------|
| Report Incident | ✅ | ❌ | ❌ | ❌ |
| View Own Reports | ✅ | ❌ | ❌ | ❌ |
| View All Incidents | ❌ | ✅ | ✅ | ✅ |
| Update Incident Status | ❌ | ✅ | ✅ | ✅ |
| Verify/Reject Reports | ❌ | ❌ | ✅ | ✅ |
| Manage Mobile Users | ❌ | ❌ | ✅ | ✅ |
| Manage Dashboard Users | ❌ | ❌ | ❌ | ✅ |
| System Configuration | ❌ | ❌ | ❌ | ✅ |
| View Analytics | ❌ | ✅ | ✅ | ✅ |

---

## ⚙️ Environment Variables

Copy `env_template.txt` to `.env` and configure:

```env
# Required
DB_NAME=safe_egypt_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Critical - Change this!
SECRET_KEY=generate-a-random-secret-key

# Optional (has defaults)
ACCESS_TOKEN_EXPIRE_MINUTES=1440  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS=30
```

Generate secure SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 🧪 Testing

Run the test script:
```bash
python test_user_auth.py
```

Tests:
1. ✅ Verify default admin
2. ✅ Create mobile user
3. ✅ Authenticate mobile user
4. ✅ Generate JWT tokens
5. ✅ Verify JWT tokens
6. ✅ Create dashboard operator
7. ✅ Test wrong password rejection
8. ✅ Test user type restrictions
9. ✅ Test password change

---

## 📚 Documentation

| Document | Content |
|----------|---------|
| **USER_SYSTEM_SETUP.md** | Complete setup guide with examples |
| **services/USER_AUTH_README.md** | Detailed API documentation & Flask examples |
| **USER_SYSTEM_SUMMARY.md** | This quick reference (you are here) |

---

## ✨ What's Next?

### Backend Tasks
- [ ] Create API endpoints (registration, login, profile)
- [ ] Add authentication middleware
- [ ] Implement role-based authorization
- [ ] Add email verification
- [ ] Add password reset
- [ ] Add rate limiting

### Mobile App Tasks
- [ ] Registration screen
- [ ] Login screen
- [ ] Token storage (secure)
- [ ] Profile screen
- [ ] Auto-logout on token expiry

### Dashboard Tasks
- [ ] Admin login page
- [ ] User management interface
- [ ] Role assignment
- [ ] Activity logs
- [ ] User statistics

---

## 🆘 Common Issues

**Can't login as admin**
→ Run `python models/setup_db.py` to create default admin

**ModuleNotFoundError**
→ Run `pip install -r requirements.txt`

**Invalid token**
→ Check SECRET_KEY is set in .env

**Database connection error**
→ Check .env database credentials

---

## 📞 Integration Example

```python
# app.py
from flask import Flask, request, jsonify
from services.auth import UserService, AuthService, get_current_user_from_token
import psycopg2

app = Flask(__name__)

def get_db():
    return psycopg2.connect(...)

@app.route('/api/mobile/register', methods=['POST'])
def register():
    data = request.json
    conn = get_db()
    user_service = UserService(conn)
    
    user = user_service.create_mobile_user(
        username=data['username'],
        email=data['email'],
        password=data['password'],
        full_name=data.get('full_name'),
        phone_number=data.get('phone_number')
    )
    
    tokens = AuthService.create_user_tokens(
        user['id'], user['username'], user['email'],
        user['user_type'], user['role']
    )
    
    conn.close()
    return jsonify({"user": user, "tokens": tokens}), 201

@app.route('/api/mobile/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db()
    user_service = UserService(conn)
    
    user = user_service.authenticate_user(
        data['username'],
        data['password'],
        'mobile'
    )
    
    if not user:
        conn.close()
        return jsonify({"error": "Invalid credentials"}), 401
    
    tokens = AuthService.create_user_tokens(
        user['id'], user['username'], user['email'],
        user['user_type'], user['role']
    )
    
    conn.close()
    return jsonify({"user": user, "tokens": tokens}), 200
```

---

**🎉 You're all set! The user system is ready to use.**

For detailed documentation, see `USER_SYSTEM_SETUP.md` and `services/USER_AUTH_README.md`.

