import 'package:safe_egypt_v2/components/incident_type.dart';
import 'package:safe_egypt_v2/components/media_evidence.dart';

class IncidentReport {
  IncidentType? incidentType;
  List<MediaEvidence> mediaEvidence = [];
  String description = '';
  String location = 'Current location';
  bool isAnonymous = false;
  DateTime timestamp = DateTime.now();

  Map<String, dynamic> toJson() {
    return {
      'incidentType': incidentType?.toString(),
      'mediaEvidence': mediaEvidence.map((e) => e.toJson()).toList(),
      'description': description,
      'location': location,
      'isAnonymous': isAnonymous,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}
