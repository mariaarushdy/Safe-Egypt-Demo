# 📱 Simplified User System - Complete Guide

## 🎯 System Overview

This is a **simple, straightforward** user system with:

### ✅ What You Have

1. **App Users (Mobile)**
   - ❌ **NO LOGIN REQUIRED**
   - ✅ Optional profile: National ID, Full Name, Contact Info
   - ✅ Profile auto-linked to device
   - ✅ Can report anonymously OR with profile

2. **Dashboard Users**
   - ✅ Simple username/password login
   - ✅ **All users have same permissions**
   - ✅ Can approve/reject any incident

### ❌ What You DON'T Have (Removed Complexity)

- ~~Multiple roles (admin/moderator/operator)~~
- ~~Email verification~~
- ~~Phone verification~~
- ~~Password reset~~
- ~~Mobile user login~~
- ~~Complex JWT refresh tokens~~

---

## 📁 Files Structure

### ✅ Use These Files (Simplified System)

```
backend/
├── models/
│   ├── setup_db.py              ✅ Creates simplified tables
│   └── simple_database.py       ✅ SQLAlchemy models
│
├── services/
│   └── simple_auth.py           ✅ Simplified auth service
│
├── test_simple_auth.py          ✅ Test script
├── SIMPLE_USER_GUIDE.md         📖 Complete usage guide
├── SIMPLIFIED_SYSTEM.md         📖 This file
└── requirements.txt             ✅ Dependencies
```

### ⚠️ Ignore These Files (Old Complex System)

```
backend/
├── services/
│   ├── auth.py                  ❌ Old complex auth (ignore)
│   └── USER_AUTH_README.md      ❌ Old docs (ignore)
│
├── models/
│   └── database.py              ❌ Old models (ignore)
│
├── test_user_auth.py            ❌ Old tests (ignore)
├── USER_SYSTEM_SETUP.md         ❌ Old guide (ignore)
├── USER_SYSTEM_SUMMARY.md       ❌ Old summary (ignore)
└── USER_ARCHITECTURE.txt        ❌ Old architecture (ignore)
```

---

## 🗄️ Database Tables

### Table 1: `app_users` (Mobile - NO LOGIN)

```sql
CREATE TABLE app_users (
    id              SERIAL PRIMARY KEY,
    national_id     VARCHAR(50) UNIQUE NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    contact_info    VARCHAR(255) NOT NULL,
    device_id       VARCHAR(255),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Store optional profile info for mobile users

### Table 2: `dashboard_users` (Dashboard - Simple Login)

```sql
CREATE TABLE dashboard_users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login      TIMESTAMP
);
```

**Purpose:** Dashboard staff who manage incidents

### Table 3: `incidents` (Updated)

```sql
CREATE TABLE incidents (
    incident_id     UUID PRIMARY KEY,
    app_user_id     INT REFERENCES app_users(id),  -- NULL for anonymous
    status          TEXT DEFAULT 'pending',         -- pending/approved/rejected
    -- ... other fields
);
```

**Key:** `app_user_id` can be NULL for anonymous reports

---

## 🚀 Quick Start (3 Steps)

### Step 1: Setup Database

```bash
cd backend
python models/setup_db.py
```

**Creates:**
- ✅ `app_users` table
- ✅ `dashboard_users` table  
- ✅ Default admin (username: `admin`, password: `Admin@123`)

### Step 2: Test System

```bash
python test_simple_auth.py
```

**Tests:**
- ✅ App user profile creation
- ✅ Anonymous reporting
- ✅ Dashboard login
- ✅ Approve/reject incidents

### Step 3: Start Using!

Import the services:
```python
from services.simple_auth import AppUserService, DashboardAuthService, IncidentService
```

---

## 💻 How It Works

### Mobile App Flow

```
┌─────────────────────────────────────────────────────────┐
│  User Opens App                                          │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Check if profile exists (by device_id)                  │
│  • If YES → Auto-link future reports                     │
│  • If NO  → Can report anonymously or create profile     │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  User Reports Incident                                   │
│  • With profile: app_user_id = profile.id                │
│  • Anonymous: app_user_id = NULL                         │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Incident saved with status = 'pending'                  │
└─────────────────────────────────────────────────────────┘
```

### Dashboard Flow

```
┌─────────────────────────────────────────────────────────┐
│  User Logs In (username/password)                        │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Get JWT Token (valid for 24 hours)                      │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  View All Incidents (pending/approved/rejected)          │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Approve or Reject Incident                              │
│  • status: pending → approved                            │
│  • status: pending → rejected                            │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Code Examples

