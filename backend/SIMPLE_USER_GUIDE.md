# 📱 Simple User System Guide

## Overview

This is a **simplified user system** with:

1. **App Users (Mobile)** - NO LOGIN REQUIRED
   - Optional profile creation
   - National ID, Full Name, Contact Info
   - Profile automatically linked to device
   - Can report incidents anonymously OR with profile

2. **Dashboard Users** - Simple login
   - All dashboard users can approve/reject any incident
   - No complex roles or permissions

---

## 📊 Database Structure

### App Users Table
```sql
CREATE TABLE app_users (
    id                SERIAL PRIMARY KEY,
    national_id       VARCHAR(50) UNIQUE NOT NULL,
    full_name         VARCHAR(255) NOT NULL,
    contact_info      VARCHAR(255) NOT NULL,
    device_id         VARCHAR(255),
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Dashboard Users Table
```sql
CREATE TABLE dashboard_users (
    id                SERIAL PRIMARY KEY,
    username          VARCHAR(100) UNIQUE NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    full_name         VARCHAR(255) NOT NULL,
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login        TIMESTAMP
);
```

### Incidents Table (Updated)
```sql
CREATE TABLE incidents (
    incident_id       UUID PRIMARY KEY,
    app_user_id       INT REFERENCES app_users(id),  -- NULL for anonymous
    status            TEXT DEFAULT 'pending',
    -- ... other fields
);
```

---

## 🚀 Quick Start

### 1. Setup Database

```bash
python models/setup_db.py
```

Creates:
- ✅ app_users table
- ✅ dashboard_users table
- ✅ Default dashboard user (username: admin, password: Admin@123)

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 💻 Usage Examples

### Mobile App: Create/Get User Profile (Optional)

```python
from services.simple_auth import AppUserService
import psycopg2

conn = psycopg2.connect(...)
app_user_service = AppUserService(conn)

# When user provides their info (optional)
user_profile = app_user_service.create_or_get_profile(
    national_id="29912010101234",  # Egyptian National ID
    full_name="Ahmed Mohamed Ali",
    contact_info="+201234567890",  # Phone or email
    device_id="device-unique-id-12345"  # From device
)

# Returns existing profile if national_id already exists
print(f"User ID: {user_profile['id']}")
print(f"Is New: {user_profile['is_new']}")

# Store user_profile['id'] locally on device
# Use it for future incident reports
```

### Mobile App: Get Profile by Device ID

```python
# On app startup, check if user already has a profile
device_id = get_device_id()  # Your device ID function
user_profile = app_user_service.get_profile_by_device_id(device_id)

if user_profile:
    print(f"Welcome back, {user_profile['full_name']}!")
    # User already has a profile
else:
    print("You can create a profile or report anonymously")
```

### Mobile App: Report Incident (Anonymous)

```python
import uuid

incident_id = str(uuid.uuid4())

cursor.execute("""
    INSERT INTO incidents (
        incident_id, 
        app_user_id,  -- NULL for anonymous
        category, 
        description, 
        location_id,
        timestamp
    ) VALUES (%s, NULL, %s, %s, %s, %s);
""", (incident_id, "violence", "Description here", location_id, datetime.now()))

conn.commit()
```

### Mobile App: Report Incident (With Profile)

```python
# If user has a profile
cursor.execute("""
    INSERT INTO incidents (
        incident_id, 
        app_user_id,  -- Link to user profile
        category, 
        description, 
        location_id,
        timestamp
    ) VALUES (%s, %s, %s, %s, %s, %s);
""", (incident_id, user_profile['id'], "violence", "Description", location_id, datetime.now()))

conn.commit()
```

### Dashboard: Login

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
    print(f"Login successful!")
    print(f"Token: {result['token']}")
    # Store token for API requests
else:
    print("Invalid credentials")
```

### Dashboard: Verify Token (Middleware)

```python
# In your API endpoint
auth_header = request.headers.get('Authorization')
if auth_header and auth_header.startswith('Bearer '):
    token = auth_header.split(' ')[1]
    
    dashboard_auth = DashboardAuthService(conn)
    user = dashboard_auth.get_user_from_token(token)
    
    if user:
        # Valid dashboard user
        print(f"Authenticated as: {user['username']}")
    else:
        # Invalid token
        return jsonify({"error": "Unauthorized"}), 401
```

### Dashboard: Approve/Reject Incident

```python
from services.simple_auth import IncidentService

conn = psycopg2.connect(...)
incident_service = IncidentService(conn)

# Approve incident
success = incident_service.update_status(
    incident_id="123e4567-e89b-12d3-a456-426614174000",
    status="approved",  # or "rejected" or "pending"
    dashboard_user_id=1
)

if success:
    print("Incident approved!")
```

