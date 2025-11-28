import React, { useCallback, useEffect, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';

interface IncidentLocation {
  address: string;
  latitude: number;
  longitude: number;
}

interface Incident {
  incident_id: string;
  title: string;
  location: IncidentLocation;
  severity: string;
  status: string;
  category: string;
}

interface GoogleMapWrapperProps {
  incidents: Incident[];
  onIncidentClick: (incidentId: string) => void;
  className?: string;
}

// Read Google Maps API key from Vite environment variables
const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || "";

// Map component that will be rendered inside the wrapper
const MapComponent: React.FC<{
  incidents: Incident[];
  onIncidentClick: (incidentId: string) => void;
  style: React.CSSProperties;
}> = ({ incidents, onIncidentClick, style }) => {
  const [map, setMap] = useState<google.maps.Map>();
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [infoWindows, setInfoWindows] = useState<google.maps.InfoWindow[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  const getSeverityColor = (severity: string, status: string): string => {
    if (status.toLowerCase() === 'resolved') return '#10B981';
    
    switch (severity.toLowerCase()) {
      case 'high': return '#EF4444';
      case 'medium': return '#F97316';
      case 'low': return '#EAB308';
      default: return '#6B7280';
    }
  };

  useEffect(() => {
    if (ref.current && !map) {
      console.log('Creating map instance...');
      const newMap = new google.maps.Map(ref.current, {
        center: { lat: 24.7136, lng: 46.6753 }, // Riyadh, Saudi Arabia
        zoom: 11,
        styles: [
          // Dark theme styles
          { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2937' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
          {
            featureType: 'administrative.locality',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d1d5db' }]
          },
          {
            featureType: 'poi',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#9ca3af' }]
          },
          {
            featureType: 'poi.park',
            elementType: 'geometry',
            stylers: [{ color: '#374151' }]
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#374151' }]
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry',
            stylers: [{ color: '#4b5563' }]
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#111827' }]
          }
        ]
      });
      
      // Add click listener to close info windows when clicking on map
      newMap.addListener('click', () => {
        // Close all info windows when clicking on empty map area
        setInfoWindows(prevInfoWindows => {
          prevInfoWindows.forEach(iw => iw.close());
          return prevInfoWindows;
        });
      });

      console.log('Map created successfully');
      setMap(newMap);
    }
  }, [ref, map]);

  useEffect(() => {
    if (!map || !incidents.length) {
      console.log('Map or incidents not ready:', { map: !!map, incidentsLength: incidents.length });
      return;
    }

    console.log('Adding markers for incidents:', incidents.length);
    console.log('First incident location:', incidents[0]?.location);
    
    // Clear existing markers and info windows
    markers.forEach(marker => marker.setMap(null));
    infoWindows.forEach(infoWindow => infoWindow.close());

    // Create new markers and info windows
    const newMarkers: google.maps.Marker[] = [];
    const newInfoWindows: google.maps.InfoWindow[] = [];

    incidents.forEach(incident => {
      const position = {
        lat: incident.location.latitude,
        lng: incident.location.longitude
      };
      
      const color = getSeverityColor(incident.severity, incident.status);
      
      const marker = new google.maps.Marker({
        position,
        map,
        title: incident.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="
            padding: 12px; 
            max-width: 280px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1f2937;
            color: #f9fafb;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          ">
            <div style="margin-bottom: 8px;">
              <h3 style="
                margin: 0; 
                font-size: 14px; 
                font-weight: 600; 
                color: #f9fafb;
                line-height: 1.3;
              ">${incident.title}</h3>
            </div>
            
            <div style="margin: 6px 0; font-size: 11px; color: #d1d5db;">
              <strong style="color: #e5e7eb;">📍 Location:</strong> ${incident.location.address}
            </div>
            
            <div style="margin: 6px 0; font-size: 11px; color: #d1d5db;">
              <strong style="color: #e5e7eb;">🏷️ Category:</strong> ${incident.category}
            </div>
            
            <div style="margin: 6px 0; font-size: 11px; color: #d1d5db;">
              <strong style="color: #e5e7eb;">⚠️ Severity:</strong> 
              <span style="
                color: ${color}; 
                font-weight: 600;
                text-transform: capitalize;
              ">${incident.severity}</span>
            </div>
            
            <div style="margin: 6px 0 10px 0; font-size: 11px; color: #d1d5db;">
              <strong style="color: #e5e7eb;">📊 Status:</strong> 
              <span style="text-transform: capitalize;">${incident.status}</span>
            </div>
            
            <button 
              onclick="window.handleIncidentClick && window.handleIncidentClick('${incident.incident_id}')"
              style="
                width: 100%;
                margin-top: 8px; 
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white; 
                border: none; 
                padding: 8px 12px; 
                border-radius: 6px; 
                cursor: pointer; 
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s;
              "
              onmouseover="this.style.background='linear-gradient(135deg, #2563eb, #1d4ed8)'"
              onmouseout="this.style.background='linear-gradient(135deg, #3b82f6, #2563eb)'"
            >
              🔍 View Details
            </button>
          </div>
        `,
        maxWidth: 300,
        disableAutoPan: false,
        pixelOffset: new google.maps.Size(0, -10)
      });

      marker.addListener('click', () => {
        // Close all other info windows first
        newInfoWindows.forEach(iw => iw.close());
        // Open this info window
        infoWindow.open(map, marker);
      });

      newMarkers.push(marker);
      newInfoWindows.push(infoWindow);
    });

    setMarkers(newMarkers);
    setInfoWindows(newInfoWindows);

    // Adjust bounds to show all incidents
    if (incidents.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      incidents.forEach(incident => {
        bounds.extend({
          lat: incident.location.latitude,
          lng: incident.location.longitude
        });
      });

      console.log('Fitting map to bounds:', bounds.toJSON());

      // For a single incident, center and zoom directly
      if (incidents.length === 1) {
        map.setCenter({
          lat: incidents[0].location.latitude,
          lng: incidents[0].location.longitude
        });
        map.setZoom(14);
        console.log('Single incident - centered at:', incidents[0].location);
      } else {
        // Multiple incidents - fit bounds with padding
        map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });

        // Ensure minimum zoom
        const listener = google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom()! > 15) map.setZoom(15);
          google.maps.event.removeListener(listener);
        });
      }
    }
  }, [map, incidents]);

  // Make incident click handler available globally
  useEffect(() => {
    (window as Window & typeof globalThis & { handleIncidentClick?: (id: string) => void }).handleIncidentClick = onIncidentClick;
    return () => {
      delete (window as Window & typeof globalThis & { handleIncidentClick?: (id: string) => void }).handleIncidentClick;
    };
  }, [onIncidentClick]);

  return <div ref={ref} style={style} />;
};

// Render function for different loading states
const render = (status: Status): React.ReactElement => {
  switch (status) {
    case Status.LOADING:
      return (
        <div className="flex items-center justify-center h-full bg-slate-800 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-slate-400">Loading Google Maps...</p>
          </div>
        </div>
      );
    case Status.FAILURE:
      return (
        <div className="flex items-center justify-center h-full bg-slate-800 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-red-400 mb-2">Failed to load Google Maps</p>
            <p className="text-xs text-slate-500">Please check your API key and internet connection</p>
          </div>
        </div>
      );
    default:
      return <div className="h-full bg-slate-800 rounded-lg" />;
  }
};

const GoogleMapWrapper: React.FC<GoogleMapWrapperProps> = ({ incidents, onIncidentClick, className }) => {
  console.log('GoogleMapWrapper rendered with incidents:', incidents.length);
  
  return (
    <div className={className}>
      <Wrapper
        apiKey={GOOGLE_MAPS_API_KEY}
        render={render}
        libraries={['places']}
      >
        <MapComponent
          incidents={incidents}
          onIncidentClick={onIncidentClick}
          style={{ width: '100%', height: '100%' }}
        />
      </Wrapper>
    </div>
  );
};

export default GoogleMapWrapper;