### Example 1: App User Creates Profile (Optional)

```python
from services.simple_auth import AppUserService
import psycopg2

conn = psycopg2.connect(...)
app_service = AppUserService(conn)

# User provides their info (OPTIONAL)
profile = app_service.create_or_get_profile(
    national_id="29912010101234",      # Egyptian National ID
    full_name="Ahmed Mohamed Ali",
    contact_info="+201234567890",      # Phone number
    device_id="device-abc-123"         # Unique device ID
)

# Save profile ID locally on device
save_to_local_storage("user_profile_id", profile['id'])

conn.close()
```

### Example 2: Report Incident (Anonymous)

```python
import uuid
from datetime import datetime

conn = psycopg2.connect(...)
cursor = conn.cursor()

# NO PROFILE NEEDED
incident_id = str(uuid.uuid4())

cursor.execute("""
    INSERT INTO incidents (
        incident_id, 
        app_user_id,    -- NULL for anonymous
        category, 
        description, 
        timestamp,
        status
    ) VALUES (%s, NULL, %s, %s, %s, 'pending');
""", (incident_id, "crime", "Theft in downtown", datetime.now()))

conn.commit()
cursor.close()
conn.close()

print(f"Anonymous incident reported: {incident_id}")
```

### Example 3: Report Incident (With Profile)

```python
# User has a profile
user_profile_id = get_from_local_storage("user_profile_id")

if user_profile_id:
    cursor.execute("""
        INSERT INTO incidents (
            incident_id, 
            app_user_id,    -- Link to user profile
            category, 
            description, 
            timestamp,
            status
        ) VALUES (%s, %s, %s, %s, %s, 'pending');
    """, (incident_id, user_profile_id, "accident", "Car crash", datetime.now()))
    
    conn.commit()
    print("Incident reported with profile")
```

### Example 4: Dashboard Login

```python
from services.simple_auth import DashboardAuthService

conn = psycopg2.connect(...)
dashboard_auth = DashboardAuthService(conn)

# Login
result = dashboard_auth.login(
    username="admin",
    password="Admin@123"
)

if result:
    print(f"✅ Logged in as: {result['username']}")
    print(f"Token: {result['token']}")
    
    # Store token for API requests
    token = result['token']
else:
    print("❌ Invalid credentials")

conn.close()
```

### Example 5: Approve/Reject Incident

```python
from services.simple_auth import DashboardAuthService, IncidentService

conn = psycopg2.connect(...)
dashboard_auth = DashboardAuthService(conn)
incident_service = IncidentService(conn)

# Verify token first
user = dashboard_auth.get_user_from_token(token)

if user:
    # Approve incident
    success = incident_service.update_status(
        incident_id="123e4567-e89b-12d3-a456-426614174000",
        status="approved",      # or "rejected"
        dashboard_user_id=user['id']
    )
    
    if success:
        print("✅ Incident approved")
else:
    print("❌ Invalid token")

conn.close()
```

---

## 🔑 Default Dashboard User

After running `setup_db.py`:

```
Username: admin
Password: Admin@123
```

**⚠️ Change this password immediately!**

To change password:
```python
dashboard_auth.change_password(
    user_id=1,
    old_password="Admin@123",
    new_password="YourNewSecurePassword123!"
)
```

---

## 🌐 Flask API Example (Complete)

