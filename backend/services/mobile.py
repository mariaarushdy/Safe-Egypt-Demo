from fastapi import File, UploadFile, Form, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import os
import uuid
from pathlib import Path
import mimetypes
from datetime import datetime
import json
import httpx
import asyncio
from models.db_helper import get_all_incidents_from_db, create_registered_user

# JSON file paths
INCIDENTS_JSON_FILE = "data/incidents_data.json"
CONFIG_JSON_FILE = "data/incident_config.json"

# Cache for location names to avoid repeated API calls
location_cache = {}

# Global configuration loaded from JSON
config_data = {}

# Upload directory (inside data folder)
UPLOAD_DIR = Path("data/uploads")

# Pydantic models
class LocationData(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude coordinate")
    
    @field_validator('latitude')
    @classmethod
    def validate_latitude(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('Latitude must be between -90 and 90')
        return v
    
    @field_validator('longitude')
    @classmethod
    def validate_longitude(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('Longitude must be between -180 and 180')
        return v

class IncidentData(BaseModel):
    description: str = Field(default="No description", description="Incident description")
    is_anonymous: bool = Field(..., description="Whether the report is anonymous")
    timestamp: datetime = Field(..., description="Incident timestamp")

class FileData(BaseModel):
    filename: str
    file_type: str  # "photo" or "video"
    file_size: int
    saved_filename: str
    file_path: str

class IncidentUploadResponse(BaseModel):
    success: bool
    message: str
    incident_id: str
    location: LocationData
    incident: IncidentData
    files: list[FileData]

# Allowed file types
ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/gif", "image/bmp", "image/webp",
    "application/octet-stream",  # fallback for Flutter uploads
}

ALLOWED_VIDEO_TYPES = {
    "video/mp4", "video/avi", "video/mov",
    "video/wmv", "video/flv", "video/webm",
    "video/mkv", "application/octet-stream",  # fallback for Flutter uploads
}

ALLOWED_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES
# Maximum file size (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024

def load_config():
    """Load configuration from JSON file"""
    global config_data
    try:
        if os.path.exists(CONFIG_JSON_FILE):
            with open(CONFIG_JSON_FILE, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
                print(f"✅ Configuration loaded from {CONFIG_JSON_FILE}")
        else:
            print(f"⚠️ Configuration file {CONFIG_JSON_FILE} not found, using defaults")
            config_data = {
                "incident_types": {
                    "emergency": {
                        "title": "Emergency Incident",
                        "description": "Emergency situation reported",
                        "severity": "High",
                        "severity_color": "red",
                        "icon": "warning"
                    }
                },
                "default_incident_type": "emergency",
                "location_regions": [],
                "geocoding": {
                    "enabled": True,
                    "fallback_to_regions": True,
                    "cache_enabled": True,
                    "timeout_seconds": 5,
                    "user_agent": "Digitopia-Backend/1.0.0"
                },
                "api_settings": {
                    "max_incidents_per_request": 100,
                    "default_icon": "local_fire_department"
                }
            }
    except Exception as e:
        print(f"❌ Error loading configuration: {e}")
        config_data = {}

def get_location_from_regions(latitude: float, longitude: float) -> str:
    """Get location name from predefined regions in config"""
    regions = config_data.get("location_regions", [])
    
    for region in regions:
        bounds = region.get("bounds", {})
        if (bounds.get("lat_min", 0) <= latitude <= bounds.get("lat_max", 0) and
            bounds.get("lng_min", 0) <= longitude <= bounds.get("lng_max", 0)):
            return region.get("name", "Unknown Location")
    
    return f"Lat: {latitude:.4f}, Lng: {longitude:.4f}"

async def get_place_name(latitude: float, longitude: float) -> str:
    """
    Get place name from coordinates using OpenStreetMap Nominatim API or config regions
    """
    geocoding_config = config_data.get("geocoding", {})
    
    # Create a cache key
    cache_key = f"{latitude:.4f},{longitude:.4f}"
    
    # Check cache first if enabled
    if geocoding_config.get("cache_enabled", True) and cache_key in location_cache:
        return location_cache[cache_key]
    
    # Try geocoding API if enabled
    if geocoding_config.get("enabled", True):
        try:
            # Use Nominatim API for reverse geocoding
            url = "https://nominatim.openstreetmap.org/reverse"
            params = {
                "lat": latitude,
                "lon": longitude,
                "format": "json",
                "addressdetails": 1,
                "accept-language": "en"
            }
            
            headers = {
                "User-Agent": geocoding_config.get("user_agent", "Digitopia-Backend/1.0.0")
            }
            
            timeout = geocoding_config.get("timeout_seconds", 5)
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, headers=headers, timeout=float(timeout))
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Extract location name from response
                    address = data.get("address", {})
                    display_name = data.get("display_name", "")
                    
                    # Try to get a meaningful location name
                    location_parts = []
                    
                    # Priority order for location components
                    if address.get("neighbourhood"):
                        location_parts.append(address["neighbourhood"])
                    elif address.get("suburb"):
                        location_parts.append(address["suburb"])
                    elif address.get("city_district"):
                        location_parts.append(address["city_district"])
                    
                    if address.get("city"):
                        location_parts.append(address["city"])
                    elif address.get("town"):
                        location_parts.append(address["town"])
                    elif address.get("village"):
                        location_parts.append(address["village"])
                    
                    if address.get("state"):
                        location_parts.append(address["state"])
                    elif address.get("governorate"):
                        location_parts.append(address["governorate"])
                    
                    if location_parts:
                        location_name = ", ".join(location_parts[:2])  # Take first 2 components
                    else:
                        # Fallback to display name or coordinates
                        if display_name:
                            # Take first part of display name (usually the most specific)
                            location_name = display_name.split(",")[0].strip()
                        else:
                            location_name = f"Lat: {latitude:.4f}, Lng: {longitude:.4f}"
                    
                    # Cache the result if caching is enabled
                    if geocoding_config.get("cache_enabled", True):
                        location_cache[cache_key] = location_name
                    return location_name
                else:
                    print(f"Geocoding API error: {response.status_code}")
                    
        except httpx.TimeoutException:
            print(f"Geocoding timeout for {latitude}, {longitude}")
        except Exception as e:
            print(f"Geocoding error for {latitude}, {longitude}: {e}")
    
    # Fallback: Use predefined regions from config
    if geocoding_config.get("fallback_to_regions", True):
        fallback_name = get_location_from_regions(latitude, longitude)
    else:
        fallback_name = f"Lat: {latitude:.4f}, Lng: {longitude:.4f}"
    
    # Cache the fallback result if caching is enabled
    if geocoding_config.get("cache_enabled", True):
        location_cache[cache_key] = fallback_name
    #TODO : return the city to be able to filter on cities names on the app side
    return fallback_name

def get_file_type(content_type: str) -> str:
    """Determine if file is image or video based on content type"""
    if content_type in ALLOWED_IMAGE_TYPES:
        return "image"
    elif content_type in ALLOWED_VIDEO_TYPES:
        return "video"
    else:
        return "unknown"

def save_file(file: UploadFile, file_type: str, original_filename: str = None) -> tuple[str, str]:
    """Save uploaded file and return file path and unique filename"""
    # Use original filename if provided, otherwise use file.filename
    filename = original_filename if original_filename else file.filename
    
    # Generate unique filename
    file_extension = Path(filename).suffix if filename else ""
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Determine subdirectory based on file_type
    if file_type == "photo":
        subdir = "images"
    elif file_type == "video":
        subdir = "videos"
    else:
        # Fallback to content-type detection
        content_type = file.content_type
        subdir = "images" if content_type in ALLOWED_IMAGE_TYPES else "videos"
    
    file_path = UPLOAD_DIR / subdir / unique_filename
    
    # Save file
    with open(file_path, "wb") as buffer:
        content = file.file.read()
        buffer.write(content)
    
    return str(file_path), unique_filename

def save_incident_to_json(incident_data: dict):
    """Save incident data to JSON file"""
    try:
        # Ensure data directory exists
        os.makedirs(os.path.dirname(INCIDENTS_JSON_FILE), exist_ok=True)
        
        # Load existing data
        if os.path.exists(INCIDENTS_JSON_FILE):
            with open(INCIDENTS_JSON_FILE, 'r', encoding='utf-8') as f:
                incidents = json.load(f)
        else:
            incidents = []
        
        # Add new incident
        incidents.append(incident_data)
        
        # Save back to file
        with open(INCIDENTS_JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(incidents, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"✅ Saved incident data to {INCIDENTS_JSON_FILE}")
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error when reading existing file: {e}")
        print(f"❌ Creating new incidents file...")
        # Create new file with just this incident
        try:
            with open(INCIDENTS_JSON_FILE, 'w', encoding='utf-8') as f:
                json.dump([incident_data], f, indent=2, ensure_ascii=False, default=str)
            print(f"✅ Created new incidents file successfully")
        except Exception as e2:
            print(f"❌ Failed to create new file: {e2}")
    except PermissionError as e:
        print(f"❌ Permission denied when saving to JSON: {e}")
    except Exception as e:
        print(f"❌ Unexpected error saving to JSON: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()

async def upload_incident_service(
    latitude: float,
    longitude: float,
    description: str,
    is_anonymous: str,
    timestamp: str,
    device_id: str,
    file_0: UploadFile,
    file_0_type: str,
    file_0_name: str,
    file_1: Optional[UploadFile] = None,
    file_1_type: Optional[str] = None,
    file_1_name: Optional[str] = None,
    file_2: Optional[UploadFile] = None,
    file_2_type: Optional[str] = None,
    file_2_name: Optional[str] = None,
) -> IncidentUploadResponse:
    """Service function to handle incident upload"""
    try:
        print(f"\n🚀 New incident upload request received:")
        print(f"📍 Location: {latitude}, {longitude}")
        print(f"📝 Description: {description}")
        print(f"👤 Anonymous: {is_anonymous}")
        print(f"⏰ Timestamp: {timestamp}")
        print(f"📱 Device ID: {device_id}")
        
        # Validate location data
        location = LocationData(latitude=latitude, longitude=longitude)
        print(f"✅ Location validated")
        
        # Parse and validate incident data
        is_anonymous_bool = is_anonymous.lower() == "true"
        
        try:
            timestamp_dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid timestamp format. Use ISO format.")
        
        incident = IncidentData(
            description=description,
            is_anonymous=is_anonymous_bool,
            timestamp=timestamp_dt
        )
        
        # Process files
        files_to_process = []
        if file_0:
            files_to_process.append((file_0, file_0_type, file_0_name))
        if file_1:
            files_to_process.append((file_1, file_1_type, file_1_name))
        if file_2:
            files_to_process.append((file_2, file_2_type, file_2_name))
        
        processed_files = []
        
        for file, file_type, original_name in files_to_process:
            try:
                print(f"📁 Processing file: {original_name} (type: {file_type})")
                
                # Check file size
                file.file.seek(0, 2)  # Seek to end
                file_size = file.file.tell()
                file.file.seek(0)  # Reset to beginning
                
                print(f"📊 File size: {file_size} bytes")
                
                if file_size > MAX_FILE_SIZE:
                    error_msg = f"File {original_name} too large. Size: {file_size} bytes, Max: {MAX_FILE_SIZE} bytes ({MAX_FILE_SIZE // (1024*1024)}MB)"
                    print(f"❌ {error_msg}")
                    raise HTTPException(status_code=413, detail=error_msg)
                
                # Validate file type if needed (optional, since we trust the client's file_type)
                content_type = file.content_type
                print(f"📄 Content type: {content_type}")
                
                if content_type and content_type not in ALLOWED_TYPES:
                    error_msg = f"Unsupported file type for {original_name}: {content_type}. Allowed types: {list(ALLOWED_TYPES)}"
                    print(f"❌ {error_msg}")
                    raise HTTPException(status_code=400, detail=error_msg)
                
                # Save file
                print(f"💾 Saving file {original_name}...")
                file_path, saved_filename = save_file(file, file_type, original_name)
                print(f"✅ File saved as: {saved_filename}")
                
            except HTTPException:
                raise  # Re-raise HTTP exceptions
            except Exception as e:
                error_msg = f"Error processing file {original_name}: {str(e)}"
                print(f"❌ {error_msg}")
                print(f"❌ Error type: {type(e).__name__}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=error_msg)
            
            processed_files.append(FileData(
                filename=original_name,
                file_type=file_type,
                file_size=file_size,
                saved_filename=saved_filename,
                file_path=file_path
            ))
        
        # Generate unique incident ID
        incident_id = str(uuid.uuid4())
        
        # Prepare data for JSON storage
        json_data = {
            "incident_id": incident_id,
            "timestamp_received": datetime.now().isoformat(),
            "device_id": device_id,
            "location": {
                "latitude": location.latitude,
                "longitude": location.longitude
            },
            "incident": {
                "description": incident.description,
                # "incident_type": "emergency",  # Default type since not provided
                "is_anonymous": incident.is_anonymous,
                "timestamp": incident.timestamp.isoformat()
            },
            "files": [
                {
                    "filename": f.filename,
                    "file_type": f.file_type,
                    "file_size": f.file_size,
                    "saved_filename": f.saved_filename,
                    "file_path": f.file_path
                } for f in processed_files
            ]
        }
        
        # Save to JSON file
        save_incident_to_json(json_data)
        
        # Return response
        return IncidentUploadResponse(
            success=True,
            message="Incident report uploaded successfully",
            incident_id=incident_id,
            location=location,
            incident=incident,
            files=processed_files
        )
        
    except ValueError as e:
        print(f"❌ ValueError: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        print(f"❌ Full traceback:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

async def get_formatted_incidents_service():
    """Service function to get formatted incidents for Flutter app"""
    try:
        if not os.path.exists(INCIDENTS_JSON_FILE):
            return {"incidents": [], "count": 0}
        
        with open(INCIDENTS_JSON_FILE, 'r', encoding='utf-8') as f:
            raw_incidents = json.load(f)
        
        formatted_incidents = []
        
        for idx, incident in enumerate(raw_incidents):
            # Extract location from incident data
            location = incident.get("location", {})
            latitude = location.get("latitude", 30.0444)  # Default to Cairo
            longitude = location.get("longitude", 31.2357)
            
            # Extract timestamp and calculate time ago
            timestamp_received = incident.get("timestamp_received", "")
            incident_timestamp = incident.get("incident", {}).get("timestamp", "")
            
            # Use the more recent timestamp
            timestamp_to_use = timestamp_received or incident_timestamp
            time_display = "Unknown time"
            
            if timestamp_to_use:
                try:
                    # Parse timestamp
                    if timestamp_to_use.endswith('Z'):
                        timestamp_dt = datetime.fromisoformat(timestamp_to_use.replace('Z', '+00:00'))
                    elif '+' in timestamp_to_use or timestamp_to_use.endswith('+00:00'):
                        timestamp_dt = datetime.fromisoformat(timestamp_to_use)
                    else:
                        timestamp_dt = datetime.fromisoformat(timestamp_to_use)
                    
                    # Calculate time difference
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
                        
                except Exception as e:
                    print(f"Error parsing timestamp {timestamp_to_use}: {e}")
                    time_display = "Unknown time"
            
            # Get incident details
            incident_data = incident.get("incident", {})
            description = incident_data.get("description", "No description")
            incident_type = incident_data.get("incident_type", "emergency")
            is_anonymous = incident_data.get("is_anonymous", False)
            
            # Get incident type mappings from config
            type_mapping = config_data.get("incident_types", {})
            default_type = config_data.get("default_incident_type", "emergency")
            
            # Get type info or default
            if incident_type in type_mapping:
                type_info = type_mapping[incident_type]
            elif default_type in type_mapping:
                type_info = type_mapping[default_type]
            else:
                # Ultimate fallback
                type_info = {
                    "title": "Unknown Incident",
                    "description": "Incident type not configured",
                    "severity": "Medium",
                    "severity_color": "gray",
                    "icon": "help"
                }
            
            # Get location name from coordinates using geocoding
            location_name = await get_place_name(latitude, longitude)
            
            # Get default icon from config
            default_icon = config_data.get("api_settings", {}).get("default_icon", "local_fire_department")
            
            # Format the incident data
            formatted_incident = {
                "id": str(idx + 1),
                "title": type_info.get("title", "Unknown Incident"),
                "description": type_info.get("description", "No description available"),
                "location": location_name,
                "severity": type_info.get("severity", "Medium"),
                "severityColor": type_info.get("severity_color", "gray"),
                "icon": type_info.get("icon", default_icon),
                "timestamp": time_display,
                "verified": not is_anonymous,  # Anonymous reports are unverified
                "position": {
                    "latitude": latitude,
                    "longitude": longitude
                },
                # Additional data that might be useful
                "original_description": description,
                "incident_type": incident_type,
                "incident_id": incident.get("incident_id", ""),
                "has_files": len(incident.get("files", [])) > 0,
                "file_count": len(incident.get("files", []))
            }
            
            formatted_incidents.append(formatted_incident)
        
        return {
            "incidents": formatted_incidents,
            "count": len(formatted_incidents),
            "message": "Incidents formatted successfully"
        }
        
    except Exception as e:
        print(f"Error formatting incidents: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error formatting incidents: {str(e)}")

async def get_location_name_service(latitude: float, longitude: float):
    """Service function to get location name for specific coordinates"""
    try:
        location_name = await get_place_name(latitude, longitude)
        return {
            "latitude": latitude,
            "longitude": longitude,
            "location_name": location_name,
            "cached": f"{latitude:.4f},{longitude:.4f}" in location_cache
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting location name: {str(e)}")

def health_check_service():
    """Service function for health check"""
    return {"status": "healthy", "message": "Mobile API is running"}

async def get_formatted_incidents_from_db_service():
    """Service function to get formatted incidents from DATABASE for Flutter app"""
    try:
        incidents = get_all_incidents_from_db()
        
        formatted_incidents = []
        
        for incident in incidents:
            # Calculate time ago from timestamp
            time_display = "Unknown time"
            if incident.get('timestamp'):
                try:
                    timestamp_dt = datetime.fromisoformat(incident['timestamp'])
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
                except Exception as e:
                    print(f"Error parsing timestamp: {e}")
            
            # Format the incident data
            formatted_incident = {
                "incident_id": incident['incident_id'],
                "title": incident.get('title', 'Unknown Incident'),
                "description": incident.get('description', 'No description available'),
                "location": incident.get('address', 'Unknown location'),
                "severity": incident.get('severity', 'Medium'),
                "severityColor": "red" if incident.get('severity') == 'High' else "orange" if incident.get('severity') == 'Medium' else "gray",
                # "icon": "local_fire_department",
                "verified": incident.get('status') != 'pending',
                "position": {
                    "latitude": incident.get('latitude', 0),
                    "longitude": incident.get('longitude', 0)
                },
                "violence_type": incident.get('violence_type', 'Unknown'),
                "weapon": incident.get('weapon', 'Unknown'),
                "site_description": incident.get('site_description', 'Unknown'),
                "number_of_people": incident.get('number_of_people', 'Unknown'),
                "description_of_people": incident.get('description_of_people', 'Unknown'),
                "detailed_description_for_the_incident": incident.get('detailed_description_for_the_incident', 'Unknown'),
                "accident_type": incident.get('accident_type', 'Unknown'),
                "vehicles_machines_involved": incident.get('vehicles_machines_involved', 'Unknown'),
                "utility_type": incident.get('utility_type', 'Unknown'),
                "extent_of_impact": incident.get('extent_of_impact', 'Unknown'),
                "duration": incident.get('duration', 'Unknown'),
                "illegal_type": incident.get('illegal_type', 'Unknown'),
                "items_involved": incident.get('items_involved', 'Unknown'),
                "detected_events": incident.get('detected_events', 'Unknown'),
                "timestamp": incident.get('timestamp', 'Unknown'),
                "status": incident.get('status', 'pending'),
                "location_id": incident.get('location_id', 'Unknown'),
                "real_files": incident.get('real_files', 'Unknown'),
                "category": incident.get('category', 'Unknown'),
                "has_files": len(incident.get('media_files', [])) > 0,
                "file_count": len(incident.get('media_files', [])),
                "device_id": incident.get('device_id'),
                "user_name": incident.get('user_name', 'Anonymous User'),
                "is_anonymous": incident.get('is_anonymous', True)
            }
            
            formatted_incidents.append(formatted_incident)
        
        return {
            "incidents": formatted_incidents,
            "total_incidents": len(formatted_incidents),
            "message": "Incidents retrieved successfully"
        }
        
    except Exception as e:
        print(f"Error formatting incidents from database: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error formatting incidents: {str(e)}")

async def register_user_service(device_id: str, national_id: str, full_name: str, contact_info: str):
    """Service function to register a user account"""
    try:
        user_id = create_registered_user(national_id, full_name, contact_info, device_id)
        
        if user_id:
            return {
                "success": True,
                "message": "User registered successfully",
                "user_id": user_id,
                "device_id": device_id
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to register user")
            
    except Exception as e:
        print(f"Error registering user: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error registering user: {str(e)}")
