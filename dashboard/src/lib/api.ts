const API_BASE_URL = 'http://localhost:8000';
// const API_BASE_URL = 'https://your-ngrok-url.ngrok-free.dev';

// ----------------------------
// Types
// ----------------------------
export type PetroleumIncidentType =
  | 'equipment damage'
  | 'spill/leak'
  | 'safety violation'
  | 'environmental hazard'
  | 'PPE violation'
  | 'fire/explosion'
  | 'confined space incident'
  | 'pressure vessel incident'
  | 'gas release'
  | 'chemical exposure';

export type IncidentCategory =
  | 'petroleum safety'
  | 'construction safety'
  | 'ppe violation'
  | 'safety violation'
  | 'environmental hazard'
  | 'equipment damage'
  | 'spill/leak'
  | 'fire/explosion'
  | 'structural issue'
  | PetroleumIncidentType
  | string;

export interface LocationShape {
  address: string;
  latitude: number;
  longitude: number;
}

export interface Incident {
  incident_id: string;
  category: IncidentCategory;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'Low' | 'Medium' | 'High';
  verified: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'accepted' | 'rejected' | string;
  timestamp: string;
  // Multi-tenant/site context
  company_id?: number;
  company_name?: string;
  site_id?: number;
  site_name?: string;
  site_code?: string;
  site_type?: 'petroleum' | 'construction' | string;
  site_address?: string;
  zone_id?: number;
  zone_name?: string;
  worker_id?: number;
  worker_name?: string;
  employee_id?: string;
  // Geo/location (normalized below)
  location: LocationShape;
  latitude?: number;
  longitude?: number;
  // Petroleum/Construction specific fields
  petroleum_type?: string;
  construction_type?: string;
  ppe_missing?: string[];
  substance_involved?: string;
  structure_affected?: string;
  equipment_id?: string;
  site_description?: string;
  detected_events?: unknown[];
  real_files?: string[];
  media_files?: { file_path: string; media_type: string }[];
}

export interface IncidentsResponse {
  status: string;
  message?: string;
  total_incidents: number;
  company_id?: number;
  company_name?: string;
  incidents: Incident[];
}

export interface DashboardStats {
  activeReports: number;
  highRiskAlerts: number;
  pendingActions: number;
}

export interface HSEUser {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  role?: string;
  company_id: number;
  company_code: string;
  company_name: string;
  industry_type?: string;
  user_type: 'hse';
}

export interface LoginResponse {
  status: string;
  message: string;
  access_token: string;
  token_type: string;
  user: HSEUser;
}

export interface IncidentLocation {
  address: string;
  latitude: number;
  longitude: number;
}

export interface IncidentInfo {
  category: string;
  title: string;
  description: string;
  severity: string;
  verified: string;
  violence_type?: string;
  weapon?: string;
  site_description?: string;
  number_of_people?: number;
  description_of_people?: string;
  detailed_description_for_the_incident?: string;
  accident_type?: string | null;
  vehicles_machines_involved?: string | null;
  utility_type?: string | null;
  extent_of_impact?: string | null;
  duration?: string | null;
  illegal_type?: string | null;
  items_involved?: string | null;
  detected_events?: unknown[];
  incident_id: string;
  timestamp: string;
  location: IncidentLocation;
  real_files?: string[];
  petroleum_type?: string;
  construction_type?: string;
  site_type?: string;
  ppe_missing?: string[];
  substance_involved?: string;
  structure_affected?: string;
}

export interface IncidentDetailResponse {
  status: string;
  incident_id?: string;
  incident?: IncidentInfo;
  incident_info?: IncidentInfo;
}

// ----------------------------
// Helpers
// ----------------------------
const buildQueryString = (params: Record<string, string | number | undefined>) => {
  const defined = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '');
  if (!defined.length) return '';
  const searchParams = new URLSearchParams();
  defined.forEach(([key, value]) => searchParams.append(key, String(value)));
  return `?${searchParams.toString()}`;
};

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

export interface DashboardUser {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  company_name?: string;
  company_code?: string;
}