```python
from flask import Flask, request, jsonify
from services.simple_auth import AppUserService, DashboardAuthService, IncidentService
import psycopg2
import os
import uuid
from datetime import datetime

app = Flask(__name__)

def get_db():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST")
    )

# ========== MOBILE APP ENDPOINTS ==========

@app.route('/api/app/profile', methods=['POST'])
def create_profile():
    """Create or get app user profile - NO AUTH REQUIRED"""
    data = request.json
    conn = get_db()
    service = AppUserService(conn)
    
    profile = service.create_or_get_profile(
        national_id=data['national_id'],
        full_name=data['full_name'],
        contact_info=data['contact_info'],
        device_id=data.get('device_id')
    )
    
    conn.close()
    return jsonify(profile), 200

@app.route('/api/app/profile/<device_id>', methods=['GET'])
def get_profile(device_id):
    """Check if profile exists for device"""
    conn = get_db()
    service = AppUserService(conn)
    profile = service.get_profile_by_device_id(device_id)
    conn.close()
    
    if profile:
        return jsonify(profile), 200
    return jsonify({"message": "No profile found"}), 404

@app.route('/api/app/incidents', methods=['POST'])
def report_incident():
    """Report incident - anonymous or with profile"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    incident_id = str(uuid.uuid4())
    
    cursor.execute("""
        INSERT INTO incidents (
            incident_id, app_user_id, category, description, 
            severity, timestamp, status
        ) VALUES (%s, %s, %s, %s, %s, %s, 'pending');
    """, (
        incident_id,
        data.get('app_user_id'),  # Can be None
        data['category'],
        data['description'],
        data.get('severity', 'medium'),
        datetime.now()
    ))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({"incident_id": incident_id}), 201

# ========== DASHBOARD ENDPOINTS ==========

@app.route('/api/dashboard/login', methods=['POST'])
def dashboard_login():
    """Dashboard login"""
    data = request.json
    conn = get_db()
    service = DashboardAuthService(conn)
    
    result = service.login(data['username'], data['password'])
    conn.close()
    
    if result:
        return jsonify(result), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/dashboard/incidents', methods=['GET'])
def get_incidents():
    """Get incidents - REQUIRES AUTH"""
    # Verify token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Unauthorized"}), 401
    
    token = auth_header.split(' ')[1]
    conn = get_db()
    auth_service = DashboardAuthService(conn)
    user = auth_service.get_user_from_token(token)
    
    if not user:
        conn.close()
        return jsonify({"error": "Invalid token"}), 401
    
    # Get incidents
    cursor = conn.cursor()
    status = request.args.get('status', 'pending')
    
    cursor.execute("""
        SELECT i.incident_id, i.category, i.description, 
               i.status, i.timestamp, a.full_name, a.contact_info
        FROM incidents i
        LEFT JOIN app_users a ON i.app_user_id = a.id
        WHERE i.status = %s
        ORDER BY i.timestamp DESC;
    """, (status,))
    
    incidents = []
    for row in cursor.fetchall():
        incidents.append({
            "incident_id": str(row[0]),
            "category": row[1],
            "description": row[2],
            "status": row[3],
            "timestamp": row[4].isoformat() if row[4] else None,
            "reporter_name": row[5] if row[5] else "Anonymous",
            "reporter_contact": row[6] if row[6] else None
        })
    
    cursor.close()
    conn.close()
    return jsonify({"incidents": incidents}), 200

@app.route('/api/dashboard/incidents/<incident_id>/status', methods=['PUT'])
def update_status(incident_id):
    """Approve/reject incident - REQUIRES AUTH"""
    # Verify token
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    
    token = auth_header.split(' ')[1]
    conn = get_db()
    auth_service = DashboardAuthService(conn)
    user = auth_service.get_user_from_token(token)
    
    if not user:
        conn.close()
        return jsonify({"error": "Invalid token"}), 401
    
    # Update status
    data = request.json
    incident_service = IncidentService(conn)
    success = incident_service.update_status(
        incident_id=incident_id,
        status=data['status'],  # "approved" or "rejected"
        dashboard_user_id=user['id']
    )
    
    conn.close()
    
    if success:
        return jsonify({"message": "Status updated"}), 200
    return jsonify({"error": "Failed"}), 400

if __name__ == '__main__':
    app.run(debug=True, port=8000)
```

---

## ✅ Key Features

| Feature | App Users | Dashboard Users |
|---------|-----------|-----------------|
| **Login Required** | ❌ NO | ✅ YES |
| **Profile Creation** | ✅ Optional | ✅ Admin creates |
| **Report Incidents** | ✅ YES | ❌ NO |
| **Approve/Reject** | ❌ NO | ✅ YES |
| **Anonymous Reports** | ✅ YES | N/A |

---

## 📋 Testing Checklist

Run the test script:
```bash
python test_simple_auth.py
```

**Should test:**
- ✅ Create app user profile
- ✅ Get existing profile
- ✅ Anonymous incident reporting
- ✅ Incident with profile
- ✅ Dashboard login
- ✅ Approve incident
- ✅ Reject incident
- ✅ Token verification

---

## 🎯 Summary

**This is a SIMPLE system:**

1. **Mobile users** = NO LOGIN, optional profile with National ID + Name + Contact
2. **Dashboard users** = Simple login, all can approve/reject
3. **Anonymous reporting** = Allowed (app_user_id = NULL)
4. **Profile linking** = Automatic via device_id
5. **No complex roles** = All dashboard users have same permissions

**That's it! Simple and straightforward.** 🎉

---

## 📞 Need Help?

- **Setup Guide**: See `SIMPLE_USER_GUIDE.md`
- **Test Script**: Run `python test_simple_auth.py`
- **API Examples**: Above in Flask section

---

**Default Admin:**
- Username: `admin`
- Password: `Admin@123`
- ⚠️ **CHANGE THIS PASSWORD!**