### Dashboard: Create New Dashboard User

```python
dashboard_auth = DashboardAuthService(conn)

new_user = dashboard_auth.create_dashboard_user(
    username="operator1",
    password="SecurePass123!",
    full_name="Mohamed Hassan"
)

print(f"Dashboard user created: {new_user['username']}")
```

---

## 🔄 Complete Flow Examples

### Flow 1: First-time App User Reports Incident

```python
# 1. User opens app (no profile yet)
device_id = "device-abc123"
app_user_service = AppUserService(conn)

profile = app_user_service.get_profile_by_device_id(device_id)
if not profile:
    print("No profile found - User can report anonymously or create profile")

# 2. User decides to create profile (OPTIONAL)
profile = app_user_service.create_or_get_profile(
    national_id="29912010101234",
    full_name="Ahmed Ali",
    contact_info="+201234567890",
    device_id=device_id
)
print(f"Profile created! ID: {profile['id']}")

# 3. User reports incident with profile
incident_id = str(uuid.uuid4())
cursor.execute("""
    INSERT INTO incidents (incident_id, app_user_id, category, description, timestamp)
    VALUES (%s, %s, %s, %s, %s);
""", (incident_id, profile['id'], "crime", "Theft reported", datetime.now()))
conn.commit()
```

### Flow 2: Returning App User

```python
# 1. User opens app
device_id = "device-abc123"
app_user_service = AppUserService(conn)

# 2. Check if profile exists
profile = app_user_service.get_profile_by_device_id(device_id)

if profile:
    print(f"Welcome back, {profile['full_name']}!")
    # Auto-link incidents to this profile
    user_id = profile['id']
else:
    print("No profile - report anonymously or create profile")
    user_id = None

# 3. Report incident (automatically linked if profile exists)
incident_id = str(uuid.uuid4())
cursor.execute("""
    INSERT INTO incidents (incident_id, app_user_id, category, description, timestamp)
    VALUES (%s, %s, %s, %s, %s);
""", (incident_id, user_id, "accident", "Car accident", datetime.now()))
conn.commit()
```

### Flow 3: Dashboard User Manages Incidents

```python
# 1. Dashboard user logs in
dashboard_auth = DashboardAuthService(conn)
result = dashboard_auth.login("admin", "Admin@123")

if not result:
    print("Login failed")
    exit()

token = result['token']
print(f"Logged in as: {result['username']}")

# 2. In API requests, verify token
user = dashboard_auth.get_user_from_token(token)
if not user:
    print("Invalid token")
    exit()

# 3. Get pending incidents
cursor.execute("""
    SELECT incident_id, category, description, status, app_user_id
    FROM incidents 
    WHERE status = 'pending'
    ORDER BY timestamp DESC;
""")
incidents = cursor.fetchall()

# 4. Approve or reject incidents
incident_service = IncidentService(conn)

for incident in incidents:
    incident_id = incident[0]
    
    # Dashboard user reviews and decides
    decision = "approved"  # or "rejected"
    
    incident_service.update_status(
        incident_id=incident_id,
        status=decision,
        dashboard_user_id=user['id']
    )
    print(f"Incident {incident_id} {decision}")
```

---

## 📱 Flask API Example

