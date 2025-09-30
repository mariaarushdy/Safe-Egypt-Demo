import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  BarChart3, 
  Shield, 
  AlertTriangle, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const getMenuItems = (t: (key: string) => string) => [
  {
    title: t('nav.dashboard'),
    path: "/dashboard",
    icon: BarChart3,
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
  const menuItems = getMenuItems(t);

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <div className={cn(
      "bg-sidebar border-l border-sidebar-border transition-all duration-300 flex flex-col",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-sidebar-primary" />
              <span className="font-bold text-sidebar-foreground">{t('login.title')}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" 
                  : "text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", collapsed && "mx-auto")} />
              {!collapsed && <span>{item.title}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {!collapsed && (
          <div className="mb-2">
            <LanguageSwitcher />
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "px-2" : "justify-start"
          )}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "ml-2")} />
          {!collapsed && <span>{t('nav.logout')}</span>}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;