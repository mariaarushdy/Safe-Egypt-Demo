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
          const SizedBox(height: 8),
          Text(
            'Attached Media:',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: Colors.white.withOpacity(0.95),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 12),
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
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(12),
        splashColor: Colors.white.withOpacity(0.1),
        highlightColor: Colors.white.withOpacity(0.05),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withOpacity(0.15),
                Colors.white.withOpacity(0.08),
              ],
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: Colors.white.withOpacity(0.25),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 40,
                color: Colors.white,
              ),
              const SizedBox(height: 12),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMediaPreview(BuildContext context, MediaEvidence media) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withOpacity(0.2),
            Colors.white.withOpacity(0.12),
          ],
        ),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: Colors.white.withOpacity(0.3),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              _getIconForMediaType(media.type),
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              media.fileName,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w500,
                fontSize: 14,
              ),
            ),
          ),
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => onMediaRemoved(media),
              child: Container(
                padding: const EdgeInsets.all(6),
                child: Icon(
                  Icons.close_rounded,
                  color: Colors.white.withOpacity(0.9),
                  size: 20,
                ),
              ),
            ),
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
