from pydantic import BaseModel, Field, validator
from fastapi import APIRouter, HTTPException, Response, Request
from fastapi.responses import FileResponse
from services.dashboard import (
    get_incidents_summary_service, 
    get_incident_by_id_service, 
    update_incident_status_service,
    manage_users_service
)
from typing import Optional
import os
import hashlib

# Create router for dashboard endpoints
dashboard_router = APIRouter()

# Request models
class LoginRequest(BaseModel):
    username: str
    password: str

class VideoRequest(BaseModel):
    file_path: str

class ImageRequest(BaseModel):
    image_path: str

class StatusUpdateRequest(BaseModel):
    status: str
    
    @validator('status')
    def validate_status(cls, v):
        if v.lower() not in ['accepted', 'rejected']:
            raise ValueError('Status must be either "accepted" or "rejected"')
        return v.lower()

# Edit user request model
class EditUserRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=3, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=128)

# Login endpoint
@dashboard_router.post("/login")
async def login_dashboard_user(request: LoginRequest):
    from services.auth import authenticate_dashboard_user
    result = await authenticate_dashboard_user(request.username, request.password)
    if result["status"] == "error":
        raise HTTPException(status_code=401, detail=result["message"])
    return result

# Edit user endpoint
@dashboard_router.put("/users/{user_id}")
async def edit_dashboard_user(user_id: int, request: EditUserRequest):
    from services.dashboard import edit_dashboard_user_service
    result = edit_dashboard_user_service(user_id, request.full_name, request.password)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

# Delete user endpoint
@dashboard_router.delete("/users/{user_id}")
async def delete_dashboard_user(user_id: int):
    from services.dashboard import delete_dashboard_user_service
    result = delete_dashboard_user_service(user_id)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

def get_file_etag(file_path: str) -> str:
    """Generate ETag for caching"""
    try:
        file_stat = os.stat(file_path)
        return hashlib.md5(f"{file_path}{file_stat.st_mtime}".encode()).hexdigest()
    except:
        return hashlib.md5(file_path.encode()).hexdigest()

@dashboard_router.get("/")
async def dashboard_root():
    """Dashboard root endpoint"""
    return {
        "message": "Dashboard API endpoints",
        "status": "Active",
        "available_endpoints": [
            "GET /api/dashboard/ - This endpoint",
            "GET /api/dashboard/users - Get users summary",
            "GET /api/dashboard/incidents - Get incidents summary",
            "GET /api/dashboard/incident/{incident_id} - Get detailed incident information",
            "POST /api/dashboard/incident/{incident_id}/video - Serve video file (body: {file_path})",
            "POST /api/dashboard/incident/{incident_id}/image - Serve image file (body: {image_path})",
            "POST /api/dashboard/incident/{incident_id}/status - Update incident status (body: {status})"
        ]
    }

@dashboard_router.get("/users")
async def get_users():
    """Get summary of system users"""
    users_data = manage_users_service()
    if users_data["status"] == "error":
        raise HTTPException(status_code=500, detail=users_data["message"])
    return users_data

@dashboard_router.get("/incidents")
async def get_incidents_summary():
    """
    Get summary of all incidents with essential information for dashboard display
    
    Returns:
        Dict containing list of incidents with key fields:
        - category, title, description, severity, verified
        - incident_id, timestamp, status, location
    """
    return get_incidents_summary_service()

# Request model for creating a user
class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    full_name: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
# Add user creation endpoint
@dashboard_router.post("/users")
async def create_dashboard_user(request: CreateUserRequest):
    """Create a new dashboard user (admin only)."""
    from services.dashboard import create_dashboard_user_service
    result = create_dashboard_user_service(request.username, request.full_name, request.password)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@dashboard_router.get("/incident/{incident_id}")
async def get_incident_by_id(incident_id: str):
    """
    Get detailed incident information by ID from analysed incidents data
    
    Args:
        incident_id: The unique incident identifier
        
    Returns:
        Dict containing complete analysed incident information including:
        - category, title, description, severity, verified status
        - violence_type, weapon, site_description, number_of_people
        - detected_events with image paths and metadata
        - location and timestamp information
        - real_files paths
    """
    return get_incident_by_id_service(incident_id)


