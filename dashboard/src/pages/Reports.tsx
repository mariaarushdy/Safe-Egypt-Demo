import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Zap,
  Users,
  Heart,
  AlertTriangle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import Sidebar from "@/components/Sidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchIncidents, type Incident } from "@/lib/api";

// Category mapping for display
const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'violence': return Shield;
    case 'accidents': return Car;
    case 'fire': return Flame;
    case 'medical': return Heart;
    case 'utility': return Zap;
    case 'illegal': return Users;
    default: return AlertTriangle;
  }
};

// Category colors for visual distinction
const getCategoryColor = (category: string) => {
  switch (category.toLowerCase()) {
    case 'violence': return 'text-red-600 bg-red-50 border-red-200';
    case 'accidents': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'fire': return 'text-red-700 bg-red-100 border-red-300';
    case 'medical': return 'text-pink-600 bg-pink-50 border-pink-200';
    case 'utility': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'illegal': return 'text-purple-600 bg-purple-50 border-purple-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

// Get localized incident types and status options
const getIncidentTypes = (t: (key: string) => string) => [
  t('reports.allCategories'),
  t('reports.violence'),
  t('reports.accidents'),
  t('reports.fire'),
  t('reports.medical'),
  t('reports.utility'),
  t('reports.illegal')
];

const getStatusOptions = (t: (key: string) => string) => [
  t('reports.allStatuses'),
  t('reports.pending'),
  t('reports.accepted'),
  t('reports.rejected')
];

// Map English categories to localized ones
const mapCategoryToLocal = (category: string, t: (key: string) => string) => {
  switch (category.toLowerCase()) {
    case 'violence': return t('reports.violence');
    case 'accidents': return t('reports.accidents');
    case 'fire': return t('reports.fire');
    case 'medical': return t('reports.medical');
    case 'utility': return t('reports.utility');
    case 'illegal': return t('reports.illegal');
    default: return category;
  }
};

// Map English status to localized ones
const mapStatusToLocal = (status: string, t: (key: string) => string) => {
  switch (status.toLowerCase()) {
    case 'pending': return t('reports.pending');
    case 'accepted': return t('reports.accepted');
    case 'rejected': return t('reports.rejected');
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
  
  // Get localized options
  const incidentTypes = getIncidentTypes(t);
  const statusOptions = getStatusOptions(t);
  
  // Set default filter values after translations are loaded
  React.useEffect(() => {
    if (!statusFilter) {
      setStatusFilter(t('reports.allStatuses'));
    }
    if (!typeFilter) {
      setTypeFilter(t('reports.allCategories'));
    }
  }, [t, statusFilter, typeFilter]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      incident.incident_id.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      incident.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      incident.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      incident.location.address.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    
    // Status filter - check against both English and localized values
    const matchesStatus = 
      statusFilter === t('reports.allStatuses') || 
      statusFilter === t('reports.allStatuses') || 
      !statusFilter ||
      incident.status.toLowerCase() === statusFilter.toLowerCase() ||
      mapStatusToLocal(incident.status, t).toLowerCase() === statusFilter.toLowerCase();
    
    // Type filter - check against both English and localized values  
    const matchesType = 
      typeFilter === t('reports.allCategories') || 
      typeFilter === t('reports.allCategories') || 
      !typeFilter ||
      incident.category.toLowerCase() === typeFilter.toLowerCase() ||
      mapCategoryToLocal(incident.category, t).toLowerCase() === typeFilter.toLowerCase();
    
    return matchesSearch && matchesStatus && matchesType;
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
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-card-foreground">
                {t('reports.title')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('reports.subtitle')}
              </p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Filters Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {t('reports.advancedFilters')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        <SelectItem key={type} value={type}>{type}</SelectItem>
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
                {(searchTerm || statusFilter !== t('reports.allStatuses') || typeFilter !== t('reports.allCategories') || dateFrom) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="gap-2"
                  >
                    <X className="h-3 w-3" />
                    {t('reports.resetFilters')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reports Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-left">{t('reports.reportNumber')}</TableHead>
                      <TableHead className="text-left">{t('reports.type')}</TableHead>
                      <TableHead className="text-left">{t('reports.titleHeader')}</TableHead>
                      <TableHead className="text-left">{t('reports.location')}</TableHead>
                      <TableHead className="text-left">{t('reports.status')}</TableHead>
                      <TableHead className="text-left">{t('reports.severity')}</TableHead>
                      <TableHead className="text-left">{t('reports.verified')}</TableHead>
                      <TableHead className="text-left">{t('reports.time')}</TableHead>
                      <TableHead className="text-left">{t('reports.actions')}</TableHead>
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
                        const CategoryIcon = getCategoryIcon(incident.category);
                        return (
                          <TableRow 
                            key={incident.incident_id}
                            className={cn(
                              "border-border cursor-pointer hover:bg-card-accent transition-colors",
                              selectedIncident === incident.incident_id && "bg-card-accent"
                            )}
                            onClick={() => navigate(`/incident/${incident.incident_id}`)}
                          >
                            <TableCell className="font-mono text-sm">
                              {incident.incident_id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-2 px-2 py-1 rounded-md border ${getCategoryColor(incident.category)}`}>
                                <CategoryIcon className="h-4 w-4" />
                                <span className="font-medium">{mapCategoryToLocal(incident.category, t)}</span>
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
                                className="gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/incident/${incident.incident_id}`);
                                }}
                              >
                                <Eye className="h-3 w-3" />
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