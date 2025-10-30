import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Calendar, 
  AlertTriangle,
  Users,
  Clock,
  Shield,
  Camera,
  Play
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import Sidebar from "@/components/Sidebar";
import { 
  fetchIncidentDetail, 
  updateIncidentStatus,
  type IncidentInfo,
  type DetectedEvent 
} from "@/lib/api";
import { mediaCacheService } from "@/services/mediaCacheService";

const IncidentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [incidentData, setIncidentData] = useState<IncidentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [sceneImages, setSceneImages] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const loadIncidentDetail = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await fetchIncidentDetail(id);
        setIncidentData(response.incident_info);
        
        // Load video if available (using cache service)
        console.log('Real files:', response.incident_info.real_files);
        if (response.incident_info.real_files && response.incident_info.real_files.length > 0) {
          console.log('Loading video with cache:', response.incident_info.real_files[0]);
          setVideoLoading(true);
          setVideoError(null);
          try {
            const url = await mediaCacheService.getVideo(id, response.incident_info.real_files[0]);
            setVideoUrl(url);
          } catch (videoError) {
            const errorMsg = videoError instanceof Error ? videoError.message : 'Unknown video loading error';
            console.error('Could not load video:', videoError);
            setVideoError(errorMsg);
          } finally {
            setVideoLoading(false);
          }
        } else {
          console.log('No real_files found or empty array');
          setVideoError('No video files available for this incident');
        }

        // Load scene images using batch cache loading
        const imagePaths = response.incident_info.detected_events
          .map((event: DetectedEvent) => event.image_path)
          .filter(Boolean);
        
        if (imagePaths.length > 0) {
          console.log(`Loading ${imagePaths.length} scene images with cache...`);
          try {
            const imageUrlsMap = await mediaCacheService.getImagesBatch(id, imagePaths);
            
            // Convert Map to object for state
            const imageUrls: { [key: string]: string } = {};
            imageUrlsMap.forEach((url, path) => {
              imageUrls[path] = url;
            });
            
            setSceneImages(imageUrls);
          } catch (imageError) {
            console.warn('Failed to load some scene images:', imageError);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load incident details');
        console.error('Error loading incident detail:', err);
      } finally {
        setLoading(false);
      }
    };

    loadIncidentDetail();
  }, [id]);

  // Cache service handles cleanup automatically, no manual cleanup needed

  const handleAction = async (action: 'accept' | 'reject') => {
    if (!id) return;
    
    setIsProcessing(true);
    try {
      const status = action === 'accept' ? 'accepted' : 'rejected';
      await updateIncidentStatus(id, status);
      console.log(`${action} incident:`, id, 'successfully');
      
      // Navigate back to dashboard after successful update
      navigate('/dashboard');
    } catch (error) {
      console.error(`Error ${action}ing incident:`, error);
      // You might want to show an error toast here
      alert(`Failed to ${action} incident. Please try again.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'bg-gradient-to-r from-red-500 to-red-600 text-white';
      case 'medium': return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white';
      case 'low': return 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
            <p className="text-muted-foreground">Loading incident details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !incidentData) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Incident Not Found</h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/dashboard')}>
              Back to Dashboard
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">{incidentData.title}</h1>
                  <p className="text-muted-foreground text-sm">
                    ID: {incidentData.incident_id}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleAction('reject')}
                  variant="outline"
                  className="gap-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  disabled={isProcessing}
                >
                  <XCircle className="h-4 w-4" />
                  Reject Incident
                </Button>
                <Button
                  onClick={() => handleAction('accept')}
                  className="gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:opacity-90"
                  disabled={isProcessing}
                >
                  <CheckCircle className="h-4 w-4" />
                  Accept Incident
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="xl:col-span-2 space-y-6">
                {/* Incident Overview */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        Incident Overview
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(incidentData.severity)}>
                          {incidentData.severity} Severity
                        </Badge>
                        <Badge variant="outline" className="border-success text-success">
                          <Shield className="h-3 w-3 mr-1" />
                          {incidentData.verified}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Category</h3>
                      <Badge variant="secondary">{incidentData.category}</Badge>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {incidentData.description}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Detailed Analysis</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {incidentData.detailed_description_for_the_incident}
                      </p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-accent rounded-lg">
                        <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-sm text-muted-foreground">People Involved</p>
                        <p className="font-semibold">{incidentData.number_of_people}</p>
                      </div>
                      {incidentData.violence_type && (
                        <div className="text-center p-3 bg-accent rounded-lg">
                          <Shield className="h-5 w-5 mx-auto mb-1 text-warning" />
                          <p className="text-sm text-muted-foreground">Violence Type</p>
                          <p className="font-semibold capitalize">{incidentData.violence_type}</p>
                        </div>
                      )}
                      {incidentData.weapon && (
                        <div className="text-center p-3 bg-accent rounded-lg">
                          <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                          <p className="text-sm text-muted-foreground">Weapon</p>
                          <p className="font-semibold">{incidentData.weapon}</p>
                        </div>
                      )}
                      <div className="text-center p-3 bg-accent rounded-lg">
                        <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-sm text-muted-foreground">Reported</p>
                        <p className="font-semibold text-xs">{formatTimestamp(incidentData.timestamp).split(',')[0]}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Evidence Media */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Play className="h-5 w-5 text-primary" />
                      Evidence Media
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-accent rounded-lg p-8 flex flex-col items-center justify-center min-h-64">
                      {videoUrl ? (
                        <div className="w-full max-w-2xl">
                          <video 
                            controls 
                            className="w-full rounded-lg"
                            poster=""
                            preload="metadata"
                            onError={(e) => {
                              console.error('Video playback error:', e);
                              console.error('Video URL that failed:', videoUrl);
                              setVideoError('Video playback failed - the video file may be corrupted or in an unsupported format');
                            }}
                            onLoadStart={() => console.log('Video loading started')}
                            onLoadedMetadata={() => console.log('Video metadata loaded')}
                            onCanPlay={() => console.log('Video can start playing')}
                          >
                            <source src={videoUrl} type="video/mp4" />
                            <source src={videoUrl} type="video/webm" />
                            <source src={videoUrl} type="video/ogg" />
                            <p>Your browser does not support the video tag. 
                               <a href={videoUrl} download="incident-video">Download the video</a>
                            </p>
                          </video>
                          <div className="mt-2 text-center">
                            <a 
                              href={videoUrl} 
                              download="incident-video.mp4"
                              className="text-sm text-muted-foreground hover:text-primary underline"
                            >
                              Download Video
                            </a>
                          </div>
                        </div>
                      ) : videoLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                          <h3 className="font-semibold text-lg mb-2">Loading Video Evidence</h3>
                          <p className="text-muted-foreground text-center mb-4">
                            Please wait while the video is being loaded...
                          </p>
                        </>
                      ) : videoError ? (
                        <>
                          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                          <h3 className="font-semibold text-lg mb-2">Video Load Error</h3>
                          <p className="text-muted-foreground text-center mb-4">
                            {videoError}
                          </p>
                          <Button 
                            variant="outline" 
                            className="gap-2"
                            onClick={() => window.location.reload()}
                          >
                            <Play className="h-4 w-4" />
                            Retry Loading
                          </Button>
                        </>
                      ) : (
                        <>
                          <Play className="h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="font-semibold text-lg mb-2">Original Video Evidence</h3>
                          <p className="text-muted-foreground text-center mb-4">
                            Video captured by mobile user showing the incident
                          </p>
                          <Button variant="outline" className="gap-2" disabled>
                            <Play className="h-4 w-4" />
                            Video Loading...
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Detected Events */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Camera className="h-5 w-5 text-primary" />
                      AI Detected Events ({incidentData.detected_events.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-4">
                        {incidentData.detected_events.map((event: DetectedEvent, index: number) => (
                          <div 
                            key={index} 
                            className="border border-border rounded-lg p-4 bg-accent/50 cursor-pointer hover:bg-accent/70 transition-colors"
                            onClick={() => navigate(`/incident/${id}/event/${index}`)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                                  {index + 1}
                                </div>
                                <div>
                                  <Badge variant="outline" className={
                                    event.event_type === 'weapon' ? 'border-destructive text-destructive' : 'border-primary text-primary'
                                  }>
                                    {event.event_type}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Confidence: {(event.confidence * 100).toFixed(0)}%
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDuration(event.first_second)}
                              </div>
                            </div>
                            
                            <p className="text-sm mb-2 leading-relaxed">{event.description}</p>
                            
                            {event.weapon_type && (
                              <Badge variant="outline" className="border-destructive text-destructive mb-2">
                                Weapon: {event.weapon_type}
                              </Badge>
                            )}
                            
                            <p className="text-xs text-muted-foreground">
                              <strong>Person Description:</strong> {event.person_attributes}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Location & Time */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      Location & Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Address</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {incidentData.location.address}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Coordinates</h3>
                      <p className="text-sm font-mono bg-accent px-2 py-1 rounded">
                        {incidentData.location.latitude}, {incidentData.location.longitude}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Timestamp</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatTimestamp(incidentData.timestamp)}
                      </p>
                    </div>

                    <div className="h-32 bg-accent rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <MapPin className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Map View</p>
                        <p className="text-xs text-muted-foreground">(Integration Required)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Site Description */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Site Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {incidentData.site_description}
                    </p>
                  </CardContent>
                </Card>

                {/* People Involved */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-primary" />
                      People Involved
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total Count</span>
                        <Badge variant="secondary">{incidentData.number_of_people}</Badge>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Description</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {incidentData.description_of_people}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Evidence Media */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Camera className="h-5 w-5 text-primary" />
                      Scene Images
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {incidentData.detected_events.map((event: DetectedEvent, index: number) => (
                        <div 
                          key={index} 
                          className="aspect-square bg-accent rounded-lg overflow-hidden group cursor-pointer hover:bg-accent/80 transition-colors border border-border"
                          onClick={() => navigate(`/incident/${id}/event/${index}`)}
                        >
                          {event.image_path && sceneImages[event.image_path] ? (
                            <div className="relative w-full h-full">
                              <img 
                                src={sceneImages[event.image_path]} 
                                alt={`Scene ${index + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded text-center">
                                <p className="text-xs">Frame {index + 1}</p>
                                <p className="text-xs">{formatDuration(event.first_second)}</p>
                              </div>
                              <div className="absolute top-1 right-1">
                                <Badge variant="outline" className={
                                  event.event_type === 'weapon' ? 'border-destructive text-destructive bg-black/70' : 'border-primary text-primary bg-black/70'
                                }>
                                  {event.event_type}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <Camera className="h-6 w-6 mb-1 text-muted-foreground group-hover:text-primary transition-colors" />
                              <p className="text-xs text-muted-foreground text-center">Frame {index + 1}</p>
                              <p className="text-xs text-muted-foreground">{formatDuration(event.first_second)}</p>
                              <p className="text-xs text-muted-foreground mt-1">Loading...</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Click images to view detection details
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetail;
