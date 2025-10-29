import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart' as http_parser;
import 'package:safe_egypt_v2/components/incident_report.dart';
import 'package:safe_egypt_v2/components/media_evidence.dart';
import 'package:safe_egypt_v2/models/incident_data.dart';
import 'package:safe_egypt_v2/services/media_service.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:device_info_plus/device_info_plus.dart';

Future<String> getDeviceId() async {
  final deviceInfo = DeviceInfoPlugin();
  final androidInfo = await deviceInfo.androidInfo;
  return androidInfo.id;
}
class ApiService {
  // Prevent multiple simultaneous uploads
  static bool _isUploading = false;
  
  /// Background function to read file bytes without blocking UI
  static List<int> _readFileBytesInBackground(String filePath) {
    final file = File(filePath);
    return file.readAsBytesSync();
  }
  
  // Get the appropriate base URL based on platform
  static String get baseUrl {
    // For physical Android device, use your computer's IP address
    // Make sure your phone and computer are on the same WiFi network
    // return 'http://192.168.1.242:8000';
    return 'https://unnacreous-jameson-diacidic.ngrok-free.dev';
    // Alternative: Use this if you're on a different network
    // Find your IP with: ipconfig (Windows) or ifconfig (Mac/Linux)
    // return 'http://YOUR_COMPUTER_IP:8000';
  }
  
