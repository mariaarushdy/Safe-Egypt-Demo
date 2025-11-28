import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:safe_egypt_v2/models/incident_data.dart';
import 'package:safe_egypt_v2/services/api_service.dart';
import 'package:safe_egypt_v2/theme/app_colors.dart';
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
  String selectedSeverity = 'all';

  // Filter identifiers for safety incident categories
  List<String> filterIdentifiers = ['all', 'petroleum_safety', 'construction_safety', 'ppe_violation', 'environmental_hazard', 'equipment_damage'];

  // Get translated labels for display
  List<String> get filterTabs => [
    'All',
    'Petroleum Safety',
    'Construction Safety',
    'PPE Violation',
    'Environmental',
    'Equipment'
  ];

  // Severity filter options
  List<String> get severityFilters => ['all', 'high', 'medium', 'low'];

  // Real incidents data from API
  List<AlertIncident> alertIncidents = [];
  bool _isLoadingIncidents = true;
  String? _incidentsError;

  List<AlertIncident> get filteredIncidents {
    List<AlertIncident> filtered = alertIncidents;

    // Filter by search query
    if (searchController.text.isNotEmpty) {
      filtered = filtered.where((incident) =>
        incident.title.toLowerCase().contains(searchController.text.toLowerCase()) ||
        incident.description.toLowerCase().contains(searchController.text.toLowerCase()) ||
        incident.location.toLowerCase().contains(searchController.text.toLowerCase()) ||
        (incident.category?.toLowerCase() ?? '').contains(searchController.text.toLowerCase())
      ).toList();
    }

    // Filter by selected category tab
    if (selectedFilter != 'all') {
      filtered = filtered.where((incident) {
        String category = incident.category?.toLowerCase() ?? '';
        switch (selectedFilter) {
          case 'petroleum_safety':
            return category.contains('petroleum');
          case 'construction_safety':
            return category.contains('construction');
          case 'ppe_violation':
            return category.contains('ppe') || category.contains('violation');
          case 'environmental_hazard':
            return category.contains('environmental') || category.contains('hazard') || category.contains('spill') || category.contains('leak');
          case 'equipment_damage':
            return category.contains('equipment') || category.contains('damage');
          default:
            return true;
        }
      }).toList();
    }

    // Filter by severity
    if (selectedSeverity != 'all') {
      filtered = filtered.where((incident) {
        String severityStr = incident.severity.name;
        return severityStr == selectedSeverity;
      }).toList();
    }

    return filtered;
  }

  @override
  void initState() {
    super.initState();
    _loadIncidents();
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

      // Get access token from SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      final accessToken = prefs.getString('access_token') ?? '';
      if (accessToken.isEmpty) {
        setState(() {
          _incidentsError = 'Not authenticated';
          _isLoadingIncidents = false;
        });
        return;
      }

      final result = await ApiService.getDashboardIncidents(accessToken);

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

  @override
  Widget build(BuildContext context) {
    final totalIncidents = alertIncidents.length;
    final verifiedCount = alertIncidents.where((incident) => incident.isVerified).length;
    final highSeverityCount = alertIncidents.where((incident) => incident.severity == AlertSeverity.high).length;

    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      extendBodyBehindAppBar: false,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 8,
        shadowColor: Colors.black.withOpacity(0.35),
        toolbarHeight: 86,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(18)),
        ),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: AppColors.primaryGradient,
          ),
        ),
        titleSpacing: 16,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text(
              'Notifications & Alerts',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: 0.3,
              ),
            ),
            SizedBox(height: 2),
            Text(
              'Live safety feed • Egypt',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Colors.white70,
              ),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list, color: Colors.white),
            tooltip: 'Filter by severity',
            onSelected: (String severity) {
              setState(() {
                selectedSeverity = severity;
              });
            },
            itemBuilder: (BuildContext context) {
              return [
                const PopupMenuItem<String>(
                  value: 'all',
                  child: Row(
                    children: [
                      Icon(Icons.all_inclusive, size: 20),
                      SizedBox(width: 8),
                      Text('All Severities'),
                    ],
                  ),
                ),
                PopupMenuItem<String>(
                  value: 'high',
                  child: Row(
                    children: [
                      Icon(Icons.error, color: AppColors.severityHigh, size: 20),
                      const SizedBox(width: 8),
                      const Text('High'),
                    ],
                  ),
                ),
                PopupMenuItem<String>(
                  value: 'medium',
                  child: Row(
                    children: [
                      Icon(Icons.warning, color: AppColors.severityMedium, size: 20),
                      const SizedBox(width: 8),
                      const Text('Medium'),
                    ],
                  ),
                ),
                PopupMenuItem<String>(
                  value: 'low',
                  child: Row(
                    children: [
                      Icon(Icons.info, color: AppColors.severityLow, size: 20),
                      const SizedBox(width: 8),
                      const Text('Low'),
                    ],
                  ),
                ),
              ];
            },
          ),
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
              onPressed: _loadIncidents,
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh incidents',
            ),
        ],
      ),
      body: Stack(
        children: [
          _buildBackgroundDecor(),
          SafeArea(
            child: Column(
              children: [
                const SizedBox(height: 8),
                _buildSearchBar(),
                _buildFilterStatus(),
                _buildFilterTabs(),
                _buildStatsRow(
                  totalIncidents: totalIncidents,
                  verifiedCount: verifiedCount,
                  highSeverityCount: highSeverityCount,
                ),
                _buildRecentAlertsHeader(),
                const SizedBox(height: 8),
                Expanded(child: _buildIncidentList()),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackgroundDecor() {
    return Positioned.fill(
      child: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.primaryGradient,
        ),
        child: Stack(
          children: [
            Positioned(
              top: -60,
              right: -20,
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [
                      AppColors.accentPrimary.withOpacity(0.15),
                      Colors.transparent,
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -50,
              left: -20,
              child: Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [
                      Colors.white.withOpacity(0.08),
                      Colors.transparent,
                    ],
                    begin: Alignment.bottomLeft,
                    end: Alignment.topRight,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            decoration: AppColors.frostedGlass(radius: 12).copyWith(
              border: Border.all(
                color: Colors.white.withOpacity(0.2),
              ),
            ),
            child: TextField(
              controller: searchController,
              onChanged: (value) => setState(() {}),
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search title, category, location...',
                hintStyle: TextStyle(color: Colors.white.withOpacity(0.65)),
                prefixIcon: Icon(Icons.search, color: Colors.white.withOpacity(0.8)),
                suffixIcon: searchController.text.isNotEmpty
                    ? IconButton(
                        icon: Icon(Icons.close, color: Colors.white.withOpacity(0.7)),
                        onPressed: () {
                          searchController.clear();
                          setState(() {});
                        },
                      )
                    : null,
                filled: false,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFilterStatus() {
    if (selectedFilter == 'all' && selectedSeverity == 'all') {
      return const SizedBox(height: 8);
    }

    final filterLabel = selectedFilter != 'all'
        ? filterTabs[filterIdentifiers.indexOf(selectedFilter)]
        : 'All';
    final severityLabel = selectedSeverity != 'all' ? selectedSeverity.toUpperCase() : 'ANY';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      padding: const EdgeInsets.all(12),
      decoration: AppColors.frostedGlass(radius: 12),
      child: Row(
        children: [
          Icon(
            Icons.filter_alt_rounded,
            size: 20,
            color: AppColors.accentLight,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Filters • $filterLabel • $severityLabel',
              style: const TextStyle(
                fontSize: 14,
                color: Colors.white,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.2,
              ),
            ),
          ),
          TextButton(
            onPressed: () {
              setState(() {
                selectedFilter = 'all';
                selectedSeverity = 'all';
              });
            },
            style: TextButton.styleFrom(
              minimumSize: Size.zero,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            ),
            child: Text(
              'Clear',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.accentLight,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTabs() {
    return Container(
      height: 46,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: filterTabs.length,
        itemBuilder: (context, index) {
          final tab = filterTabs[index];
          final filterId = filterIdentifiers[index];
          final isSelected = selectedFilter == filterId;

          return Padding(
            padding: EdgeInsets.only(right: index == filterTabs.length - 1 ? 0 : 10),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              decoration: BoxDecoration(
                gradient: isSelected ? AppColors.accentGradient : null,
                color: isSelected ? null : Colors.white.withOpacity(0.1),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: isSelected
                      ? AppColors.accentSecondary
                      : Colors.white.withOpacity(0.2),
                  width: isSelected ? 1.6 : 1,
                ),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: AppColors.accentPrimary.withOpacity(0.25),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ]
                    : [],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(24),
                  onTap: () {
                    setState(() {
                      selectedFilter = filterId;
                    });
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Text(
                      tab,
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        fontSize: 12,
                        letterSpacing: 0.1,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatsRow({
    required int totalIncidents,
    required int verifiedCount,
    required int highSeverityCount,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          _buildStatCard(
            title: 'Viewing',
            value: '${filteredIncidents.length}',
            icon: Icons.remove_red_eye_outlined,
            gradient: LinearGradient(
              colors: [
                AppColors.accentPrimary.withOpacity(0.25),
                AppColors.accentSecondary.withOpacity(0.12),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          _buildStatCard(
            title: 'Verified',
            value: totalIncidents == 0 ? '0' : '$verifiedCount/$totalIncidents',
            icon: Icons.verified,
            gradient: LinearGradient(
              colors: [
                AppColors.success.withOpacity(0.22),
                Colors.white.withOpacity(0.05),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          _buildStatCard(
            title: 'High Priority',
            value: '$highSeverityCount',
            icon: Icons.priority_high_rounded,
            gradient: LinearGradient(
              colors: [
                AppColors.severityHigh.withOpacity(0.25),
                Colors.white.withOpacity(0.05),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard({
    required String title,
    required String value,
    required IconData icon,
    required Gradient gradient,
  }) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(12),
        decoration: AppColors.cardDecoration(radius: 14).copyWith(
          gradient: gradient,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, color: Colors.white, size: 18),
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.7),
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              title,
              style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentAlertsHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text(
                'Recent Alerts',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: 0.3,
                ),
              ),
              SizedBox(height: 4),
              Text(
                'Stay ahead of nearby risks',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white70,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              gradient: AppColors.accentGradient,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppColors.accentPrimary.withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.white.withOpacity(0.8),
                        blurRadius: 6,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${filteredIncidents.length} alerts',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIncidentList() {
    if (_isLoadingIncidents) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
            ),
            SizedBox(height: 16),
            Text(
              'Loading incidents...',
              style: TextStyle(
                fontSize: 16,
                color: Colors.white70,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    if (_incidentsError != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: AppColors.error,
            ),
            const SizedBox(height: 16),
            const Text(
              'Error loading incidents',
              style: TextStyle(
                fontSize: 16,
                color: Colors.white,
                fontWeight: FontWeight.w700,
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
                  color: Colors.white.withOpacity(0.7),
                ),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadIncidents,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accentPrimary,
                foregroundColor: Colors.white,
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (filteredIncidents.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.notifications_off,
              size: 64,
              color: Colors.white.withOpacity(0.6),
            ),
            const SizedBox(height: 16),
            const Text(
              'No alerts found',
              style: TextStyle(
                fontSize: 16,
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Adjust your filters or try again later',
              style: TextStyle(
                fontSize: 14,
                color: Colors.white.withOpacity(0.7),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.accentPrimary,
      backgroundColor: AppColors.primaryMedium,
      onRefresh: _loadIncidents,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: filteredIncidents.length,
        itemBuilder: (context, index) {
          final incident = filteredIncidents[index];
          return _buildIncidentCard(incident);
        },
      ),
    );
  }

  Widget _buildIncidentCard(AlertIncident incident) {
    final Color severityColor = _severityColor(incident.severity);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: AppColors.cardDecoration(radius: 18).copyWith(
        gradient: LinearGradient(
          colors: [
            severityColor.withOpacity(0.16),
            Colors.white.withOpacity(0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(
          color: severityColor.withOpacity(0.35),
          width: 1.2,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () {},
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: AppColors.accentGradient,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withOpacity(0.25)),
                    ),
                    child: Center(
                      child: Text(
                        incident.icon,
                        style: const TextStyle(fontSize: 24),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                incident.title,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _formatTimeAgo(incident.timestamp),
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white.withOpacity(0.75),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _buildPriorityBadge(incident.severity),
                            _buildVerificationChip(incident.isVerified),
                            if ((incident.category ?? '').isNotEmpty)
                              _buildInfoChip(
                                label: incident.category!,
                                icon: Icons.category_rounded,
                                color: Colors.white.withOpacity(0.85),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                incident.description,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.white.withOpacity(0.92),
                  height: 1.4,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(
                    Icons.location_on_rounded,
                    size: 16,
                    color: AppColors.accentLight,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      incident.location,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white.withOpacity(0.85),
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: severityColor.withOpacity(0.8),
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPriorityBadge(AlertSeverity severity) {
    Color badgeColor;
    String text;
    IconData icon;

    switch (severity) {
      case AlertSeverity.high:
        badgeColor = AppColors.severityHigh;
        text = 'incidents.severity_high'.tr();
        icon = Icons.error_rounded;
        break;
      case AlertSeverity.medium:
        badgeColor = AppColors.severityMedium;
        text = 'incidents.severity_medium'.tr();
        icon = Icons.warning_rounded;
        break;
      case AlertSeverity.low:
        badgeColor = AppColors.severityLow;
        text = 'incidents.severity_low'.tr();
        icon = Icons.info_rounded;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            badgeColor.withOpacity(0.95),
            badgeColor.withOpacity(0.7),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.white.withOpacity(0.2),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: badgeColor.withOpacity(0.35),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 12,
            color: Colors.white,
          ),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(
              fontSize: 11,
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerificationChip(bool isVerified) {
    final Gradient gradient = isVerified
        ? AppColors.accentGradient
        : LinearGradient(
            colors: [
              Colors.white.withOpacity(0.12),
              Colors.white.withOpacity(0.05),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.white.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isVerified ? Icons.verified_rounded : Icons.pending_outlined,
            size: 12,
            color: Colors.white,
          ),
          const SizedBox(width: 4),
          Text(
            isVerified ? 'incidents.verified'.tr() : 'incidents.unverified'.tr(),
            style: const TextStyle(
              fontSize: 11,
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoChip({
    required String label,
    required IconData icon,
    Color? color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 12,
            color: color ?? Colors.white,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: color ?? Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Color _severityColor(AlertSeverity severity) {
    switch (severity) {
      case AlertSeverity.high:
        return AppColors.severityHigh;
      case AlertSeverity.medium:
        return AppColors.severityMedium;
      case AlertSeverity.low:
        return AppColors.severityLow;
    }
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
