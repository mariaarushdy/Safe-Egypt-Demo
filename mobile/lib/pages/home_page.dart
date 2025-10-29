import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:safe_egypt_v2/pages/report_incident_screen.dart';
import 'package:safe_egypt_v2/pages/notifications_alerts_page.dart';
import 'package:safe_egypt_v2/services/location_service.dart';
import 'package:safe_egypt_v2/services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool isMapView = true;
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
      
      final result = await ApiService.getDashboardIncidents();
      
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
      
      // Create LatLng from position coordinates
      LatLng position = _cairoCenter; // Default fallback
      if (incident['position'] != null) {
        final positionData = incident['position'];
        if (positionData['latitude'] != null && positionData['longitude'] != null) {
          position = LatLng(
            double.tryParse(positionData['latitude'].toString()) ?? _cairoCenter.latitude,
            double.tryParse(positionData['longitude'].toString()) ?? _cairoCenter.longitude,
          );
        }
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
      backgroundColor: Colors.grey[50],
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildViewToggle(),
            _buildLocationStatusIndicator(),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    SizedBox(
                      height: isMapView ? 300 : null,
                      child: isMapView ? _buildMapView() : _buildListView(),
                    ),
                    _buildRecentAlerts(),
                    _buildReportButton(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      height: 60,
      decoration: const BoxDecoration(
        color: Color(0xFF1E3FA3),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            const Icon(
              Icons.shield,
              color: Colors.white,
              size: 28,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'app_name'.tr(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Spacer(),
            // Location filter toggle or loading indicator
            if (_isLoadingUserLocation)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8.0),
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white70),
                  ),
                ),
              )
            else if (_userCity != null && _extractCityKeywords(_userCity!).isNotEmpty)
              GestureDetector(
                onTap: _toggleShowAllCities,
                child: Icon(
                  _showAllCities ? Icons.location_off : Icons.location_city,
                  color: _showAllCities ? Colors.white70 : Colors.white,
                  size: 24,
                ),
              ),
            const SizedBox(width: 16),
            // Refresh button for incidents
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
              GestureDetector(
                onTap: _refreshIncidents,
                child: const Icon(
                  Icons.refresh,
                  color: Colors.white,
                  size: 24,
                ),
              ),
            const SizedBox(width: 16),
            const Icon(
              Icons.person,
              color: Colors.white,
              size: 24,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildViewToggle() {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => isMapView = true),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: isMapView ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: isMapView
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.map,
                      color: isMapView ? Colors.black87 : Colors.grey[600],
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'home.map_view'.tr(),
                      style: TextStyle(
                        color: isMapView ? Colors.black87 : Colors.grey[600],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => isMapView = false),
                child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: !isMapView ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: !isMapView
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.list,
                      color: !isMapView ? Colors.black87 : Colors.grey[600],
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'home.list_view'.tr(),
                      style: TextStyle(
                        color: !isMapView ? Colors.black87 : Colors.grey[600],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationStatusIndicator() {
    if (_userCity == null || _extractCityKeywords(_userCity!).isEmpty || _showAllCities) {
      return const SizedBox.shrink();
    }
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E3FA3).withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: const Color(0xFF1E3FA3).withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.location_city,
            size: 20,
            color: const Color(0xFF1E3FA3),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'location.showing_local_only'.tr(),
              style: TextStyle(
                fontSize: 14,
                color: const Color(0xFF1E3FA3),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          TextButton(
            onPressed: _toggleShowAllCities,
            style: TextButton.styleFrom(
              minimumSize: Size.zero,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            ),
            child: Text(
              'location.show_all'.tr(),
              style: TextStyle(
                fontSize: 12,
                color: const Color(0xFF1E3FA3),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
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
                height: 300,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircularProgressIndicator(),
                      SizedBox(height: 16),
                      Text(
                        'Getting your location...',
                        style: TextStyle(
                          color: Colors.grey,
                          fontSize: 16,
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

  Widget _buildListView() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'home.nearby_incidents'.tr(),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          _incidentsError != null
              ? _buildErrorWidget(_incidentsError!)
              : _isLoadingIncidents
                  ? _buildLoadingWidget()
                  : incidents.isEmpty
                      ? _buildEmptyWidget()
                      : Column(
                          children: incidents
                              .map((incident) => Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: _buildIncidentCard(incident, isCompact: true),
                                  ))
                              .toList(),
                        ),
        ],
      ),
    );
  }
  
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
      margin: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'home.recent_alerts'.tr(),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  if (_userCity != null && _extractCityKeywords(_userCity!).isNotEmpty && !_showAllCities)
                    Text(
                      'location.local_only'.tr(),
                      style: TextStyle(
                        fontSize: 12,
                        color: const Color(0xFF1E3FA3),
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
                    color: Color(0xFF1E3FA3),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: 120,
              maxHeight: 200,
            ),
            child: _incidentsError != null
                ? Center(
                    child: Text(
                      'Error loading recent incidents',
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 14,
                      ),
                    ),
                  )
                : _isLoadingIncidents
                    ? const Center(child: CircularProgressIndicator())
                    : incidents.isEmpty
                        ? Center(
                            child: Text(
                              'No recent incidents',
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontSize: 14,
                              ),
                            ),
                          )
                        : ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: incidents.length,
                            itemBuilder: (context, index) {
                              return Container(
                                width: 280,
                                margin: const EdgeInsets.only(right: 12),
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
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with icon, title, severity, and verified status
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: incident['severityColor'].withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  incident['icon'],
                  color: incident['severityColor'],
                  size: 20,
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
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (incident['verified'] == true)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.green.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: Colors.green.withOpacity(0.3),
                                width: 1,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.verified,
                                  color: Colors.green,
                                  size: 12,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  'Verified',
                                  style: TextStyle(
                                    color: Colors.green,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
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
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.blue.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            incident['category'],
                            style: TextStyle(
                              color: Colors.blue[700],
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
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
                            color: incident['severityColor'].withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            incident['severity'],
                            style: TextStyle(
                              color: incident['severityColor'],
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
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
              color: Colors.grey[700],
              fontSize: 14,
              height: 1.3,
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
                color: Colors.grey[600],
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  incident['location'],
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 12,
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
                color: Colors.grey[600],
              ),
              const SizedBox(width: 4),
              Text(
                incident['timestamp'],
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 12,
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
      child: SizedBox(
        width: double.infinity,
        height: 56,
        child: ElevatedButton(
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const ReportIncidentScreen(),
              ),
            );
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red[600],
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 4,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.add, size: 24),
              const SizedBox(width: 8),
              Text(
                'home.report_incident'.tr(),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
