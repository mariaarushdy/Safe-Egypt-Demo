"""
Worker API Endpoints for Site Safety Incident Reporting
Multi-tenant with company isolation
"""

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, BackgroundTasks, Depends, Request
from typing import Optional, List
from pydantic import BaseModel
import os
import logging
import uuid

from services.auth import authenticate_worker
from middleware.company_auth import get_current_worker, validate_site_access
from models.db_helper import (
    get_sites_by_company,
    get_zones_by_site,
    get_site_by_id,
    save_ai_analysis_to_db
)

logger = logging.getLogger(__name__)

# Create router for worker endpoints
mobile_router = APIRouter()


# ==================== REQUEST MODELS ====================

class WorkerLoginRequest(BaseModel):
    username: str
    password: str
    company_code: str


# ==================== AUTHENTICATION ====================

@mobile_router.post("/api/worker/login")
async def worker_login(request: WorkerLoginRequest):
    """
    Worker login with company code
    Returns JWT token with company_id for multi-tenant isolation

    Body:
        username: Worker username
        password: Worker password
        company_code: Company code (e.g., PETRO001, CONST001)
    """
    result = await authenticate_worker(
        username=request.username,
        password=request.password,
        company_code=request.company_code
    )

    if result["status"] == "error":
        raise HTTPException(status_code=401, detail=result["message"])

    return result


# ==================== SITE & ZONE ENDPOINTS ====================

@mobile_router.get("/api/worker/sites")
async def get_worker_sites(request: Request):
    """
    Get all sites for the authenticated worker's company
    Requires: Valid JWT token
    """
    worker = await get_current_worker(request)
    company_id = worker['company_id']

    sites = get_sites_by_company(company_id)

    return {
        "status": "success",
        "company_id": company_id,
        "company_name": worker.get('company_name'),
        "sites": sites
    }


