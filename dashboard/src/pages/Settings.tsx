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
import { useAuth } from "@/contexts/AuthContext";
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
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

interface DashboardUser {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  company_code?: string;
  company_name?: string;
}

type MemStats = {
  videos: { count: number; sizeMB: number };
  images: { count: number; sizeMB: number };
  total: { sizeMB: number; utilizationPercent: number };
};

type PersistStats = {
  videos: { count: number; totalSizeMB: number };
  images: { count: number; totalSizeMB: number };
  total: { totalSizeMB: number; count: number };
};

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
  const [cacheStats, setCacheStats] = useState<MemStats | null>(null);
  const [persistentStats, setPersistentStats] = useState<PersistStats | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ username: "", full_name: "", password: "" });
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [editPasswordErrors, setEditPasswordErrors] = useState<string[]>([]);
  const { t } = useLanguage();
  const { user: authUser, token } = useAuth();

  const [editUser, setEditUser] = useState<DashboardUser | null>(null);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [editUserSuccess, setEditUserSuccess] = useState<string | null>(null);
  const [editUserFields, setEditUserFields] = useState({ full_name: "", password: "" });
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  const loadUsersData = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await fetchUsers();
      const scopedUsers = authUser?.company_code
        ? data.dashboard_users.filter(u => !u.company_code || u.company_code === authUser.company_code)
        : data.dashboard_users;

      setUsersData({
        ...data,
        dashboard_users: scopedUsers,
        total_dashboard_users: scopedUsers.length,
        active_dashboard_users: scopedUsers.filter(u => u.is_active).length,
      });
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
      // Normalize types: ensure totalSizeMB is a number to match PersistStats
      setPersistentStats({
        videos: {
          count: dbStats.videos.count,
          totalSizeMB: parseFloat(String(dbStats.videos.totalSizeMB)),
        },
        images: {
          count: dbStats.images.count,
          totalSizeMB: parseFloat(String(dbStats.images.totalSizeMB)),
        },
        total: {
          count: dbStats.total.count,
          totalSizeMB: parseFloat(String(dbStats.total.totalSizeMB)),
        },
      });
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setLoadingCache(false);
    }
  };

  useEffect(() => {
    loadCacheStats();
    loadUsersData();
  }, [authUser?.company_code]);

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

  const validatePassword = (pw: string): string[] => {
    const errs: string[] = [];
    if (pw.length < 8) errs.push(t('settings.passwordReq8Chars'));
    if (!/[a-z]/.test(pw)) errs.push(t('settings.passwordReqLowercase'));
    if (!/[A-Z]/.test(pw)) errs.push(t('settings.passwordReqUppercase'));
    if (!/\d/.test(pw)) errs.push(t('settings.passwordReqNumber'));
    if (!/[^\w\s]/.test(pw)) errs.push(t('settings.passwordReqSpecial'));
    return errs;
  };

  const handleAddUser = async () => {
    setAddUserLoading(true);
    setAddUserError(null);
    setAddUserSuccess(null);
    try {
      // Frontend password strength validation
      const errs = validatePassword(newUser.password || "");
      setPasswordErrors(errs);
      if (errs.length > 0) {
        setAddUserError(t('settings.passwordWeak'));
        return;
      }

      const res = await fetch("http://localhost:8000/api/dashboard/users", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setAddUserError(data.message || t('settings.failedToAddUser'));
      } else {
        setAddUserSuccess(t('settings.userCreatedSuccess'));
        setNewUser({ username: "", full_name: "", password: "" });
        setPasswordErrors([]);
        loadUsersData();
        setShowAddUser(false);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAddUserError(msg || t('settings.failedToAddUser'));
    } finally {
      setAddUserLoading(false);
    }
  };

  const openEditUserModal = (user: DashboardUser) => {
    setEditUser(user);
    setEditUserFields({ full_name: user.full_name, password: "" });
    setEditUserModalOpen(true);
    setEditUserError(null);
    setEditUserSuccess(null);
    setEditPasswordErrors([]);
  };

  const handleEditUser = async () => {
    if (!editUser) return;
    setEditUserLoading(true);
    setEditUserError(null);
    setEditUserSuccess(null);
    try {
      // Validate password if provided
      if (editUserFields.password) {
        const errs = validatePassword(editUserFields.password);
        setEditPasswordErrors(errs);
        if (errs.length > 0) {
          setEditUserError(t('settings.passwordWeak'));
          setEditUserLoading(false);
          return;
        }
      }

      // Only include non-empty fields in the request
      const updateData: Record<string, string> = {};
      if (editUserFields.full_name) updateData.full_name = editUserFields.full_name;
      if (editUserFields.password) updateData.password = editUserFields.password;

      const res = await fetch(`http://localhost:8000/api/dashboard/users/${editUser.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updateData),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setEditUserError(data.message || t('settings.failedToUpdateUser'));
      } else {
        setEditUserSuccess(t('settings.userUpdatedSuccess'));
        setEditPasswordErrors([]);
        setEditUserModalOpen(false);
        loadUsersData();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setEditUserError(msg || t('settings.failedToUpdateUser'));
    } finally {
      setEditUserLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setDeleteUserLoading(true);
    setDeleteUserError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/dashboard/users/${deleteUserId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setDeleteUserError(data.message || t('settings.failedToDeleteUser'));
      } else {
        setDeleteUserId(null);
        loadUsersData();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setDeleteUserError(msg || t('settings.failedToDeleteUser'));
    } finally {
      setDeleteUserLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="container mx-auto p-6 space-y-6 max-w-7xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-card to-card-accent border border-[hsl(215,20%,35%)] p-6 rounded-xl shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[hsl(20,100%,63%)]/5 to-transparent pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[hsl(20,100%,63%)] to-[hsl(22,96%,62%)] flex items-center justify-center shadow-lg shadow-[hsl(20,100%,63%)]/30">
                  <SettingsIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{t('settings.title')}</h1>
                  <p className="text-[hsl(214,20%,76%)] mt-1">{t('settings.subtitle')}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="grid w-full grid-cols-5 bg-card-accent/50 border border-[hsl(215,20%,35%)] p-1 h-auto">
                <TabsTrigger
                  value="users"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(20,100%,63%)] data-[state=active]:to-[hsl(22,96%,62%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(20,100%,63%)]/30 transition-all duration-200 py-3"
                >
                  <Users className="h-4 w-4" />
                  {t('settings.userManagement')}
                </TabsTrigger>
                <TabsTrigger
                  value="alerts"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(20,100%,63%)] data-[state=active]:to-[hsl(22,96%,62%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(20,100%,63%)]/30 transition-all duration-200 py-3"
                >
                  <Bell className="h-4 w-4" />
                  {t('settings.alertSettings')}
                </TabsTrigger>
                <TabsTrigger
                  value="notifications"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(20,100%,63%)] data-[state=active]:to-[hsl(22,96%,62%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(20,100%,63%)]/30 transition-all duration-200 py-3"
                >
                  <Bell className="h-4 w-4" />
                  {t('settings.notifications')}
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(20,100%,63%)] data-[state=active]:to-[hsl(22,96%,62%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(20,100%,63%)]/30 transition-all duration-200 py-3"
                >
                  <Shield className="h-4 w-4" />
                  {t('settings.systemConfig')}
                </TabsTrigger>
                <TabsTrigger
                  value="cache"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(20,100%,63%)] data-[state=active]:to-[hsl(22,96%,62%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(20,100%,63%)]/30 transition-all duration-200 py-3"
                >
                  <Database className="h-4 w-4" />
                  Cache
                </TabsTrigger>
              </TabsList>

              {/* User Management Tab */}
              <TabsContent value="users" className="space-y-6">
                <Card className="border-[hsl(215,20%,35%)] shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between bg-card-accent/30 border-b border-[hsl(215,20%,35%)]">
                    <div>
                      <CardTitle>{t('settings.userManagementTitle')}</CardTitle>
                      <CardDescription>
                        {t('settings.userManagementDescription')}
                      </CardDescription>
                    </div>
                    <Dialog open={showAddUser} onOpenChange={(open) => {
                      setShowAddUser(open);
                      if (!open) {
                        // Reset form and errors when closing
                        setNewUser({ username: "", full_name: "", password: "" });
                        setPasswordErrors([]);
                        setAddUserError(null);
                        setAddUserSuccess(null);
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          {t('settings.addNewUser')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('settings.addNewUser')}</DialogTitle>
                          <DialogDescription>{t('settings.userManagementDescription')}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>{t('settings.username')}</Label>
                            <Input value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} />
                          </div>
                          <div>
                            <Label>{t('settings.fullName')}</Label>
                            <Input value={newUser.full_name} onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))} />
                          </div>
                          <div>
                            <Label>{t('settings.password')}</Label>
                            <Input
                              type="password"
                              value={newUser.password}
                              onChange={e => {
                                const val = e.target.value;
                                setNewUser(u => ({ ...u, password: val }));
                                // live validation with localized messages
                                setPasswordErrors(validatePassword(val));
                              }}
                            />
                            {passwordErrors.length > 0 && (
                              <ul className="mt-2 text-xs text-red-500 list-disc pl-5 space-y-1">
                                {passwordErrors.map((e, i) => (
                                  <li key={i}>{e}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {addUserError && <div className="text-red-500 text-sm">{addUserError}</div>}
                          {addUserSuccess && <div className="text-green-600 text-sm">{addUserSuccess}</div>}
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddUser} disabled={addUserLoading || passwordErrors.length > 0}>
                            {addUserLoading ? t('settings.updating') : t('settings.addNewUser')}
                          </Button>
                          <DialogClose asChild>
                            <Button variant="outline">{t('settings.cancel')}</Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t('settings.totalDashboardUsers', { count: String(usersData?.total_dashboard_users ?? 0) })}
                      </p>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('settings.fullName')}</TableHead>
                          <TableHead>{t('settings.username')}</TableHead>
                          <TableHead>{t('settings.status')}</TableHead>
                          <TableHead>{t('settings.lastLogin')}</TableHead>
                          <TableHead>{t('settings.actions')}</TableHead>
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
                              <Button variant="outline" size="sm" onClick={() => openEditUserModal(user)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDeleteUserId(user.id)}>
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                {/* Edit User Dialog */}
                <Dialog open={editUserModalOpen} onOpenChange={(open) => {
                  setEditUserModalOpen(open);
                  if (!open) {
                    // Reset errors when closing
                    setEditPasswordErrors([]);
                    setEditUserError(null);
                    setEditUserSuccess(null);
                  }
                }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('settings.editUser')}</DialogTitle>
                      <DialogDescription>{t('settings.editUserDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>{t('settings.fullName')}</Label>
                        <Input 
                          value={editUserFields.full_name} 
                          onChange={e => setEditUserFields(f => ({ ...f, full_name: e.target.value }))} 
                        />
                      </div>
                      <div>
                        <Label>{t('settings.newPassword')}</Label>
                        <Input 
                          type="password" 
                          value={editUserFields.password} 
                          onChange={e => {
                            const val = e.target.value;
                            setEditUserFields(f => ({ ...f, password: val }));
                            // live validation for edit password
                            if (val) {
                              setEditPasswordErrors(validatePassword(val));
                            } else {
                              setEditPasswordErrors([]);
                            }
                          }} 
                        />
                        {editPasswordErrors.length > 0 && (
                          <ul className="mt-2 text-xs text-red-500 list-disc pl-5 space-y-1">
                            {editPasswordErrors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {editUserError && <div className="text-red-500 text-sm">{editUserError}</div>}
                      {editUserSuccess && <div className="text-green-600 text-sm">{editUserSuccess}</div>}
                    </div>
                    <DialogFooter>
                      <Button onClick={handleEditUser} disabled={editUserLoading || (editUserFields.password !== "" && editPasswordErrors.length > 0)}>
                        {editUserLoading ? t('settings.updating') : t('settings.updateUser')}
                      </Button>
                      <DialogClose asChild>
                        <Button variant="outline">{t('settings.cancel')}</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Delete User Dialog */}
                <Dialog open={deleteUserId !== null} onOpenChange={(open) => !open && setDeleteUserId(null)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('settings.deleteUser')}</DialogTitle>
                      <DialogDescription>{t('settings.deleteUserDescription')}</DialogDescription>
                    </DialogHeader>
                    {deleteUserError && <div className="text-red-500 text-sm">{deleteUserError}</div>}
                    <DialogFooter>
                      <Button 
                        variant="danger" 
                        onClick={handleDeleteUser} 
                        disabled={deleteUserLoading}
                      >
                        {deleteUserLoading ? t('settings.deleting') : t('settings.deleteUser')}
                      </Button>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
