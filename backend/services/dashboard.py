"""
Dashboard Service Module

This module will contain dashboard-related functionality such as:
- Analytics and reporting
- User management
- System monitoring
- Configuration management
- Data export/import
- etc.
"""

from fastapi import HTTPException
from typing import Dict, Any, List, Optional
import json
import os
import logging
from datetime import datetime, timedelta
from models.db_helper import get_all_incidents_from_db, update_incident_status

logger = logging.getLogger(__name__)

# TODO: Add dashboard service functions here
# Examples:

def get_incidents_summary_service() -> Dict[str, Any]:
    """
    Get summary of all incidents with key information for dashboard display
    
    Returns:
        Dict containing list of incidents with essential fields
    """
    try:
        logger.info("Fetching incidents from database...")
        # Get all incidents from database
        incidents_data = get_all_incidents_from_db()
        logger.info(f"Retrieved {len(incidents_data)} incidents from database")
        
        # Extract required fields for each incident
        incidents_summary = []
        for incident in incidents_data:
            incident_summary = {
                "category": incident.get("category", "Unknown"),
                "title": incident.get("title", "Untitled Incident"),
                "description": incident.get("description", "No description available"),
                "severity": incident.get("severity", "Unknown"),
                "verified": incident.get("verified", "Unverified"),
                "incident_id": incident.get("incident_id", ""),
                "timestamp": incident.get("timestamp", ""),
                "status": incident.get("status", "pending"),
                "location": {
                    "address": incident.get("address", "Unknown location"),
                    "latitude": incident.get("latitude", 0.0),
                    "longitude": incident.get("longitude", 0.0)
                }
            }
            incidents_summary.append(incident_summary)
        
        logger.info(f"Successfully formatted {len(incidents_summary)} incidents for dashboard")
        return {
            "status": "success",
            "message": f"Retrieved {len(incidents_summary)} incidents",
            "total_incidents": len(incidents_summary),
            "incidents": incidents_summary
        }
        
    except Exception as e:
        logger.error(f"Error in get_incidents_summary_service: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Error reading incidents: {str(e)}",
            "incidents": []
        }

def get_analytics_service() -> Dict[str, Any]:
    """
    Get system analytics and statistics
    
    Returns:
        Dict containing analytics data
    """
    # TODO: Implement analytics calculation
    return {
        "status": "not_implemented",
        "message": "Analytics service to be implemented",
        "total_incidents": 0,
        "incidents_today": 0,
        "incidents_this_week": 0,
        "incidents_this_month": 0
    }

