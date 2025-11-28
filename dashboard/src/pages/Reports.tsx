import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search,
  MapPin,
  Clock,
  Shield,
  Eye,
  CalendarIcon,
  Filter,
  Flame,
  Car,
  Wrench,
  X,
  HardHat,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Sidebar from "@/components/Sidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchIncidents, type Incident } from "@/lib/api";

// Category mapping for display - based on petroleum_type
const getCategoryIcon = (incident: Incident) => {
  const type = (incident.petroleum_type || incident.category || '').toLowerCase();
  if (type.includes('equipment')) return Car;
  if (type.includes('spill') || type.includes('leak') || type.includes('fire') || type.includes('explosion')) return Flame;
  if (type.includes('ppe')) return HardHat;
  if (type.includes('safety') || type.includes('environmental')) return Wrench;
  return Shield;
};

// Category colors for visual distinction - based on petroleum_type
const getCategoryColor = (incident: Incident) => {
  const type = (incident.petroleum_type || incident.category || '').toLowerCase();
  if (type.includes('equipment')) return 'text-slate-700 bg-slate-100 border-slate-300';
  if (type.includes('spill') || type.includes('leak') || type.includes('fire') || type.includes('explosion')) return 'text-orange-700 bg-orange-100 border-orange-300';
  if (type.includes('ppe')) return 'text-amber-700 bg-amber-100 border-amber-300';
  if (type.includes('safety')) return 'text-blue-700 bg-blue-100 border-blue-300';
  if (type.includes('environmental')) return 'text-green-700 bg-green-100 border-green-300';
  return 'text-gray-600 bg-gray-50 border-gray-200';
};

// Get petroleum incident types for filter dropdown
const getIncidentTypes = () => [
  { value: 'all', label: 'All Categories' },
  { value: 'equipment damage', label: 'Equipment Damage' },
  { value: 'spill/leak', label: 'Spill/Leak' },
  { value: 'PPE violation', label: 'PPE Violation' },
  { value: 'safety violation', label: 'Safety Violation' },
  { value: 'fire/explosion', label: 'Fire/Explosion' },
  { value: 'environmental hazard', label: 'Environmental Hazard' },
  { value: 'confined space incident', label: 'Confined Space' },
  { value: 'pressure vessel incident', label: 'Pressure Vessel' },
  { value: 'gas release', label: 'Gas Release' },
  { value: 'chemical exposure', label: 'Chemical Exposure' }
];

const getStatusOptions = (t: (key: string) => string) => [
  t('reports.allStatuses'),
  t('reports.pending'),
  t('reports.accepted'),
  t('reports.rejected')
];

// Map petroleum_type to display name
const mapCategoryToLocal = (incident: Incident) => {
  const type = incident.petroleum_type || incident.category;
  if (!type) return 'Unknown';

  const typeMap: Record<string, string> = {
    'equipment damage': 'Equipment Damage',
    'spill/leak': 'Spill/Leak',
    'ppe violation': 'PPE Violation',
    'safety violation': 'Safety Violation',
    'environmental hazard': 'Environmental Hazard',
    'fire/explosion': 'Fire/Explosion',
    'confined space incident': 'Confined Space',
    'pressure vessel incident': 'Pressure Vessel',
    'gas release': 'Gas Release',
    'chemical exposure': 'Chemical Exposure'
  };

  return typeMap[type.toLowerCase()] || type;
};

// Map English status to localized ones
const mapStatusToLocal = (status: string, t: (key: string) => string) => {
  switch (status.toLowerCase()) {
    case 'pending': return t('reports.pending');
    case 'accepted': return t('reports.accepted');
    case 'rejected': return t('reports.rejected');
    case 'resolved': return t('reports.resolved');
    case 'reviewed': return t('reports.reviewed');
    default: return status;
  }
};

// Map English severity to localized ones
const mapSeverityToLocal = (severity: string, t: (key: string) => string) => {
  switch (severity.toLowerCase()) {
    case 'high': return t('reports.high');
    case 'medium': return t('reports.medium');
    case 'low': return t('reports.low');
    default: return severity;
  }
};

// Map English verified to localized ones
const mapVerifiedToLocal = (verified: string, t: (key: string) => string) => {
  switch (verified.toLowerCase()) {
    case 'real': return t('reports.real');
    case 'fake': return t('reports.fake');
    default: return verified;
  }
};

