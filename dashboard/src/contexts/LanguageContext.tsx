import React, { createContext, useContext } from 'react';

export type Language = 'en';

interface LanguageContextType {
  language: Language;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.reports': 'Reports',
  'nav.alerts': 'Alerts',
  'nav.analytics': 'Analytics',
  'nav.settings': 'Settings',
  'nav.logout': 'Logout',

  // Dashboard
  'dashboard.title': 'Dashboard',
  'dashboard.activeReports': 'Active Reports',
  'dashboard.highRiskAlerts': 'High-Risk Alerts',
  'dashboard.pendingActions': 'Pending Actions',
  'dashboard.unitsDeployed': 'Units Deployed',
  'dashboard.liveIncidentMap': 'Live Incident Map',
  'dashboard.liveAlertsActivity': 'Live Alerts Activity',
  'dashboard.all': 'All',
  'dashboard.violence': 'Violence',
  'dashboard.accidents': 'Accidents',
  'dashboard.utility': 'Utility',
  'dashboard.illegal': 'Illegal',
  'dashboard.petroleum': 'Petroleum Safety',
  'dashboard.construction': 'Construction Safety',
  'dashboard.ppe': 'PPE Violations',
  'dashboard.equipment': 'Equipment/Assets',
  'dashboard.fire': 'Fire',
  'dashboard.weapon': 'Weapon',
  'dashboard.accident': 'Accident',
  'dashboard.crowd': 'Crowd',
  'dashboard.credibility': 'Credibility',
  'dashboard.active': 'Active',
  'dashboard.dispatched': 'Dispatched',
  'dashboard.investigating': 'Investigating',
  'dashboard.monitoring': 'Monitoring',
  'dashboard.resolved': 'Resolved',
  'dashboard.companyScope': 'Company scope',
  'dashboard.filterBySite': 'Filter by site',
  'dashboard.filterBySeverity': 'Filter by severity',
  'dashboard.allSites': 'All sites',
  'dashboard.allSeverities': 'All severities',
  'dashboard.highPriority': 'High Priority',
  'dashboard.mediumPriority': 'Medium Priority',
  'dashboard.lowPriority': 'Low Priority',
  'dashboard.severity': 'severity',
  'dashboard.justNow': 'Just now',
  'dashboard.minAgo': 'min ago',
  'dashboard.minsAgo': 'mins ago',
  'dashboard.hourAgo': 'hour ago',
  'dashboard.hoursAgo': 'hours ago',
  'dashboard.dayAgo': 'day ago',
  'dashboard.daysAgo': 'days ago',
  'dashboard.loadingIncidents': 'Loading incidents...',
  'dashboard.noIncidentsFound': 'No incidents found',

  // Settings
  'settings.title': 'System Settings',
  'settings.subtitle': 'Manage users, alerts, and system configuration',
  'settings.userManagement': 'User Management',
  'settings.alertSettings': 'Alert Settings',
  'settings.notifications': 'Notifications',
  'settings.systemConfig': 'System Configuration',
  'settings.addUser': 'Add New User',
  'settings.name': 'Name',
  'settings.email': 'Email',
  'settings.role': 'Role',
  'settings.status': 'Status',
  'settings.lastLogin': 'Last Login',
  'settings.addNewUser': 'Add New User',
  'settings.editUser': 'Edit User',
  'settings.editUserDescription': 'Update user details',
  'settings.deleteUser': 'Delete User',
  'settings.deleteUserDescription': 'Are you sure you want to delete this user? This action cannot be undone.',
  'settings.fullName': 'Full Name',
  'settings.username': 'Username',
  'settings.password': 'Password',
  'settings.newPassword': 'New Password (leave blank to keep current)',
  'settings.updating': 'Updating...',
  'settings.updateUser': 'Update User',
  'settings.deleting': 'Deleting...',
  'settings.cancel': 'Cancel',
  'settings.userManagementTitle': 'User Management',
  'settings.userManagementDescription': 'Manage dashboard user accounts and permissions',
  'settings.totalDashboardUsers': 'Total Dashboard Users: {count}',
  'settings.actions': 'Actions',
  'settings.edit': 'Edit',
  'settings.delete': 'Delete',
  'settings.active': 'Active',
  'settings.inactive': 'Inactive',
  'settings.passwordWeak': 'Password is too weak. Please meet all requirements below.',
  'settings.passwordReq8Chars': 'At least 8 characters',
  'settings.passwordReqLowercase': 'At least one lowercase letter',
  'settings.passwordReqUppercase': 'At least one uppercase letter',
  'settings.passwordReqNumber': 'At least one number',
  'settings.passwordReqSpecial': 'At least one special character',
  'settings.passwordRequirements': 'Password Requirements',
  'settings.failedToAddUser': 'Failed to add user',
  'settings.failedToUpdateUser': 'Failed to update user',
  'settings.failedToDeleteUser': 'Failed to delete user',
  'settings.userCreatedSuccess': 'User created successfully',
  'settings.userUpdatedSuccess': 'User updated successfully',

