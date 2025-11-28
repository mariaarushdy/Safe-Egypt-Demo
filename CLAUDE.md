# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Safe Egypt is a comprehensive safety incident reporting system with three integrated components:
- **Mobile App** (Flutter): Citizen incident reporting with multimedia evidence
- **Backend API** (FastAPI/Python): Processes incidents with AI-powered analysis
- **Dashboard** (React/TypeScript): Authority-only interface for monitoring and response

## Development Commands

### Backend (FastAPI)
```bash
# Setup
cd backend
python -m venv venv
source venv/bin/activate  # On Mac/Linux
# venv\Scripts\activate   # On Windows
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with required API keys

# Database setup
python models/setup_db.py

# Run development server
uvicorn app:app --host 127.0.0.1 --port 8000 --reload

# Create dashboard user
python models/create_dashboard_user.py

# Run specific tests
python test_ai_service.py
python test_dashboard_service.py
```

### Dashboard (React + Vite)
```bash
# Setup
cd dashboard
npm install

# Configure environment
cp .env.example .env
# Edit .env with API URL and Google Maps key

# Development
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Mobile App (Flutter)
```bash
# Setup
cd mobile
flutter pub get

# Configure Google Maps API key in android/app/src/main/AndroidManifest.xml

# Development
flutter run --debug          # Run with hot reload
flutter build apk            # Build release APK
flutter build apk --debug    # Build debug APK
```

### Using ngrok for External Access
```bash
# In separate terminal, expose backend on port 8000
ngrok http 8000