const Reports = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  // Initialize filters with localized default values
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  
  // Get petroleum types and status options
  const incidentTypes = getIncidentTypes();
  const statusOptions = getStatusOptions(t);

  // Set default filter values after translations are loaded
  React.useEffect(() => {
    if (!statusFilter) {
      setStatusFilter(t('reports.allStatuses'));
    }
    if (!typeFilter) {
      setTypeFilter('all');
    }
    if (!siteFilter) {
      setSiteFilter(t('reports.allSites'));
    }
  }, [t, statusFilter, typeFilter, siteFilter]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
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

  // Fetch incidents from API
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchIncidents();
        setIncidents(response.incidents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch incidents');
        console.error('Error loading incidents:', err);
      } finally {
        setLoading(false);
      }
    };

    loadIncidents();
  }, []);

  // Debounce search term for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const getSeverityVariant = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "default";
      default: return "default";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "high": return "text-red-700 bg-red-100 border-red-300";
      case "medium": return "text-orange-700 bg-orange-100 border-orange-300";
      case "low": return "text-yellow-700 bg-yellow-100 border-yellow-300";
      default: return "text-gray-700 bg-gray-100 border-gray-300";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending": return "secondary";
      case "accepted": return "default";
      case "rejected": return "default";
      default: return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending": return "text-yellow-700 bg-yellow-100 border-yellow-300";
      case "accepted": return "text-green-700 bg-green-100 border-green-300";
      case "rejected": return "text-red-700 bg-red-100 border-red-300";
      default: return "text-gray-700 bg-gray-100 border-gray-300";
    }
  };

  const getVerifiedVariant = (verified: string) => {
    switch (verified.toLowerCase()) {
      case "real": return "default";
      case "fake": return "destructive";
      default: return "secondary";
    }
  };

  const getVerifiedColor = (verified: string) => {
    switch (verified.toLowerCase()) {
      case "real": return "text-green-700 bg-green-100 border-green-300";
      case "fake": return "text-red-700 bg-red-100 border-red-300";
      default: return "text-gray-700 bg-gray-100 border-gray-300";
    }
  };

  const filteredIncidents = incidents.filter(incident => {
    // Search functionality - if no search term, show all
    const matchesSearch = !debouncedSearchTerm.trim() || 
      (incident.incident_id || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (incident.category || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (incident.title || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (incident.location?.address || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (incident.site_name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    
    // Status filter - check against both English and localized values
    const matchesStatus = 
      statusFilter === t('reports.allStatuses') || 
      statusFilter === t('reports.allStatuses') || 
      !statusFilter ||
      (incident.status || '').toLowerCase() === statusFilter.toLowerCase() ||
      mapStatusToLocal(incident.status || '', t).toLowerCase() === statusFilter.toLowerCase();
    
    // Type filter - check against petroleum_type
    const matchesType =
      typeFilter === 'all' ||
      !typeFilter ||
      (incident.petroleum_type || incident.category || '').toLowerCase() === typeFilter.toLowerCase();

    const matchesSite =
      siteFilter === t('reports.allSites') ||
      !siteFilter ||
      siteFilter === (incident.site_id ? String(incident.site_id) : incident.site_name || incident.site_code || '');
    
    return matchesSearch && matchesStatus && matchesType && matchesSite;
  });


  const clearSearch = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
  };

  const resetFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setStatusFilter(t('reports.allStatuses'));
    setTypeFilter(t('reports.allCategories'));
    setSiteFilter(t('reports.allSites'));
    setDateFrom(undefined);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gradient-to-r from-card to-card-accent border-b border-[hsl(215,20%,35%)] p-6 shadow-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(20,100%,63%)]/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between relative">
            <div>
              <h1 className="text-3xl font-bold text-card-foreground flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(20,100%,63%)] to-[hsl(22,96%,62%)] flex items-center justify-center shadow-lg shadow-[hsl(20,100%,63%)]/30">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                {t('reports.title')}
              </h1>
              <p className="text-[hsl(214,20%,76%)] mt-2 ml-13">
                {t('reports.subtitle')}
              </p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Filters Section */}
          <Card className="border-[hsl(215,20%,35%)] shadow-lg">
            <CardHeader className="bg-card-accent/50">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(20,100%,63%)]/20 to-[hsl(22,96%,62%)]/10 flex items-center justify-center border border-[hsl(20,100%,63%)]/30">
                  <Filter className="h-4 w-4 text-[hsl(20,100%,63%)]" />
                </div>
                {t('reports.advancedFilters')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search Bar */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('reports.search')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('reports.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    {searchTerm && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('reports.status')}</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('reports.type')}</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {incidentTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Site Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('reports.site')}</label>
                  <Select value={siteFilter} onValueChange={setSiteFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={t('reports.allSites')}>{t('reports.allSites')}</SelectItem>
                      {siteOptions.map(site => (
                        <SelectItem key={site.value} value={site.value}>{site.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('reports.dateRange')}</label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "PPP") : t('reports.from')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              
              {/* Results Counter and Reset */}
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <div>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">{t('reports.loadingIncidents')}</p>
                  ) : error ? (
                    <p className="text-sm text-red-500">{t('reports.errorLoading')} {error}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('reports.showing')} {filteredIncidents.length} {t('reports.of')} {incidents.length} {t('analytics.incidents').toLowerCase()}
                    </p>
                  )}
                </div>
                {(searchTerm || statusFilter !== t('reports.allStatuses') || typeFilter !== t('reports.allCategories') || siteFilter !== t('reports.allSites') || dateFrom) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="gap-2 border-[hsl(20,100%,63%)]/50 text-[hsl(20,100%,63%)] hover:bg-[hsl(20,100%,63%)]/10 hover:border-[hsl(20,100%,63%)] transition-all"
                  >
                    <X className="h-3 w-3" />
                    {t('reports.resetFilters')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reports Table */}
          <Card className="border-[hsl(215,20%,35%)] shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[hsl(215,20%,35%)] bg-card-accent/50">
                      <TableHead className="text-left font-bold text-[hsl(214,20%,76%)]">{t('reports.reportNumber')}</TableHead>
                      <TableHead className="text-left font-bold text-[hsl(214,20%,76%)]">{t('reports.type')}</TableHead>
                      <TableHead className="text-left font-bold text-[hsl(214,20%,76%)]">{t('reports.titleHeader')}</TableHead>
                      <TableHead className="text-left font-bold text-[hsl(214,20%,76%)]">{t('reports.location')}</TableHead>
                      <TableHead className="text-left font-bold text-[hsl(214,20%,76%)]">{t('reports.status')}</TableHead>
                      <TableHead className="text-left font-bold text-[hsl(214,20%,76%)]">{t('reports.severity')}</TableHead>
                      <TableHead className="text-left font-bold text-[hsl(214,20%,76%)]">{t('reports.verified')}</TableHead>
                      <TableHead className="text-left font-bold text-[hsl(214,20%,76%)]">{t('reports.time')}</TableHead>
                      <TableHead className="text-left font-bold text-[hsl(214,20%,76%)]">{t('reports.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          {t('reports.loadingIncidents')}
                        </TableCell>
                      </TableRow>
                    ) : error ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-red-500">
                          {t('reports.errorLoading')} {error}
                        </TableCell>
                      </TableRow>
                    ) : filteredIncidents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          {t('reports.noIncidentsFound')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredIncidents.map((incident) => {
                        const CategoryIcon = getCategoryIcon(incident);
                        return (
                          <TableRow
                            key={incident.incident_id}
                            className={cn(
                              "border-[hsl(215,20%,35%)] cursor-pointer transition-all duration-200",
                              "hover:bg-card-accent/70 hover:shadow-md",
                              selectedIncident === incident.incident_id && "bg-card-accent/70 border-l-4 border-l-[hsl(20,100%,63%)]"
                            )}
                            onClick={() => navigate(`/incident/${incident.incident_id}`)}
                          >
                            <TableCell className="font-mono text-sm">
                              {incident.incident_id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-2 px-2 py-1 rounded-md border ${getCategoryColor(incident)}`}>
                                <CategoryIcon className="h-4 w-4" />
                                <span className="font-medium">{mapCategoryToLocal(incident)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <span className="truncate block" title={incident.title}>
                                {incident.title}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 table-cell-icon" />
                                <span className="truncate max-w-[200px]" title={incident.location.address}>
                                  {incident.location.address}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`inline-flex px-2 py-1 rounded-md border font-medium ${getStatusColor(incident.status)}`}>
                                {mapStatusToLocal(incident.status, t)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`inline-flex px-2 py-1 rounded-md border font-medium ${getSeverityColor(incident.severity)}`}>
                                {mapSeverityToLocal(incident.severity, t)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`inline-flex px-2 py-1 rounded-md border font-medium ${getVerifiedColor(incident.verified)}`}>
                                {mapVerifiedToLocal(incident.verified, t)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 table-cell-icon" />
                                <span className="text-sm">
                                  {new Date(incident.timestamp).toLocaleDateString()} {new Date(incident.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-[hsl(20,100%,63%)]/50 text-[hsl(20,100%,63%)] hover:bg-gradient-to-r hover:from-[hsl(20,100%,63%)] hover:to-[hsl(22,96%,62%)] hover:text-white hover:border-transparent transition-all shadow-sm hover:shadow-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/incident/${incident.incident_id}`);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {t('reports.view')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Reports;
