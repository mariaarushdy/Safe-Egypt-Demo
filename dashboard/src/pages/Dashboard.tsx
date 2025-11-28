import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  Flame, 
  Clock, 
  Car,
  MapPin,
  Wrench,
  HardHat
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import GoogleMapWrapper from "@/components/GoogleMapWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  fetchIncidents,
  fetchIncidentDetail,
  calculateDashboardStats,
  type Incident,
  type DashboardStats
} from "@/lib/api";
import { mediaCacheService } from "@/services/mediaCacheService";
import { useAuth } from "@/contexts/AuthContext";

// Helper function to get time ago from timestamp
const getTimeAgo = (timestamp: string, t: (key: string) => string): string => {
  const now = new Date();
  const incidentTime = new Date(timestamp);
  const diffInMinutes = Math.floor((now.getTime() - incidentTime.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return t('dashboard.justNow');
  if (diffInMinutes < 60) return `${diffInMinutes} ${diffInMinutes === 1 ? t('dashboard.minAgo') : t('dashboard.minsAgo')}`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} ${diffInHours === 1 ? t('dashboard.hourAgo') : t('dashboard.hoursAgo')}`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} ${diffInDays === 1 ? t('dashboard.dayAgo') : t('dashboard.daysAgo')}`;
};

// Helper function to get petroleum type count
const getIncidentCountByType = (incidents: Incident[], petroleumType: string) =>
  incidents.filter(incident =>
    (incident.petroleum_type || '').toLowerCase() === petroleumType.toLowerCase()
  ).length;

// Define petroleum incident types based on petroleum_type field
const getIncidentTypes = (incidents: Incident[], t: (key: string) => string) => {
  return {
    all: { label: t('dashboard.all'), count: incidents.length },
    'equipment damage': { label: 'Equipment Damage', count: getIncidentCountByType(incidents, 'equipment damage'), icon: Car },
    'spill/leak': { label: 'Spill/Leak', count: getIncidentCountByType(incidents, 'spill/leak'), icon: Flame },
    'PPE violation': { label: 'PPE Violation', count: getIncidentCountByType(incidents, 'PPE violation'), icon: HardHat },
    'safety violation': { label: 'Safety Violation', count: getIncidentCountByType(incidents, 'safety violation'), icon: AlertTriangle },
    'fire/explosion': { label: 'Fire/Explosion', count: getIncidentCountByType(incidents, 'fire/explosion'), icon: Flame },
    'environmental hazard': { label: 'Environmental', count: getIncidentCountByType(incidents, 'environmental hazard'), icon: Wrench },
  };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    activeReports: 0,
    highRiskAlerts: 0,
    pendingActions: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();
  const { user } = useAuth();

  // Fetch incidents data on component mount
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        setLoading(true);
        const response = await fetchIncidents();
        setIncidents(response.incidents);
        setDashboardStats(calculateDashboardStats(response.incidents));
        setError(null);
      } catch (err) {
        setError('Failed to load incidents data');
        console.error('Error loading incidents:', err);
      } finally {
        setLoading(false);
      }
    };

    loadIncidents();
  }, []);

  // Preload media for high-priority incidents
  useEffect(() => {
    const preloadMedia = async () => {
      // Get high-priority incidents
      const highPriorityIncidents = incidents
        .filter(i => i.severity === 'High' && i.status === 'pending')
        .slice(0, 3); // Top 3
      
      if (highPriorityIncidents.length === 0) return;
      
      console.log(`🔄 Preloading media for ${highPriorityIncidents.length} high-priority incidents...`);
      
      for (const incident of highPriorityIncidents) {
        try {
          const detail = await fetchIncidentDetail(incident.incident_id);
          // This will cache both video and images
          await mediaCacheService.preloadIncidentMedia(
            incident.incident_id, 
            detail.incident_info
          );
        } catch (e) {
          console.warn('Preload failed for incident:', incident.incident_id, e);
        }
      }
      
      console.log('✅ Media preloading complete');
    };
    
    if (incidents.length > 0) {
      // Preload after 3 seconds to not interfere with initial render
      const timeoutId = setTimeout(preloadMedia, 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [incidents]);

  const handleIncidentClick = (incidentId: string) => {
    navigate(`/incident/${incidentId}`);
  };

  const getIncidentIcon = (incident: Incident) => {
    const type = (incident.petroleum_type || incident.category || '').toLowerCase();
    if (type.includes('equipment')) return Car;
    if (type.includes('spill') || type.includes('leak') || type.includes('fire') || type.includes('explosion')) return Flame;
    if (type.includes('ppe')) return HardHat;
    if (type.includes('safety') || type.includes('environmental')) return Wrench;
    return AlertTriangle;
  };

  const getSeverityStyles = (severity: string) => {
    const normalized = (severity || '').toLowerCase();
    switch (normalized) {
      case "high": return {
        bg: "bg-red-500/10",
        text: "text-red-500",
        border: "border-red-500/20"
      };
      case "medium": return {
        bg: "bg-orange-500/10", 
        text: "text-orange-500",
        border: "border-orange-500/20"
      };
      case "low": return {
        bg: "bg-yellow-500/10",
        text: "text-yellow-500", 
        border: "border-yellow-500/20"
      };
      default: return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        border: "border-muted"
      };
    }
  };

  const getStatusColor = (status: string) => {
    const normalized = (status || '').toLowerCase();
    switch (normalized) {
      case "pending": return "bg-yellow-500";
      case "reviewed": return "bg-blue-500";
      case "resolved": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const incidentTypes = getIncidentTypes(incidents, t);
  const siteOptions = Array.from(
    new Map(
      incidents.map((incident) => {
        const value = incident.site_id ? String(incident.site_id) : (incident.site_name || incident.site_code || '');
        const label = incident.site_name || incident.site_code || incident.site_address || 'Site';
        return [value || label, { value: value || label, label }];
      })
    ).values()
  ).filter(option => option.value);

  const filteredIncidents = incidents.filter((incident) => {
    const petroleumType = (incident.petroleum_type || incident.category || '').toLowerCase();
    const severity = incident.severity?.toLowerCase() || '';
    const siteId = incident.site_id ? String(incident.site_id) : (incident.site_name || incident.site_code || '');

    const matchesCategory = (() => {
      if (selectedFilter === "all") return true;
      return petroleumType === selectedFilter.toLowerCase();
    })();

    const matchesSite = siteFilter === "all" ? true : siteFilter === siteId;
    const matchesSeverity = severityFilter === "all" ? true : severity === severityFilter;
    return matchesCategory && matchesSite && matchesSeverity;
  });
  const glassCard = "bg-card/80 border-[hsl(215,20%,35%)] backdrop-blur-xl shadow-xl";

  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.companyScope')}</p>
              <p className="text-lg font-semibold text-foreground">
                {user?.company_name || t('dashboard.title')}
                {user?.company_code ? ` • ${user.company_code}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder={t('dashboard.filterBySite')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('dashboard.allSites')}</SelectItem>
                  {siteOptions.map((site) => (
                    <SelectItem key={site.value} value={site.value}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('dashboard.filterBySeverity')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('dashboard.allSeverities')}</SelectItem>
                  <SelectItem value="high">{t('reports.high')}</SelectItem>
                  <SelectItem value="medium">{t('reports.medium')}</SelectItem>
                  <SelectItem value="low">{t('reports.low')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Top Statistics Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Active Reports */}
            <Card className={cn(glassCard, "relative overflow-hidden")}>
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(20,100%,63%)]/10 to-transparent" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[hsl(214,20%,76%)]">{t('dashboard.activeReports')}</p>
                    <p className="text-4xl font-bold text-white mt-2">
                      {loading ? "..." : dashboardStats.activeReports}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-[hsl(20,100%,63%)]/20 to-[hsl(22,96%,62%)]/10 rounded-xl border border-[hsl(20,100%,63%)]/30 shadow-lg shadow-[hsl(20,100%,63%)]/20">
                    <AlertTriangle className="h-7 w-7 text-[hsl(20,100%,63%)]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* High-Risk Alerts */}
            <Card className={cn(glassCard, "relative overflow-hidden")}>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[hsl(214,20%,76%)]">{t('dashboard.highRiskAlerts')}</p>
                    <p className="text-4xl font-bold text-white mt-2">
                      {loading ? "..." : dashboardStats.highRiskAlerts}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl border border-red-500/30 shadow-lg shadow-red-500/20">
                    <Flame className="h-7 w-7 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending Actions */}
            <Card className={cn(glassCard, "relative overflow-hidden")}>
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(45,96%,69%)]/10 to-transparent" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[hsl(214,20%,76%)]">{t('dashboard.pendingActions')}</p>
                    <p className="text-4xl font-bold text-white mt-2">
                      {loading ? "..." : dashboardStats.pendingActions}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-[hsl(45,96%,69%)]/20 to-yellow-600/10 rounded-xl border border-[hsl(45,96%,69%)]/30 shadow-lg shadow-[hsl(45,96%,69%)]/20">
                    <Clock className="h-7 w-7 text-[hsl(45,96%,69%)]" />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
            {/* Live Incident Map (2/3 width) */}
            <div className="lg:col-span-2">
              <Card className={cn("h-full", glassCard)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {t('dashboard.liveIncidentMap')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[calc(100%-80px)] p-4 relative">
                  <GoogleMapWrapper
                    incidents={incidents}
                    onIncidentClick={handleIncidentClick}
                    className="w-full h-full rounded-lg border border-white/20"
                  />
                  
                  {/* Map Legend */}
                  <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-xl rounded-xl p-4 space-y-2.5 border border-[hsl(215,20%,35%)] shadow-xl text-white">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
                      <span>{t('dashboard.highPriority')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-3 h-3 bg-orange-500 rounded-full shadow-lg shadow-orange-500/50" />
                      <span>{t('dashboard.mediumPriority')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-3 h-3 bg-[hsl(45,96%,69%)] rounded-full shadow-lg shadow-[hsl(45,96%,69%)]/50" />
                      <span>{t('dashboard.lowPriority')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg shadow-green-500/50" />
                      <span>{t('dashboard.resolved')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Alerts Feed (1/3 width) */}
            <div className="lg:col-span-1">
              <Card className={cn("h-full", glassCard)}>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    {t('dashboard.liveAlertsActivity')}
                  </CardTitle>
                  
                  {/* Filter Buttons */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(incidentTypes).map(([key, type]) => (
                      <Button
                        key={key}
                        variant={selectedFilter === key ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedFilter(key)}
                        className={cn(
                          "text-xs flex items-center gap-1.5 transition-all duration-200",
                          selectedFilter === key
                            ? "bg-gradient-to-r from-[hsl(20,100%,63%)] to-[hsl(22,96%,62%)] text-white shadow-lg shadow-[hsl(20,100%,63%)]/30 border-transparent hover:shadow-xl"
                            : "hover:bg-sidebar-accent hover:border-[hsl(20,100%,63%)]/50"
                        )}
                        disabled={loading}
                      >
                        {key !== "all" && "icon" in type && type.icon && <type.icon className="h-3.5 w-3.5" />}
                        <span className="font-medium">{type.label}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "ml-1 text-xs font-bold",
                            selectedFilter === key
                              ? "bg-white/20 text-white border-white/30"
                              : "bg-card border-border"
                          )}
                        >
                          {type.count}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                
                <CardContent className="p-0">
                  <ScrollArea className="h-[520px]">
                    <div className="space-y-3 p-4">
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-sm text-muted-foreground">{t('dashboard.loadingIncidents')}</div>
                        </div>
                      ) : error ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-sm text-red-500">{error}</div>
                        </div>
                      ) : filteredIncidents.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-sm text-muted-foreground">{t('dashboard.noIncidentsFound')}</div>
                        </div>
                      ) : (
                        filteredIncidents.map((incident) => {
                          const IconComponent = getIncidentIcon(incident);
                          const severityStyles = getSeverityStyles(incident.severity);
                          const isSelected = selectedIncident === incident.incident_id;
                          const isHighSeverity = incident.severity?.toLowerCase() === 'high';

                          return (
                            <div
                              key={incident.incident_id}
                              onClick={() => handleIncidentClick(incident.incident_id)}
                              className={cn(
                                "p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-lg relative group",
                                "hover:border-[hsl(20,100%,63%)]/50 hover:bg-card/70",
                                isSelected && "border-[hsl(20,100%,63%)] bg-card/70 shadow-lg shadow-[hsl(20,100%,63%)]/20",
                                isHighSeverity && "border-red-500/30",
                                severityStyles.border
                              )}
                            >
                              {isHighSeverity && (
                                <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent rounded-xl pointer-events-none" />
                              )}
                              <div className="flex items-start gap-3 relative">
                                <div className={cn(
                                  "p-2.5 rounded-xl flex-shrink-0 transition-all duration-200 group-hover:scale-110",
                                  severityStyles.bg,
                                  isHighSeverity && "shadow-lg shadow-red-500/30"
                                )}>
                                  <IconComponent className={cn("h-5 w-5", severityStyles.text)} />
                                </div>
                                
                                <div className="flex-1 space-y-2 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <h4 className="font-medium text-sm text-foreground truncate">
                                      {incident.title}
                                    </h4>
                                    <div className={cn(
                                      "w-2 h-2 rounded-full flex-shrink-0 ml-2",
                                      getStatusColor(incident.status)
                                    )} />
                                  </div>
                                  
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">
                                      {incident.site_name || incident.location.address}
                                      {incident.zone_name ? ` • ${incident.zone_name}` : ""}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">{getTimeAgo(incident.timestamp, t)}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {incident.verified}
                                    </Badge>
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-xs">
                                    <span className={cn(
                                      "capitalize",
                                      severityStyles.text
                                    )}>
                                      {incident.severity} {t('dashboard.severity')}
                                    </span>
                                    <span className="text-muted-foreground capitalize">
                                      {incident.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