# Update mobile app: mobile/lib/services/api_service.dart line ~47
# Update dashboard: dashboard/.env with VITE_API_BASE_URL
```

## Architecture

### Backend Structure
- **`app.py`**: FastAPI application entry point with CORS middleware
- **`routes/`**: API endpoint routers
  - `mobile_endpoints.py`: Mobile app API (`/api/mobile/*`)
  - `dashboard_endpoints.py`: Dashboard API (`/api/dashboard/*`)
- **`services/`**: Business logic layer
  - `mobile.py`: Mobile incident upload, formatting, user registration
  - `dashboard.py`: Dashboard incident management, user management
  - `AI.py`: Google Gemini integration for incident analysis
  - `auth.py`: JWT authentication, password hashing
  - `utilities.py`: Reverse geocoding and shared utilities
- **`models/`**: Database layer
  - `db_helper.py`: PostgreSQL database operations
  - `setup_db.py`: Database initialization script
  - `database.py`, `simple_database.py`: Database utilities
- **`data/uploads/`**: User-uploaded media files (images/videos)

### Database Schema (PostgreSQL)
- **`app_users`**: Mobile app users (device_id is primary, national_id optional for registered users)
- **`dashboard_users`**: Dashboard authentication (username/password with bcrypt)
- **`incidents`**: Incident reports with AI analysis (JSONB for detected_events)
- **`locations`**: Geographic data (address, lat/lng)
- **`media_files`**: References to uploaded media per incident

### Frontend (Dashboard) Structure
- **`src/App.tsx`**: React Router setup with routes
- **`src/pages/`**: Main page components
  - `Login.tsx`: Dashboard authentication
  - `Dashboard.tsx`: Main dashboard with map and incident feed
  - `Reports.tsx`: Incident reports table
  - `Analytics.tsx`: Statistics and charts
  - `Settings.tsx`: User management for dashboard
  - `IncidentDetail.tsx`: Detailed incident view with media
  - `EventDetail.tsx`: Individual event analysis from AI
- **`src/components/`**: Reusable UI components
  - `Sidebar.tsx`: Navigation sidebar
  - `AlertsPanel.tsx`: Real-time alerts
  - `GoogleMapWrapper.tsx`: Google Maps integration
  - `ui/`: shadcn/ui components
- **`src/lib/api.ts`**: API client with TypeScript interfaces
- **`src/contexts/LanguageContext.tsx`**: Arabic/English localization

### Mobile App Structure
- **`lib/main.dart`**: Flutter app entry point
- **`lib/pages/`**: Screen components
  - `home_page.dart`: Main screen with incident feed
  - `report_incident_screen.dart`: Incident submission form
  - `registration.dart`: Optional user registration
  - `notifications_alerts_page.dart`: User notifications
  - `onboarding_pages.dart`: First-time user flow
- **`lib/services/`**: External integrations
  - `api_service.dart`: Backend API client (change baseUrl for ngrok)
  - `location_service.dart`: GPS location tracking
  - `media_service.dart`: Camera/gallery access
  - `permission_service.dart`: Android permissions
- **`lib/models/`**: Data models
- **`lib/components/`**: Reusable widgets

## Key Technical Details

### API Endpoint Structure
Backend provides both new organized structure (`/api/mobile/*`, `/api/dashboard/*`) and legacy routes (root level) for backward compatibility. Mobile app can use either.

### AI Processing
- Background processing via FastAPI BackgroundTasks
- Google Gemini API analyzes incident media for:
  - Category classification (violence, accident, utility issue, illegal activity)
  - Severity assessment (low/medium/high)
  - Event detection (JSONB array in database)
  - Verification status (real/fake)
- Analysis results stored in `incidents.detected_events` as JSONB

### Authentication
- **Mobile**: Anonymous by device_id, optional registration adds national_id
- **Dashboard**: JWT-based with bcrypt password hashing
- Default admin user: `admin` / `Admin@123` (change on first login)

### File Upload Strategy
Mobile app uses multipart/form-data with multiple files. Backend saves to `data/uploads/images/` or `data/uploads/videos/` and stores paths in database.

### Real-time Updates
Dashboard polls `/api/dashboard/incidents` endpoint periodically. No WebSocket implementation.

### Localization
Both dashboard and mobile support Arabic (RTL) and English. Dashboard uses i18n context, mobile uses easy_localization package.

## Environment Variables

### Backend `.env`
```
JWT_SECRET_KEY=<strong-random-key>
GOOGLE_API_KEY=<gemini-api-key>
DATABASE_URL=sqlite:///./data/auth.db  # Or PostgreSQL URL
DB_NAME=<postgres-db-name>
DB_USER=<postgres-user>
DB_PASSWORD=<postgres-password>
DB_HOST=<postgres-host>
DB_PORT=<postgres-port>
```

### Dashboard `.env`
```
VITE_GOOGLE_MAPS_API_KEY=<google-maps-key>
VITE_API_BASE_URL=http://localhost:8000  # Or ngrok URL
```

### Mobile Configuration
Edit `lib/services/api_service.dart` to set baseUrl (localhost IP or ngrok URL).
Edit `android/app/src/main/AndroidManifest.xml` for Google Maps API key.

## Common Development Workflows

### Adding New Incident Fields
1. Update database schema in `backend/models/setup_db.py` (add column to incidents table)
2. Run migration or recreate database
3. Update `backend/services/AI.py` analysis models if AI should populate field
4. Update `dashboard/src/lib/api.ts` TypeScript interface
5. Update UI in relevant dashboard pages (`IncidentDetail.tsx`, etc.)

### Adding New API Endpoint
1. Add route function in `backend/routes/mobile_endpoints.py` or `dashboard_endpoints.py`
2. Implement business logic in corresponding service (`services/mobile.py` or `services/dashboard.py`)
3. Update frontend API client (`dashboard/src/lib/api.ts` or `mobile/lib/services/api_service.dart`)
4. Update UI to call new endpoint

### Changing AI Analysis Behavior
Edit `backend/services/AI.py`:
- Modify enums to change categories/types
- Update Pydantic models to change analysis structure
- Adjust prompts in `run_full_ai_analysis()` function
- Changes automatically reflected in dashboard via JSONB storage

### Deploying with ngrok
1. Start backend: `uvicorn app:app --host 127.0.0.1 --port 8000`
2. Start ngrok: `ngrok http 8000`
3. Copy ngrok URL (e.g., `https://abc123.ngrok-free.dev`)
4. Update mobile app `baseUrl` in `api_service.dart` line ~47
5. Update dashboard `.env`: `VITE_API_BASE_URL=https://abc123.ngrok-free.dev`
6. Rebuild/restart mobile app and dashboard

## Important Notes

- Backend uses both SQLite (default) and PostgreSQL (production). Database type depends on `DATABASE_URL` in `.env`.
- Mobile app requires physical Android device or emulator for GPS/camera features.
- Dashboard is authority-only; contains sensitive incident data.
- All user passwords use bcrypt hashing (dashboard) or no passwords (mobile anonymous users).
- Media files are stored on filesystem, not in database. Database stores paths only.
- Background AI analysis means upload endpoint returns immediately; analysis completes asynchronously.
