import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:mime/mime.dart';
import 'package:path/path.dart' as path;
import 'package:safe_egypt_v2/components/media_evidence.dart';

class MediaService {
  static final ImagePicker _picker = ImagePicker();

  /// Show media selection dialog and return selected files
  static Future<List<MediaEvidence>> selectMedia() async {
    // This would typically show a dialog in the UI
    // For now, we'll provide methods for different media types
    return [];
  }

  /// Capture photo from camera
  static Future<MediaEvidence?> capturePhoto() async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
        maxWidth: 1920,
        maxHeight: 1080,
      );

      if (image != null) {
        return MediaEvidence(
          type: MediaType.photo,
          filePath: image.path,
          fileName: image.name,
        );
      }
      return null;
    } catch (e) {
      throw Exception('Failed to capture photo: $e');
    }
  }

  /// Record video from camera
  static Future<MediaEvidence?> recordVideo() async {
    try {
      final XFile? video = await _picker.pickVideo(
        source: ImageSource.camera,
        maxDuration: const Duration(minutes: 5),
      );

      if (video != null) {
        return MediaEvidence(
          type: MediaType.video,
          filePath: video.path,
          fileName: video.name,
        );
      }
      return null;
    } catch (e) {
      throw Exception('Failed to record video: $e');
    }
  }

  /// Pick image from gallery
  static Future<MediaEvidence?> pickImageFromGallery() async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );

      if (image != null) {
        return MediaEvidence(
          type: MediaType.photo,
          filePath: image.path,
          fileName: image.name,
        );
      }
      return null;
    } catch (e) {
      throw Exception('Failed to pick image: $e');
    }
  }

  /// Pick video from gallery
  static Future<MediaEvidence?> pickVideoFromGallery() async {
    try {
      final XFile? video = await _picker.pickVideo(
        source: ImageSource.gallery,
      );

      if (video != null) {
        return MediaEvidence(
          type: MediaType.video,
          filePath: video.path,
          fileName: video.name,
        );
      }
      return null;
    } catch (e) {
      throw Exception('Failed to pick video: $e');
    }
  }

  /// Pick multiple files from gallery
  static Future<List<MediaEvidence>> pickMultipleFiles() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        allowMultiple: true,
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'mp4', 'mov', 'mp3', 'wav'],
      );

      if (result != null) {
        List<MediaEvidence> mediaFiles = [];
        
        for (var file in result.files) {
          if (file.path != null) {
            String fileName = file.name;
            MediaType type = _getMediaTypeFromFile(fileName);
            
            mediaFiles.add(MediaEvidence(
              type: type,
              filePath: file.path!,
              fileName: fileName,
            ));
          }
        }
        
        return mediaFiles;
      }
      return [];
    } catch (e) {
      throw Exception('Failed to pick files: $e');
    }
  }

  /// Get media type from file extension
  static MediaType _getMediaTypeFromFile(String fileName) {
    String extension = path.extension(fileName).toLowerCase();
    
    switch (extension) {
      case '.jpg':
      case '.jpeg':
      case '.png':
        return MediaType.photo;
      case '.mp4':
      case '.mov':
      case '.avi':
        return MediaType.video;
      case '.mp3':
      case '.wav':
      case '.aac':
      default:
        return MediaType.photo;
    }
  }

  /// Get MIME type for file
  static String getMimeType(String filePath) {
    return lookupMimeType(filePath) ?? 'application/octet-stream';
  }

  /// Background function for file validation
  static Map<String, dynamic> _validateFileInBackground(String filePath) {
    try {
      final file = File(filePath);
      
      if (!file.existsSync()) {
        return {
          'valid': false,
          'error': 'File does not exist',
        };
      }

      final fileSizeInBytes = file.lengthSync();
      final fileSizeInMB = fileSizeInBytes / (1024 * 1024);
      
      if (fileSizeInMB > 50) {
        return {
          'valid': false,
          'error': 'File size exceeds 50MB limit',
        };
      }

      return {
        'valid': true,
        'size': fileSizeInMB,
        'mimeType': lookupMimeType(filePath) ?? 'application/octet-stream',
      };
    } catch (e) {
      return {
        'valid': false,
        'error': 'Failed to validate file: $e',
      };
    }
  }

  /// Check if file size is within limits (50MB) - NON-BLOCKING
  static Future<bool> isFileSizeValid(String filePath) async {
    final result = await validateMediaFile(filePath);
    return result['valid'] == true;
  }

  /// Get file size in MB - NON-BLOCKING
  static Future<double> getFileSizeInMB(String filePath) async {
    final result = await validateMediaFile(filePath);
    return result['size'] ?? 0.0;
  }

  /// Validate media file - RUNS IN BACKGROUND TO AVOID UI BLOCKING
  static Future<Map<String, dynamic>> validateMediaFile(String filePath) async {
    try {
      // Use compute() to run file validation in background isolate
      return await compute(_validateFileInBackground, filePath);
    } catch (e) {
      return {
        'valid': false,
        'error': 'Failed to validate file: $e',
      };
    }
  }
}
