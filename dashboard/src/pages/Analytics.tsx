import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  Loader2,
  BarChart3
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchIncidents, Incident } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const isPetroleumIncident = (incident: Incident) =>
  (incident.site_type || '').toLowerCase() === 'petroleum' ||
  (incident.category || '').toLowerCase().includes('petroleum');

const isConstructionIncident = (incident: Incident) =>
  (incident.site_type || '').toLowerCase() === 'construction' ||
  (incident.category || '').toLowerCase().includes('construction');

const isPPEIncident = (incident: Incident) =>
  (incident.ppe_missing && incident.ppe_missing.length > 0) ||
  (incident.petroleum_type || '').toLowerCase().includes('ppe') ||
  (incident.construction_type || '').toLowerCase().includes('ppe');

const isEquipmentIncident = (incident: Incident) =>
  (incident.petroleum_type || '').toLowerCase().includes('equipment') ||
  (incident.construction_type || '').toLowerCase().includes('equipment') ||
  (incident.category || '').toLowerCase().includes('equipment');

const getAnalyticsCategory = (incident: Incident): string => {
  if (isPetroleumIncident(incident)) return 'Petroleum Safety';
  if (isConstructionIncident(incident)) return 'Construction Safety';
  if (isPPEIncident(incident)) return 'PPE Violations';
  if (isEquipmentIncident(incident)) return 'Equipment/Assets';
  return incident.category || 'Other';
};

// Data processing functions
const getCategoryDisplayName = (category: string): string => {
  const categoryMap: { [key: string]: string } = {
    'Petroleum Safety': 'Petroleum Safety',
    'Construction Safety': 'Construction Safety',
    'PPE Violations': 'PPE Violations',
    'Equipment/Assets': 'Equipment/Assets'
  };
  return categoryMap[category] || category;
};

const getCategoryColor = (category: string): string => {
  const colorMap: { [key: string]: string } = {
    'Petroleum Safety': '#ea580c',
    'Construction Safety': '#2563eb', 
    'PPE Violations': '#f59e0b',
    'Equipment/Assets': '#0f172a'
  };
  return colorMap[category] || '#6b7280';
};

const processIncidentsByCategory = (incidents: Incident[]) => {
  const categoryCount: { [key: string]: number } = {};
  
  incidents.forEach(incident => {
    const category = getAnalyticsCategory(incident);
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });

  return Object.entries(categoryCount).map(([category, count]) => ({
    name: getCategoryDisplayName(category),
    value: count,
    color: getCategoryColor(category)
  }));
};

const processSeverityDistribution = (incidents: Incident[]) => {
  const severityCount = { Low: 0, Medium: 0, High: 0 };

  incidents.forEach(incident => {
    const severity = incident.severity?.toLowerCase() || '';
    if (severity === 'low') severityCount.Low++;
    else if (severity === 'medium') severityCount.Medium++;
    else if (severity === 'high') severityCount.High++;
  });

  return [
    { name: 'Low', value: severityCount.Low, color: '#10b981' },
    { name: 'Medium', value: severityCount.Medium, color: '#f59e0b' },
    { name: 'High', value: severityCount.High, color: '#ef4444' }
  ];
};

const processStatusDistribution = (incidents: Incident[]) => {
  const statusCount: { [key: string]: number } = {};
  
  // First, let's see what status values we actually have
  incidents.forEach(incident => {
    const status = incident.status;
    statusCount[status] = (statusCount[status] || 0) + 1;
  });

  console.log('Status count:', statusCount);

  // Map the status values we might receive to English labels
  const statusLabels: { [key: string]: string } = {
    pending: 'Pending',
    reviewed: 'Under Review',
    resolved: 'Resolved',
    accepted: 'Accepted',
    rejected: 'Rejected'
  };

  // Get color for each status
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'resolved':
      case 'accepted':
        return '#10b981'; // Green
      case 'reviewed':
        return '#f59e0b'; // Orange
      case 'pending':
        return '#f59e0b'; // Orange
      case 'rejected':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  return Object.entries(statusCount).map(([status, count]) => ({
    name: statusLabels[status] || status,
    value: count,
    color: getStatusColor(status)
  }));
};

const processHourlyDistribution = (incidents: Incident[]) => {
  const hourlyCount: { [key: number]: number } = {};
  
  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourlyCount[i] = 0;
  }
  
  incidents.forEach(incident => {
    const hour = new Date(incident.timestamp).getHours();
    hourlyCount[hour]++;
  });

  return Object.entries(hourlyCount).map(([hour, count]) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    incidents: count
  }));
};

