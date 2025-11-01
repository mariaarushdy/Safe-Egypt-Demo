// API configuration and service functions
// Change this to your backend URL:
// - For local development: 'http://localhost:8000'
// - For ngrok: 'https://your-ngrok-url.ngrok-free.dev'
// const API_BASE_URL = 'http://localhost:8000';

// import { readFileSync } from 'fs';

// // Read and parse the JSON config file
// const ngrokConfig = JSON.parse(readFileSync('ngrok_config.json', 'utf8'));

// // Extract the ngrok_ip field
// const ngrok = ngrokConfig['ngrok_ip'];

// // Set your base URL
// const API_BASE_URL = ngrok;

// export default API_BASE_URL;
const API_BASE_URL = 'http://localhost:8000';
// const API_BASE_URL = 'https://unnacreous-jameson-diacidic.ngrok-free.dev';

export interface IncidentLocation {
  address: string;
  latitude: number;
  longitude: number;
}

export interface Incident {
  category: string;
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High';
  verified: string;
  incident_id: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'resolved';
  location: IncidentLocation;
}

export interface IncidentsResponse {
  status: string;
  message: string;
  total_incidents: number;
  incidents: Incident[];
}

export interface DashboardStats {
  activeReports: number;
  highRiskAlerts: number;
  pendingActions: number;
}

export interface DashboardUser {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
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
  weapon_type: string | null;
  person_attributes: string;
  image_path: string;
  detected_elements_paths: string[];
}

export interface IncidentInfo {
  category: string;
  title: string;
  description: string;
  severity: string;
  verified: string;
  violence_type?: string;
  weapon?: string;
  site_description: string;
  number_of_people: number;
  description_of_people: string;
  detailed_description_for_the_incident: string;
  accident_type?: string | null;
  vehicles_machines_involved?: string | null;
  utility_type?: string | null;
  extent_of_impact?: string | null;
  duration?: string | null;
  illegal_type?: string | null;
  items_involved?: string | null;
  detected_events: DetectedEvent[];
  incident_id: string;
  timestamp: string;
  location: IncidentLocation;
  real_files: string[];
}

export interface IncidentDetailResponse {
  status: string;
  incident_id: string;
  incident_info: IncidentInfo;
}

// Fetch incidents from the API
export const fetchUsers = async (): Promise<UsersResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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

export const fetchIncidents = async (): Promise<IncidentsResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/incidents`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Skip ngrok browser warning
      },
      mode: 'cors', // Enable CORS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Check if response is actually JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response received:', text);
      throw new Error('Server returned non-JSON response');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching incidents:', error);
    throw error;
  }
};

// Calculate dashboard statistics from incidents
export const calculateDashboardStats = (incidents: Incident[]): DashboardStats => {
  const activeReports = incidents.length;
  const highRiskAlerts = incidents.filter(incident => incident.severity === 'High').length;
  const pendingActions = incidents.filter(incident => incident.status === 'pending').length;

  return {
    activeReports,
    highRiskAlerts,
    pendingActions
  };
};

// Map API categories to display categories
export const mapCategory = (category: string): string => {
  switch (category.toLowerCase()) {
    case 'violence':
      return 'Violence';
    case 'accidents':
      return 'Accidents';
    case 'utility':
      return 'Utility';
    case 'illegal':
      return 'Illegal';
    default:
      return category;
  }
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
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
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
    
    const response = await fetch(`${API_BASE_URL}/api/dashboard/incident/${incidentId}/video`, {
      method: 'POST',
      headers: {
        'Accept': 'video/*,*/*',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
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
    const response = await fetch(`${API_BASE_URL}/api/dashboard/incident/${incidentId}/image`, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
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
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
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