  // Login
  'login.title': 'Site Safety Management System',
  'login.subtitle': 'HSE Dashboard Login',
  'login.username': 'Username',
  'login.password': 'Password',
  'login.companyCode': 'Company Code',
  'login.companyCodePlaceholder': 'e.g., PETRO001 or CONST001',
  'login.authority': 'Authority',
  'login.selectAuthority': 'Select Authority',
  'login.police': 'Police',
  'login.fire': 'Fire Department',
  'login.medical': 'Medical',
  'login.civilDefense': 'Civil Defense',
  'login.button': 'Login',
  'login.systemInfo': 'Comprehensive safety monitoring system for petroleum and construction sites',
  'login.successTitle': 'Login Successful',
  'login.successMessage': 'Welcome {username}',
  'login.errorTitle': 'Invalid Credentials',
  'login.errorMessage': 'Invalid username or password',
  'login.networkError': 'Network error occurred. Please try again.',

  // Reports
  'reports.title': 'Reports Management',
  'reports.subtitle': 'View and manage all incident reports',
  'reports.exportCSV': 'Export CSV',
  'reports.exportPDF': 'Export PDF',
  'reports.advancedFilters': 'Advanced Search Filters',
  'reports.search': 'Search',
  'reports.searchPlaceholder': 'Search by report number, type, or location...',
  'reports.reportStatus': 'Report Status',
  'reports.incidentType': 'Incident Type',
  'reports.dateRange': 'Date Range',
  'reports.from': 'From',
  'reports.to': 'To',
  'reports.showing': 'Showing',
  'reports.of': 'of',
  'reports.reportNumber': 'Report Number',
  'reports.type': 'Type',
  'reports.location': 'Location',
  'reports.status': 'Status',
  'reports.authority': 'Responsible Authority',
  'reports.severity': 'Severity Level',
  'reports.credibility': 'Credibility',
  'reports.time': 'Time',
  'reports.actions': 'Actions',
  'reports.view': 'View',
  'reports.allTypes': 'All Types',
  'reports.allStatuses': 'All Statuses',
  'reports.fire': 'Fire',
  'reports.traffic': 'Traffic Accident',
  'reports.suspicious': 'Suspicious Activity',
  'reports.medical': 'Medical Emergency',
  'reports.weapon': 'Weapon Suspicion',
  'reports.crowd': 'Unauthorized Gathering',
  'reports.emergency': 'Emergency',
  'reports.active': 'Active',
  'reports.investigating': 'Investigating',
  'reports.resolved': 'Resolved',
  'reports.falseReport': 'False Report',
  'reports.high': 'High',
  'reports.medium': 'Medium',
  'reports.low': 'Low',
  'reports.allCategories': 'All Categories',
  'reports.violence': 'Violence',
  'reports.accidents': 'Accidents',
  'reports.utility': 'Utility',
  'reports.illegal': 'Illegal',
  'reports.petroleumSafety': 'Petroleum Safety',
  'reports.constructionSafety': 'Construction Safety',
  'reports.ppeViolation': 'PPE Violation',
  'reports.spillLeak': 'Spill/Leak',
  'reports.equipmentDamage': 'Equipment Damage',
  'reports.site': 'Site',
  'reports.allSites': 'All Sites',
  'reports.illegalActivity': 'Illegal Activity',
  'reports.pending': 'Pending',
  'reports.reviewed': 'Reviewed',
  'reports.accepted': 'Accepted',
  'reports.rejected': 'Rejected',
  'reports.real': 'Real',
  'reports.fake': 'Fake',
  'reports.titleHeader': 'Title',
  'reports.verified': 'Verified',
  'reports.resetFilters': 'Reset Filters',
  'reports.loadingIncidents': 'Loading incidents...',
  'reports.errorLoading': 'Error loading incidents:',
  'reports.noIncidentsFound': 'No incidents found',

