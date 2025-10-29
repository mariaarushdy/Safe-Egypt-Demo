import 'package:permission_handler/permission_handler.dart';

class PermissionService {
  /// Request all necessary permissions for incident reporting
  static Future<Map<String, dynamic>> requestAllPermissions() async {
    Map<String, dynamic> results = {};
    
    // Request camera permission
    results['camera'] = await requestCameraPermission();
    
    // Request storage permission
    results['storage'] = await requestStoragePermission();
    
    // Request location permission
    results['location'] = await requestLocationPermission();
    
    // Check if all permissions are granted
    bool allGranted = results.values.every((status) => status == true);
    
    return {
      'success': allGranted,
      'permissions': results,
      'message': allGranted 
          ? 'All permissions granted' 
          : 'Some permissions were denied',
    };
  }

  /// Request camera permission
  static Future<bool> requestCameraPermission() async {
    var status = await Permission.camera.status;
    
    if (status.isDenied) {
      status = await Permission.camera.request();
    }
    
    return status.isGranted;
  }

  /// Request storage permission
  static Future<bool> requestStoragePermission() async {
    var status = await Permission.storage.status;
    
    if (status.isDenied) {
      status = await Permission.storage.request();
    }
    
    return status.isGranted;
  }

  /// Request location permission
  static Future<bool> requestLocationPermission() async {
    var status = await Permission.location.status;
    
    if (status.isDenied) {
      status = await Permission.location.request();
    }
    
    return status.isGranted;
  }

  /// Check if all required permissions are granted
  static Future<bool> hasAllPermissions() async {
    bool camera = await Permission.camera.isGranted;
    bool storage = await Permission.storage.isGranted;
    bool location = await Permission.location.isGranted;
    
    return camera && storage && location;
  }

  /// Get permission status for all required permissions
  static Future<Map<String, PermissionStatus>> getPermissionStatus() async {
    return {
      'camera': await Permission.camera.status,
      'storage': await Permission.storage.status,
      'location': await Permission.location.status,
    };
  }

  /// Open app settings if permissions are permanently denied
  static Future<void> openAppSettings() async {
    await openAppSettings();
  }

  /// Check if any permission is permanently denied
  static Future<bool> hasPermanentlyDeniedPermissions() async {
    Map<String, PermissionStatus> statuses = await getPermissionStatus();
    return statuses.values.any((status) => status.isPermanentlyDenied);
  }
}
