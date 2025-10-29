import 'package:safe_egypt_v2/components/media_evidence.dart';

enum IncidentType {
  emergency,
  accident,
  fire,
  medical,
  security,
  other,
}

class IncidentData {
  final String description;
  final IncidentType type;
  final bool isAnonymous;
  final DateTime timestamp;
  final double? latitude;
  final double? longitude;
  final String? locationDescription;
  final List<MediaEvidence> mediaFiles;

  IncidentData({
    required this.description,
    required this.type,
    this.isAnonymous = false,
    DateTime? timestamp,
    this.latitude,
    this.longitude,
    this.locationDescription,
    this.mediaFiles = const [],
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() {
    return {
      'description': description,
      'accident_type': type.toString().split('.').last,
      'is_anonymous': isAnonymous,
      'timestamp': timestamp.toIso8601String(),
      'latitude': latitude,
      'longitude': longitude,
      'location_description': locationDescription,
      'media_count': mediaFiles.length,
    };
  }

  IncidentData copyWith({
    String? description,
    IncidentType? type,
    bool? isAnonymous,
    DateTime? timestamp,
    double? latitude,
    double? longitude,
    String? locationDescription,
    List<MediaEvidence>? mediaFiles,
  }) {
    return IncidentData(
      description: description ?? this.description,
      type: type ?? this.type,
      isAnonymous: isAnonymous ?? this.isAnonymous,
      timestamp: timestamp ?? this.timestamp,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      locationDescription: locationDescription ?? this.locationDescription,
      mediaFiles: mediaFiles ?? this.mediaFiles,
    );
  }

  /// Get incident type display name
  String get typeDisplayName {
    switch (type) {
      case IncidentType.emergency:
        return 'Emergency';
      case IncidentType.accident:
        return 'Accident';
      case IncidentType.fire:
        return 'Fire';
      case IncidentType.medical:
        return 'Medical';
      case IncidentType.security:
        return 'Security';
      case IncidentType.other:
        return 'other';
    }
  }

  /// Get incident type icon
  String get typeIcon {
    switch (type) {
      case IncidentType.emergency:
        return '🚨';
      case IncidentType.accident:
        return '🚗';
      case IncidentType.fire:
        return '🔥';
      case IncidentType.medical:
        return '🏥';
      case IncidentType.security:
        return '🛡️';
      case IncidentType.other:
        return '📋';
    }
  }

  /// Check if incident has location data
  bool get hasLocation => latitude != null && longitude != null;

  /// Check if incident has media files
  bool get hasMedia => mediaFiles.isNotEmpty;

  /// Get total media count by type
  Map<MediaType, int> get mediaCountByType {
    Map<MediaType, int> counts = {};
    for (var media in mediaFiles) {
      counts[media.type] = (counts[media.type] ?? 0) + 1;
    }
    return counts;
  }
}

class IncidentUploadResponse {
  final bool success;
  final String message;
  final String? incidentId;
  final String? error;
  final Map<String, dynamic>? data;

  IncidentUploadResponse({
    required this.success,
    required this.message,
    this.incidentId,
    this.error,
    this.data,
  });

  factory IncidentUploadResponse.fromJson(Map<String, dynamic> json) {
    return IncidentUploadResponse(
      success: json['success'] ?? false,
      message: json['message'] ?? '',
      incidentId: json['incident_id'],
      error: json['error'],
      data: json['data'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'message': message,
      'incident_id': incidentId,
      'error': error,
      'data': data,
    };
  }
}