  // Alerts
  'alerts.title': 'Alerts Management',
  'alerts.subtitle': 'View and manage all alerts and incidents in real-time',
  'alerts.activeReports': 'Active Reports',
  'alerts.highRiskAlerts': 'High-Risk Alerts',
  'alerts.pendingActions': 'Pending Actions',
  'alerts.unitsDeployed': 'Units Deployed',
  'alerts.today': 'Today',
  'alerts.lastHour': 'Last Hour',
  'alerts.sinceYesterday': 'Since Yesterday',
  'alerts.filterAlerts': 'Filter Alerts',
  'alerts.searchPlaceholder': 'Search alerts...',
  'alerts.alertStatus': 'Alert Status',
  'alerts.alertType': 'Alert Type',
  'alerts.alertNumber': 'Alert Number',
  'alerts.activeAlerts': 'Active Alerts',
  'alerts.monitoring': 'Monitoring',
  'alerts.solved': 'Solved',
  'alerts.close': 'Close',
  'alerts.confirmAlert': 'Confirm Alert',
  'alerts.sendPatrol': 'Send Patrol',
  'alerts.addNote': 'Add Note',
  'alerts.responsibleAuthority': 'Responsible Authority',
  'alerts.credibilityLevel': 'Credibility Level',

  // Analytics
  'analytics.title': 'Analytics Dashboard',
  'analytics.subtitle': 'Performance metrics and trends',
  'analytics.filterBySite': 'Filter by site',
  'analytics.allSites': 'All sites',
  'analytics.selectTimeRange': 'Select Time Range',
  'analytics.last24h': 'Last 24 Hours',
  'analytics.last7days': 'Last 7 Days',
  'analytics.last30days': 'Last 30 Days',
  'analytics.last90days': 'Last 90 Days',
  'analytics.customRange': 'Custom Range',
  'analytics.avgResponseTime': 'Average Response Time',
  'analytics.resolutionRate': 'Resolution Rate',
  'analytics.falseReports': 'False Reports',
  'analytics.improvement': 'Improvement',
  'analytics.decrease': 'Decrease',
  'analytics.increase': 'Increase',
  'analytics.incidentsByType': 'Incidents by Type',
  'analytics.weeklyTrends': 'Weekly Incident Trends',
  'analytics.responseTimesByHour': 'Average Response Times by Hour',
  'analytics.incidentHotspots': 'Incident Hotspots',
  'analytics.minutes': 'Minute',
  'analytics.minutes2': 'Minutes',
  'analytics.reported': 'Reported',
  'analytics.resolved': 'Resolved',
  'analytics.police': 'Police',
  'analytics.fireService': 'Fire Department',
  'analytics.medicalService': 'Medical',
  'analytics.incident': 'Incident',
  'analytics.incidents': 'Incidents',
  'analytics.count': 'Count',

  // Common
  'common.language': 'Language',
  'common.english': 'English'
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const language: Language = 'en';

  const t = (key: string, params?: Record<string, string>): string => {
    let translation = translations[key] || key;

    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(`{${param}}`, value);
      });
    }

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
