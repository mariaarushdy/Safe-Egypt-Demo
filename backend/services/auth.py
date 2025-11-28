"""
Multi-Tenant Authentication Service for Site Safety System
Handles authentication for workers and HSE users with company isolation
"""

import os
import jwt
import bcrypt
import logging
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from typing import Optional, Dict, Any
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
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
        """Create a JWT access token with company_id for multi-tenant isolation"""
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
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError:
            logger.warning("Invalid token")
            return None


async def authenticate_worker(username: str, password: str, company_code: str) -> Dict[str, Any]:
    """
    Authenticate a worker with username, password, and company code
    Multi-tenant: Worker must belong to the specified company

    Args:
        username: The username to authenticate
        password: The password to verify
        company_code: Company code for multi-tenant isolation

    Returns:
        Dict containing authentication result and token if successful
    """
    from models.db_helper import get_db_connection, get_company_by_code

    try:
        # 1. Validate company exists
        company = get_company_by_code(company_code)
        if not company:
            logger.warning(f"Invalid company code: {company_code}")
            return {
                "status": "error",
                "message": "Invalid company code"
            }

        company_id = company['id']

        # 2. Get worker from database
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT w.id, w.company_id, w.username, w.password_hash, w.full_name,
                   w.employee_id, w.role, w.department, w.is_active, w.device_id,
                   c.company_name, c.industry_type
            FROM workers w
            JOIN companies c ON w.company_id = c.id
            WHERE w.username = %s AND w.company_id = %s;
        """, (username, company_id))

        user = cur.fetchone()

        logger.info(f"Worker authentication attempt: username={username}, company={company_code}")

        if not user:
            logger.warning(f"Worker '{username}' not found for company '{company_code}'")
            cur.close()
            conn.close()
            return {
                "status": "error",
                "message": "Invalid credentials"
            }

        (worker_id, db_company_id, db_username, password_hash, full_name,
         employee_id, role, department, is_active, device_id,
         company_name, industry_type) = user

        # 3. Check if worker is active
        if not is_active:
            cur.close()
            conn.close()
            return {
                "status": "error",
                "message": "Account is inactive"
            }

        # 4. Verify password
        try:
            password_match = check_password_hash(password_hash, password)

            if not password_match:
                logger.warning(f"Invalid password for worker: {username}")
                cur.close()
                conn.close()
                return {
                    "status": "error",
                    "message": "Invalid credentials"
                }
        except Exception as e:
            logger.error(f"Error verifying password: {str(e)}")
            cur.close()
            conn.close()
            return {
                "status": "error",
                "message": "Authentication failed"
            }

        # 5. Generate JWT token with company_id for multi-tenant isolation
        token_data = {
            "sub": str(worker_id),
            "id": worker_id,
            "username": username,
            "full_name": full_name,
            "company_id": company_id,  # Critical for multi-tenant security
            "company_code": company_code,
            "company_name": company_name,
            "user_type": "worker",
            "role": role,
            "employee_id": employee_id
        }

        access_token = AuthService.create_access_token(token_data)

        # 6. Update last login
        cur.execute("""
            UPDATE workers
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (worker_id,))

        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"✅ Worker authenticated successfully: {username} @ {company_code}")

        return {
            "status": "success",
            "message": "Authentication successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": worker_id,
                "username": username,
                "full_name": full_name,
                "employee_id": employee_id,
                "role": role,
                "department": department,
                "company_id": company_id,
                "company_code": company_code,
                "company_name": company_name,
                "industry_type": industry_type,
                "user_type": "worker"
            }
        }

    except Exception as e:
        logger.error(f"Worker authentication error: {str(e)}")
        return {
            "status": "error",
            "message": f"Authentication failed: {str(e)}"
        }