const processLocationHotspots = (incidents: Incident[]) => {
  const locationCount: { [key: string]: number } = {};
  
  incidents.forEach(incident => {
    // Extract city/area from address
    const addressParts = incident.location.address.split(',');
    const location = addressParts.length > 2 ? addressParts[addressParts.length - 3].trim() : 'Unknown';
    locationCount[location] = (locationCount[location] || 0) + 1;
  });

  return Object.entries(locationCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([location, count]) => ({
      location,
      incidents: count,
      change: Math.floor(Math.random() * 30) - 15, // Mock change percentage
      isPositive: Math.random() > 0.5
    }));
};

const calculateKPIs = (incidents: Incident[]) => {
  const totalIncidents = incidents.length;
  const highSeverityIncidents = incidents.filter(i => i.severity?.toLowerCase() === 'high').length;
  const pendingIncidents = incidents.filter(i => i.status?.toLowerCase() === 'pending').length;
  const resolvedIncidents = incidents.filter(i => i.status?.toLowerCase() === 'resolved').length;
  
  const resolutionRate = totalIncidents > 0 ? (resolvedIncidents / totalIncidents * 100).toFixed(1) : '0';
  const highRiskPercentage = totalIncidents > 0 ? (highSeverityIncidents / totalIncidents * 100).toFixed(1) : '0';
  
  // Calculate average response time (mock calculation based on timestamp differences)
  const now = new Date();
  const avgResponseTime = incidents.length > 0 
    ? incidents.reduce((acc, incident) => {
        const incidentTime = new Date(incident.timestamp);
        const timeDiff = (now.getTime() - incidentTime.getTime()) / (1000 * 60); // minutes
        return acc + Math.min(timeDiff, 60); // Cap at 60 minutes for realistic response time
      }, 0) / incidents.length
    : 0;

  return {
    totalIncidents,
    avgResponseTime: avgResponseTime.toFixed(1),
    resolutionRate,
    highRiskPercentage,
    pendingIncidents,
    highSeverityIncidents
  };
};

