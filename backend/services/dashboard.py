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
from datetime import datetime, timedelta

# TODO: Add dashboard service functions here
# Examples:

def get_incidents_summary_service() -> Dict[str, Any]:
    """
    Get summary of all incidents with key information for dashboard display
    
    Returns:
        Dict containing list of incidents with essential fields
    """
    try:
        # Path to the analysed incidents file
        incidents_file_path = os.path.join("data", "analysed_incidents.json")
        
        # Check if file exists
        if not os.path.exists(incidents_file_path):
            return {
                "status": "error",
                "message": "Analysed incidents file not found",
                "incidents": []
            }
        
        # Read the incidents data
        with open(incidents_file_path, 'r', encoding='utf-8') as file:
            incidents_data = json.load(file)
        
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
                "status": incident.get("status", "pending"),  # Adding status as pending as requested
                "location": {
                    "address": incident.get("location", {}).get("address", "Unknown location"),
                    "latitude": incident.get("location", {}).get("latitude", 0.0),
                    "longitude": incident.get("location", {}).get("longitude", 0.0)
                }
            }
            incidents_summary.append(incident_summary)
        
        return {
            "status": "success",
            "message": f"Retrieved {len(incidents_summary)} incidents",
            "total_incidents": len(incidents_summary),
            "incidents": incidents_summary
        }
        
    except json.JSONDecodeError as e:
        return {
            "status": "error",
            "message": f"Error parsing incidents file: {str(e)}",
            "incidents": []
        }
    except Exception as e:
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
    # TODO: Implement user management
    return {
        "status": "not_implemented",
        "message": "User management service to be implemented",
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
    Get detailed incident information by ID from analysed incidents data
    
    Args:
        incident_id: The unique incident identifier
        
    Returns:
        Dict containing complete analysed incident information including
        category, title, severity, detected events, location, and all other analysis results
    """
    try:
        # Read analysed incident data (primary source)
        analysed_file_path = os.path.join("data", "analysed_incidents.json")
        
        # Check if analysed incidents file exists
        if not os.path.exists(analysed_file_path):
            raise HTTPException(status_code=404, detail="Analysed incidents file not found")
        
        # Read analysed incident data
        with open(analysed_file_path, 'r', encoding='utf-8') as file:
            analysed_incidents = json.load(file)
        
        # Find the incident in analysed data (primary source)
        analysed_incident = None
        for incident in analysed_incidents:
            if incident.get("incident_id") == incident_id:
                analysed_incident = incident
                break
        
        if not analysed_incident:
            raise HTTPException(status_code=404, detail=f"Incident with ID {incident_id} not found in analysed data")
        
        
        
        # Build response with analysed incident data as primary info
        response = {
            "status": "success",
            "incident_id": incident_id,
            "incident_info": analysed_incident  # Return analysed data as main info
        }
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Error parsing incident files: {str(e)}")
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
        # Path to the analysed incidents file
        incidents_file_path = os.path.join("data", "analysed_incidents.json")
        
        # Check if file exists
        if not os.path.exists(incidents_file_path):
            raise HTTPException(status_code=404, detail="Analysed incidents file not found")
        
        # Read the incidents data
        with open(incidents_file_path, 'r', encoding='utf-8') as file:
            incidents_data = json.load(file)
        
        # Find the incident to update
        incident_found = False
        updated_incident = None
        
        for i, incident in enumerate(incidents_data):
            if incident.get("incident_id") == incident_id:
                # Update the status
                incidents_data[i]["status"] = status
                updated_incident = incidents_data[i]
                incident_found = True
                break
        
        if not incident_found:
            raise HTTPException(status_code=404, detail=f"Incident with ID {incident_id} not found")
        
        # Write the updated data back to the file
        with open(incidents_file_path, 'w', encoding='utf-8') as file:
            json.dump(incidents_data, file, ensure_ascii=False, indent=2)
        
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
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Error parsing incidents file: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating incident status: {str(e)}")
