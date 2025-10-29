import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:safe_egypt_v2/components/media_evidence.dart';
import 'package:easy_localization/easy_localization.dart';

class MediaEvidenceSection extends StatelessWidget {
  final Function(MediaEvidence) onMediaAdded;
  final Function(MediaEvidence) onMediaRemoved;
  final List<MediaEvidence> mediaList;

  const MediaEvidenceSection({
    super.key,
    required this.onMediaAdded,
    required this.onMediaRemoved,
    required this.mediaList,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          children: [
            _buildMediaButton(
              context,
              'report.take_photo'.tr(),
              Icons.camera_alt,
              () => _takePhoto(context),
            ),
            _buildMediaButton(
              context,
              'report.record_video'.tr(),
              Icons.videocam,
              () => _recordVideo(context),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (mediaList.isNotEmpty) ...[
          const Text(
            'Attached Media:',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          ...mediaList.map((media) => _buildMediaPreview(context, media)).toList(),
        ],
      ],
    );
  }

  Widget _buildMediaButton(
    BuildContext context,
    String label,
    IconData icon,
    VoidCallback onPressed,
  ) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey[300]!),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 30),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMediaPreview(BuildContext context, MediaEvidence media) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.green[50],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.green[300]!),
      ),
      child: Row(
        children: [
          Icon(
            _getIconForMediaType(media.type),
            color: Colors.green,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              media.fileName,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.red),
            onPressed: () => onMediaRemoved(media),
          ),
        ],
      ),
    );
  }

  IconData _getIconForMediaType(MediaType type) {
    switch (type) {
      case MediaType.photo:
        return Icons.image;
      case MediaType.video:
        return Icons.videocam;
    }
  }

  Future<void> _takePhoto(BuildContext context) async {
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? image = await picker.pickImage(source: ImageSource.camera);
      
      if (image != null) {
        onMediaAdded(
          MediaEvidence(
            type: MediaType.photo,
            filePath: image.path,
            fileName: image.name,
          ),
        );
      }
    } catch (e) {
      _showErrorSnackbar(context, 'Could not take photo: $e');
    }
  }

  Future<void> _recordVideo(BuildContext context) async {
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? video = await picker.pickVideo(source: ImageSource.camera);
      
      if (video != null) {
        onMediaAdded(
          MediaEvidence(
            type: MediaType.video,
            filePath: video.path,
            fileName: video.name,
          ),
        );
      }
    } catch (e) {
      _showErrorSnackbar(context, 'Could not record video: $e');
    }
  }

  void _showErrorSnackbar(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
