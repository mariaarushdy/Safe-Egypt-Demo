"""
Authentication and User Management Service
Handles user registration, login, and authentication for both mobile and dashboard users
"""

import os
import jwt
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 30  # 30 days


class AuthService:
    """Service for handling authentication operations"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password for storing."""
        return generate_password_hash(password)
    
    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify a stored password against one provided by user"""
        return check_password_hash(password_hash, password)
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(data: dict) -> str:
        """Create a JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_ALGORITHM)
        return encoded_jwt
    
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
    
    @staticmethod
    def create_user_tokens(user_id: int, username: str, email: str, 
                          user_type: str, role: str) -> Dict[str, str]:
        """Create both access and refresh tokens for a user"""
        token_data = {
            "user_id": user_id,
            "username": username,
            "email": email,
            "user_type": user_type,
            "role": role
        }
        
        access_token = AuthService.create_access_token(token_data)
        refresh_token = AuthService.create_refresh_token(token_data)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }


class UserService:
    """Service for user management operations"""
    
    def __init__(self, db_connection):
        """Initialize with database connection"""
        self.conn = db_connection
        self.cur = self.conn.cursor()
    
    def create_mobile_user(self, username: str, email: str, password: str, 
                          full_name: Optional[str] = None, 
                          phone_number: Optional[str] = None) -> Dict[str, Any]:
        """Create a new mobile app user"""
        try:
            password_hash = AuthService.hash_password(password)
            
            self.cur.execute("""
                INSERT INTO users (username, email, password_hash, full_name, phone_number, 
                                 user_type, role, is_active, is_verified)
                VALUES (%s, %s, %s, %s, %s, 'mobile', 'user', TRUE, FALSE)
                RETURNING id, username, email, full_name, phone_number, user_type, role, 
                          is_active, created_at;
            """, (username, email, password_hash, full_name, phone_number))
            
            user = self.cur.fetchone()
            self.conn.commit()
            
            return {
                "id": user[0],
                "username": user[1],
                "email": user[2],
                "full_name": user[3],
                "phone_number": user[4],
                "user_type": user[5],
                "role": user[6],
                "is_active": user[7],
                "created_at": user[8].isoformat() if user[8] else None
            }
        except Exception as e:
            self.conn.rollback()
            raise Exception(f"Failed to create mobile user: {str(e)}")
    
    def create_dashboard_user(self, username: str, email: str, password: str,
                             full_name: str, role: str = 'operator') -> Dict[str, Any]:
        """Create a new dashboard user (admin, moderator, or operator)"""
        valid_roles = ['admin', 'moderator', 'operator']
        if role not in valid_roles:
            raise ValueError(f"Invalid role. Must be one of: {valid_roles}")
        
        try:
            password_hash = AuthService.hash_password(password)
            
            self.cur.execute("""
                INSERT INTO users (username, email, password_hash, full_name, 
                                 user_type, role, is_active, is_verified)
                VALUES (%s, %s, %s, %s, 'dashboard', %s, TRUE, TRUE)
                RETURNING id, username, email, full_name, user_type, role, 
                          is_active, created_at;
            """, (username, email, password_hash, full_name, role))
            
            user = self.cur.fetchone()
            self.conn.commit()
            
            return {
                "id": user[0],
                "username": user[1],
                "email": user[2],
                "full_name": user[3],
                "user_type": user[4],
                "role": user[5],
                "is_active": user[6],
                "created_at": user[7].isoformat() if user[7] else None
            }
        except Exception as e:
            self.conn.rollback()
            raise Exception(f"Failed to create dashboard user: {str(e)}")
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate a dashboard user by username and password"""
        try:
            query = """
                SELECT id, username, password_hash, full_name, is_active, last_login
                FROM dashboard_users
                WHERE username = %s
            """
            params = [username]
            self.cur.execute(query, params)
            user = self.cur.fetchone()
            if not user:
                return None
            # Check if user is active
            if not user[4]:  # is_active
                return None
            # Verify password (password_hash is at index 2)
            if not AuthService.verify_password(password, user[2]):
                return None
            # Update last login in dashboard_users
            self.cur.execute("""
                UPDATE dashboard_users SET last_login = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (user[0],))
            self.conn.commit()
            return {
                "id": user[0],
                "username": user[1],
                "full_name": user[3],
                "is_active": user[4],
                "last_login": user[5]
            }
        except Exception as e:
            print(f"Authentication error: {str(e)}")
            return None
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        try:
            self.cur.execute("""
                SELECT id, username, email, full_name, phone_number,
                       user_type, role, is_active, is_verified, created_at, last_login
                FROM users
                WHERE id = %s;
            """, (user_id,))
            
            user = self.cur.fetchone()
            if not user:
                return None
            
            return {
                "id": user[0],
                "username": user[1],
                "email": user[2],
                "full_name": user[3],
                "phone_number": user[4],
                "user_type": user[5],
                "role": user[6],
                "is_active": user[7],
                "is_verified": user[8],
                "created_at": user[9].isoformat() if user[9] else None,
                "last_login": user[10].isoformat() if user[10] else None
            }
        except Exception as e:
            print(f"Error fetching user: {str(e)}")
            return None
    
    def verify_user_email(self, user_id: int) -> bool:
        """Mark user's email as verified"""
        try:
            self.cur.execute("""
                UPDATE users SET is_verified = TRUE
                WHERE id = %s;
            """, (user_id,))
            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            print(f"Error verifying user: {str(e)}")
            return False
    
    def change_password(self, user_id: int, old_password: str, 
                       new_password: str) -> bool:
        """Change user password"""
        try:
            # Get current password hash
            self.cur.execute("""
                SELECT password_hash FROM users WHERE id = %s;
            """, (user_id,))
            
            result = self.cur.fetchone()
            if not result:
                return False
            
            # Verify old password
            if not AuthService.verify_password(old_password, result[0]):
                return False
            
            # Update with new password
            new_password_hash = AuthService.hash_password(new_password)
            self.cur.execute("""
                UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (new_password_hash, user_id))
            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            print(f"Error changing password: {str(e)}")
            return False
    
    def deactivate_user(self, user_id: int) -> bool:
        """Deactivate a user account"""
        try:
            self.cur.execute("""
                UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (user_id,))
            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            print(f"Error deactivating user: {str(e)}")
            return False


def get_current_user_from_token(token: str, db_connection) -> Optional[Dict[str, Any]]:
    """
    Extract and verify user from JWT token
    Returns user data if valid, None otherwise
    """
    payload = AuthService.verify_token(token)
    if not payload:
        return None
    
    user_service = UserService(db_connection)
    user = user_service.get_user_by_id(payload.get("user_id"))
    return user

