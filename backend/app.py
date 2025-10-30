from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.mobile_endpoints import mobile_router
from routes.dashboard_endpoints import dashboard_router
# from services.mobile import load_config
import os
from pathlib import Path
import logging


# Create FastAPI app
app = FastAPI(
    title="Digitopia Media API",
    description="API for receiving media files (images/videos) with location data from Flutter app",
    version="1.0.0"
)

# Configure CORS for Flutter app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Flutter app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directories inside data folder
UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "images").mkdir(exist_ok=True)
(UPLOAD_DIR / "videos").mkdir(exist_ok=True)

# Load configuration on startup
# load_config()

# Include routers
app.include_router(mobile_router, prefix="/api/mobile", tags=["Mobile"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])

# Add backward compatibility routes (without /api/mobile prefix)
# This allows existing Flutter app to work without changes
app.include_router(mobile_router, tags=["Mobile - Legacy"])

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Digitopia Media API",
        "version": "1.0.0",
        "structure": "New organized structure with backward compatibility",
        "endpoints": {
            "new_structure": {
                "/api/mobile/upload-media": "POST - Upload image/video with location",
                "/api/mobile/incidents/formatted": "GET - Get formatted incidents for Flutter app", 
                "/api/mobile/location/{latitude}/{longitude}": "GET - Get location name for coordinates",
                "/api/mobile/health": "GET - Health check",
                "/api/mobile/register-user": "POST - Register user",
                "/api/dashboard/...": "Dashboard endpoints (to be implemented)"
            },
            "legacy_support": {
                "/upload-media": "POST - Upload image/video with location (legacy)",
                "/incidents/formatted": "GET - Get formatted incidents for Flutter app (legacy)",
                "/location/{latitude}/{longitude}": "GET - Get location name for coordinates (legacy)",
                "/health": "GET - Health check (legacy)"
            }
        },
        "note": "Legacy endpoints are provided for backward compatibility. Please migrate to /api/mobile/ prefix when possible."
    }

if __name__ == "__main__":
    import uvicorn
    print("Starting server...")
    
    if not os.path.exists("data"):
        os.makedirs("data")
    if not os.path.exists("data/uploads"):
        os.makedirs("data/uploads")
    if not os.path.exists("data/uploads/images"):
        os.makedirs("data/uploads/images")
    if not os.path.exists("data/uploads/videos"):
        os.makedirs("data/uploads/videos")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