@dashboard_router.post("/incident/{incident_id}/video")
async def serve_incident_video(incident_id: str, request: VideoRequest, req: Request):
    """
    Serve video file associated with an incident
    
    Args:
        incident_id: The unique incident identifier
        request: VideoRequest containing file_path
        
    Returns:
        Video file as FileResponse
    """
    # Get incident data to verify the file belongs to this incident
    incident_data = get_incident_by_id_service(incident_id)
    
    # Normalize the requested path
    requested_path = request.file_path.replace("\\", "/")
    
    # Check if the requested file path exists in the incident's real_files
    video_found = False
    actual_file_path = None
    
    for real_file in incident_data.get("incident_info", {}).get("real_files", []):
        # Normalize stored path
        stored_path = real_file.replace("\\", "/")
        
        # Check if the requested path matches the stored path
        if requested_path == stored_path or requested_path in stored_path:
            # Try different path variations to find the actual file
            if os.path.exists(stored_path):
                actual_file_path = stored_path
                video_found = True
                break
            elif os.path.exists("data/" + stored_path):
                actual_file_path = "data/" + stored_path
                video_found = True
                break
            elif not stored_path.startswith("data/") and os.path.exists(stored_path):
                actual_file_path = stored_path
                video_found = True
                break
    
    if not video_found:
        raise HTTPException(status_code=404, detail=f"Video file {request.file_path} not found for incident {incident_id}")
    
    if not actual_file_path or not os.path.exists(actual_file_path):
        raise HTTPException(status_code=404, detail="Video file not found on server")
    
    # Generate ETag for cache validation
    etag = get_file_etag(actual_file_path)
    
    # Check if client has cached version
    if_none_match = req.headers.get("if-none-match")
    if if_none_match == etag:
        return Response(status_code=304)  # Not Modified
    
    # Return file response with appropriate headers
    return FileResponse(
        path=actual_file_path,
        media_type="video/mp4",
        filename=os.path.basename(actual_file_path),
        headers={
            "Cache-Control": "public, max-age=604800, immutable",  # 7 days
            "ETag": etag,
            "Accept-Ranges": "bytes",
        }
    )


@dashboard_router.post("/incident/{incident_id}/image")
async def serve_incident_image(incident_id: str, request: ImageRequest, req: Request):
    """
    Serve image file associated with an incident
    
    Args:
        incident_id: The unique incident identifier  
        request: ImageRequest containing image_path
        
    Returns:
        Image file as FileResponse
    """
    # Get incident data to verify the file belongs to this incident
    incident_data = get_incident_by_id_service(incident_id)
    
    # Find the requested image file in detected events
    image_found = False
    image_path = request.image_path
    
    for event in incident_data.get("incident_info", {}).get("detected_events", []):
        # Check scene image
        if event.get("image_path") and image_path in event.get("image_path", ""):
            if os.path.exists(image_path):
                image_found = True
                break
        
        # Check detection images
        for det_path in event.get("detected_elements_paths", []):
            if image_path in det_path and os.path.exists(image_path):
                image_found = True
                break
        
        if image_found:
            break
    
    if not image_found:
        raise HTTPException(status_code=404, detail=f"Image file not found for incident {incident_id}")
    
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image file not found on server")
    
    # Generate ETag for cache validation
    etag = get_file_etag(image_path)
    
    # Check if client has cached version
    if_none_match = req.headers.get("if-none-match")
    if if_none_match == etag:
        return Response(status_code=304)  # Not Modified
    
    # Determine media type based on file extension
    if image_path.lower().endswith('.jpg') or image_path.lower().endswith('.jpeg'):
        media_type = "image/jpeg"
    elif image_path.lower().endswith('.png'):
        media_type = "image/png"
    else:
        media_type = "image/jpeg"  # Default
    
    return FileResponse(
        path=image_path,
        media_type=media_type,
        filename=os.path.basename(image_path),
        headers={
            "Cache-Control": "public, max-age=604800, immutable",  # 7 days
            "ETag": etag,
        }
    )


@dashboard_router.post("/incident/{incident_id}/status")
async def update_incident_status(incident_id: str, request: StatusUpdateRequest):
    """
    Update incident status to accepted or rejected
    
    Args:
        incident_id: The unique incident identifier
        request: StatusUpdateRequest containing status (accepted/rejected)
        
    Returns:
        Dict containing success message and updated incident info
    """
    return update_incident_status_service(incident_id, request.status)

# TODO: Add dashboard-specific endpoints here
# Examples:
# - GET /analytics - Get incident analytics
# - GET /reports - Get detailed reports
# - GET /users - Manage users
# - etc.
