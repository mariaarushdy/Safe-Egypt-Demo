import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:safe_egypt_v2/widgets/media_evidence_section.dart';
import 'package:safe_egypt_v2/components/incident_report.dart';
import 'package:safe_egypt_v2/services/api_service.dart';
import 'package:safe_egypt_v2/services/location_service.dart';
import 'package:safe_egypt_v2/theme/app_colors.dart';
import 'package:easy_localization/easy_localization.dart';

class ReportIncidentScreen extends StatefulWidget {
  final String? accessToken;
  final Map<String, dynamic>? userData;
  final Map<String, dynamic>? selectedSite;

  const ReportIncidentScreen({
    super.key,
    this.accessToken,
    this.userData,
    this.selectedSite,
  });

  @override
  State<ReportIncidentScreen> createState() => _ReportIncidentScreenState();
}

class _ReportIncidentScreenState extends State<ReportIncidentScreen> {
  final IncidentReport _report = IncidentReport();
  final TextEditingController _descriptionController = TextEditingController();
  bool _isSubmitting = false;

  static const LinearGradient _backgroundGradient = AppColors.primaryGradient;

  List<Map<String, dynamic>> _zones = [];
  int? _selectedZoneId;

  BoxDecoration _frostedDecoration({double radius = 12}) {
    return AppColors.frostedGlass(radius: radius);
  }

  @override
  void initState() {
    super.initState();
    _loadZones();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadZones() async {
    if (widget.accessToken == null || widget.selectedSite == null) return;

    try {
      final result = await ApiService.getSiteZones(
        widget.accessToken!,
        widget.selectedSite!['id'],
      );

      if (result['status'] == 'success' && mounted) {
        setState(() {
          _zones = List<Map<String, dynamic>>.from(result['zones'] ?? []);
        });
      }
    } catch (e) {
      return;
    }
  }

  Future<void> _submitReport() async {
    // Validate inputs
    if (widget.accessToken == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Authentication required. Please login again.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (widget.selectedSite == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No site selected. Please select a site first.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (_report.mediaEvidence.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('report.add_media_required'.tr()),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      // Get current location
      final locationResult = await LocationService.getCurrentLocation();

      if (!locationResult['success']) {
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${'errors.location_error_prefix'.tr()} ${locationResult['message']}'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() {
          _isSubmitting = false;
        });
        return;
      }

      // Set placeholder description if empty
      String description = _report.description.trim();
      if (description.isEmpty) {
        description = 'No description provided';
      }

      // Submit report using new site-based API
      final result = await ApiService.reportSiteIncident(
        accessToken: widget.accessToken!,
        siteId: widget.selectedSite!['id'],
        zoneId: _selectedZoneId,
        latitude: locationResult['latitude'],
        longitude: locationResult['longitude'],
        description: description,
        timestamp: DateTime.now().toIso8601String(),
        mediaFiles: _report.mediaEvidence,
      );

      if (result['success']) {
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? 'Incident reported successfully'),
            backgroundColor: Colors.green,
          ),
        );

        // Navigate back to home screen
        // ignore: use_build_context_synchronously
        Navigator.pop(context);
      } else {
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? 'Failed to report incident'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      // ignore: use_build_context_synchronously
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error submitting report: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Report Safety Incident'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: _backgroundGradient,
          ),
        ),
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: _backgroundGradient,
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                Text(
                  widget.selectedSite?['site_name'] ?? 'Unknown Site',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: 0.3,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                if (widget.selectedSite?['site_type'] != null)
                  Text(
                    (widget.selectedSite?['site_type'] ?? '').toString().toUpperCase(),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.7),
                      letterSpacing: 1.2,
                    ),
                  ),
                const SizedBox(height: 24),

                // Zone Selection (Optional)
                if (_zones.isNotEmpty) ...[
                  Text(
                    'Zone (Optional)',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white.withValues(alpha: 0.95),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    decoration: _frostedDecoration(radius: 12),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int?>(
                        value: _selectedZoneId,
                        isExpanded: true,
                        dropdownColor: AppColors.primaryDark.withOpacity(0.95),
                        iconEnabledColor: Colors.white,
                        iconDisabledColor: Colors.white54,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                        hint: Text(
                          'Select zone (optional)',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.75),
                            fontSize: 15,
                          ),
                        ),
                        items: [
                          DropdownMenuItem<int?>(
                            value: null,
                            child: Text(
                              'No specific zone',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9),
                              ),
                            ),
                          ),
                          ..._zones.map((zone) {
                            return DropdownMenuItem<int?>(
                              value: zone['id'],
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.dangerous_outlined,
                                    size: 16,
                                    color: zone['hazard_level'] == 'high'
                                        ? Colors.red
                                        : zone['hazard_level'] == 'medium'
                                            ? Colors.orange
                                            : Colors.grey,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    zone['zone_name'] ?? 'Unknown Zone',
                                    style: const TextStyle(color: Colors.white),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                        onChanged: _isSubmitting
                            ? null
                            : (value) {
                                setState(() {
                                  _selectedZoneId = value;
                                });
                              },
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Media Evidence Section
                Text(
                  'Add Photo or Video Evidence *',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white.withValues(alpha: 0.95),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  decoration: _frostedDecoration(radius: 12),
                  padding: const EdgeInsets.all(12),
                  child: DefaultTextStyle.merge(
                    style: const TextStyle(color: Colors.white),
                    child: IconTheme.merge(
                      data: const IconThemeData(color: Colors.white),
                      child: MediaEvidenceSection(
                        onMediaAdded: (media) {
                          setState(() {
                            _report.mediaEvidence.add(media);
                          });
                        },
                        onMediaRemoved: (media) {
                          setState(() {
                            _report.mediaEvidence.remove(media);
                          });
                        },
                        mediaList: _report.mediaEvidence,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Description Section
                Text(
                  'Description (Optional)',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white.withValues(alpha: 0.95),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.12),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: TextField(
                    controller: _descriptionController,
                    enabled: !_isSubmitting,
                    style: const TextStyle(
                      color: Colors.black87,
                      fontSize: 15,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Describe the safety incident (PPE violation, equipment damage, hazard, etc.)',
                      hintStyle: TextStyle(
                        color: Colors.black.withValues(alpha: 0.45),
                        fontSize: 14,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.all(16),
                    ),
                    maxLines: 5,
                    onChanged: (value) {
                      _report.description = value;
                    },
                  ),
                ),
                const SizedBox(height: 24),

                // Location Indicator
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: _frostedDecoration(radius: 12),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.location_on_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Current location will be used',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.95),
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                // Submit Button
                Container(
                  width: double.infinity,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: AppColors.accentGradient,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.accentPrimary.withOpacity(0.4),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitReport,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: Colors.grey[400],
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                      shadowColor: Colors.transparent,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            height: 24,
                            width: 24,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.send_rounded, size: 22),
                              SizedBox(width: 10),
                              Text(
                                'Submit Report',
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 12),

                // Required field note
                Center(
                  child: Text(
                    '* At least one photo or video is required',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withValues(alpha: 0.8),
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
