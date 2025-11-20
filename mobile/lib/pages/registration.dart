import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:safe_egypt_v2/services/api_service.dart';

class RegistrationPage extends StatefulWidget {
  const RegistrationPage({super.key});

  @override
  State<RegistrationPage> createState() => _RegistrationPageState();
}

class _RegistrationPageState extends State<RegistrationPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _nationalIdController = TextEditingController();

  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _nationalIdController.dispose();
    super.dispose();
  }

  /// Validate Egyptian National ID
  /// Format: 14 digits
  /// - First digit: century (2 for 1900s, 3 for 2000s)
  /// - Next 6 digits: birthdate (YYMMDD)
  /// - Next 2 digits: governorate code
  /// - Next 4 digits: sequence number
  /// - Last digit: check digit (odd for males, even for females)
  bool _validateEgyptianNationalId(String id) {
    // Check if it's exactly 14 digits
    if (id.length != 14) {
      return false;
    }

    // Check if all characters are digits
    if (!RegExp(r'^\d+$').hasMatch(id)) {
      return false;
    }

    // Check century digit (must be 2 or 3)
    final centuryDigit = int.parse(id[0]);
    if (centuryDigit != 2 && centuryDigit != 3) {
      return false;
    }

    // Extract and validate birthdate (positions 1-6: YYMMDD)
    final month = int.parse(id.substring(3, 5));
    final day = int.parse(id.substring(5, 7));

    // Validate month (01-12)
    if (month < 1 || month > 12) {
      return false;
    }

    // Validate day (01-31)
    if (day < 1 || day > 31) {
      return false;
    }

    // Validate governorate code (positions 7-8: 01-35)
    final governorate = int.parse(id.substring(7, 9));
    if (governorate < 1 || governorate > 35) {
      return false;
    }

    return true;
  }

  void _submitRegistration() async {
  if (_formKey.currentState!.validate()) {
    setState(() {
      _isLoading = true;
    });

    try {
      // Get device ID
      final deviceId = await getDeviceId();
      
      // Call the registration API
      final result = await ApiService.registerUser(
        deviceId: deviceId,
        nationalId: _nationalIdController.text,
        fullName: _nameController.text,
        contactInfo: _emailController.text.isNotEmpty 
            ? _emailController.text 
            : _phoneController.text,
      );

      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        if (result['success'] ?? false) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('registration.success'.tr()),
              backgroundColor: Colors.green,
            ),
          );

          // Return success result to previous screen
          Navigator.pop(context, true);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Registration failed'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              _buildHeader(),
              _buildRegistrationForm(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF1E3FA3), // Navy blue
            const Color(0xFF2850C7), // Slightly lighter blue
          ],
        ),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E3FA3).withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Column(
          children: [
            // Back button
            Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(
                    context.locale.languageCode == 'ar'
                        ? Icons.arrow_forward
                        : Icons.arrow_back,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            
            // User icon
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Text(
                  '👤',
                  style: TextStyle(fontSize: 48),
                ),
              ),
            ),
            const SizedBox(height: 20),
            
            // Title
            Text(
              'registration.title'.tr(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            
            // Subtitle
            Text(
              'registration.subtitle'.tr(),
              style: TextStyle(
                color: Colors.lightBlue[100],
                fontSize: 16,
                fontWeight: FontWeight.w400,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildRegistrationForm() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            
            // Full Name Field
            _buildTextField(
              controller: _nameController,
              label: 'registration.full_name'.tr(),
              hint: 'registration.full_name_hint'.tr(),
              icon: Icons.person_outline,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'registration.name_required'.tr();
                }
                if (value.length < 3) {
                  return 'registration.name_too_short'.tr();
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            
            // Email Field
            _buildTextField(
              controller: _emailController,
              label: 'registration.email'.tr(),
              hint: 'registration.email_hint'.tr(),
              icon: Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'registration.email_required'.tr();
                }
                final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
                if (!emailRegex.hasMatch(value)) {
                  return 'registration.email_invalid'.tr();
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            
            // Phone Field
            _buildTextField(
              controller: _phoneController,
              label: 'registration.phone'.tr(),
              hint: 'registration.phone_hint'.tr(),
              icon: Icons.phone_outlined,
              keyboardType: TextInputType.phone,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'registration.phone_required'.tr();
                }
                if (value.length < 10) {
                  return 'registration.phone_invalid'.tr();
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            
            // National ID Field
            _buildTextField(
              controller: _nationalIdController,
              label: 'registration.national_id'.tr(),
              hint: 'registration.national_id_hint'.tr(),
              icon: Icons.badge_outlined,
              keyboardType: TextInputType.number,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'registration.national_id_required'.tr();
                }
                if (!_validateEgyptianNationalId(value)) {
                  return 'registration.national_id_invalid'.tr();
                }
                return null;
              },
            ),
            const SizedBox(height: 32),
            // Register Button
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _submitRegistration,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E3FA3),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 4,
                  shadowColor: const Color(0xFF1E3FA3).withOpacity(0.4),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.person_add, size: 24),
                          const SizedBox(width: 12),
                          Text(
                            'registration.register_button'.tr(),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 24),
            
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          validator: validator,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(
              color: Colors.grey[400],
              fontSize: 14,
            ),
            prefixIcon: Icon(
              icon,
              color: const Color(0xFF1E3FA3),
              size: 22,
            ),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: Colors.grey[300]!,
                width: 1,
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: Colors.grey[300]!,
                width: 1,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(
                color: Color(0xFF1E3FA3),
                width: 2,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(
                color: Colors.red,
                width: 1,
              ),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(
                color: Colors.red,
                width: 2,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 16,
            ),
          ),
        ),
      ],
    );
  }
}