async def authenticate_hse_user(username: str, password: str, company_code: str) -> Dict[str, Any]:
    """
    Authenticate an HSE user with username, password, and company code
    Multi-tenant: HSE user must belong to the specified company

    Args:
        username: The username to authenticate
        password: The password to verify
        company_code: Company code for multi-tenant isolation

    Returns:
        Dict containing authentication result and token if successful
    """
    from models.db_helper import get_db_connection, get_company_by_code

    try:
        # 1. Validate company exists
        company = get_company_by_code(company_code)
        if not company:
            logger.warning(f"Invalid company code: {company_code}")
            return {
                "status": "error",
                "message": "Invalid company code"
            }

        company_id = company['id']

        # 2. Get HSE user from database
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT h.id, h.company_id, h.username, h.password_hash, h.full_name,
                   h.role, h.email, h.is_active,
                   c.company_name, c.industry_type
            FROM hse_users h
            JOIN companies c ON h.company_id = c.id
            WHERE h.username = %s AND h.company_id = %s;
        """, (username, company_id))

        user = cur.fetchone()

        logger.info(f"HSE authentication attempt: username={username}, company={company_code}")

        if not user:
            logger.warning(f"HSE user '{username}' not found for company '{company_code}'")
            cur.close()
            conn.close()
            return {
                "status": "error",
                "message": "Invalid credentials"
            }

        (hse_id, db_company_id, db_username, password_hash, full_name,
         role, email, is_active, company_name, industry_type) = user

        # 3. Check if user is active
        if not is_active:
            cur.close()
            conn.close()
            return {
                "status": "error",
                "message": "Account is inactive"
            }

        # 4. Verify password
        try:
            password_match = check_password_hash(password_hash, password)

            if not password_match:
                logger.warning(f"Invalid password for HSE user: {username}")
                cur.close()
                conn.close()
                return {
                    "status": "error",
                    "message": "Invalid credentials"
                }
        except Exception as e:
            logger.error(f"Error verifying password: {str(e)}")
            cur.close()
            conn.close()
            return {
                "status": "error",
                "message": "Authentication failed"
            }

        # 5. Generate JWT token with company_id for multi-tenant isolation
        token_data = {
            "sub": str(hse_id),
            "id": hse_id,
            "username": username,
            "full_name": full_name,
            "company_id": company_id,  # Critical for multi-tenant security
            "company_code": company_code,
            "company_name": company_name,
            "user_type": "hse",
            "role": role,
            "email": email
        }

        access_token = AuthService.create_access_token(token_data)

        # 6. Update last login
        cur.execute("""
            UPDATE hse_users
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (hse_id,))

        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"✅ HSE user authenticated successfully: {username} @ {company_code}")

        return {
            "status": "success",
            "message": "Authentication successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": hse_id,
                "username": username,
                "full_name": full_name,
                "email": email,
                "role": role,
                "company_id": company_id,
                "company_code": company_code,
                "company_name": company_name,
                "industry_type": industry_type,
                "user_type": "hse"
            }
        }

    except Exception as e:
        logger.error(f"HSE authentication error: {str(e)}")
        return {
            "status": "error",
            "message": f"Authentication failed: {str(e)}"
        }


def get_current_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Extract and verify user from JWT token
    Returns user data with company_id if valid, None otherwise
    """
    payload = AuthService.verify_token(token)
    if not payload:
        return None

    # Token must contain company_id for multi-tenant security
    if 'company_id' not in payload:
        logger.warning("Token missing company_id - invalid for multi-tenant system")
        return None

    return payload


def validate_company_access(token: str, required_company_id: int) -> bool:
    """
    Validate that the token's company_id matches the required company_id
    Critical security check for multi-tenant data isolation

    Args:
        token: JWT token
        required_company_id: The company_id being accessed

    Returns:
        True if access is allowed, False otherwise
    """
    user = get_current_user_from_token(token)
    if not user:
        return False

    token_company_id = user.get('company_id')
    if token_company_id != required_company_id:
        logger.warning(f"Company access violation: token company_id={token_company_id}, required={required_company_id}")
        return False

    return True


def extract_token_from_header(authorization: str) -> Optional[str]:
    """
    Extract JWT token from Authorization header
    Format: "Bearer <token>"
    """
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None

    return parts[1]
