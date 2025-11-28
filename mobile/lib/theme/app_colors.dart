import 'package:flutter/material.dart';

/// App Color Palette inspired by Safe Egypt logo
/// Features Egyptian-themed colors with dark charcoal, silver, and amber accents
class AppColors {
  // Primary Colors - Dark charcoal/navy (from logo shield)
  static const Color primaryDark = Color(0xFF2B3A4A);
  static const Color primaryMedium = Color(0xFF374151);
  static const Color primaryLight = Color(0xFF4B5563);

  // Accent Colors - Amber/Orange (from logo's Eye of Horus)
  static const Color accentPrimary = Color(0xFFFF8C42);
  static const Color accentSecondary = Color(0xFFFB923C);
  static const Color accentLight = Color(0xFFFBBF24);

  // Secondary Colors - Silver/Gray (from logo details)
  static const Color silver = Color(0xFFB8C5D6);
  static const Color silverLight = Color(0xFFCBD5E1);
  static const Color silverDark = Color(0xFF94A3B8);

  // Background Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF2B3A4A),
      Color(0xFF374151),
      Color(0xFF4B5563),
    ],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFFF8C42),
      Color(0xFFFB923C),
    ],
  );

  // Frosted Glass Effect
  static BoxDecoration frostedGlass({double radius = 12}) {
    return BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.white.withOpacity(0.15),
          Colors.white.withOpacity(0.08),
        ],
      ),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(
        color: Colors.white.withOpacity(0.25),
        width: 1,
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.1),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  // Status Colors
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error = Color(0xFFEF4444);
  static const Color info = Color(0xFF3B82F6);

  // Text Colors
  static const Color textPrimary = Colors.white;
  static Color textSecondary = Colors.white.withOpacity(0.85);
  static Color textTertiary = Colors.white.withOpacity(0.65);

  // Severity Colors (for incidents)
  static const Color severityHigh = Color(0xFFDC2626);
  static const Color severityMedium = Color(0xFFF59E0B);
  static const Color severityLow = Color(0xFF10B981);

  // Card/Container Colors
  static BoxDecoration cardDecoration({double radius = 12}) {
    return BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.white.withOpacity(0.15),
          Colors.white.withOpacity(0.08),
        ],
      ),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(
        color: Colors.white.withOpacity(0.2),
        width: 1,
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.15),
          blurRadius: 8,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  // Icon Container Decoration
  static BoxDecoration iconContainer({double radius = 10}) {
    return BoxDecoration(
      color: Colors.white.withOpacity(0.15),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(
        color: Colors.white.withOpacity(0.25),
        width: 1,
      ),
    );
  }
}
