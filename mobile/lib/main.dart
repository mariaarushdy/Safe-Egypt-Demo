import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:safe_egypt_v2/pages/onboarding_pages.dart';


void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  
  runApp(
    EasyLocalization(
      supportedLocales: const [
        Locale('en', 'US'), // English
        Locale('ar', 'EG'), // Arabic (Egypt)
      ],
      path: 'lib/assets/translations',
      fallbackLocale: const Locale('en'),
      // This will automatically use device locale if supported
      // If device locale is not supported, it will use fallbackLocale
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'app_name'.tr(), // Use localized app name
      debugShowCheckedModeBanner: false,
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E3FA3),
          primary: const Color(0xFF1E3FA3),
        ),
        useMaterial3: true,
      ),
      home: const OnboardingScreen(),
    );
  }
}