const Analytics = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeRange, setTimeRange] = useState("7days");
  const [siteFilter, setSiteFilter] = useState("all");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const siteOptions = Array.from(
    new Map(
      incidents.map((incident) => {
        const value = incident.site_id ? String(incident.site_id) : (incident.site_name || incident.site_code || '');
        const label = incident.site_name || incident.site_code || incident.site_address || 'Site';
        return [value || label, { value: value || label, label }];
      })
    ).values()
  ).filter(option => option.value);

  // Fetch incidents data
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchIncidents();
        setIncidents(response.incidents);
      } catch (err) {
        console.error('Error loading incidents:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadIncidents();
  }, []);

  // Filter incidents based on time range
  const getFilteredIncidents = () => {
    let filtered = incidents;

    if (timeRange === '24h') {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      filtered = incidents.filter(incident => new Date(incident.timestamp) >= oneDayAgo);
    } else if (timeRange === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filtered = incidents.filter(incident => new Date(incident.timestamp) >= sevenDaysAgo);
    } else if (timeRange === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = incidents.filter(incident => new Date(incident.timestamp) >= thirtyDaysAgo);
    } else if (timeRange === '90days') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      filtered = incidents.filter(incident => new Date(incident.timestamp) >= ninetyDaysAgo);
    }

    if (siteFilter !== 'all') {
      filtered = filtered.filter(incident => {
        const siteId = incident.site_id ? String(incident.site_id) : (incident.site_name || incident.site_code || '');
        return siteId === siteFilter;
      });
    }

    return filtered;
  };

  const filteredIncidents = getFilteredIncidents();
  console.log('Filtered incidents:', filteredIncidents.length, 'incidents');
  console.log('Sample incident statuses:', filteredIncidents.slice(0, 5).map(i => i.status));
  
  const kpis = calculateKPIs(filteredIncidents);
  const incidentsByCategory = processIncidentsByCategory(filteredIncidents);
  const severityDistribution = processSeverityDistribution(filteredIncidents);
  const statusDistribution = processStatusDistribution(filteredIncidents);
  const hourlyDistribution = processHourlyDistribution(filteredIncidents);
  const locationHotspots = processLocationHotspots(filteredIncidents);
  
  console.log('Status distribution result:', statusDistribution);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; dataKey: string; value: number }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-card-foreground font-medium">{`${label}`}</p>
          {payload.map((entry, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-card-foreground font-medium">{data.name}</p>
          <p className="text-primary text-sm">{`Count: ${data.value}`}</p>
        </div>
      );
    }
    return null;
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gradient-to-r from-card to-card-accent border-b border-[hsl(215,20%,35%)] p-6 shadow-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(20,100%,63%)]/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between relative">
            <div>
              <h1 className="text-3xl font-bold text-card-foreground flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(20,100%,63%)] to-[hsl(22,96%,62%)] flex items-center justify-center shadow-lg shadow-[hsl(20,100%,63%)]/30">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                {t('analytics.title')}
              </h1>
              <p className="text-[hsl(214,20%,76%)] mt-2 ml-13">
                {t('analytics.subtitle')}
              </p>
              {user?.company_name && (
                <p className="text-sm text-[hsl(214,20%,76%)] ml-13 mt-1">
                  {user.company_name} {user.company_code ? `• ${user.company_code}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('analytics.filterBySite')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('analytics.allSites')}</SelectItem>
                  {siteOptions.map((site) => (
                    <SelectItem key={site.value} value={site.value}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Custom Range
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Average Response Time"
              value={`${kpis.avgResponseTime} min`}
              icon={<Clock className="h-6 w-6" />}
              trend={{ value: "Calculated from current data", isPositive: true }}
              variant="success"
            />
            <StatsCard
              title="Resolution Rate"
              value={`${kpis.resolutionRate}%`}
              icon={<CheckCircle className="h-6 w-6" />}
              trend={{ value: `${kpis.totalIncidents} total incidents`, isPositive: true }}
              variant="success"
            />
            <StatsCard
              title="High-Risk Incidents"
              value={`${kpis.highRiskPercentage}%`}
              icon={<AlertTriangle className="h-6 w-6" />}
              trend={{ value: `${kpis.highSeverityIncidents} of ${kpis.totalIncidents}`, isPositive: false }}
              variant="warning"
            />
            <StatsCard
              title="Pending Incidents"
              value={kpis.pendingIncidents.toString()}
              icon={<Users className="h-6 w-6" />}
              trend={{ value: "Needs attention", isPositive: false }}
              variant="default"
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Incidents by Category */}
            <Card className="border-[hsl(215,20%,35%)] shadow-lg">
              <CardHeader className="bg-card-accent/30 border-b border-[hsl(215,20%,35%)]">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(20,100%,63%)]/20 to-[hsl(22,96%,62%)]/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-[hsl(20,100%,63%)]" />
                  </div>
                  Incidents by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incidentsByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={incidentsByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {incidentsByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend 
                        wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data to display
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Severity Distribution */}
            <Card className="border-[hsl(215,20%,35%)] shadow-lg">
              <CardHeader className="bg-card-accent/30 border-b border-[hsl(215,20%,35%)]">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  Incidents by Severity Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                {severityDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={severityDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: 'hsl(var(--foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {severityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data to display
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Hourly Distribution and Hotspots */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Hourly Distribution */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Incidents by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                {hourlyDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={hourlyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="hour" 
                        tick={{ fill: 'hsl(var(--foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
                        label={{ value: 'Number of Incidents', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'hsl(var(--foreground))' } }}
                        tick={{ fill: 'hsl(var(--foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="incidents" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data to display
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Incident Hotspots */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Incident Hotspots
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locationHotspots.length > 0 ? (
                  <div className="space-y-4">
                    {locationHotspots.map((hotspot, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <h4 className="font-medium text-foreground">{hotspot.location}</h4>
                          <p className="text-sm text-muted-foreground">{hotspot.incidents} incident{hotspot.incidents !== 1 ? 's' : ''}</p>
                        </div>
                        <div className={`flex items-center gap-1 text-sm ${
                          hotspot.isPositive ? 'text-success' : 'text-danger'
                        }`}>
                          {hotspot.isPositive ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                          {hotspot.change}%
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No data to display
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Additional Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Incidents by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusDistribution.length > 0 && statusDistribution.some(item => item.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusDistribution.filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusDistribution.filter(item => item.value > 0).map((entry, index) => (
                          <Cell key={`status-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend 
                        wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data to display
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Summary Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Total Incidents</span>
                    <span className="text-2xl font-bold text-primary">{kpis.totalIncidents}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Pending Incidents</span>
                    <span className="text-2xl font-bold text-warning">{kpis.pendingIncidents}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">High-Risk Incidents</span>
                    <span className="text-2xl font-bold text-danger">{kpis.highSeverityIncidents}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Resolution Rate</span>
                    <span className="text-2xl font-bold text-success">{kpis.resolutionRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Analytics;