@mobile_router.get("/api/worker/sites/{site_id}/zones")
async def get_site_zones(site_id: int, request: Request):
    """
    Get all zones for a specific site
    Validates site belongs to worker's company
    """
    worker = await get_current_worker(request)
    company_id = worker['company_id']

    # Validate site access
    site = get_site_by_id(site_id, company_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found or access denied")

    zones = get_zones_by_site(site_id, company_id)

    return {
        "status": "success",
        "site_id": site_id,
        "site_name": site['site_name'],
        "zones": zones
    }


# ==================== INCIDENT REPORTING ====================

def process_ai_analysis_background(
    incident_id: str,
    company_id: int,
    site_id: int,
    worker_id: int,
    file_path: str,
    address: str,
    timestamp: str,
    all_files: list,
    latitude: float,
    longitude: float,
    zone_id: Optional[int] = None
):
    """Process AI analysis in the background and save results to database"""
    from services.AI import run_full_ai_analysis

    logger.info(f"🔄 Starting background AI analysis for incident_id={incident_id}, worker_id={worker_id}, site_id={site_id}")

    try:
        # Run AI analysis on the primary file
        comprehensive_analysis = run_full_ai_analysis(file_path, address, timestamp)

        # Prepare file paths list (all uploaded files)
        file_paths = [f["file_path"] for f in all_files]

        # Save to database with multi-tenant fields
        if comprehensive_analysis and isinstance(comprehensive_analysis, dict):
            success = save_ai_analysis_to_db(
                incident_id=incident_id,
                company_id=company_id,
                site_id=site_id,
                worker_id=worker_id,
                ai_analysis=comprehensive_analysis,
                timestamp=timestamp,
                file_paths=file_paths,
                latitude=latitude,
                longitude=longitude,
                address=address,
                zone_id=zone_id,
                real_files=file_paths
            )

            if success:
                logger.info(f"✅ Background AI analysis completed for incident_id={incident_id}")
                logger.info(f"📁 Saved {len(file_paths)} file(s) to database")
            else:
                logger.error(f"❌ Failed to save AI analysis to database for incident_id={incident_id}")
        else:
            logger.warning(f"Background AI analysis failed for incident_id={incident_id}")

    except Exception as e:
        logger.error(f"Error in background AI analysis for incident_id={incident_id}: {str(e)}")
        logger.exception("Full traceback:")


@mobile_router.post("/api/worker/report-incident")
async def report_incident(
    background_tasks: BackgroundTasks,
    request: Request,

    # Site information (REQUIRED)
    site_id: int = Form(..., description="Site ID where incident occurred"),
    zone_id: Optional[int] = Form(None, description="Zone ID within the site (optional)"),

    # Location fields
    latitude: float = Form(..., description="Latitude coordinate"),
    longitude: float = Form(..., description="Longitude coordinate"),

    # Incident fields
    description: Optional[str] = Form(None, description="Incident description"),
    timestamp: str = Form(..., description="Incident timestamp in ISO format"),

    # File fields (supporting multiple files)
    file_0: UploadFile = File(..., description="Primary file to upload"),
    file_0_type: str = Form(..., description="File type: 'photo' or 'video'"),
    file_0_name: str = Form(..., description="Original filename"),

    # Optional additional files
    file_1: Optional[UploadFile] = File(None),
    file_1_type: Optional[str] = Form(None),
    file_1_name: Optional[str] = Form(None),

    file_2: Optional[UploadFile] = File(None),
    file_2_type: Optional[str] = Form(None),
    file_2_name: Optional[str] = Form(None),

    file_3: Optional[UploadFile] = File(None),
    file_3_type: Optional[str] = Form(None),
    file_3_name: Optional[str] = Form(None),
):
    """
    Report a safety incident at a site
    Requires: Authenticated worker with valid JWT
    """
    # Get authenticated worker
    worker = await get_current_worker(request)
    company_id = worker['company_id']
    # token may contain id or sub; prefer explicit id, fallback to sub
    worker_id = worker.get('id') or worker.get('worker_id')
    if worker_id is None and worker.get('sub'):
        try:
            worker_id = int(worker['sub'])
        except (ValueError, TypeError):
            worker_id = worker['sub']
    if worker_id is None:
        logger.error("Authenticated worker token missing id/sub")
        raise HTTPException(status_code=401, detail="Invalid worker token")

    # Validate site belongs to worker's company
    site = get_site_by_id(site_id, company_id)
    if not site:
        raise HTTPException(status_code=403, detail="Site not found or access denied")

    # Validate zone if provided
    if zone_id:
        from models.db_helper import get_zones_by_site
        zones = get_zones_by_site(site_id, company_id)
        if not any(z['id'] == zone_id for z in zones):
            raise HTTPException(status_code=403, detail="Zone not found or access denied")

    logger.info(f"📥 Incident report from worker {worker['username']} at site {site_id}")

    # Generate incident ID
    incident_id = str(uuid.uuid4())

    # Create upload directories
    upload_dir = os.path.join("data", "uploads")
    os.makedirs(os.path.join(upload_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(upload_dir, "videos"), exist_ok=True)

    # Process and save files
    all_files = []
    primary_file_path = None

    # Helper function to save file
    async def save_file(file: UploadFile, file_type: str, file_name: str, index: int):
        if file:
            # Determine directory based on file type
            subdir = "videos" if file_type == "video" else "images"

            # Create safe filename
            ext = os.path.splitext(file_name)[1] if file_name else ".mp4"
            safe_filename = f"{incident_id}_{index}{ext}"
            file_path = os.path.join(upload_dir, subdir, safe_filename)

            # Save file
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)

            logger.info(f"💾 Saved {file_type}: {file_path}")

            return {
                "file_path": file_path,
                "file_type": file_type,
                "original_name": file_name,
                "index": index
            }
        return None

    # Save all files
    file_info_0 = await save_file(file_0, file_0_type, file_0_name, 0)
    if file_info_0:
        all_files.append(file_info_0)
        primary_file_path = file_info_0["file_path"]

    if file_1:
        file_info_1 = await save_file(file_1, file_1_type, file_1_name, 1)
        if file_info_1:
            all_files.append(file_info_1)

    if file_2:
        file_info_2 = await save_file(file_2, file_2_type, file_2_name, 2)
        if file_info_2:
            all_files.append(file_info_2)

    if file_3:
        file_info_3 = await save_file(file_3, file_3_type, file_3_name, 3)
        if file_info_3:
            all_files.append(file_info_3)

    # Get location address (site address or geocode)
    address = site.get('address', f"Site: {site['site_name']}")

    # Queue background AI analysis
    background_tasks.add_task(
        process_ai_analysis_background,
        incident_id=incident_id,
        company_id=company_id,
        site_id=site_id,
        worker_id=worker_id,
        file_path=primary_file_path,
        address=address,
        timestamp=timestamp,
        all_files=all_files,
        latitude=latitude,
        longitude=longitude,
        zone_id=zone_id
    )

    logger.info(f"✅ Incident {incident_id} uploaded successfully, AI analysis queued")

    return {
        "status": "success",
        "message": "Incident reported successfully. AI analysis in progress.",
        "incident_id": incident_id,
        "company_id": company_id,
        "site_id": site_id,
        "site_name": site['site_name'],
        "worker_id": worker_id,
        "files_uploaded": len(all_files)
    }


# ==================== INCIDENT RETRIEVAL ====================

@mobile_router.get("/api/worker/incidents")
async def get_worker_incidents(request: Request, limit: int = 50):
    """
    Get incidents reported by the authenticated worker
    """
    from models.db_helper import get_all_incidents_from_db

    worker = await get_current_worker(request)
    company_id = worker['company_id']

    # Get incidents for worker's company
    incidents = get_all_incidents_from_db(company_id=company_id, limit=limit)

    return {
        "status": "success",
        "total_incidents": len(incidents),
        "company_id": company_id,
        "incidents": incidents
    }


@mobile_router.get("/api/worker/incidents/{incident_id}")
async def get_incident_detail(incident_id: str, request: Request):
    """
    Get detailed information about a specific incident
    Validates incident belongs to worker's company
    """
    from models.db_helper import get_incident_by_id

    worker = await get_current_worker(request)
    company_id = worker['company_id']

    incident = get_incident_by_id(incident_id, company_id)

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    return {
        "status": "success",
        "incident": incident
    }


@mobile_router.get("/api/mobile/incidents/formatted")
async def get_formatted_incidents(request: Request, limit: int = 50):
    """
    Get formatted incidents for mobile app incident feed
    Returns incidents for the authenticated worker's company
    """
    from models.db_helper import get_all_incidents_from_db
    from datetime import datetime

    # Get authenticated worker
    worker = await get_current_worker(request)
    company_id = worker['company_id']

    # Get incidents for worker's company
    incidents = get_all_incidents_from_db(company_id=company_id, limit=limit)

    # Format incidents for mobile app display
    formatted_incidents = []
    for incident in incidents:
        # Calculate time ago from timestamp
        time_display = "Unknown time"
        if incident.get('timestamp'):
            try:
                timestamp_dt = datetime.fromisoformat(str(incident['timestamp']))
                now = datetime.now(timestamp_dt.tzinfo) if timestamp_dt.tzinfo else datetime.now()
                time_diff = now - timestamp_dt

                if time_diff.days > 0:
                    time_display = f"{time_diff.days} days ago"
                elif time_diff.seconds > 3600:
                    hours = time_diff.seconds // 3600
                    time_display = f"{hours} hours ago"
                elif time_diff.seconds > 60:
                    minutes = time_diff.seconds // 60
                    time_display = f"{minutes} minutes ago"
                else:
                    time_display = "Just now"
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse timestamp {incident.get('timestamp')}: {e}")

        formatted_incident = {
            "id": incident.get("incident_id", ""),
            "category": incident.get("category", "Unknown"),
            "severity": incident.get("severity", "unknown"),
            "title": incident.get("title", "Untitled Incident"),
            "description": incident.get("description", "No description"),
            "location": incident.get("site_address") or incident.get("address") or "Unknown location",
            "time": time_display,
            "timestamp": incident.get("timestamp", ""),
            "latitude": incident.get("latitude", 0.0),
            "longitude": incident.get("longitude", 0.0),
            "status": incident.get("status", "pending"),
            "site_name": incident.get("site_name", ""),
            "site_type": incident.get("site_type", ""),
            "verified": incident.get("verified", "unverified")
        }
        formatted_incidents.append(formatted_incident)

    return {
        "status": "success",
        "total_incidents": len(formatted_incidents),
        "company_id": company_id,
        "incidents": formatted_incidents
    }


@mobile_router.get("/api/mobile/location/{latitude}/{longitude}")
async def get_location_address(latitude: float, longitude: float):
    """
    Reverse geocode coordinates to get address
    Public endpoint (no authentication required)
    """
    from services.utilities import reverse_geocode

    try:
        address = reverse_geocode(latitude, longitude)
        return {
            "status": "success",
            "latitude": latitude,
            "longitude": longitude,
            "address": address
        }
    except Exception as e:
        logger.error(f"Reverse geocoding error: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to get address: {str(e)}",
            "latitude": latitude,
            "longitude": longitude,
            "address": None
        }


# ==================== HEALTH CHECK ====================

@mobile_router.get("/api/worker/health")
async def health_check():
    """Health check endpoint for worker API"""
    return {
        "status": "success",
        "message": "Worker API is running",
        "api_version": "2.0-multi-tenant"
    }


# ==================== LEGACY COMPATIBILITY ====================
# Keep old /api/mobile/health for backward compatibility
@mobile_router.get("/api/mobile/health")
async def legacy_health_check():
    """Legacy health check endpoint"""
    return {
        "status": "success",
        "message": "API is running (legacy endpoint - please migrate to /api/worker/health)",
        "api_version": "2.0-multi-tenant"
    }
