import 'package:geolocator/geolocator.dart';

class LocationService {
  /// Get current location coordinates
  static Future<Map<String, dynamic>> getCurrentLocation() async {
    try {
      // Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return {
          'success': false,
          'message': 'Location services are disabled',
          'error': 'LOCATION_SERVICES_DISABLED',
        };
      }

      // Check location permissions
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return {
            'success': false,
            'message': 'Location permissions are denied',
            'error': 'PERMISSION_DENIED',
          };
        }
      }

      if (permission == LocationPermission.deniedForever) {
        return {
          'success': false,
          'message': 'Location permissions are permanently denied',
          'error': 'PERMISSION_DENIED_FOREVER',
        };
      }

      // Get current position
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      return {
        'success': true,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'speed': position.speed,
        'heading': position.heading,
        'timestamp': position.timestamp,
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error getting location: $e',
        'error': e.toString(),
      };
    }
  }

  /// Get location with specific accuracy
  static Future<Map<String, dynamic>> getLocationWithAccuracy(
    LocationAccuracy accuracy,
  ) async {
    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: accuracy,
        timeLimit: const Duration(seconds: 15),
      );

      return {
        'success': true,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'speed': position.speed,
        'heading': position.heading,
        'timestamp': position.timestamp,
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error getting location: $e',
        'error': e.toString(),
      };
    }
  }

  /// Calculate distance between two points
  static double calculateDistance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    return Geolocator.distanceBetween(lat1, lon1, lat2, lon2);
  }

  /// Check if location permissions are granted
  static Future<bool> hasLocationPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    return permission == LocationPermission.whileInUse ||
           permission == LocationPermission.always;
  }

  /// Request location permissions
  static Future<LocationPermission> requestLocationPermission() async {
    return await Geolocator.requestPermission();
  }

  /// Check if location services are enabled
  static Future<bool> isLocationServiceEnabled() async {
    return await Geolocator.isLocationServiceEnabled();
  }
}
