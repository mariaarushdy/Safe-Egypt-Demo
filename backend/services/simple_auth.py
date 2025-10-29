"""
Simplified Authentication Service
- App users: NO LOGIN, just profile creation (optional)
- Dashboard users: Simple login to approve/reject incidents
"""

import os
import jwt
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


class AppUserService:
    """Service for mobile app users (NO LOGIN REQUIRED)"""
    
    def __init__(self, db_connection):
        self.conn = db_connection
        self.cur = self.conn.cursor()
    
    def create_or_get_profile(self, national_id: str, full_name: str, 
                              contact_info: str, device_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new app user profile or return existing one.
        This is called when user first provides their info in the app.
        """
        try:
            # Check if user already exists by national_id
            self.cur.execute("""
                SELECT id, national_id, full_name, contact_info, device_id, created_at
                FROM app_users
                WHERE national_id = %s;
            """, (national_id,))
            
            existing_user = self.cur.fetchone()
            
            if existing_user:
                # Update device_id if provided and different
                if device_id and existing_user[4] != device_id:
                    self.cur.execute("""
                        UPDATE app_users SET device_id = %s
                        WHERE id = %s;
                    """, (device_id, existing_user[0]))
                    self.conn.commit()
                
                return {
                    "id": existing_user[0],
                    "national_id": existing_user[1],
                    "full_name": existing_user[2],
                    "contact_info": existing_user[3],
                    "device_id": device_id if device_id else existing_user[4],
                    "created_at": existing_user[5].isoformat() if existing_user[5] else None,
                    "is_new": False
                }
            
            # Create new user
            self.cur.execute("""
                INSERT INTO app_users (national_id, full_name, contact_info, device_id)
                VALUES (%s, %s, %s, %s)
                RETURNING id, national_id, full_name, contact_info, device_id, created_at;
            """, (national_id, full_name, contact_info, device_id))
            
            user = self.cur.fetchone()
            self.conn.commit()
            
            return {
                "id": user[0],
                "national_id": user[1],
                "full_name": user[2],
                "contact_info": user[3],
                "device_id": user[4],
                "created_at": user[5].isoformat() if user[5] else None,
                "is_new": True
            }
        except Exception as e:
            self.conn.rollback()
            raise Exception(f"Failed to create/get app user profile: {str(e)}")
    
    def get_profile_by_national_id(self, national_id: str) -> Optional[Dict[str, Any]]:
        """Get app user profile by national ID"""
        try:
            self.cur.execute("""
                SELECT id, national_id, full_name, contact_info, device_id, created_at
                FROM app_users
                WHERE national_id = %s;
            """, (national_id,))
            
            user = self.cur.fetchone()
            if not user:
                return None
            
            return {
                "id": user[0],
                "national_id": user[1],
                "full_name": user[2],
                "contact_info": user[3],
                "device_id": user[4],
                "created_at": user[5].isoformat() if user[5] else None
            }
        except Exception as e:
            print(f"Error fetching app user: {str(e)}")
            return None
    
    def get_profile_by_device_id(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get app user profile by device ID"""
        try:
            self.cur.execute("""
                SELECT id, national_id, full_name, contact_info, device_id, created_at
                FROM app_users
                WHERE device_id = %s;
            """, (device_id,))
            
            user = self.cur.fetchone()
            if not user:
                return None
            
            return {
                "id": user[0],
                "national_id": user[1],
                "full_name": user[2],
                "contact_info": user[3],
                "device_id": user[4],
                "created_at": user[5].isoformat() if user[5] else None
            }
        except Exception as e:
            print(f"Error fetching app user: {str(e)}")
            return None


class DashboardAuthService:
    """Service for dashboard users (SIMPLE LOGIN)"""
    
    def __init__(self, db_connection):
        self.conn = db_connection
        self.cur = self.conn.cursor()
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password"""
        return generate_password_hash(password)
    
    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify a password"""
        return check_password_hash(password_hash, password)
    
    @staticmethod
    def create_token(user_id: int, username: str, full_name: str) -> str:
        """Create a JWT token for dashboard user"""
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        token_data = {
            "user_id": user_id,
            "username": username,
            "full_name": full_name,
            "user_type": "dashboard",
            "exp": expire,
            "iat": datetime.utcnow()
        }
        return jwt.encode(token_data, SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def create_dashboard_user(self, username: str, password: str, 
                             full_name: str) -> Dict[str, Any]:
        """Create a new dashboard user"""
        try:
            password_hash = self.hash_password(password)
            
            self.cur.execute("""
                INSERT INTO dashboard_users (username, password_hash, full_name, is_active)
                VALUES (%s, %s, %s, TRUE)
                RETURNING id, username, full_name, is_active, created_at;
            """, (username, password_hash, full_name))
            
            user = self.cur.fetchone()
            self.conn.commit()
            
            return {
                "id": user[0],
                "username": user[1],
                "full_name": user[2],
                "is_active": user[3],
                "created_at": user[4].isoformat() if user[4] else None
            }
        except Exception as e:
            self.conn.rollback()
            raise Exception(f"Failed to create dashboard user: {str(e)}")
    
    def login(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Authenticate a dashboard user and return user data + token
        """
        try:
            self.cur.execute("""
                SELECT id, username, password_hash, full_name, is_active
                FROM dashboard_users
                WHERE username = %s;
            """, (username,))
            
            user = self.cur.fetchone()
            
            if not user:
                return None
            
            # Check if user is active
            if not user[4]:
                return None
            
            # Verify password
            if not self.verify_password(password, user[2]):
                return None
            
            # Update last login
            self.cur.execute("""
                UPDATE dashboard_users SET last_login = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (user[0],))
            self.conn.commit()
            
            # Create token
            token = self.create_token(user[0], user[1], user[3])
            
            return {
                "id": user[0],
                "username": user[1],
                "full_name": user[3],
                "is_active": user[4],
                "token": token
            }
        except Exception as e:
            print(f"Login error: {str(e)}")
            return None
    
    def get_user_from_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Extract user from JWT token"""
        payload = self.verify_token(token)
        if not payload:
            return None
        
        try:
            self.cur.execute("""
                SELECT id, username, full_name, is_active, created_at, last_login
                FROM dashboard_users
                WHERE id = %s AND is_active = TRUE;
            """, (payload['user_id'],))
            
            user = self.cur.fetchone()
            if not user:
                return None
            
            return {
                "id": user[0],
                "username": user[1],
                "full_name": user[2],
                "is_active": user[3],
                "created_at": user[4].isoformat() if user[4] else None,
                "last_login": user[5].isoformat() if user[5] else None
            }
        except Exception as e:
            print(f"Error fetching user: {str(e)}")
            return None
    
    def change_password(self, user_id: int, old_password: str, 
                       new_password: str) -> bool:
        """Change dashboard user password"""
        try:
            self.cur.execute("""
                SELECT password_hash FROM dashboard_users WHERE id = %s;
            """, (user_id,))
            
            result = self.cur.fetchone()
            if not result:
                return False
            
            # Verify old password
            if not self.verify_password(old_password, result[0]):
                return False
            
            # Update with new password
            new_password_hash = self.hash_password(new_password)
            self.cur.execute("""
                UPDATE dashboard_users SET password_hash = %s
                WHERE id = %s;
            """, (new_password_hash, user_id))
            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            print(f"Error changing password: {str(e)}")
            return False


class IncidentService:
    """Service for managing incidents"""
    
    def __init__(self, db_connection):
        self.conn = db_connection
        self.cur = self.conn.cursor()
    
    def update_status(self, incident_id: str, status: str, 
                     dashboard_user_id: int) -> bool:
        """
        Update incident status (approve/reject)
        Status can be: 'pending', 'approved', 'rejected'
        """
        try:
            valid_statuses = ['pending', 'approved', 'rejected']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status. Must be one of: {valid_statuses}")
            
            self.cur.execute("""
                UPDATE incidents 
                SET status = %s, verified = %s
                WHERE incident_id = %s;
            """, (status, status, incident_id))
            
            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            print(f"Error updating incident status: {str(e)}")
            return False

