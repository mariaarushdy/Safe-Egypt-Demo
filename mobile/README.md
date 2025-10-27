# Safe Egypt v2 🇪🇬

**Report danger. Save lives.**

Safe Egypt v2 is a mobile safety incident reporting application designed to help citizens of Egypt quickly and effectively report safety incidents to authorities. The app enables real-time incident reporting with multimedia evidence, GPS location tracking, and AI-powered verification.

## 🚨 Features

### Core Functionality
- **🔴 Emergency Incident Reporting** - Report fires, accidents, medical emergencies, and suspicious activities
- **📍 GPS Location Services** - Automatic location detection with Google Maps integration
- **📱 Multimedia Evidence** - Attach photos, videos, and audio recordings as evidence
- **🤖 AI Verification** - Advanced AI system analyzes and verifies reports for accuracy and urgency
- **🚔 Authority Integration** - Verified incidents are forwarded directly to relevant emergency services

### User Experience
- **🗺️ Interactive Map View** - View nearby incidents on an interactive map
- **📋 List View** - Browse incidents in a structured list format
- **👤 Anonymous Reporting** - Option to submit reports anonymously for sensitive situations
- **🌐 Bilingual Support** - Full Arabic and English language support
- **⚡ Real-time Updates** - Live updates of incident reports and status

## 🏗️ Technical Architecture

### Built With
- **Flutter** - Cross-platform mobile framework
- **Dart** - Programming language
- **Google Maps Flutter** - Interactive mapping
- **Easy Localization** - Internationalization support

### Key Dependencies
- `google_maps_flutter` - Map integration
- `geolocator` - Location services
- `image_picker` - Camera and gallery access
- `file_picker` - File selection
- `dio` & `http` - Network requests
- `permission_handler` - Runtime permissions
- `provider` - State management
- `easy_localization` - Multi-language support

## 📱 Incident Types

The app supports reporting various types of safety incidents:

- **🔥 Building Fires** - Residential and commercial fires
- **🚗 Traffic Accidents** - Vehicle collisions and road incidents
- **👁️ Suspicious Activity** - Unusual or potentially dangerous behavior
- **🚑 Medical Emergencies** - Health-related incidents requiring immediate attention
- **⚠️ General Safety Hazards** - Other safety concerns

## 🛠️ Installation & Setup

### Prerequisites
- Flutter SDK (>=3.9.2)
- Dart SDK
- Android Studio / Xcode for mobile development
- Google Maps API key

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/mariaarushdy/Safe-Egypt.git
   cd Safe-Egypt
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Configure Google Maps API**
   - Add your Google Maps API key to Android (`android/app/src/main/AndroidManifest.xml`)
   - Add your Google Maps API key to iOS (`ios/Runner/AppDelegate.swift`)

4. **Generate app icons**
   ```bash
   flutter pub run flutter_launcher_icons:main
   ```

5. **Run the application**
   ```bash
   flutter run
   ```

## 🌐 Localization

The app supports:
- **English (US)** - Primary language
- **Arabic (Egypt)** - Native language support with RTL layout

Translation files are located in `lib/assets/translations/`:
- `en-US.json` - English translations
- `ar-EG.json` - Arabic translations

## 📁 Project Structure

```
lib/
├── assets/
│   ├── icons/          # App icons and images
│   └── translations/   # Language files
├── components/         # Reusable UI components
├── models/            # Data models
├── pages/             # Screen widgets
├── services/          # Business logic and API calls
└── widgets/           # Custom widgets
```

## 🔐 Permissions

The app requires the following permissions:
- **📍 Location Access** - For incident location reporting
- **📷 Camera Access** - For photo evidence
- **🎤 Microphone Access** - For audio recordings
- **📁 Storage Access** - For saving and uploading media files

## 🤝 Contributing

This is a safety-critical application. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary. All rights reserved.

## 📞 Contact & Support

For support, bug reports, or feature requests, please contact the development team.

---

**Safe Egypt v2** - Making Egypt safer, one report at a time. 🛡️
