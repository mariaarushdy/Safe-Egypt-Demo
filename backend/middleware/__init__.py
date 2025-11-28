"""
Middleware package for multi-tenant security and data isolation
"""

from .company_auth import (
    get_current_user,
    get_current_worker,
    get_current_hse_user,
    validate_company_access,
    validate_site_access,
    validate_incident_access,
    CompanyAccessMiddleware
)

__all__ = [
    'get_current_user',
    'get_current_worker',
    'get_current_hse_user',
    'validate_company_access',
    'validate_site_access',
    'validate_incident_access',
    'CompanyAccessMiddleware'
]