export interface UsersResponse {
  status: string;
  message: string;
  total_dashboard_users: number;
  active_dashboard_users: number;
  total_app_users: number;
  registered_app_users: number;
  anonymous_app_users: number;
  total_users: number;
  dashboard_users: DashboardUser[];
}

export interface DetectedEvent {
  event_type: string;
  first_second: number;
  confidence: number;
  description: string;
  suggested_frame_seconds: number;
  weapon_type?: string | null;
  person_attributes?: string;
  image_path?: string;
  detected_elements_paths?: string[];
}

// ----------------------------
// Auth
// ----------------------------
export const loginHSE = async (payload: {
  username: string;
  password: string;
  company_code: string;
}): Promise<LoginResponse> => {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    const detail = data?.detail || data?.message || 'Invalid credentials';
    throw new Error(detail);
  }

  return data;
};

// Fetch incidents from the API
export const fetchUsers = async (): Promise<UsersResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/users`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export interface IncidentFilters {
  siteId?: number;
  status?: string;
  severity?: string;
  incidentType?: string;
}

const normalizeIncident = (incident: any): Incident => {
  const address =
    incident?.site_address ||
    incident?.address ||
    incident?.location?.address ||
    'Unknown location';
  const latitude =
    incident?.latitude ?? incident?.location?.latitude ?? 0;
  const longitude =
    incident?.longitude ?? incident?.location?.longitude ?? 0;

  return {
    ...incident,
    location: { address, latitude, longitude },
  };
};

export const fetchIncidents = async (filters: IncidentFilters = {}): Promise<IncidentsResponse> => {
  try {
    const query = buildQueryString({
      site_id: filters.siteId,
      status: filters.status,
      severity: filters.severity,
      incident_type: filters.incidentType,
    });

    const response = await fetch(`${API_BASE_URL}/api/dashboard/incidents${query}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response received:', text);
      throw new Error('Server returned non-JSON response');
    }
    
    const data = await response.json();
    const incidents = Array.isArray(data?.incidents)
      ? data.incidents.map(normalizeIncident)
      : [];

    return { ...data, incidents };
  } catch (error) {
    console.error('Error fetching incidents:', error);
    throw error;
  }
};

// Calculate dashboard statistics from incidents
export const calculateDashboardStats = (incidents: Incident[]): DashboardStats => {
  const activeReports = incidents.length;
  const highRiskAlerts = incidents.filter(incident => (incident.severity || '').toLowerCase() === 'high').length;
  const pendingActions = incidents.filter(incident => (incident.status || '').toLowerCase() === 'pending').length;

  return {
    activeReports,
    highRiskAlerts,
    pendingActions
  };
};

// Map API categories to display categories
// Petroleum incident types list
export const PETROLEUM_TYPES = [
  { value: 'equipment damage', label: 'Equipment Damage' },
  { value: 'spill/leak', label: 'Spill/Leak' },
  { value: 'safety violation', label: 'Safety Violation' },
  { value: 'environmental hazard', label: 'Environmental Hazard' },
  { value: 'PPE violation', label: 'PPE Violation' },
  { value: 'fire/explosion', label: 'Fire/Explosion' },
  { value: 'confined space incident', label: 'Confined Space' },
  { value: 'pressure vessel incident', label: 'Pressure Vessel' },
  { value: 'gas release', label: 'Gas Release' },
  { value: 'chemical exposure', label: 'Chemical Exposure' }
] as const;

// Map petroleum type to display name
export const mapPetroleumType = (type: string): string => {
  const normalized = type?.toLowerCase?.() || '';
  if (!normalized) return type;

  const typeMap: Record<string, string> = {
    'equipment damage': 'Equipment Damage',
    'spill/leak': 'Spill/Leak',
    'safety violation': 'Safety Violation',
    'environmental hazard': 'Environmental Hazard',
    'ppe violation': 'PPE Violation',
    'fire/explosion': 'Fire/Explosion',
    'confined space incident': 'Confined Space',
    'pressure vessel incident': 'Pressure Vessel',
    'gas release': 'Gas Release',
    'chemical exposure': 'Chemical Exposure'
  };

  return typeMap[normalized] || type;
};

