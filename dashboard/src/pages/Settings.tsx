import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Sidebar from "@/components/Sidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import { mediaCacheService } from "@/services/mediaCacheService";
import { persistentMediaCache } from "@/services/persistentMediaCache";
import { UsersResponse, fetchUsers } from "@/lib/api";
import { 
  Edit, 
  Trash2, 
  Plus, 
  TestTube, 
  Users,
  Settings as SettingsIcon,
  Bell,
  Shield,
  Database,
  HardDrive
} from "lucide-react";

interface DashboardUser {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

const Settings = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [highRiskThreshold, setHighRiskThreshold] = useState([75]);
  const [responseTimeAlert, setResponseTimeAlert] = useState([10]);
  const [usersData, setUsersData] = useState<UsersResponse | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState([
    "admin@emergency.gov",
    "supervisor@emergency.gov"
  ]);
  const [newEmail, setNewEmail] = useState("");
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [persistentStats, setPersistentStats] = useState<any>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const { t } = useLanguage();

  const loadUsersData = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await fetchUsers();
      setUsersData(data);
    } catch (error) {
      console.error('Error loading users data:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadCacheStats = async () => {
    setLoadingCache(true);
    try {
      const memStats = mediaCacheService.getStats();
      const dbStats = await persistentMediaCache.getStats();
      setCacheStats(memStats);
      setPersistentStats(dbStats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setLoadingCache(false);
    }
  };

  useEffect(() => {
    loadCacheStats();
    loadUsersData();
  }, []);

  const handleClearMemoryCache = () => {
    mediaCacheService.clearAll();
    loadCacheStats();
  };

  const handleClearPersistentCache = async () => {
    await persistentMediaCache.clearAll();
    loadCacheStats();
  };

  const handleClearAllCache = async () => {
    mediaCacheService.clearAll();
    await persistentMediaCache.clearAll();
    loadCacheStats();
  };

  const handleClearOldCache = async () => {
    await persistentMediaCache.clearOld();
    loadCacheStats();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Police": return "default";
      case "Fire": return "danger";
      case "Medical": return "success";
      case "Civil Defense": return "secondary";
      default: return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    return status === "Active" ? "success" : "outline";
  };

  const addEmailRecipient = () => {
    if (newEmail && !emailRecipients.includes(newEmail)) {
      setEmailRecipients([...emailRecipients, newEmail]);
      setNewEmail("");
    }
  };

  const removeEmailRecipient = (email: string) => {
    setEmailRecipients(emailRecipients.filter(e => e !== email));
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="container mx-auto p-6 space-y-6 max-w-7xl">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">{t('settings.title')}</h1>
              <p className="text-muted-foreground">{t('settings.subtitle')}</p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('settings.userManagement')}
                </TabsTrigger>
                <TabsTrigger value="alerts" className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  {t('settings.alertSettings')}
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  {t('settings.notifications')}
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t('settings.systemConfig')}
                </TabsTrigger>
                <TabsTrigger value="cache" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Cache
                </TabsTrigger>
              </TabsList>

              {/* User Management Tab */}
              <TabsContent value="users" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>User Management</CardTitle>
                      <CardDescription>
                        Manage dashboard user accounts and permissions
                      </CardDescription>
                    </div>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add New User
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Total Dashboard Users: {usersData?.total_dashboard_users ?? 0}
                      </p>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Full Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Login</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingUsers ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4">
                              Loading users...
                            </TableCell>
                          </TableRow>
                        ) : usersData?.dashboard_users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.full_name}</TableCell>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>
                              <Badge variant={user.is_active ? "success" : "outline"}>
                                {user.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>{user.last_login || "Never"}</TableCell>
                            <TableCell className="space-x-2">
                              <Button variant="outline" size="sm">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Alert Settings Tab */}
              <TabsContent value="alerts" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Alert Thresholds</CardTitle>
                      <CardDescription>Configure automated alert thresholds</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>High-Risk Alert Threshold: {highRiskThreshold[0]}%</Label>
                        <Slider
                          value={highRiskThreshold}
                          onValueChange={setHighRiskThreshold}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <p className="text-sm text-muted-foreground">
                          Credibility percentage for triggering high-risk alerts
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Response Time Alert: {responseTimeAlert[0]} minutes</Label>
                        <Slider
                          value={responseTimeAlert}
                          onValueChange={setResponseTimeAlert}
                          max={30}
                          min={1}
                          step={1}
                          className="w-full"
                        />
                        <p className="text-sm text-muted-foreground">
                          Time limit for response time alerts
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Incident Classification</CardTitle>
                      <CardDescription>Configure automatic incident classification</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-classify">Auto-classify incidents</Label>
                        <Switch id="auto-classify" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-low">Filter low-credibility reports</Label>
                        <Switch id="filter-low" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="priority-dispatch">Priority dispatch for high-risk</Label>
                        <Switch id="priority-dispatch" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="cctv-cross">Cross-reference with CCTV</Label>
                        <Switch id="cctv-cross" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Email Notifications</CardTitle>
                      <CardDescription>Configure email alert systems</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="high-risk-email">High-risk incidents</Label>
                        <Switch id="high-risk-email" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="daily-summary">Daily summary reports</Label>
                        <Switch id="daily-summary" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="maintenance">System maintenance alerts</Label>
                        <Switch id="maintenance" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="analytics-digest">Weekly analytics digest</Label>
                        <Switch id="analytics-digest" />
                      </div>

                      <div className="space-y-2">
                        <Label>Email Recipients</Label>
                        <div className="space-y-2">
                          {emailRecipients.map((email, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                              <span className="text-sm">{email}</span>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeEmailRecipient(email)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add email address"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                          />
                          <Button onClick={addEmailRecipient}>Add</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>SMS Integration</CardTitle>
                      <CardDescription>Configure SMS alert systems</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="emergency-sms">Emergency alerts</Label>
                        <Switch id="emergency-sms" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="status-sms">Status updates</Label>
                        <Switch id="status-sms" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="dispatch-sms">Dispatch confirmations</Label>
                        <Switch id="dispatch-sms" defaultChecked />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="api-key">SMS API Key</Label>
                        <Input id="api-key" placeholder="Enter SMS API key" type="password" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sender-id">Sender ID</Label>
                        <Input id="sender-id" placeholder="Enter sender ID" />
                      </div>

                      <Button variant="outline" className="w-full">
                        <TestTube className="h-4 w-4 mr-2" />
                        Test SMS Configuration
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* System Configuration Tab */}
              <TabsContent value="system" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Security Settings</CardTitle>
                      <CardDescription>Manage security settings and policies</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="two-factor">Two-factor authentication</Label>
                        <Switch id="two-factor" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="session-timeout">Session timeout - 30 min</Label>
                        <Switch id="session-timeout" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ip-whitelist">IP whitelist enforcement</Label>
                        <Switch id="ip-whitelist" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="audit-logging">Audit logging</Label>
                        <Switch id="audit-logging" defaultChecked />
                      </div>

                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <h4 className="font-medium mb-2">Password Policy</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Minimum 12 characters</li>
                          <li>• Mix of letters, numbers, symbols</li>
                          <li>• Must change every 90 days</li>
                          <li>• No reuse of last 5 passwords</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>System Integration</CardTitle>
                      <CardDescription>Manage external system integrations</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="cctv-integration">CCTV System Integration</Label>
                        <Switch id="cctv-integration" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="dispatch-911">911 Dispatch System</Label>
                        <Switch id="dispatch-911" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="traffic-mgmt">Traffic Management</Label>
                        <Switch id="traffic-mgmt" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="weather-api">Weather Service API</Label>
                        <Switch id="weather-api" defaultChecked />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cctv-endpoint">CCTV API Endpoint</Label>
                        <Input id="cctv-endpoint" placeholder="https://api.cctv.gov/v1" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dispatch-endpoint">Dispatch API Endpoint</Label>
                        <Input id="dispatch-endpoint" placeholder="https://api.dispatch.gov/v1" />
                      </div>

                      <Button variant="outline" className="w-full">
                        <TestTube className="h-4 w-4 mr-2" />
                        Test Connections
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Cache Management Tab */}
              <TabsContent value="cache" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5" />
                      Media Cache Management
                    </CardTitle>
                    <CardDescription>
                      Manage cached videos and images for faster loading
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Memory Cache Stats */}
                    <div className="space-y-3">
                      <h3 className="font-semibold">Session Cache (Memory)</h3>
                      {cacheStats && (
                        <div className="grid grid-cols-3 gap-4">
                          <Card className="p-4">
                            <div className="text-2xl font-bold">{cacheStats.videos.count}</div>
                            <div className="text-sm text-muted-foreground">Videos</div>
                            <div className="text-xs text-muted-foreground">{cacheStats.videos.sizeMB} MB</div>
                          </Card>
                          <Card className="p-4">
                            <div className="text-2xl font-bold">{cacheStats.images.count}</div>
                            <div className="text-sm text-muted-foreground">Images</div>
                            <div className="text-xs text-muted-foreground">{cacheStats.images.sizeMB} MB</div>
                          </Card>
                          <Card className="p-4">
                            <div className="text-2xl font-bold">{cacheStats.total.sizeMB} MB</div>
                            <div className="text-sm text-muted-foreground">Total Size</div>
                            <div className="text-xs text-muted-foreground">
                              {cacheStats.total.utilizationPercent.toFixed(1)}% used
                            </div>
                          </Card>
                        </div>
                      )}
                      <Button variant="outline" onClick={handleClearMemoryCache} disabled={loadingCache}>
                        Clear Session Cache
                      </Button>
                    </div>

                    <Separator />

                    {/* Persistent Cache Stats */}
                    <div className="space-y-3">
                      <h3 className="font-semibold">Persistent Cache (IndexedDB)</h3>
                      {persistentStats && (
                        <div className="grid grid-cols-3 gap-4">
                          <Card className="p-4">
                            <div className="text-2xl font-bold">{persistentStats.videos.count}</div>
                            <div className="text-sm text-muted-foreground">Videos</div>
                            <div className="text-xs text-muted-foreground">{persistentStats.videos.totalSizeMB} MB</div>
                          </Card>
                          <Card className="p-4">
                            <div className="text-2xl font-bold">{persistentStats.images.count}</div>
                            <div className="text-sm text-muted-foreground">Images</div>
                            <div className="text-xs text-muted-foreground">{persistentStats.images.totalSizeMB} MB</div>
                          </Card>
                          <Card className="p-4">
                            <div className="text-2xl font-bold">{persistentStats.total.totalSizeMB} MB</div>
                            <div className="text-sm text-muted-foreground">Total Size</div>
                            <div className="text-xs text-muted-foreground">
                              {persistentStats.total.count} files
                            </div>
                          </Card>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={handleClearOldCache} disabled={loadingCache}>
                          Clear Old Cache (7+ days)
                        </Button>
                        <Button variant="outline" onClick={handleClearPersistentCache} disabled={loadingCache}>
                          Clear Persistent Cache
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <Button variant="danger" onClick={handleClearAllCache} disabled={loadingCache}>
                        Clear All Caches
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        This will remove all cached media. New media will be downloaded when needed.
                      </p>
                    </div>

                    <Separator />

                    <Button variant="ghost" onClick={loadCacheStats} disabled={loadingCache}>
                      {loadingCache ? 'Refreshing...' : 'Refresh Stats'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;