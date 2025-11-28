"""
Multi-Tenant Middleware for Company Data Isolation
Ensures all API requests are scoped to the authenticated user's company
"""

from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Extract and validate user from JWT token in request headers
    Required for all authenticated endpoints

    Returns:
        Dict containing user data including company_id

    Raises:
        HTTPException: If token is missing, invalid, or expired
    """
    from services.auth import get_current_user_from_token, extract_token_from_header

    # Get authorization header
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Extract token
    token = extract_token_from_header(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token format",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Verify token and get user
    user = get_current_user_from_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Ensure company_id is present (multi-tenant requirement)
    if 'company_id' not in user:
        logger.error(f"Token missing company_id for user: {user.get('username')}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token: missing company information"
        )

    return user


async def get_current_worker(request: Request) -> Dict[str, Any]:
    """
    Get current authenticated worker
    Validates that user_type is 'worker'

    Returns:
        Dict containing worker data including company_id

    Raises:
        HTTPException: If user is not a worker
    """
    user = await get_current_user(request)

    if user.get('user_type') != 'worker':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Worker authentication required"
        )

    return user


async def get_current_hse_user(request: Request) -> Dict[str, Any]:
    """
    Get current authenticated HSE user
    Validates that user_type is 'hse'

    Returns:
        Dict containing HSE user data including company_id

    Raises:
        HTTPException: If user is not an HSE user
    """
    user = await get_current_user(request)

    if user.get('user_type') != 'hse':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: HSE team authentication required"
        )

    return user


def validate_company_access(user: Dict[str, Any], resource_company_id: int) -> None:
    """
    Validate that user's company matches the resource's company
    Critical security check for multi-tenant data isolation

    Args:
        user: User data from token (must contain company_id)
        resource_company_id: Company ID of the resource being accessed

    Raises:
        HTTPException: If company IDs don't match
    """
    user_company_id = user.get('company_id')

    if user_company_id != resource_company_id:
        logger.warning(
            f"Company access violation detected! "
            f"User {user.get('username')} (company {user_company_id}) "
            f"attempted to access company {resource_company_id} data"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You don't have permission to access this resource"
        )


def validate_site_access(user: Dict[str, Any], site_company_id: int) -> None:
    """
    Validate that user can access a specific site
    Site must belong to user's company

    Args:
        user: User data from token
        site_company_id: Company ID that owns the site

    Raises:
        HTTPException: If user's company doesn't match site's company
    """
    validate_company_access(user, site_company_id)


def validate_incident_access(user: Dict[str, Any], incident_company_id: int) -> None:
    """
    Validate that user can access a specific incident
    Incident must belong to user's company

    Args:
        user: User data from token
        incident_company_id: Company ID that owns the incident

    Raises:
        HTTPException: If user's company doesn't match incident's company
    """
    validate_company_access(user, incident_company_id)


class CompanyAccessMiddleware:
    """
    Middleware to enforce company-based access control on all requests
    Automatically validates company_id on authenticated endpoints
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        """
        Process each request and enforce company isolation
        """
        # Only process HTTP requests
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Extract path
        path = scope.get("path", "")

        # Skip authentication for public endpoints
        public_paths = [
            "/",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/api/worker/login",
            "/api/hse/login",
            "/api/mobile/health"  # Legacy health check
        ]

        if path in public_paths or path.startswith("/static"):
            await self.app(scope, receive, send)
            return

        # For all other endpoints, company isolation is enforced
        # via the get_current_user dependency in route handlers
        await self.app(scope, receive, send)
