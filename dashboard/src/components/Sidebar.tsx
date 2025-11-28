import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Shield,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

const getMenuItems = (t: (key: string) => string) => [
  {
    title: t('nav.dashboard'),
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: t('nav.reports'),
    path: "/reports",
    icon: FileText,
  },
  {
    title: t('nav.analytics'),
    path: "/analytics",
    icon: BarChart3,
  },
  {
    title: t('nav.settings'),
    path: "/settings",
    icon: Settings,
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar = ({ collapsed = false, onToggle }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const menuItems = getMenuItems(t);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className={cn(
      "bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col relative h-screen",
      "before:absolute before:inset-0 before:bg-gradient-to-br before:from-sidebar-background before:to-card before:pointer-events-none",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border relative backdrop-blur-sm bg-white/5 z-10">
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(214,24%,83%)] to-[hsl(214,20%,76%)] rounded-full blur-sm opacity-50" />
                <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(214,24%,83%)] to-[hsl(214,20%,76%)] flex items-center justify-center border-2 border-[hsl(20,100%,63%)] shadow-lg">
                  <Shield className="h-5 w-5 text-sidebar-background" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sidebar-foreground leading-tight">
                  {user?.company_name || t('login.title')}
                </span>
                {user?.company_code && (
                  <span className="text-xs text-[hsl(20,100%,63%)] uppercase font-semibold tracking-wide">
                    {user.company_code}
                  </span>
                )}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-[hsl(20,100%,63%)] transition-colors"
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-2 relative z-10">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.title : undefined}
              className={cn(
                "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 relative group",
                "hover:bg-sidebar-accent hover:shadow-md",
                collapsed ? "justify-center p-3" : "gap-3 px-3 py-3",
                isActive
                  ? "bg-gradient-to-r from-[hsl(20,100%,63%)] to-[hsl(22,96%,62%)] text-white shadow-lg shadow-[hsl(20,100%,63%)]/30"
                  : "text-sidebar-foreground hover:text-[hsl(20,100%,63%)]"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-white/10 rounded-lg backdrop-blur-sm" />
              )}
              <item.icon className={cn(
                "h-5 w-5 relative z-10 transition-transform group-hover:scale-110",
                isActive && "drop-shadow-sm"
              )} />
              {!collapsed && <span className="relative z-10">{item.title}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-2 relative z-10 backdrop-blur-sm bg-white/5">
        <Button
          variant="ghost"
          onClick={handleLogout}
          title={collapsed ? t('nav.logout') : undefined}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 group",
            "border border-transparent hover:border-red-500/30",
            collapsed ? "justify-center px-3 py-3" : "justify-start px-3 py-3"
          )}
        >
          <LogOut className={cn("h-4 w-4 transition-transform group-hover:scale-110", !collapsed && "mr-2")} />
          {!collapsed && <span>{t('nav.logout')}</span>}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
