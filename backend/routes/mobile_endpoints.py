from fastapi import APIRouter, File, UploadFile, Form, HTTPException, BackgroundTasks
from typing import Optional
from services.utilities import reverse_geocode
from services.AI import run_full_ai_analysis
from models.db_helper import save_ai_analysis_to_db
import os
import json
import logging


from services.mobile import (
    upload_incident_service,
    get_formatted_incidents_from_db_service,
    get_location_name_service,
    health_check_service,
    register_user_service,
    IncidentUploadResponse,
    check_user_registration_service
)

# Create router for mobile endpoints
mobile_router = APIRouter()
@mobile_router.get("/api/mobile/check-user/{device_id}")
async def check_user_registration(device_id: str):
    """
    Check if a user with the given device_id has registered account information.
    Returns user registration status and data if registered.
    """
    return await check_user_registration_service(device_id)


def process_ai_analysis_background(incident_id: str, file_path: str, address: str, timestamp: str, latitude: float, longitude: float, all_files: list, device_id: str, app_user_id: int = None):
    """Process AI analysis in the background and save results to database"""
    logger = logging.getLogger("mobile_endpoints.background_analysis")
    logger.info(f"🔄 Starting background AI analysis for incident_id={incident_id}, device_id={device_id}")
    
    try:
        # Run AI analysis on the primary file
        comprehensive_analysis = run_full_ai_analysis(file_path, address, timestamp)
        
        # Prepare file paths list (all uploaded files)
        file_paths = [f["file_path"] for f in all_files]
        
        # Save to database instead of JSON file
        if comprehensive_analysis and isinstance(comprehensive_analysis, dict):
            # Save AI analysis to database
            success = save_ai_analysis_to_db(
                incident_id=incident_id,
                ai_analysis=comprehensive_analysis,
                latitude=latitude,
                longitude=longitude,
                address=address,
                timestamp=timestamp,
                file_paths=file_paths,
                device_id=device_id,
                app_user_id=app_user_id,
                real_files=file_paths
            )
            
            if success:
                logger.info(f"✅ Background AI analysis completed and saved to database for incident_id={incident_id}")
                logger.info(f"📁 Saved {len(file_paths)} file path(s) to database")
            else:
                logger.error(f"❌ Failed to save AI analysis to database for incident_id={incident_id}")
        else:
            logger.warning(f"Background AI analysis failed or returned invalid data for incident_id={incident_id}")
            
    except Exception as e:
        logger.error(f"Error in background AI analysis for incident_id={incident_id}: {str(e)}")
        logger.exception("Full traceback:")

@mobile_router.get("api/mobile/health")
async def health_check():
    """Health check endpoint for mobile API"""
    return health_check_service()

@mobile_router.post("/api/mobile/upload-media")
async def upload_incident(
    background_tasks: BackgroundTasks,
    # Device ID (REQUIRED)
    device_id: str = Form(..., description="Unique device identifier"),
    
    # Location fields
    latitude: float = Form(..., description="Latitude coordinate (-90 to 90)"),
    longitude: float = Form(..., description="Longitude coordinate (-180 to 180)"),
    
    # Incident fields
    description: Optional[str] = Form(None, description="Incident description"),
    is_anonymous: str = Form(..., description="Whether the report is anonymous (true/false)"),
    timestamp: str = Form(..., description="Incident timestamp in ISO format"),
    
    # File fields (supporting multiple files with _0, _1, etc. pattern)
    file_0: UploadFile = File(..., description="Primary file to upload"),
    file_0_type: str = Form(..., description="File type: 'photo' or 'video'"),
    file_0_name: str = Form(..., description="Original filename"),
    
    # Optional additional files
    file_1: Optional[UploadFile] = File(None, description="Optional second file"),
    file_1_type: Optional[str] = Form(None, description="Second file type"),
    file_1_name: Optional[str] = Form(None, description="Second file name"),
    
    file_2: Optional[UploadFile] = File(None, description="Optional third file"),
    file_2_type: Optional[str] = Form(None, description="Third file type"),
    file_2_name: Optional[str] = Form(None, description="Third file name"),
):
    """
    Upload incident report with media files and location data.
    REQUIRES device_id to track reporter (anonymous or registered).
    
    Supports multiple files using the pattern: file_0, file_1, file_2, etc.
    Each file should have corresponding file_X_type and file_X_name fields.
    
    AI analysis processes in the background after upload completes.
    Returns immediately with upload confirmation.
    """
    logger = logging.getLogger("mobile_endpoints.upload_incident")
    logger.info(f"Received upload request: device_id={device_id}, lat={latitude}, lon={longitude}, anon={is_anonymous}")
    
    upload_response = await upload_incident_service(
        latitude=latitude,
        longitude=longitude,
        description=description,
        is_anonymous=is_anonymous,
        timestamp=timestamp,
        device_id=device_id,
        file_0=file_0,
        file_0_type=file_0_type,
        file_0_name=file_0_name,
        file_1=file_1,
        file_1_type=file_1_type,
        file_1_name=file_1_name,
        file_2=file_2,
        file_2_type=file_2_type,
        file_2_name=file_2_name,
    )
    
    # Extract response data
    incident_id = upload_response.incident_id
    file_path = upload_response.files[0].file_path
    address = reverse_geocode(latitude, longitude)
    
    # Prepare all file paths for background processing
    all_files_data = [{"file_path": f.file_path} for f in upload_response.files]
    
    logger.debug(f"Upload response: incident_id={incident_id}, file_path={file_path}, total_files={len(all_files_data)}")
    
    # Start AI analysis in background (don't wait for it)
    background_tasks.add_task(
        process_ai_analysis_background,
        incident_id=incident_id,
        file_path=file_path,
        address=address,
        timestamp=timestamp,
        latitude=latitude,
        longitude=longitude,
        all_files=all_files_data,
        device_id=device_id,
        app_user_id=None
    )
    
    logger.info(f"✅ File uploaded successfully for incident_id={incident_id}. AI analysis queued in background.")
    
    # Return immediately after upload with simple confirmation
    return {"status": "success", "message": "Done uploading", "incident_id": incident_id}


@mobile_router.get("/api/mobile/incidents/formatted")
async def get_formatted_incidents():
    """Get incidents formatted for Flutter app display - FROM DATABASE"""
    return await get_formatted_incidents_from_db_service()

@mobile_router.get("/api/mobile/location/{latitude}/{longitude}")
async def get_location_name(latitude: float, longitude: float):
    """Get location name for specific coordinates"""
    return await get_location_name_service(latitude, longitude)

@mobile_router.post("/api/mobile/register-user")
async def register_user(
    device_id: str = Form(..., description="Unique device identifier"),
    national_id: str = Form(..., description="National ID"),
    full_name: str = Form(..., description="Full name"),
    contact_info: str = Form(..., description="Contact information (phone/email)"),
):
    """
    Register a user account (optional).
    Links device_id to a real user account.
    If not registered, user remains anonymous but tracked by device_id.
    """
    return await register_user_service(device_id, national_id, full_name, contact_info)
