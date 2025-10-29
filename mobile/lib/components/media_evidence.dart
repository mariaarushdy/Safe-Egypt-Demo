enum MediaType {
  photo,
  video,
}

class MediaEvidence {
  final MediaType type;
  final String filePath;
  final String fileName;

  MediaEvidence({
    required this.type,
    required this.filePath,
    required this.fileName,
  });

  Map<String, dynamic> toJson() {
    return {
      'type': type.toString(),
      'filePath': filePath,
      'fileName': fileName,
    };
  }
}