export const mapCategory = (category: string): string => {
  const normalized = category?.toLowerCase?.() || '';
  if (!normalized) return category;
  if (normalized.includes('petroleum')) return 'Petroleum Safety';
  if (normalized.includes('construction')) return 'Construction Safety';
  if (normalized.includes('ppe')) return 'PPE Violation';
  if (normalized.includes('spill')) return 'Spill/Leak';
  if (normalized.includes('equipment')) return 'Equipment Damage';
  if (normalized.includes('fire')) return 'Fire/Explosion';
  if (normalized.includes('confined space')) return 'Confined Space';
  if (normalized.includes('pressure vessel')) return 'Pressure Vessel';
  if (normalized.includes('gas release')) return 'Gas Release';
  if (normalized.includes('chemical')) return 'Chemical Exposure';
  if (normalized.includes('environmental')) return 'Environmental Hazard';

  // Try mapping as petroleum type
  return mapPetroleumType(category);
};

// Get severity color for map pins
export const getSeverityMapColor = (severity: string, status: string): string => {
  if (status === 'resolved') return '#22c55e'; // green
  
  switch (severity.toLowerCase()) {
    case 'high':
      return '#ef4444'; // red
    case 'medium':
      return '#f97316'; // orange
    case 'low':
      return '#eab308'; // yellow
    default:
      return '#6b7280'; // gray
  }
};

// Fetch incident detail information
export const fetchIncidentDetail = async (incidentId: string): Promise<IncidentDetailResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/incident/${incidentId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response received:', text);
      throw new Error('Server returned non-JSON response');
    }
    
    const data = await response.json();
    // Normalize shape (backend may return `incident` instead of `incident_info`)
    if (data?.incident && !data?.incident_info) {
      return { ...data, incident_info: data.incident, incident_id: incidentId };
    }
    return data;
  } catch (error) {
    console.error('Error fetching incident detail:', error);
    throw error;
  }
};

// Fetch video file for incident
export const fetchIncidentVideo = async (incidentId: string, filePath: string): Promise<Blob> => {
  try {
    console.log('Fetching video from API:', `${API_BASE_URL}/api/dashboard/incident/${incidentId}/video`);
    console.log('Request body:', { file_path: filePath });

    const authHeaders = getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/dashboard/incident/${incidentId}/video`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Accept': 'video/*,*/*',
      },
      mode: 'cors',
      body: JSON.stringify({ file_path: filePath }),
    });
    
    console.log('Video API response status:', response.status);
    console.log('Video API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Video API error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    console.log('Video content type:', contentType);
    
    // Check if we got an error response instead of video
    if (contentType && (contentType.includes('text/html') || contentType.includes('application/json'))) {
      const errorText = await response.text();
      console.error('Server returned error page instead of video:', errorText);
      throw new Error('Server returned error page instead of video file');
    }
    
    const blob = await response.blob();
    console.log('Video blob created:', blob.size, 'bytes, type:', blob.type);
    
    return blob;
  } catch (error) {
    console.error('Error fetching incident video:', error);
    throw error;
  }
};

// Fetch image file for incident
export const fetchIncidentImage = async (incidentId: string, imagePath: string): Promise<Blob> => {
  try {
    const authHeaders = getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/dashboard/incident/${incidentId}/image`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Accept': '*/*',
      },
      mode: 'cors',
      body: JSON.stringify({ image_path: imagePath }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error('Error fetching incident image:', error);
    throw error;
  }
};

// Update incident status (accept/reject)
export const updateIncidentStatus = async (incidentId: string, status: 'accepted' | 'rejected'): Promise<{ status: string; message: string; incident?: unknown }> => {
  try {
    console.log('Updating incident status:', incidentId, 'to', status);

    const response = await fetch(`${API_BASE_URL}/api/dashboard/incident/${incidentId}/status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      mode: 'cors',
      body: JSON.stringify({ status }),
    });
    
    console.log('Status update response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Status update error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('Status update successful:', data);
      return data;
    } else {
      // Some APIs might return plain text or empty response on success
      const text = await response.text();
      console.log('Status update successful (text response):', text);
      return { status: 'success', message: text || 'Status updated successfully' };
    }
  } catch (error) {
    console.error('Error updating incident status:', error);
    throw error;
  }
};