  /// Upload media files with location data to the API (Step 6-7 from pseudocode)
  /// Using the working logic from simple_api_test.dart
  static Future<IncidentUploadResponse> uploadIncident({
    required IncidentData incidentData,
  }) async {
    // Prevent multiple simultaneous uploads
    if (_isUploading) {
      return IncidentUploadResponse(
        success: false,
        message: 'Upload already in progress. Please wait.',
        error: 'Upload in progress',
      );
    }
    
    _isUploading = true;
    try {
      // Validate media files first
      for (var media in incidentData.mediaFiles) {
        var validation = await MediaService.validateMediaFile(media.filePath);
        if (!validation['valid']) {
          return IncidentUploadResponse(
            success: false,
            message: 'Invalid media file: ${validation['error']}',
            error: validation['error'],
          );
        }
      }

      // Create multipart form data request - EXACT same logic as testttt.py
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/mobile/upload-media'),
      );

      // Add form fields - EXACTLY matching testttt.py order and format
      request.fields['latitude'] = incidentData.latitude?.toString() ?? '0.0';
      request.fields['longitude'] = incidentData.longitude?.toString() ?? '0.0';
      request.fields['description'] = incidentData.description;
      request.fields['is_anonymous'] = incidentData.isAnonymous.toString();
      request.fields['timestamp'] = incidentData.timestamp.toIso8601String();
      request.fields['device_id'] = await getDeviceId();

      // Add media files - EXACTLY matching testttt.py pattern
      // file_0, file_0_type, file_0_name, file_1, file_1_type, file_1_name, etc.
      for (int i = 0; i < incidentData.mediaFiles.length; i++) {
        final media = incidentData.mediaFiles[i];
        final file = File(media.filePath);
        
        if (await file.exists()) {
          // Add file with name pattern: file_0, file_1, etc.
          request.files.add(
            await http.MultipartFile.fromPath(
              'file_$i',
              media.filePath,
              contentType: _getMediaType(media.type),
            ),
          );
          
          // Add file metadata - matching testttt.py exactly
          request.fields['file_${i}_type'] = media.type.toString().split('.').last; // "photo" or "video"
          request.fields['file_${i}_name'] = media.fileName;
        }
      }

      // Send request (Step 7) with timeout - using the working approach
      var streamedResponse = await request.send().timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw Exception('Upload timeout');
        },
      );
      
      final responseBody = await streamedResponse.stream.bytesToString();
      
      if (streamedResponse.statusCode == 200) {
        final responseData = json.decode(responseBody);
        return IncidentUploadResponse(
          success: responseData['success'] ?? true,
          message: responseData['message'] ?? 'Incident reported successfully',
          incidentId: responseData['incident_id'],
          data: responseData,
        );
      } else {
        return IncidentUploadResponse(
          success: false,
          message: 'Failed to upload incident. Status: ${streamedResponse.statusCode}',
          error: 'HTTP ${streamedResponse.statusCode}: $responseBody',
        );
      }
    } catch (e) {
      return IncidentUploadResponse(
        success: false,
        message: 'Error uploading incident: $e',
        error: e.toString(),
      );
    } finally {
      _isUploading = false;
    }
  }

  /// Helper method to get the correct MediaType for file uploads
  static http_parser.MediaType _getMediaType(MediaType mediaType) {
    switch (mediaType) {
      case MediaType.photo:
        return http_parser.MediaType('image', 'jpeg');
      case MediaType.video:
        return http_parser.MediaType('video', 'mp4');
    }
  }

  /// Legacy method for backward compatibility
  static Future<Map<String, dynamic>> uploadMediaWithLocation({
    required List<MediaEvidence> mediaFiles,
    required double latitude,
    required double longitude,
    String? description,
    String? incidentType,
    bool isAnonymous = false,
  }) async {
    try {
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/mobile/upload-media'),
      );

      // Add location data - matching FastAPI structure (same as testttt.py)
      request.fields['latitude'] = latitude.toString();
      request.fields['longitude'] = longitude.toString();
      request.fields['description'] = description ?? 'none';
      request.fields['is_anonymous'] = isAnonymous.toString();
      request.fields['timestamp'] = DateTime.now().toIso8601String();
      request.fields['device_id'] = await getDeviceId();

      // Add media files - matching FastAPI structure
      for (int i = 0; i < mediaFiles.length; i++) {
        final media = mediaFiles[i];
        final file = File(media.filePath);
        
        if (await file.exists()) {
          // Use compute() to read file bytes in background to prevent UI blocking
          final bytes = await compute(_readFileBytesInBackground, media.filePath);
          
          request.files.add(
            http.MultipartFile.fromBytes(
              'file_$i',
              bytes,
              filename: media.fileName,
            ),
          );
          
          // Add metadata for each file - matching FastAPI expectations
          request.fields['file_${i}_type'] = media.type.toString().split('.').last; // photo or video
          request.fields['file_${i}_name'] = media.fileName;
        }
      }

      // Send the request with timeout
      var response = await request.send().timeout(
        const Duration(minutes: 5),
        onTimeout: () {
          throw Exception('Upload timeout - please check your internet connection');
        },
      );
      
      if (response.statusCode == 200) {
        final responseBody = await response.stream.bytesToString();
        final responseData = json.decode(responseBody);
        
        return {
          'success': responseData['success'] ?? true,
          'message': responseData['message'] ?? "common.Media uploaded successfully".tr(),
          'data': responseData,
        };
      } else {
        final responseBody = await response.stream.bytesToString();
        return {
          'success': false,
          'message': 'Failed to upload media. Status: ${response.statusCode}',
          'error': 'HTTP ${response.statusCode}: $responseBody',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error uploading media: $e',
        'error': e.toString(),
      };
    }
  }

  /// Upload a single incident report with all data
  static Future<Map<String, dynamic>> submitIncidentReport({
    required IncidentReport report,
    required double latitude,
    required double longitude,
  }) async {
    try {
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/mobile/upload-media'), // Use the correct endpoint
      );

      // Add basic incident data - matching FastAPI structure (same as testttt.py)
      request.fields['latitude'] = latitude.toString();
      request.fields['longitude'] = longitude.toString();
      request.fields['description'] = report.description;
      request.fields['is_anonymous'] = report.isAnonymous.toString();
      request.fields['timestamp'] = report.timestamp.toIso8601String();
      request.fields['device_id'] = await getDeviceId();

      // Add media files - matching FastAPI structure
      for (int i = 0; i < report.mediaEvidence.length; i++) {
        final media = report.mediaEvidence[i];
        final file = File(media.filePath);
        
        if (await file.exists()) {
          // Use compute() to read file bytes in background to prevent UI blocking
          final bytes = await compute(_readFileBytesInBackground, media.filePath);
          
          request.files.add(
            http.MultipartFile.fromBytes(
              'file_$i', // Use file_ prefix to match FastAPI
              bytes,
              filename: media.fileName,
            ),
          );
          
          // Add metadata for each file - matching FastAPI expectations
          request.fields['file_${i}_type'] = media.type.toString().split('.').last; // photo or video
          request.fields['file_${i}_name'] = media.fileName;
        }
      }

      // Send the request with timeout
      var response = await request.send().timeout(
        const Duration(minutes: 5),
        onTimeout: () {
          throw Exception('Upload timeout - please check your internet connection');
        },
      );
      
      if (response.statusCode == 200) {
        final responseBody = await response.stream.bytesToString();
        final responseData = json.decode(responseBody);
        
        return {
          'success': responseData['success'] ?? true,
          'message': responseData['message'] ?? 'Incident report submitted successfully',
          'data': responseData,
        };
      } else {
        final responseBody = await response.stream.bytesToString();
        return {
          'success': false,
          'message': 'Failed to submit incident report. Status: ${response.statusCode}',
          'error': 'HTTP ${response.statusCode}: $responseBody',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error submitting incident report: $e',
        'error': e.toString(),
      };
    }
  }

  /// Test API connectivity
  static Future<Map<String, dynamic>> testConnection() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/mobile/health'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Connection timeout - server may be unreachable');
        },
      );
      
      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': 'API connection successful',
          'data': response.body,
          'server_url': baseUrl,
        };
      } else {
        return {
          'success': false,
          'message': 'API connection failed. Status: ${response.statusCode}',
          'error': 'HTTP ${response.statusCode}: ${response.body}',
          'server_url': baseUrl,
        };
      }
    } catch (e) {
      String errorMessage = 'Error connecting to API';
      if (e.toString().contains('timeout')) {
        errorMessage = 'Connection timeout - check if server is running';
      } else if (e.toString().contains('SocketException')) {
        errorMessage = 'Network error - check your internet connection and server URL';
      } else if (e.toString().contains('Connection refused')) {
        errorMessage = 'Connection refused - server may not be running on port 8000';
      }
      
      return {
        'success': false,
        'message': '$errorMessage: $e',
        'error': e.toString(),
        'server_url': baseUrl,
      };
    }
  }

  /// Upload media files using Dio (recommended for video uploads)
  static Future<IncidentUploadResponse> uploadIncidentWithDio({
    required IncidentData incidentData,
    Function(int sent, int total)? onUploadProgress,
  }) async {
    // Prevent multiple simultaneous uploads
    if (_isUploading) {
      return IncidentUploadResponse(
        success: false,
        message: 'Upload already in progress. Please wait.',
        error: 'Upload in progress',
      );
    }
    
    _isUploading = true;
    try {
      // Validate media files first
      for (var media in incidentData.mediaFiles) {
        var validation = await MediaService.validateMediaFile(media.filePath);
        if (!validation['valid']) {
          return IncidentUploadResponse(
            success: false,
            message: 'Invalid media file: ${validation['error']}',
            error: validation['error'],
          );
        }
      }

      // Create Dio instance with timeout configuration
      final dio = Dio();
      dio.options.connectTimeout = const Duration(seconds: 30);
      dio.options.receiveTimeout = const Duration(minutes: 5);
      dio.options.sendTimeout = const Duration(minutes: 5);

      // Prepare form data
      final formData = FormData();

      // Add incident data fields - matching FastAPI endpoint structure
      formData.fields.addAll([
        MapEntry('latitude', incidentData.latitude?.toString() ?? '0.0'),
        MapEntry('longitude', incidentData.longitude?.toString() ?? '0.0'),
        MapEntry('description', incidentData.description),
        // MapEntry('incident_type', incidentData.type.toString().split('.').last),
        MapEntry('is_anonymous', incidentData.isAnonymous.toString()),
        MapEntry('timestamp', incidentData.timestamp.toIso8601String()),
        MapEntry('device_id', await getDeviceId()),
      ]);

      // Add media files - matching FastAPI file structure
      for (int i = 0; i < incidentData.mediaFiles.length; i++) {
        final media = incidentData.mediaFiles[i];
        final file = File(media.filePath);
        
        if (await file.exists()) {
          // Add file to form data
          formData.files.add(
            MapEntry(
              'file_$i',
              await MultipartFile.fromFile(
                media.filePath,
                filename: media.fileName,
              ),
            ),
          );
          
          // Add metadata for each file - matching FastAPI expectations
          formData.fields.addAll([
            MapEntry('file_${i}_type', media.type.toString().split('.').last), // photo or video
            MapEntry('file_${i}_name', media.fileName),
          ]);
        }
      }

      // Send request with progress callback
      final response = await dio.post(
        '$baseUrl/api/mobile/upload-media',
        data: formData,
        onSendProgress: onUploadProgress,
      );
      
      if (response.statusCode == 200) {
        final responseData = response.data;
        
        return IncidentUploadResponse(
          success: responseData['success'] ?? true,
          message: responseData['message'] ?? 'Incident reported successfully',
          incidentId: responseData['incident_id'],
          data: responseData,
        );
      } else {
        return IncidentUploadResponse(
          success: false,
          message: 'Failed to upload incident. Status: ${response.statusCode}',
          error: 'HTTP ${response.statusCode}: ${response.data}',
        );
      }
    } on DioException catch (e) {
      String errorMessage = 'Network error occurred';
      if (e.type == DioExceptionType.connectionTimeout) {
        errorMessage = 'Connection timeout - please check your internet connection';
      } else if (e.type == DioExceptionType.sendTimeout) {
        errorMessage = 'Upload timeout - file may be too large or connection too slow';
      } else if (e.type == DioExceptionType.receiveTimeout) {
        errorMessage = 'Server response timeout';
      } else if (e.type == DioExceptionType.connectionError) {
        errorMessage = 'Connection error - check your internet connection and server URL';
      }
      
      return IncidentUploadResponse(
        success: false,
        message: '$errorMessage: ${e.message}',
        error: e.toString(),
      );
    } catch (e) {
      return IncidentUploadResponse(
        success: false,
        message: 'Error uploading incident: $e',
        error: e.toString(),
      );
    } finally {
      _isUploading = false;
    }
  }

  /// Get formatted incidents from the backend API
  static Future<Map<String, dynamic>> getFormattedIncidents() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/mobile/incidents/formatted'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Request timeout - server may be unreachable');
        },
      );
      
      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        
        return {
          'success': true,
          'incidents': responseData['incidents'] ?? [],
          'total_incidents': responseData['total_incidents'] ?? 0,
          'message': responseData['message'] ?? 'Incidents retrieved successfully',
        };
      } else {
        return {
          'success': false,
          'message': 'Failed to get incidents. Status: ${response.statusCode}',
          'error': 'HTTP ${response.statusCode}: ${response.body}',
          'incidents': [],
          'total_incidents': 0,
        };
      }
    } catch (e) {
      String errorMessage = 'Error fetching incidents';
      if (e.toString().contains('timeout')) {
        errorMessage = 'Connection timeout - check if server is running';
      } else if (e.toString().contains('SocketException')) {
        errorMessage = 'Network error - check your internet connection and server URL';
      } else if (e.toString().contains('Connection refused')) {
        errorMessage = 'Connection refused - server may not be running on port 8000';
      }
      
      return {
        'success': false,
        'message': '$errorMessage: $e',
        'error': e.toString(),
        'incidents': [],
        'total_incidents': 0,
      };
    }
  }

  /// Get dashboard incidents from the new endpoint
  static Future<Map<String, dynamic>> getDashboardIncidents() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/mobile/incidents/formatted'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Request timeout - server may be unreachable');
        },
      );
      
      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        
        return {
          'success': true,
          'incidents': responseData['incidents'] ?? [],
          'total_incidents': responseData['total_incidents'] ?? 0,
          'message': responseData['message'] ?? 'Incidents retrieved successfully',
        };
      } else {
        return {
          'success': false,
          'message': 'Failed to get dashboard incidents. Status: ${response.statusCode}',
          'error': 'HTTP ${response.statusCode}: ${response.body}',
          'incidents': [],
          'total_incidents': 0,
        };
      }
    } catch (e) {
      String errorMessage = 'Error fetching dashboard incidents';
      if (e.toString().contains('timeout')) {
        errorMessage = 'Connection timeout - check if server is running';
      } else if (e.toString().contains('SocketException')) {
        errorMessage = 'Network error - check your internet connection and server URL';
      } else if (e.toString().contains('Connection refused')) {
        errorMessage = 'Connection refused - server may not be running on port 8000';
      }
      
      return {
        'success': false,
        'message': '$errorMessage: $e',
        'error': e.toString(),
        'incidents': [],
        'total_incidents': 0,
      };
    }
  }

  /// Get location name for given coordinates
  static Future<Map<String, dynamic>> getLocationName({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/mobile/location/$latitude/$longitude'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          throw Exception('Request timeout - server may be unreachable');
        },
      );
      
      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        
        return {
          'success': true,
          'latitude': responseData['latitude'] ?? latitude,
          'longitude': responseData['longitude'] ?? longitude,
          'location_name': responseData['location_name'] ?? 'Unknown Location',
          'cached': responseData['cached'] ?? false,
        };
      } else {
        return {
          'success': false,
          'message': 'Failed to get location name. Status: ${response.statusCode}',
          'error': 'HTTP ${response.statusCode}: ${response.body}',
          'latitude': latitude,
          'longitude': longitude,
          'location_name': 'Unknown Location',
          'cached': false,
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error fetching location name: $e',
        'error': e.toString(),
        'latitude': latitude,
        'longitude': longitude,
        'location_name': 'Unknown Location',
        'cached': false,
      };
    }
  }

  /// Legacy method using Dio for backward compatibility
  static Future<Map<String, dynamic>> uploadMediaWithDio({
    required List<MediaEvidence> mediaFiles,
    required double latitude,
    required double longitude,
    String? description,
    String? incidentType,
    bool isAnonymous = false,
    Function(int sent, int total)? onUploadProgress,
  }) async {
    try {
      // Create Dio instance with timeout configuration
      final dio = Dio();
      dio.options.connectTimeout = const Duration(seconds: 30);
      dio.options.receiveTimeout = const Duration(minutes: 5);
      dio.options.sendTimeout = const Duration(minutes: 5);

      // Prepare form data
      final formData = FormData();

      // Add location data - matching FastAPI structure (same as testttt.py)
      formData.fields.addAll([
        MapEntry('latitude', latitude.toString()),
        MapEntry('longitude', longitude.toString()),
        MapEntry('description', description ?? ''),
        MapEntry('is_anonymous', isAnonymous.toString()),
        MapEntry('timestamp', DateTime.now().toIso8601String()),
        MapEntry('device_id', await getDeviceId()),
      ]);

      // Add media files - matching FastAPI structure
      for (int i = 0; i < mediaFiles.length; i++) {
        final media = mediaFiles[i];
        final file = File(media.filePath);
        
        if (await file.exists()) {
          // Add file to form data
          formData.files.add(
            MapEntry(
              'file_$i',
              await MultipartFile.fromFile(
                media.filePath,
                filename: media.fileName,
              ),
            ),
          );
          
          // Add metadata for each file - matching FastAPI expectations
          formData.fields.addAll([
            MapEntry('file_${i}_type', media.type.toString().split('.').last), // photo or video
            MapEntry('file_${i}_name', media.fileName),
          ]);
        }
      }

      // Send request with progress callback
      final response = await dio.post(
        '$baseUrl/api/mobile/upload-media',
        data: formData,
        onSendProgress: onUploadProgress,
      );
      
      if (response.statusCode == 200) {
        final responseData = response.data;
        
        return {
          'success': responseData['success'] ?? true,
          'message': responseData['message'] ?? 'common.Media uploaded successfully'.tr(),
          'data': responseData,
        };
      } else {
        return {
          'success': false,
          'message': 'Failed to upload media. Status: ${response.statusCode}',
          'error': 'HTTP ${response.statusCode}: ${response.data}',
        };
      }
    } on DioException catch (e) {
      String errorMessage = 'Network error occurred';
      if (e.type == DioExceptionType.connectionTimeout) {
        errorMessage = 'Connection timeout - please check your internet connection';
      } else if (e.type == DioExceptionType.sendTimeout) {
        errorMessage = 'Upload timeout - file may be too large or connection too slow';
      } else if (e.type == DioExceptionType.receiveTimeout) {
        errorMessage = 'Server response timeout';
      } else if (e.type == DioExceptionType.connectionError) {
        errorMessage = 'Connection error - check your internet connection and server URL';
      }
      
      return {
        'success': false,
        'message': '$errorMessage: ${e.message}',
        'error': e.toString(),
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error uploading media: $e',
        'error': e.toString(),
      };
    }
  }
}
