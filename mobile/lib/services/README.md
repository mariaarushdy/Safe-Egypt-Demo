# API Service Implementation

This implementation provides functionality to send video/image files along with location coordinates to your API server.

## Features

- ✅ Upload media files (images, videos, audio) with location data
- ✅ Automatic location detection using GPS
- ✅ Support for multiple media files in a single request
- ✅ Error handling and loading states
- ✅ Anonymous reporting option
- ✅ Incident type classification

## API Endpoints

### 1. Upload Media with Location
```
POST /upload-media
```

**Request Format:**
- `latitude`: Current latitude (double)
- `longitude`: Current longitude (double)
- `description`: Optional description (string)
- `incident_type`: Type of incident (string)
- `is_anonymous`: Anonymous reporting flag (boolean)
- `timestamp`: ISO 8601 timestamp (string)
- `file_0`, `file_1`, etc.: Media files (multipart)
- `file_0_type`, `file_1_type`, etc.: Media type for each file
- `file_0_name`, `file_1_name`, etc.: Original filename for each file

### 2. Submit Complete Incident Report
```
POST /submit-incident
```

**Request Format:**
- All fields from upload-media endpoint
- `location`: Human-readable location description
- `media_0`, `media_1`, etc.: Media files (multipart)
- `media_0_type`, `media_1_type`, etc.: Media type for each file
- `media_0_name`, `media_1_name`, etc.: Original filename for each file

## Usage Examples

### Basic Usage
```dart
import 'package:safe_egypt_v2/services/api_service.dart';
import 'package:safe_egypt_v2/services/location_service.dart';

// Get current location
final locationResult = await LocationService.getCurrentLocation();
if (locationResult['success']) {
  // Upload media with location
  final result = await ApiService.uploadMediaWithLocation(
    mediaFiles: [mediaEvidence],
    latitude: locationResult['latitude'],
    longitude: locationResult['longitude'],
    description: 'Incident description',
    incidentType: 'emergency',
  );
}
```

### Using the Incident Report Screen
The `ReportIncidentScreen` now automatically:
1. Gets current location when submitting
2. Uploads all media files with location data
3. Shows loading states during upload
4. Handles errors gracefully

## Configuration

### Update API Base URL
Edit `lib/services/api_service.dart`:
```dart
static const String baseUrl = 'http://localhost:8000';
```

**Note:** If you're testing on a physical device, replace `localhost` with your computer's IP address (e.g., `http://192.168.1.100:8000`).

### Android Permissions
Required permissions are already added to `android/app/src/main/AndroidManifest.xml`:
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `INTERNET`
- `CAMERA`
- `READ_EXTERNAL_STORAGE`

## Error Handling

The service provides comprehensive error handling for:
- Location permission denied
- Location services disabled
- Network connectivity issues
- File upload failures
- API server errors

## Response Format

All API calls return a consistent response format:
```dart
{
  'success': bool,
  'message': String,
  'data': String?, // Response body from server
  'error': String?, // Error details if failed
}
```

## Testing

Use the test connection method to verify API connectivity:
```dart
final result = await ApiService.testConnection();
if (result['success']) {
  print('API is reachable');
} else {
  print('API connection failed: ${result['message']}');
}
```
