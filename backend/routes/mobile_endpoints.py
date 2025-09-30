from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from typing import Optional
from services.utilities import reverse_geocode
from services.ai_test import run_full_ai_analysis
import os
import json
import logging
import asyncio



from services.mobile import (
    upload_incident_service,
    get_formatted_incidents_service,
    get_location_name_service,
    health_check_service,
    IncidentUploadResponse
)

# Create router for mobile endpoints
mobile_router = APIRouter()

async def process_ai_analysis_background(incident_id: str, file_path: str, address: str, timestamp: str, latitude: float, longitude: float):
    """Process AI analysis in the background and save results"""
    logger = logging.getLogger("mobile_endpoints.background_analysis")
    logger.info(f"Starting background AI analysis for incident_id={incident_id}")
    
    try:
        # Run AI analysis
        comprehensive_analysis = run_full_ai_analysis(file_path, address, timestamp)
        
        # Add incident metadata to the analysis
        if comprehensive_analysis and isinstance(comprehensive_analysis, dict):
            comprehensive_analysis["incident_id"] = incident_id
            comprehensive_analysis["timestamp"] = timestamp
            comprehensive_analysis["status"] = "pending" 
            comprehensive_analysis["location"] = {
                "address": address,
                "latitude": latitude,
                "longitude": longitude
            }
            comprehensive_analysis["real_files"] = [file_path]
            # Ensure the data directory exists
            data_dir = "data"
            os.makedirs(data_dir, exist_ok=True)
            analysed_incidents_path = os.path.join(data_dir, "analysed_incidents.json")

            # Load existing incidents if file exists, else start with empty list
            if os.path.exists(analysed_incidents_path):
                with open(analysed_incidents_path, "r", encoding="utf-8") as f:
                    try:
                        analysed_incidents = json.load(f)
                        if not isinstance(analysed_incidents, list):
                            analysed_incidents = []
                    except Exception:
                        analysed_incidents = []
            else:
                analysed_incidents = []

            # Append the new comprehensive_analysis
            analysed_incidents.append(comprehensive_analysis)
            with open(analysed_incidents_path, "w", encoding="utf-8") as f:
                json.dump(analysed_incidents, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Background AI analysis completed and saved for incident_id={incident_id}")
            logger.debug(f"analysed_incidents count after append: {len(analysed_incidents)}")
        else:
            logger.warning(f"Background AI analysis failed or returned invalid data for incident_id={incident_id}")
            
    except Exception as e:
        logger.error(f"Error in background AI analysis for incident_id={incident_id}: {str(e)}")
        logger.exception("Full traceback:")

@mobile_router.get("/health")
async def health_check():
    """Health check endpoint for mobile API"""
    return health_check_service()

@mobile_router.post("/upload-media")
async def upload_incident(
    # Location fields
    latitude: float = Form(..., description="Latitude coordinate (-90 to 90)"),
    longitude: float = Form(..., description="Longitude coordinate (-180 to 180)"),
    
    # Incident fields
    description: str = Form(..., description="Incident description"),
    incident_type: str = Form(..., description="Type of incident"),
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
    
    Supports multiple files using the pattern: file_0, file_1, file_2, etc.
    Each file should have corresponding file_X_type and file_X_name fields.
    
    AI analysis processes in the background after upload completes.
    Returns immediately with upload confirmation.
    """
    logger = logging.getLogger("mobile_endpoints.upload_incident")
    logger.info(f"Received upload request: lat={latitude}, lon={longitude}, type={incident_type}, anon={is_anonymous}, file_0_name={file_0_name}")
    
    upload_response = await upload_incident_service(
        latitude=latitude,
        longitude=longitude,
        description=description,
        incident_type=incident_type,
        is_anonymous=is_anonymous,
        timestamp=timestamp,
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
    
    logger.debug(f"Upload response: incident_id={incident_id}, file_path={file_path}")
    
    # Start AI analysis in background (don't wait for it)
    asyncio.create_task(process_ai_analysis_background(
        incident_id=incident_id,
        file_path=file_path,
        address=address,
        timestamp=timestamp,
        latitude=latitude,
        longitude=longitude
    ))
    
    logger.info(f"File uploaded successfully for incident_id={incident_id}. AI analysis started in background.")
    
    # Return immediately after upload with simple confirmation
    return {"status": "success", "message": "Done uploading", "incident_id": incident_id}


@mobile_router.get("/incidents/formatted")
async def get_formatted_incidents():
    """Get incidents formatted for Flutter app display"""
    return await get_formatted_incidents_service()

@mobile_router.get("/location/{latitude}/{longitude}")
async def get_location_name(latitude: float, longitude: float):
    """Get location name for specific coordinates"""
    return await get_location_name_service(latitude, longitude)
