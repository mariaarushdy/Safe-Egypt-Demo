import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  Flame, 
  Clock, 
  Users, 
  Car,
  Zap,
  UserX,
  MapPin,
  Filter,
  Shield,
  Wrench
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import GoogleMapWrapper from "@/components/GoogleMapWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  fetchIncidents, 
  fetchIncidentDetail,
  calculateDashboardStats, 
  getSeverityMapColor,
  mapCategory,
  type Incident,
  type DashboardStats 
} from "@/lib/api";
import { mediaCacheService } from "@/services/mediaCacheService";

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

// Define incident categories based on API
const getIncidentTypes = (incidents: Incident[], t: (key: string) => string) => {
  const violenceCount = incidents.filter(i => i.category.toLowerCase() === 'violence').length;
  const accidentsCount = incidents.filter(i => i.category.toLowerCase() === 'accidents').length;
  const utilityCount = incidents.filter(i => i.category.toLowerCase() === 'utility').length;
  const illegalCount = incidents.filter(i => i.category.toLowerCase() === 'illegal').length;
  
  return {
    all: { label: t('dashboard.all'), count: incidents.length },
    violence: { label: t('dashboard.violence'), count: violenceCount, icon: UserX },
    accidents: { label: t('dashboard.accidents'), count: accidentsCount, icon: Car },
    utility: { label: t('dashboard.utility'), count: utilityCount, icon: Wrench },
    illegal: { label: t('dashboard.illegal'), count: illegalCount, icon: Shield }
  };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
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

  const getIncidentIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "violence": return UserX;
      case "accidents": return Car;
      case "utility": return Wrench;
      case "illegal": return Shield;
      default: return AlertTriangle;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity.toLowerCase()) {
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
    switch (status.toLowerCase()) {
      case "pending": return "bg-yellow-500";
      case "reviewed": return "bg-blue-500";
      case "resolved": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const incidentTypes = getIncidentTypes(incidents, t);
  
  const filteredIncidents = selectedFilter === "all" 
    ? incidents 
    : incidents.filter(incident => incident.category.toLowerCase() === selectedFilter);

  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Top Statistics Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Active Reports */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">{t('dashboard.activeReports')}</p>
                    <p className="text-3xl font-bold text-white">
                      {loading ? "..." : dashboardStats.activeReports}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <AlertTriangle className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* High-Risk Alerts */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">{t('dashboard.highRiskAlerts')}</p>
                    <p className="text-3xl font-bold text-white">
                      {loading ? "..." : dashboardStats.highRiskAlerts}
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-full">
                    <Flame className="h-6 w-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending Actions */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">{t('dashboard.pendingActions')}</p>
                    <p className="text-3xl font-bold text-white">
                      {loading ? "..." : dashboardStats.pendingActions}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-full">
                    <Clock className="h-6 w-6 text-yellow-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
            {/* Live Incident Map (2/3 width) */}
            <div className="lg:col-span-2">
              <Card className="h-full">
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
                    className="w-full h-full rounded-lg border border-slate-700"
                  />
                  
                  {/* Map Legend */}
                  <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 space-y-2 border border-slate-700">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span>{t('dashboard.highPriority')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-3 h-3 bg-orange-500 rounded-full" />
                      <span>{t('dashboard.mediumPriority')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                      <span>{t('dashboard.lowPriority')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span>{t('dashboard.resolved')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Alerts Feed (1/3 width) */}
            <div className="lg:col-span-1">
              <Card className="h-full">
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
                        className="text-xs flex items-center gap-1"
                        disabled={loading}
                      >
                        {key !== "all" && "icon" in type && type.icon && <type.icon className="h-3 w-3" />}
                        {type.label}
                        <Badge variant="secondary" className="ml-1 text-xs">
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
                          const IconComponent = getIncidentIcon(incident.category);
                          const severityStyles = getSeverityStyles(incident.severity);
                          const isSelected = selectedIncident === incident.incident_id;
                          
                          return (
                            <div
                              key={incident.incident_id}
                              onClick={() => handleIncidentClick(incident.incident_id)}
                              className={cn(
                                "p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:bg-card/50",
                                isSelected && "border-primary bg-card/50",
                                severityStyles.border
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "p-2 rounded-full flex-shrink-0",
                                  severityStyles.bg
                                )}>
                                  <IconComponent className={cn("h-4 w-4", severityStyles.text)} />
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
                                    <span className="truncate">{incident.location.address}</span>
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