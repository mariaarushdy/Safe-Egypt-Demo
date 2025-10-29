enum IncidentType {
  fire,
  trafficAccident,
  violenceCrime,
  medicalEmergency,
  other,
}

extension IncidentTypeExtension on IncidentType {
  String get displayName {
    switch (this) {
      case IncidentType.fire:
        return 'Building Fire';
      case IncidentType.trafficAccident:
        return 'Traffic Accident';
      case IncidentType.violenceCrime:
        return 'Violence/Crime';
      case IncidentType.medicalEmergency:
        return 'Medical Emergency';
      case IncidentType.other:
        return 'Other';
    }
  }
}
