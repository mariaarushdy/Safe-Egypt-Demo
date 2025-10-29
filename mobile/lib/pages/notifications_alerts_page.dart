import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:safe_egypt_v2/models/incident_data.dart';
import 'package:safe_egypt_v2/services/api_service.dart';
import 'package:safe_egypt_v2/services/location_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NotificationsAlertsPage extends StatefulWidget {
  const NotificationsAlertsPage({super.key});

  @override
  State<NotificationsAlertsPage> createState() => _NotificationsAlertsPageState();
}

class _NotificationsAlertsPageState extends State<NotificationsAlertsPage>
    with SingleTickerProviderStateMixin {
  TextEditingController searchController = TextEditingController();
  String selectedFilter = 'all';
  
  // Filter identifiers for logic based on categories from dashboard API
  List<String> filterIdentifiers = ['all', 'violence', 'accident', 'illegal_activity', 'utility'];
  
  // Get translated labels for display
  List<String> get filterTabs => [
    'All'.tr(),
    'Violence'.tr(), 
    'Accident'.tr(),
    'Illegal Activity'.tr(),
    'Utility'.tr()
  ];
  
  // Real incidents data from API
  List<AlertIncident> alertIncidents = [];
  bool _isLoadingIncidents = true;
  String? _incidentsError;
  
  // Location-based filtering
  String? _userCity;
  bool _showAllCities = false;
  bool _isLoadingLocation = false;

  List<AlertIncident> get filteredIncidents {
    List<AlertIncident> filtered = alertIncidents;
    
    // Filter by user location (any city)
    if (!_showAllCities && _userCity != null) {
      final userCityKeywords = _extractCityKeywords(_userCity!);
      if (userCityKeywords.isNotEmpty) {
        filtered = filtered.where((incident) {
          final incidentLocation = incident.location.toLowerCase();
          return userCityKeywords.any((keyword) => incidentLocation.contains(keyword));
        }).toList();
      }
    }
    
    // Filter by search query
    if (searchController.text.isNotEmpty) {
      filtered = filtered.where((incident) =>
        incident.title.toLowerCase().contains(searchController.text.toLowerCase()) ||
        incident.description.toLowerCase().contains(searchController.text.toLowerCase()) ||
        incident.location.toLowerCase().contains(searchController.text.toLowerCase())
      ).toList();
    }
    
    // Filter by selected category tab
    if (selectedFilter != 'all') {
      filtered = filtered.where((incident) {
        // Using category field from dashboard API instead of type
        String category = incident.category?.toLowerCase() ?? '';
        switch (selectedFilter) {
          case 'violence':
            return category == 'violence';
          case 'accident':
            return category == 'accident';
          case 'illegal_activity':
            return category == 'illegal activity';
          case 'utility':
            return category == 'utility';
          default:
            return true;
        }
      }).toList();
    }
    
    return filtered;
  }

  @override
  void initState() {
    super.initState();
    _loadIncidents();
    _loadUserLocation();
    _loadLocationPreferences();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  /// Load incidents from the API (updated to use dashboard endpoint)
  Future<void> _loadIncidents() async {
    try {
      setState(() {
        _isLoadingIncidents = true;
        _incidentsError = null;
      });
      
      final result = await ApiService.getDashboardIncidents();
      
      if (result['success']) {
        setState(() {
          alertIncidents = _convertDashboardDataToAlertIncidents(result['incidents']);
          _isLoadingIncidents = false;
        });
      } else {
        setState(() {
          _incidentsError = result['message'];
          _isLoadingIncidents = false;
        });
      }
    } catch (e) {
      setState(() {
        _incidentsError = 'Error loading incidents: $e';
        _isLoadingIncidents = false;
      });
    }
  }

  /// Convert dashboard API incident data to AlertIncident format
  List<AlertIncident> _convertDashboardDataToAlertIncidents(List<dynamic> apiIncidents) {
    return apiIncidents.map((incident) {
      // Map category from dashboard API to IncidentType enum for backwards compatibility
      IncidentType type = IncidentType.other;
      String category = incident['category']?.toString().toLowerCase() ?? '';
      
      switch (category) {
        case 'violence':
          type = IncidentType.security;
          break;
        case 'accident':
          type = IncidentType.accident;
          break;
        case 'illegal activity':
          type = IncidentType.security;
          break;
        case 'utility':
          type = IncidentType.other;
          break;
        default:
          type = IncidentType.other;
      }

      // Map severity from dashboard API
      AlertSeverity severity = AlertSeverity.medium;
      Color iconColor = Colors.blue;
      String icon = '📋';

      switch (incident['severity']?.toString().toLowerCase()) {
        case 'high':
        case 'critical':
          severity = AlertSeverity.high;
          break;
        case 'medium':
        case 'moderate':
          severity = AlertSeverity.medium;
          break;
        case 'low':
          severity = AlertSeverity.low;
          break;
      }

      // Set icon and color based on category
      switch (category) {
        case 'violence':
          icon = '⚠️';
          iconColor = Colors.red;
          break;
        case 'accident':
          icon = '🚗';
          iconColor = Colors.orange;
          break;
        case 'illegal activity':
          icon = '🚫';
          iconColor = Colors.purple;
          break;
        case 'utility':
          icon = '🔧';
          iconColor = Colors.blue;
          break;
        default:
          icon = '📋';
          iconColor = Colors.grey;
      }

      // Parse timestamp
      DateTime timestamp = DateTime.now();
      try {
        if (incident['timestamp'] != null) {
          timestamp = DateTime.parse(incident['timestamp'].toString());
        }
      } catch (e) {
        // Use current time if parsing fails
        timestamp = DateTime.now();
      }

      return AlertIncident(
        id: incident['incident_id']?.toString() ?? '',
        title: incident['title']?.toString() ?? 'Unknown Incident',
        description: incident['description']?.toString() ?? 'No description available',
        location: incident['location']?.toString() ?? 'Unknown Location',
        timestamp: timestamp,
        severity: severity,
        isVerified: incident['verified']?.toString().toLowerCase() == 'real',
        type: type,
        icon: icon,
        iconColor: iconColor,
        category: incident['category']?.toString() ?? 'Unknown', // Include category field
      );
    }).toList();
  }

  /// Refresh incidents data
  Future<void> _refreshIncidents() async {
    await _loadIncidents();
  }

  /// Load user's current location and determine city
  Future<void> _loadUserLocation() async {
    try {
      setState(() {
        _isLoadingLocation = true;
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
            _isLoadingLocation = false;
          });
          
          // Save user's city for future use
          _saveUserCity(locationName);
        } else {
          setState(() {
            _isLoadingLocation = false;
          });
        }
      } else {
        // Try to load previously saved city
        final prefs = await SharedPreferences.getInstance();
        final savedCity = prefs.getString('user_city');
        if (savedCity != null) {
          setState(() {
            _userCity = savedCity;
          });
        }
        setState(() {
          _isLoadingLocation = false;
        });
      }
    } catch (e) {
      setState(() {
        _isLoadingLocation = false;
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
    });
    _saveLocationPreferences();
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
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3FA3),
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Notifications & Alerts',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        actions: [
          // Location filter toggle or loading indicator
          if (_isLoadingLocation)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0),
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
            IconButton(
              onPressed: _toggleShowAllCities,
              icon: Icon(
                _showAllCities ? Icons.location_off : Icons.location_city,
                color: _showAllCities ? Colors.white70 : Colors.white,
              ),
              tooltip: _showAllCities ? 'Show local only' : 'Show all cities',
            ),
          // Refresh button for incidents
          if (_isLoadingIncidents)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              ),
            )
          else
            IconButton(
              onPressed: _refreshIncidents,
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh incidents',
            ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Container(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: searchController,
              onChanged: (value) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Search alerts...',
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),
          
          // Location filter status
          if (_userCity != null && _extractCityKeywords(_userCity!).isNotEmpty && !_showAllCities)
            Container(
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
            ),
          
          // Filter Tabs
          Container(
            height: 50,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: filterTabs.length,
               itemBuilder: (context, index) {
                 final tab = filterTabs[index];
                 final filterId = filterIdentifiers[index];
                 final isSelected = selectedFilter == filterId;
                
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(tab),
                    selected: isSelected,
                     onSelected: (selected) {
                       setState(() {
                         selectedFilter = filterId;
                       });
                     },
                    backgroundColor: Colors.grey[200],
                    selectedColor: const Color(0xFF1E3FA3),
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : Colors.black87,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                );
              },
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Recent Alerts Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Recent Alerts',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${filteredIncidents.length} alerts',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[600],
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
              ],
            ),
          ),
          
          const SizedBox(height: 8),
          
          // Incidents List
          Expanded(
            child: _isLoadingIncidents
                ? const Center(
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
                  )
                : _incidentsError != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.error_outline,
                              size: 64,
                              color: Colors.red[400],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Error loading incidents',
                              style: TextStyle(
                                fontSize: 16,
                                color: Colors.grey[600],
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 32),
                              child: Text(
                                _incidentsError!,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[500],
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: _refreshIncidents,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF1E3FA3),
                                foregroundColor: Colors.white,
                              ),
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : filteredIncidents.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.notifications_off,
                                  size: 64,
                                  color: Colors.grey[400],
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'No alerts found',
                                  style: TextStyle(
                                    fontSize: 16,
                                    color: Colors.grey[600],
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Try adjusting your search or filters',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Colors.grey[500],
                                  ),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _refreshIncidents,
                            child: ListView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              itemCount: filteredIncidents.length,
                              itemBuilder: (context, index) {
                                final incident = filteredIncidents[index];
                                return _buildIncidentCard(incident);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildIncidentCard(AlertIncident incident) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: incident.iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                incident.icon,
                style: const TextStyle(fontSize: 20),
              ),
            ),
          ),
          
          const SizedBox(width: 12),
          
          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title and Priority
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        incident.title,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                    _buildPriorityBadge(incident.severity),
                  ],
                ),
                
                const SizedBox(height: 4),
                
                // Verification Status
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: incident.isVerified ? Colors.green : Colors.grey,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    incident.isVerified ? 'incidents.verified'.tr() : 'incidents.unverified'.tr(),
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                
                const SizedBox(height: 8),
                
                // Description
                Text(
                  incident.description,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[700],
                    height: 1.3,
                  ),
                ),
                
                const SizedBox(height: 8),
                
                // Location and Time
                Row(
                  children: [
                    Icon(
                      Icons.location_on,
                      size: 16,
                      color: Colors.grey[500],
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        incident.location,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      Icons.access_time,
                      size: 16,
                      color: Colors.grey[500],
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _formatTimeAgo(incident.timestamp),
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriorityBadge(AlertSeverity severity) {
    Color backgroundColor;
    String text;
    
    switch (severity) {
      case AlertSeverity.high:
        backgroundColor = Colors.red;
        text = 'incidents.severity_high'.tr();
        break;
      case AlertSeverity.medium:
        backgroundColor = Colors.orange;
        text = 'incidents.severity_medium'.tr();
        break;
      case AlertSeverity.low:
        backgroundColor = Colors.green;
        text = 'incidents.severity_low'.tr();
        break;
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          color: Colors.white,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  String _formatTimeAgo(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    
    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes} min ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours} hour${difference.inHours > 1 ? 's' : ''} ago';
    } else {
      return '${difference.inDays} day${difference.inDays > 1 ? 's' : ''} ago';
    }
  }
}

// Data models for the alerts
class AlertIncident {
  final String id;
  final String title;
  final String description;
  final String location;
  final DateTime timestamp;
  final AlertSeverity severity;
  final bool isVerified;
  final IncidentType type;
  final String icon;
  final Color iconColor;
  final String? category; // Added category field for dashboard API

  AlertIncident({
    required this.id,
    required this.title,
    required this.description,
    required this.location,
    required this.timestamp,
    required this.severity,
    required this.isVerified,
    required this.type,
    required this.icon,
    required this.iconColor,
    this.category, // Added category parameter
  });
}

enum AlertSeverity { high, medium, low }