```python
from flask import Flask, request, jsonify
from services.simple_auth import AppUserService, DashboardAuthService, IncidentService
import psycopg2
import os

app = Flask(__name__)

def get_db():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST")
    )

# ============ APP USER ENDPOINTS (NO AUTH) ============

@app.route('/api/app/profile', methods=['POST'])
def create_app_profile():
    """Create or get app user profile - NO LOGIN REQUIRED"""
    data = request.json
    conn = get_db()
    app_user_service = AppUserService(conn)
    
    try:
        profile = app_user_service.create_or_get_profile(
            national_id=data['national_id'],
            full_name=data['full_name'],
            contact_info=data['contact_info'],
            device_id=data.get('device_id')
        )
        conn.close()
        return jsonify(profile), 200
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400

@app.route('/api/app/profile/device/<device_id>', methods=['GET'])
def get_profile_by_device(device_id):
    """Get profile by device ID"""
    conn = get_db()
    app_user_service = AppUserService(conn)
    
    profile = app_user_service.get_profile_by_device_id(device_id)
    conn.close()
    
    if profile:
        return jsonify(profile), 200
    else:
        return jsonify({"message": "No profile found"}), 404

@app.route('/api/app/incidents', methods=['POST'])
def report_incident():
    """Report incident - with or without user profile"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        import uuid
        incident_id = str(uuid.uuid4())
        
        cursor.execute("""
            INSERT INTO incidents (
                incident_id, app_user_id, category, description, 
                latitude, longitude, timestamp
            ) VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING incident_id;
        """, (
            incident_id,
            data.get('app_user_id'),  # Can be None for anonymous
            data['category'],
            data['description'],
            data['latitude'],
            data['longitude']
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            "message": "Incident reported successfully",
            "incident_id": incident_id
        }), 201
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({"error": str(e)}), 400

# ============ DASHBOARD ENDPOINTS (REQUIRES AUTH) ============

@app.route('/api/dashboard/login', methods=['POST'])
def dashboard_login():
    """Dashboard user login"""
    data = request.json
    conn = get_db()
    dashboard_auth = DashboardAuthService(conn)
    
    result = dashboard_auth.login(
        username=data['username'],
        password=data['password']
    )
    
    conn.close()
    
    if result:
        return jsonify(result), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/dashboard/incidents', methods=['GET'])
def get_incidents():
    """Get all incidents (requires dashboard auth)"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Unauthorized"}), 401
    
    token = auth_header.split(' ')[1]
    conn = get_db()
    dashboard_auth = DashboardAuthService(conn)
    
    user = dashboard_auth.get_user_from_token(token)
    if not user:
        conn.close()
        return jsonify({"error": "Invalid token"}), 401
    
    # Get incidents
    cursor = conn.cursor()
    status_filter = request.args.get('status', 'pending')
    
    cursor.execute("""
        SELECT i.incident_id, i.category, i.description, i.status, 
               i.timestamp, a.full_name, a.contact_info
        FROM incidents i
        LEFT JOIN app_users a ON i.app_user_id = a.id
        WHERE i.status = %s
        ORDER BY i.timestamp DESC;
    """, (status_filter,))
    
    incidents = []
    for row in cursor.fetchall():
        incidents.append({
            "incident_id": str(row[0]),
            "category": row[1],
            "description": row[2],
            "status": row[3],
            "timestamp": row[4].isoformat() if row[4] else None,
            "reporter_name": row[5],
            "reporter_contact": row[6]
        })
    
    cursor.close()
    conn.close()
    
    return jsonify({"incidents": incidents}), 200

@app.route('/api/dashboard/incidents/<incident_id>/status', methods=['PUT'])
def update_incident_status(incident_id):
    """Approve or reject incident (requires dashboard auth)"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Unauthorized"}), 401
    
    token = auth_header.split(' ')[1]
    conn = get_db()
    dashboard_auth = DashboardAuthService(conn)
    
    user = dashboard_auth.get_user_from_token(token)
    if not user:
        conn.close()
        return jsonify({"error": "Invalid token"}), 401
    
    # Update status
    data = request.json
    incident_service = IncidentService(conn)
    
    success = incident_service.update_status(
        incident_id=incident_id,
        status=data['status'],  # 'approved' or 'rejected'
        dashboard_user_id=user['id']
    )
    
    conn.close()
    
    if success:
        return jsonify({"message": "Status updated successfully"}), 200
    else:
        return jsonify({"error": "Failed to update status"}), 400

if __name__ == '__main__':
    app.run(debug=True)
```

---

## 🔑 Default Dashboard User

```
Username: admin
Password: Admin@123
```

**⚠️ Change this password after first login!**

---

## ✅ Key Points

1. **App users DON'T need to login** - Profile creation is optional
2. **Anonymous reporting is allowed** - app_user_id can be NULL
3. **Profile is auto-linked** - Using device_id or national_id
4. **Dashboard users need login** - Simple username/password
5. **All dashboard users have same permissions** - Can approve/reject any incident
6. **Incident status**: pending → approved/rejected

---

## 📝 Notes

- **National ID**: Egyptian national ID (14 digits)
- **Contact Info**: Phone number or email
- **Device ID**: Unique identifier from mobile device
- **Anonymous Reporting**: Leave app_user_id as NULL
- **Profile Creation**: Optional, can report without profile
- **Dashboard Access**: All dashboard users can manage all incidents

---

## 🧪 Testing

Run the setup:
```bash
python models/setup_db.py
```

Test with Python:
```python
from services.simple_auth import AppUserService, DashboardAuthService
import psycopg2

conn = psycopg2.connect(...)

# Test app user
app_service = AppUserService(conn)
profile = app_service.create_or_get_profile(
    national_id="29912010101234",
    full_name="Ahmed Ali",
    contact_info="+201234567890",
    device_id="test-device-123"
)
print(f"Profile: {profile}")

# Test dashboard login
dash_service = DashboardAuthService(conn)
result = dash_service.login("admin", "Admin@123")
print(f"Login: {result}")

conn.close()
```

That's it! Simple and straightforward. 🎉

