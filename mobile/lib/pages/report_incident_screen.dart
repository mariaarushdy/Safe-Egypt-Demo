import 'package:flutter/material.dart';
import 'package:safe_egypt_v2/widgets/media_evidence_section.dart';
import 'package:safe_egypt_v2/components/incident_report.dart';
import 'package:safe_egypt_v2/services/api_service.dart';
import 'package:safe_egypt_v2/services/location_service.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:safe_egypt_v2/pages/registration.dart';

class ReportIncidentScreen extends StatefulWidget {
  const ReportIncidentScreen({super.key});

  @override
  State<ReportIncidentScreen> createState() => _ReportIncidentScreenState();
}

class _ReportIncidentScreenState extends State<ReportIncidentScreen> {
  final IncidentReport _report = IncidentReport();
  final TextEditingController _descriptionController = TextEditingController();
  bool _isAnonymous = true;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submitReport() async {
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
        return;
      }

      // Set placeholder description if empty
      if (_report.description.trim().isEmpty) {
        _report.description = 'report.no_description_provided'.tr();
      }

      // Submit report with location and media
      final result = await ApiService.submitIncidentReport(
        report: _report,
        latitude: locationResult['latitude'],
        longitude: locationResult['longitude'],
      );

      if (result['success']) {
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message']),
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
            content: Text(result['message']),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      // ignore: use_build_context_synchronously
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${'errors.submit_report_error'.tr()} $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('report.report_incident'.tr()),
        backgroundColor: const Color(0xFF1E3FA3),
        foregroundColor: const Color.fromARGB(255, 255, 255, 255),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            // In a real app, navigate back
            Navigator.maybePop(context);
          },
        ),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'report.add_media_evidence'.tr(),
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              MediaEvidenceSection(
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
              const SizedBox(height: 24),
              
              Text(
                'report.description_optional'.tr(),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: TextField(
                  controller: _descriptionController,
                  decoration: InputDecoration(
                    hintText: 'report.describe_what_happened'.tr(),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.all(16),
                  ),
                  maxLines: 5,
                  onChanged: (value) {
                    _report.description = value;
                  },
                ),
              ),
              const SizedBox(height: 24),
              
              // Location section
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.location_on, color: Colors.grey),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'report.current_location_used'.tr(),
                        style: const TextStyle(color: Colors.grey),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              
              // Anonymous reporting toggle
              Row(
                children: [
                 Switch(
                  value: _isAnonymous,
                  onChanged: (value) async {
                    if (value == false) {
                      // User is turning off anonymous mode
                      // Check if they have registered account info
                      final deviceId = await getDeviceId();
                      final checkResult = await ApiService.checkUserRegistration(deviceId);
                      
                      if (checkResult['success']) {
                        if (!checkResult['is_registered']) {
                          // User has no account info, show dialog to ask what they want to do
                          // ignore: use_build_context_synchronously
                          final userChoice = await showDialog<String>(
                            context: context,
                            barrierDismissible: false,
                            builder: (BuildContext context) {
                              return AlertDialog(
                                title: Text('registration.required_title'.tr()),
                                content: Text('registration.required_message'.tr()),
                                actions: [
                                  TextButton(
                                    onPressed: () {
                                      Navigator.of(context).pop('anonymous');
                                    },
                                    child: Text('registration.continue_anonymous'.tr()),
                                  ),
                                  ElevatedButton(
                                    onPressed: () {
                                      Navigator.of(context).pop('register');
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF1E3FA3),
                                      foregroundColor: Colors.white,
                                    ),
                                    child: Text('registration.go_to_register'.tr()),
                                  ),
                                ],
                              );
                            },
                          );
                          
                          if (userChoice == 'register') {
                            // Navigate to registration page
                            // ignore: use_build_context_synchronously
                            final registrationResult = await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const RegistrationPage(),
                              ),
                            );
                            
                            // If registration was successful, turn off anonymous mode
                            if (registrationResult == true) {
                              setState(() {
                                _isAnonymous = false;
                                _report.isAnonymous = false;
                              });
                            }
                            // If user cancelled registration, keep anonymous mode on
                            return;
                          } else {
                            // User chose to continue as anonymous, keep the switch ON
                            return;
                          }
                        }
                      } else {
                        // API error, show message
                        // ignore: use_build_context_synchronously
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(checkResult['message'] ?? 'Error checking user registration'),
                            backgroundColor: Colors.red,
                          ),
                        );
                        return; // Don't change the switch state
                      }
                    }
                    
                    // If all checks pass or turning anonymous ON, update the state
                    setState(() {
                      _isAnonymous = value;
                      _report.isAnonymous = value;
                    });
                  },
                  activeThumbColor: Theme.of(context).primaryColor,
                ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('report.report_anonymously'.tr()),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'report.identity_not_shared'.tr(),
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
              const SizedBox(height: 32),
              
              // Submit button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitReport,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red[600],
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isSubmitting
                      ? Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text('report.submitting'.tr()),
                          ],
                        )
                      : Text(
                          'report.submit_report'.tr(),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
