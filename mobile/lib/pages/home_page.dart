import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:safe_egypt_v2/pages/report_incident_screen.dart';
import 'package:safe_egypt_v2/pages/notifications_alerts_page.dart';
import 'package:safe_egypt_v2/pages/site_selection_page.dart';
import 'package:safe_egypt_v2/services/location_service.dart';
import 'package:safe_egypt_v2/services/api_service.dart';
import 'package:safe_egypt_v2/theme/app_colors.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HomePage extends StatefulWidget {
  final String? accessToken;
  final Map<String, dynamic>? userData;
  final Map<String, dynamic>? selectedSite;

  const HomePage({
    super.key,
    this.accessToken,
    this.userData,
    this.selectedSite,
  });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  GoogleMapController? mapController;
  
  // Location variables
  LatLng? _currentLocation;
  bool _isLoadingLocation = true;
  
  // Incidents data variables
  List<Map<String, dynamic>> _incidents = [];
  List<Map<String, dynamic>> _allIncidents = []; // Store all incidents before filtering
  bool _isLoadingIncidents = true;
  String? _incidentsError;
  
  // Location-based filtering
  String? _userCity;
  bool _showAllCities = false;
  // ignore: unused_field
  bool _isLoadingUserLocation = false;
  
  // Cairo coordinates as fallback
  static const LatLng _cairoCenter = LatLng(30.0444, 31.2357);
  
  // Get the current location or fallback to Cairo
  LatLng get _mapCenter => _currentLocation ?? _cairoCenter;

  /// Format timestamp to show "X minutes ago" or "X hours ago"
  String _formatTimeAgo(String timestamp) {
    try {
      final DateTime incidentTime = DateTime.parse(timestamp);
      final DateTime now = DateTime.now();
      final Duration difference = now.difference(incidentTime);
      
      if (difference.inMinutes < 60) {
        if (difference.inMinutes <= 0) {
          return 'Just now';
        }
        return '${difference.inMinutes} ${difference.inMinutes == 1 ? 'minute' : 'minutes'} ago';
      } else if (difference.inHours < 24) {
        return '${difference.inHours} ${difference.inHours == 1 ? 'hour' : 'hours'} ago';
      } else if (difference.inDays < 7) {
        return '${difference.inDays} ${difference.inDays == 1 ? 'day' : 'days'} ago';
      } else {
        // For older incidents, show the date
        final formatter = DateFormat('MMM dd, yyyy');
        return formatter.format(incidentTime);
      }
    } catch (e) {
      return 'Unknown time';
    }
  }

  @override
  void initState() {
    super.initState();
    _getCurrentLocation();
    _loadIncidents();
    _loadUserLocationForFiltering();
    _loadLocationPreferences();
  }

  /// Get user's current location
  Future<void> _getCurrentLocation() async {
    try {
      final locationResult = await LocationService.getCurrentLocation();
      
      if (locationResult['success']) {
        setState(() {
          _currentLocation = LatLng(
            locationResult['latitude'],
            locationResult['longitude'],
          );
          _isLoadingLocation = false;
        });
        
        // If map controller is available, animate to current location
        if (mapController != null) {
          mapController!.animateCamera(
            CameraUpdate.newLatLng(_currentLocation!),
          );
        }
      } else {
        // Failed to get location, use Cairo as fallback
        setState(() {
          _isLoadingLocation = false;
        });
        
        // Optionally show a subtle message that location couldn't be obtained
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Using default location - ${locationResult['message']}'),
              duration: const Duration(seconds: 3),
              backgroundColor: Colors.orange,
            ),
          );
        }
      }
    } catch (e) {
      // Error getting location, use Cairo as fallback
      setState(() {
        _isLoadingLocation = false;
      });
    }
  }
  
  /// Load incidents from the API
  Future<void> _loadIncidents() async {
    try {
      setState(() {
        _isLoadingIncidents = true;
        _incidentsError = null;
      });

      // Get access token from widget or SharedPreferences
      String? accessToken = widget.accessToken;
      if (accessToken == null || accessToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        accessToken = prefs.getString('access_token');
      }

      if (accessToken == null || accessToken.isEmpty) {
        setState(() {
          _incidentsError = 'Not authenticated';
          _isLoadingIncidents = false;
        });
        return;
      }

      final result = await ApiService.getDashboardIncidents(accessToken);

      if (result['success']) {
        setState(() {
          _allIncidents = _processDashboardIncidents(result['incidents']);
          _incidents = _applyLocationFiltering(_allIncidents);
          _isLoadingIncidents = false;
        });
      } else {
        setState(() {
          _incidentsError = result['message'];
          _isLoadingIncidents = false;
        });
        
        // Show error message to user
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to load incidents: ${result['message']}'),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 5),
            ),
          );
        }
      }
    } catch (e) {
      setState(() {
        _incidentsError = 'Unexpected error: $e';
        _isLoadingIncidents = false;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading incidents: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }
  
  /// Process dashboard incidents data to match the expected format
  List<Map<String, dynamic>> _processDashboardIncidents(List<dynamic> apiIncidents) {
    return apiIncidents.map((incident) {
      // Convert API incident to UI format
      Color severityColor = Colors.blue; // Default
      IconData icon = Icons.warning; // Default
      
      // Map severity to color
      String severity = incident['severity']?.toString().toLowerCase() ?? 'unknown';
      switch (severity) {
        case 'high':
        case 'critical':
          severityColor = Colors.red;
          break;
        case 'medium':
        case 'moderate':
          severityColor = Colors.orange;
          break;
        case 'low':
          severityColor = Colors.green;
          break;
        default:
          severityColor = Colors.blue;
      }
      
      // Map category to icon
      String category = incident['category']?.toString().toLowerCase() ?? '';
      switch (category) {
        case 'violence':
          icon = Icons.warning;
          break;
        case 'accident':
          icon = Icons.car_crash;
          break;
        case 'illegal activity':
          icon = Icons.security;
          break;
        case 'utility':
          icon = Icons.construction;
          break;
        case 'medical':
          icon = Icons.local_hospital;
          break;
        case 'fire':
          icon = Icons.local_fire_department;
          break;
        default:
          icon = Icons.warning;
      }
      
      // Create LatLng from incident coordinates
      LatLng position = _cairoCenter; // Default fallback
      if (incident['latitude'] != null && incident['longitude'] != null) {
        position = LatLng(
          double.tryParse(incident['latitude'].toString()) ?? _cairoCenter.latitude,
          double.tryParse(incident['longitude'].toString()) ?? _cairoCenter.longitude,
        );
      }
      
      return {
        'id': incident['incident_id']?.toString() ?? '',
        'title': incident['title']?.toString() ?? 'Unknown Incident',
        'description': incident['description']?.toString() ?? '',
        'location': incident['location']?.toString() ?? 'Unknown Location',
        'category': incident['category']?.toString() ?? 'Unknown',
        'severity': incident['severity']?.toString() ?? 'Unknown',
        'severityColor': severityColor,
        'icon': icon,
        'timestamp': _formatTimeAgo(incident['timestamp']?.toString() ?? ''),
        'rawTimestamp': incident['timestamp']?.toString() ?? '',
        'verified': incident['verified']?.toString().toLowerCase() == 'true',
        'status': incident['status']?.toString() ?? 'unknown',
        'position': position,
      };
    }).toList();
  }
  
  // Get incidents data - now from API
  List<Map<String, dynamic>> get incidents => _incidents;

  Set<Marker> get _markers {
    return incidents.map((incident) {
      return Marker(
        markerId: MarkerId(incident['id']),
        position: incident['position'],
        infoWindow: InfoWindow(
          title: incident['title'],
          snippet: incident['location'],
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(
          _getMarkerHue(incident['severity']),
        ),
      );
    }).toSet();
  }

  double _getMarkerHue(String severity) {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return BitmapDescriptor.hueRed;
      case 'urgent':
      case 'medium':
        return BitmapDescriptor.hueOrange;
      case 'low':
        return BitmapDescriptor.hueGreen;
      default:
        return BitmapDescriptor.hueBlue;
    }
  }
  
  /// Refresh incidents data
  Future<void> _refreshIncidents() async {
    await _loadIncidents();
  }

  /// Load user's current location for filtering purposes
  Future<void> _loadUserLocationForFiltering() async {
    try {
      setState(() {
        _isLoadingUserLocation = true;
      });

      // Get current location
      final locationResult = await LocationService.getCurrentLocation();
      
      if (locationResult['success']) {
        double latitude = locationResult['latitude'];
        double longitude = locationResult['longitude'];
        
        // Get location name from API
        final locationNameResult = await ApiService.getLocationName(
          latitude: latitude,
          longitude: longitude,
        );
        
        if (locationNameResult['success']) {
          String locationName = locationNameResult['location_name'];
          setState(() {
            _userCity = locationName;
            _isLoadingUserLocation = false;
            // Reapply filtering with new location info
            _incidents = _applyLocationFiltering(_allIncidents);
          });
          
          // Save user's city for future use
          _saveUserCity(locationName);
        } else {
          setState(() {
            _isLoadingUserLocation = false;
          });
        }
      } else {
        // Try to load previously saved city
        final prefs = await SharedPreferences.getInstance();
        final savedCity = prefs.getString('user_city');
        if (savedCity != null) {
          setState(() {
            _userCity = savedCity;
            // Reapply filtering with saved location
            _incidents = _applyLocationFiltering(_allIncidents);
          });
        }
        setState(() {
          _isLoadingUserLocation = false;
        });
      }
    } catch (e) {
      setState(() {
        _isLoadingUserLocation = false;
      });
    }
  }

  /// Save user's city to preferences
  Future<void> _saveUserCity(String city) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_city', city);
  }

  /// Load location filtering preferences
  Future<void> _loadLocationPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final showAllCities = prefs.getBool('show_all_cities') ?? false;
    setState(() {
      _showAllCities = showAllCities;
      // Reapply filtering with loaded preferences
      _incidents = _applyLocationFiltering(_allIncidents);
    });
  }

  /// Save location filtering preferences
  Future<void> _saveLocationPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('show_all_cities', _showAllCities);
  }

  /// Toggle show all cities filter
  // ignore: unused_element
  void _toggleShowAllCities() {
    setState(() {
      _showAllCities = !_showAllCities;
      // Reapply filtering
      _incidents = _applyLocationFiltering(_allIncidents);
    });
    _saveLocationPreferences();
  }

  /// Apply location-based filtering to incidents
  List<Map<String, dynamic>> _applyLocationFiltering(List<Map<String, dynamic>> incidents) {
    // ALWAYS show all incidents by default for now
    // Location filtering is disabled because:
    // 1. Incidents might not have detailed location data
    // 2. Strict city matching can hide valid incidents
    // TODO: Implement distance-based filtering using lat/lng instead
    return incidents;

    /* Original location filtering (disabled)
    if (_showAllCities || _userCity == null) {
      return incidents; // Show all incidents
    }

    final userCityKeywords = _extractCityKeywords(_userCity!);
    if (userCityKeywords.isEmpty) {
      return incidents; // No filtering if no city keywords found
    }

    // Filter to show only incidents from user's city
    return incidents.where((incident) {
      final incidentLocation = incident['location']?.toString().toLowerCase() ?? '';
      return userCityKeywords.any((keyword) => incidentLocation.contains(keyword));
    }).toList();
    */
  }

  /// Extract city keywords from location string for filtering
  List<String> _extractCityKeywords(String location) {
    final keywords = <String>[];
    final locationLower = location.toLowerCase();
    
    // Common Egyptian cities with their Arabic names
    final cityMap = {
      'cairo': ['cairo', 'قاهرة', 'القاهرة'],
      'alexandria': ['alexandria', 'إسكندرية', 'اسكندرية'],
      'giza': ['giza', 'جيزة', 'الجيزة'],
      'luxor': ['luxor', 'أقصر', 'الأقصر'],
      'aswan': ['aswan', 'أسوان', 'اسوان'],
      'matrouh': ['matrouh', 'مطروح', 'مرسى مطروح', 'marsa matrouh'],
      'suez': ['suez', 'سويس', 'السويس'],
      'port said': ['port said', 'بورسعيد', 'بور سعيد'],
      'ismailia': ['ismailia', 'إسماعيلية', 'اسماعيلية'],
      'damietta': ['damietta', 'دمياط'],
      'mansoura': ['mansoura', 'منصورة', 'المنصورة'],
      'tanta': ['tanta', 'طنطا'],
      'zagazig': ['zagazig', 'زقازيق', 'الزقازيق'],
      'minya': ['minya', 'منيا', 'المنيا'],
      'asyut': ['asyut', 'أسيوط', 'اسيوط'],
      'sohag': ['sohag', 'سوهاج'],
      'qena': ['qena', 'قنا'],
      'beni suef': ['beni suef', 'بني سويف'],
      'fayoum': ['fayoum', 'فيوم', 'الفيوم'],
      'kafr el sheikh': ['kafr el sheikh', 'كفر الشيخ'],
      'gharbia': ['gharbia', 'غربية', 'الغربية'],
      'menoufia': ['menoufia', 'منوفية', 'المنوفية'],
      'dakahlia': ['dakahlia', 'دقهلية', 'الدقهلية'],
      'beheira': ['beheira', 'بحيرة', 'البحيرة'],
      'sharqia': ['sharqia', 'شرقية', 'الشرقية'],
      'red sea': ['red sea', 'بحر أحمر', 'البحر الأحمر'],
      'north sinai': ['north sinai', 'شمال سيناء'],
      'south sinai': ['south sinai', 'جنوب سيناء'],
      'new valley': ['new valley', 'وادي جديد', 'الوادي الجديد'],
    };
    
    // Check if location matches any known city
    for (final entry in cityMap.entries) {
      for (final cityKeyword in entry.value) {
        if (locationLower.contains(cityKeyword.toLowerCase())) {
          keywords.addAll(entry.value.map((k) => k.toLowerCase()));
          break;
        }
      }
      if (keywords.isNotEmpty) break;
    }
    
    // If no match found, extract the first word as potential city name
    if (keywords.isEmpty) {
      final words = location.split(RegExp(r'[,\s]+'));
      if (words.isNotEmpty) {
        final firstWord = words.first.toLowerCase().trim();
        if (firstWord.isNotEmpty) {
          keywords.add(firstWord);
        }
      }
    }
    
    return keywords;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.primaryGradient,
        ),
        child: SafeArea(
          child: Stack(
            children: [
              Column(
                children: [
                  _buildSiteHeader(),
                  SizedBox(
                    height: 350, // Made map bigger
                    child: _buildMapView(),
                  ),
                  Expanded(
                    child: _buildRecentAlerts(),
                  ),
                ],
              ),
              // Fixed report button at bottom
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _buildReportButton(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSiteHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: AppColors.cardDecoration(radius: 16),
        child: Row(
          children: [
            InkWell(
              onTap: () {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (context) => SiteSelectionPage(
                      accessToken: widget.accessToken ?? '',
                      userData: widget.userData ?? {},
                    ),
                  ),
                );
              },
              borderRadius: BorderRadius.circular(10),
              child: const Padding(
                padding: EdgeInsets.all(6.0),
                child: Icon(Icons.arrow_back, color: Colors.white, size: 22),
              ),
            ),
            const SizedBox(width: 10),
            const Icon(Icons.oil_barrel, color: Colors.white, size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.selectedSite?['site_name'] ?? 'app_name'.tr(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (widget.selectedSite?['site_type'] != null)
                    Text(
                      (widget.selectedSite?['site_type'] ?? '').toString().toUpperCase(),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 12,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            if (_isLoadingIncidents)
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            else
              IconButton(
                onPressed: _refreshIncidents,
                icon: const Icon(Icons.refresh, color: Colors.white),
              ),
          ],
        ),
      ),
    );
  }


  Widget _buildMapView() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: _isLoadingLocation
            ? Container(
                height: 350,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.white.withValues(alpha: 0.1),
                      Colors.white.withValues(alpha: 0.05),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.2),
                    width: 1,
                  ),
                ),
                child: const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                      SizedBox(height: 16),
                      Text(
                        'Getting your location...',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            : GoogleMap(
                onMapCreated: (GoogleMapController controller) {
                  mapController = controller;
                },
                initialCameraPosition: CameraPosition(
                  target: _mapCenter,
                  zoom: 15.0,
                ),
                markers: _markers,
                mapType: MapType.normal,
                myLocationEnabled: true,
                myLocationButtonEnabled: true,
              ),
      ),
    );
  }

  // ignore: unused_element
  Widget _buildErrorWidget(String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.error_outline,
            size: 64,
            color: Colors.red,
          ),
          const SizedBox(height: 16),
          Text(
            'Error loading incidents',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.red,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            error,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _refreshIncidents,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
  
  // ignore: unused_element
  Widget _buildLoadingWidget() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text(
            'Loading incidents...',
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey,
            ),
          ),
        ],
      ),
    );
  }
  
  // ignore: unused_element
  Widget _buildEmptyWidget() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.inbox_outlined,
            size: 64,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            'No incidents found',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Check back later for updates',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentAlerts() {
    return Container(
      margin: const EdgeInsets.only(top: 16, left: 16, right: 16, bottom: 80), // Add bottom margin for fixed button
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.white.withValues(alpha: 0.1),
            Colors.white.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'home.recent_alerts'.tr(),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    if (_userCity != null && _extractCityKeywords(_userCity!).isNotEmpty && !_showAllCities)
                      Text(
                        'location.local_only'.tr(),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.8),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                  ],
                ),
                TextButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => const NotificationsAlertsPage(),
                      ),
                    );
                  },
                  child: Text(
                    'home.view_all'.tr(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _incidentsError != null
                ? Center(
                    child: Text(
                      'Error loading recent incidents',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 14,
                      ),
                    ),
                  )
                : _isLoadingIncidents
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : incidents.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.inbox_outlined,
                                  size: 64,
                                  color: Colors.white.withValues(alpha: 0.5),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'No recent incidents',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.9),
                                    fontSize: 16,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
                            itemCount: incidents.length,
                            itemBuilder: (context, index) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _buildIncidentCard(incidents[index]),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildIncidentCard(Map<String, dynamic> incident, {bool isCompact = false}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppColors.cardDecoration(radius: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with icon, title, severity, and verified status
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: AppColors.iconContainer(radius: 12).copyWith(
                  border: Border.all(
                    color: AppColors.accentSecondary.withOpacity(0.6),
                    width: 2,
                  ),
                ),
                child: Icon(
                  incident['icon'],
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            incident['title'],
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: Colors.white,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (incident['verified'] == true)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.green.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: Colors.green.shade700,
                                width: 1.5,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.verified,
                                  color: Colors.green.shade800,
                                  size: 14,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Verified',
                                  style: TextStyle(
                                    color: Colors.green.shade800,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        // Category badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.3),
                              width: 1,
                            ),
                          ),
                          child: Text(
                            incident['category'],
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Severity badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: incident['severityColor'].withValues(alpha: 0.25),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: incident['severityColor'],
                              width: 1.5,
                            ),
                          ),
                          child: Text(
                            incident['severity'],
                            style: TextStyle(
                              color: incident['severityColor'],
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          
          // Description (shown for all cards now to include requested info)
          const SizedBox(height: 12),
          Text(
            incident['description'],
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: 14,
              height: 1.3,
              fontWeight: FontWeight.w500,
            ),
            maxLines: isCompact ? 2 : 3,
            overflow: TextOverflow.ellipsis,
          ),

          const SizedBox(height: 12),
          // Location and timestamp row
          Row(
            children: [
              Icon(
                Icons.location_on,
                size: 16,
                color: Colors.white.withValues(alpha: 0.8),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  incident['location'],
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.8),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(
                Icons.access_time,
                size: 16,
                color: Colors.white.withValues(alpha: 0.8),
              ),
              const SizedBox(width: 4),
              Text(
                incident['timestamp'],
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.8),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              // Status indicator
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 6,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: incident['status'] == 'accepted' 
                      ? Colors.green.withValues(alpha: 0.1) 
                      : incident['status'] == 'rejected' ? Colors.red.withValues(alpha: 0.1) : Colors.orange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  incident['status'].toUpperCase(),
                  style: TextStyle(
                    color: incident['status'] == 'accepted' 
                        ? Colors.green[700] 
                        : incident['status'] == 'rejected' ? Colors.red[700] : Colors.orange[700],
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReportButton() {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: AppColors.accentGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.accentPrimary.withOpacity(0.5),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ReportIncidentScreen(
                  accessToken: widget.accessToken,
                  userData: widget.userData,
                  selectedSite: widget.selectedSite,
                ),
              ),
            );
          },
          borderRadius: BorderRadius.circular(20),
          child: Container(
            height: 64,
            alignment: Alignment.center,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.add_alert,
                    size: 24,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  'home.report_incident'.tr(),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