def get_reports_service(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    accident_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate detailed reports based on filters
    
    Args:
        start_date: Start date for report (ISO format)
        end_date: End date for report (ISO format)
        accident_type: Filter by incident type
        
    Returns:
        Dict containing report data
    """
    # TODO: Implement report generation
    return {
        "status": "not_implemented",
        "message": "Reports service to be implemented",
        "filters": {
            "start_date": start_date,
            "end_date": end_date,
            "accident_type": accident_type
        }
    }

def manage_users_service() -> Dict[str, Any]:
    """
    Get user management data
    
    Returns:
        Dict containing user data
    """
    from models.db_helper import get_db_connection

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Dashboard users
        cur.execute("SELECT COUNT(*) FROM dashboard_users;")
        total_dashboard = cur.fetchone()[0] or 0

        cur.execute("SELECT COUNT(*) FROM dashboard_users WHERE is_active = TRUE;")
        active_dashboard = cur.fetchone()[0] or 0

        # App users (mobile profiles)
        cur.execute("SELECT COUNT(*) FROM app_users;")
        total_app = cur.fetchone()[0] or 0

        # Registered app users (have national_id) vs anonymous
        cur.execute("SELECT COUNT(*) FROM app_users WHERE national_id IS NOT NULL;")
        registered_app = cur.fetchone()[0] or 0

        anonymous_app = total_app - registered_app

        # Combined totals
        combined_total = total_dashboard + total_app

        cur.close()
        conn.close()

        return {
            "status": "success",
            "message": "User management summary retrieved",
            "total_dashboard_users": total_dashboard,
            "active_dashboard_users": active_dashboard,
            "total_app_users": total_app,
            "registered_app_users": registered_app,
            "anonymous_app_users": anonymous_app,
            "total_users": combined_total
        }
    except Exception as e:
        logger.error(f"Error in manage_users_service: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Failed to retrieve user summary: {str(e)}",
            "total_users": 0,
            "active_users": 0
        }

def get_system_status_service() -> Dict[str, Any]:
    """
    Get system health and monitoring data
    
    Returns:
        Dict containing system status
    """
    # TODO: Implement system monitoring
    return {
        "status": "not_implemented",
        "message": "System monitoring service to be implemented",
        "api_status": "healthy",
        "database_status": "healthy",
        "storage_status": "healthy"
    }

def export_data_service(
    data_type: str,
    format: str = "json"
) -> Dict[str, Any]:
    """
    Export system data in various formats
    
    Args:
        data_type: Type of data to export (incidents, users, etc.)
        format: Export format (json, csv, xlsx)
        
    Returns:
        Dict containing export information
    """
    # TODO: Implement data export
    return {
        "status": "not_implemented",
        "message": "Data export service to be implemented",
        "data_type": data_type,
        "format": format
    }

def import_data_service(
    data_type: str,
    file_path: str
) -> Dict[str, Any]:
    """
    Import data from files
    
    Args:
        data_type: Type of data to import
        file_path: Path to the import file
        
    Returns:
        Dict containing import results
    """
    # TODO: Implement data import
    return {
        "status": "not_implemented",
        "message": "Data import service to be implemented",
        "data_type": data_type,
        "file_path": file_path
    }


def get_incident_by_id_service(incident_id: str) -> Dict[str, Any]:
    """
    Get detailed incident information by ID from database
    
    Args:
        incident_id: The unique incident identifier
        
    Returns:
        Dict containing complete incident information including
        category, title, severity, detected events, location, and all other analysis results
    """
    try:
        # Get all incidents from database (we'll filter for the one we need)
        all_incidents = get_all_incidents_from_db()
        
        # Find the specific incident
        found_incident = None
        for incident in all_incidents:
            if incident.get("incident_id") == incident_id:
                found_incident = incident
                break
        
        if not found_incident:
            raise HTTPException(status_code=404, detail=f"Incident with ID {incident_id} not found")
        
        # Build the incident_info object with location nested properly
        incident_info = {
            "incident_id": found_incident.get("incident_id"),
            "category": found_incident.get("category"),
            "title": found_incident.get("title"),
            "description": found_incident.get("description"),
            "severity": found_incident.get("severity"),
            "verified": found_incident.get("verified"),
            "status": found_incident.get("status", "pending"),
            "timestamp": found_incident.get("timestamp"),
            "violence_type": found_incident.get("violence_type"),
            "weapon": found_incident.get("weapon"),
            "site_description": found_incident.get("site_description"),
            "number_of_people": found_incident.get("number_of_people"),
            "description_of_people": found_incident.get("description_of_people"),
            "detailed_description_for_the_incident": found_incident.get("detailed_description_for_the_incident"),
            "accident_type": found_incident.get("accident_type"),
            "vehicles_machines_involved": found_incident.get("vehicles_machines_involved"),
            "utility_type": found_incident.get("utility_type"),
            "extent_of_impact": found_incident.get("extent_of_impact"),
            "duration": found_incident.get("duration"),
            "illegal_type": found_incident.get("illegal_type"),
            "items_involved": found_incident.get("items_involved"),
            "detected_events": found_incident.get("detected_events", []),
            "real_files": found_incident.get("real_files", []),
            "location": {
                "address": found_incident.get("address"),
                "latitude": found_incident.get("latitude"),
                "longitude": found_incident.get("longitude")
            }
        }
        
        # Build response
        response = {
            "status": "success",
            "incident_id": incident_id,
            "incident_info": incident_info
        }
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving incident: {str(e)}")


def update_incident_status_service(incident_id: str, status: str) -> Dict[str, Any]:
    """
    Update incident status to accepted or rejected
    
    Args:
        incident_id: The unique incident identifier
        status: New status (accepted or rejected)
        
    Returns:
        Dict containing success message and updated incident info
    """
    try:
        # Update status in database
        success = update_incident_status(incident_id, status)
        
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to update incident status in database")
        
        # Get the updated incident to return its info
        all_incidents = get_all_incidents_from_db()
        updated_incident = None
        
        for incident in all_incidents:
            if incident.get("incident_id") == incident_id:
                updated_incident = incident
                break
        
        if not updated_incident:
            raise HTTPException(status_code=404, detail=f"Incident with ID {incident_id} not found")
        
        return {
            "status": "success",
            "message": f"Incident {incident_id} status updated to {status}",
            "incident_id": incident_id,
            "new_status": status,
            "updated_incident": {
                "title": updated_incident.get("title", ""),
                "category": updated_incident.get("category", ""),
                "severity": updated_incident.get("severity", ""),
                "timestamp": updated_incident.get("timestamp", ""),
                "status": updated_incident.get("status", "")
            }
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating incident status: {str(e)}")
