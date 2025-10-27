import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Camera, 
  Clock,
  AlertTriangle,
  Shield
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import Sidebar from "@/components/Sidebar";
import { 
  fetchIncidentDetail, 
  fetchIncidentImage,
  type IncidentInfo,
  type DetectedEvent 
} from "@/lib/api";

const EventDetail = () => {
  const { id, eventIndex } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [incidentData, setIncidentData] = useState<IncidentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [clickedImage, setClickedImage] = useState<string | null>(null);
  
  const eventIdx = parseInt(eventIndex || '0');
  const event = incidentData?.detected_events[eventIdx];

  useEffect(() => {
    const loadIncidentDetail = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await fetchIncidentDetail(id);
        setIncidentData(response.incident_info);
        
        // Load images for the specific event
        const eventData = response.incident_info.detected_events[eventIdx];
        if (eventData) {
          const urls: { [key: string]: string } = {};
          
          // Load the main scene image if available
          if (eventData.image_path) {
            try {
              const imageBlob = await fetchIncidentImage(id, eventData.image_path);
              const url = URL.createObjectURL(imageBlob);
              urls[eventData.image_path] = url;
            } catch (imageError) {
              console.warn(`Could not load scene image ${eventData.image_path}:`, imageError);
            }
          }
          
          // Load all detection images for this event
          if (eventData.detected_elements_paths) {
            for (let i = 0; i < eventData.detected_elements_paths.length; i++) {
              const imagePath = eventData.detected_elements_paths[i];
              try {
                const imageBlob = await fetchIncidentImage(id, imagePath);
                const url = URL.createObjectURL(imageBlob);
                urls[imagePath] = url;
              } catch (imageError) {
                console.warn(`Could not load detection image ${imagePath}:`, imageError);
              }
            }
          }
          
          setImageUrls(urls);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load incident details');
        console.error('Error loading incident detail:', err);
      } finally {
        setLoading(false);
      }
    };

    loadIncidentDetail();
  }, [id, eventIdx]);

  // Cleanup image URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const extractFilename = (path: string) => {
    return path.split('\\').pop() || path.split('/').pop() || path;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading event details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !incidentData || !event) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Event Not Found</h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate(`/incident/${id}`)}>
              Back to Incident
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
        <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/incident/${id}`)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Incident
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Event {eventIdx + 1} - Detection Details</h1>
                <p className="text-muted-foreground text-sm">
                  Event at {formatDuration(event.first_second)} - {event.event_type}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Scene Image - Main Content */}
              <div className="lg:col-span-2">
                {event.image_path && (
                  <Card className="shadow-lg mb-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3">
                        <Camera className="h-5 w-5 text-primary" />
                        Scene Image
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="aspect-video bg-accent rounded-lg overflow-hidden relative group cursor-pointer"
                        onMouseEnter={() => event.image_path && imageUrls[event.image_path] && setHoveredImage(imageUrls[event.image_path])}
                        onMouseLeave={() => setHoveredImage(null)}
                        onClick={() => event.image_path && imageUrls[event.image_path] && setClickedImage(imageUrls[event.image_path])}
                      >
                        {imageUrls[event.image_path] ? (
                          <img 
                            src={imageUrls[event.image_path]} 
                            alt="Scene capture"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                              <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                              <p className="text-lg font-semibold mb-2">Loading Scene Image</p>
                              <p className="text-muted-foreground">Scene captured at {formatDuration(event.first_second)}</p>
                            </div>
                          </div>
                        )}
                        {/* Hover overlay */}
                        {imageUrls[event.image_path] && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-center">
                              <Camera className="h-8 w-8 mx-auto mb-2" />
                              <p className="text-sm font-medium">Click or hover to enlarge</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

              </div>

              {/* Event Information & Detection Images - Sidebar */}
              <div className="lg:col-span-1">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-primary" />
                      Event Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Event Information Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={
                          event.event_type === 'weapon' ? 'border-destructive text-destructive' : 'border-primary text-primary'
                        }>
                          {event.event_type}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDuration(event.first_second)}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-2">Confidence</h3>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-accent rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ width: `${event.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold">{(event.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-2">Description</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {event.description}
                        </p>
                      </div>

                      {event.weapon_type && (
                        <div>
                          <h3 className="font-semibold mb-2">Weapon Type</h3>
                          <Badge variant="outline" className="border-destructive text-destructive">
                            {event.weapon_type}
                          </Badge>
                        </div>
                      )}

                      <div>
                        <h3 className="font-semibold mb-2">Person Attributes</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {event.person_attributes}
                        </p>
                      </div>
                    </div>

                    {/* Detection Images Section */}
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">Detection Images ({event.detected_elements_paths.length})</h3>
                      </div>
                      
                      <ScrollArea className="h-64">
                        <div className="space-y-3">
                          {event.detected_elements_paths.map((imagePath: string, index: number) => (
                            <div key={index} className="border border-border rounded-lg overflow-hidden bg-accent/30">
                              <div 
                                className="aspect-video bg-accent flex items-center justify-center relative group cursor-pointer"
                                onMouseEnter={() => imageUrls[imagePath] && setHoveredImage(imageUrls[imagePath])}
                                onMouseLeave={() => setHoveredImage(null)}
                                onClick={() => imageUrls[imagePath] && setClickedImage(imageUrls[imagePath])}
                              >
                                {imageUrls[imagePath] ? (
                                  <>
                                    <img 
                                      src={imageUrls[imagePath]} 
                                      alt={`Detection ${index + 1}`}
                                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                    />
                                    {/* Hover overlay for detection images */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-center">
                                        <Camera className="h-4 w-4 mx-auto mb-1" />
                                        <p className="text-xs">Click to enlarge</p>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-center">
                                    <Camera className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                                    <p className="text-xs font-medium">Detection {index + 1}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Loading...
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="p-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    {imagePath.includes('person') ? 'Person' : 
                                     imagePath.includes('weapon') ? 'Weapon' : 'Detection'}
                                  </span>
                                  <Badge variant="secondary" className="text-xs">
                                    {imagePath.match(/conf([\d.]+)/)?.[1] ? 
                                      `${(parseFloat(imagePath.match(/conf([\d.]+)/)?.[1] || '0') * 100).toFixed(0)}%` : 
                                      'N/A'
                                    }
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        AI detection results
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Full Image Modal - Hover */}
      {hoveredImage && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4"
          style={{ pointerEvents: 'none' }}
        >
          <div className="relative max-w-6xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden">
            <img 
              src={hoveredImage} 
              alt="Enlarged view"
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg">
              <p className="text-sm font-medium">Hover View</p>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Modal - Click */}
      {clickedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setClickedImage(null)}
        >
          <div className="relative max-w-7xl max-h-[95vh] bg-white rounded-lg shadow-2xl overflow-hidden">
            <img 
              src={clickedImage} 
              alt="Full size view"
              className="w-full h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setClickedImage(null)}
              className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg hover:bg-black/90 transition-colors"
            >
              ✕ Close
            </button>
            <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg">
              <p className="text-sm font-medium">Full Size - Click outside to close</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetail;
