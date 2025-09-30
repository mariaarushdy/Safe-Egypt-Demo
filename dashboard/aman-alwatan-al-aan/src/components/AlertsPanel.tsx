import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  Flame, 
  Car, 
  Users, 
  Zap,
  MapPin,
  Clock,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";

const alertTypes = {
  fire: { icon: Flame, label: "حريق", color: "danger" },
  weapon: { icon: Zap, label: "سلاح", color: "danger" },
  accident: { icon: Car, label: "حادث", color: "warning" },
  crowd: { icon: Users, label: "تجمع", color: "warning" },
  emergency: { icon: AlertTriangle, label: "طوارئ", color: "danger" }
};

const mockAlerts = [
  {
    id: "ALT-001",
    type: "fire",
    title: "حريق في مبنى سكني",
    location: "شارع الملك فهد، الرياض",
    time: "قبل دقيقتين",
    severity: "high",
    status: "active"
  },
  {
    id: "ALT-002",
    type: "accident",
    title: "حادث مروري",
    location: "طريق الملك عبدالعزيز",
    time: "قبل 5 دقائق",
    severity: "medium",
    status: "dispatched"
  },
  {
    id: "ALT-003",
    type: "weapon",
    title: "اشتباه في وجود سلاح",
    location: "حي النخيل، جدة",
    time: "قبل 8 دقائق",
    severity: "high",
    status: "investigating"
  },
  {
    id: "ALT-004",
    type: "crowd",
    title: "تجمع غير مصرح",
    location: "ساحة الأمير محمد",
    time: "قبل 12 دقيقة",
    severity: "low",
    status: "monitoring"
  }
];

const AlertsPanel = () => {
  const [filter, setFilter] = useState<string>("all");
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "danger";
      case "medium": return "warning";
      case "low": return "success";
      default: return "default";
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "high": return "عالي";
      case "medium": return "متوسط";
      case "low": return "منخفض";
      default: return "غير محدد";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "نشط";
      case "dispatched": return "تم الإرسال";
      case "investigating": return "قيد التحقيق";
      case "monitoring": return "مراقبة";
      default: return "غير محدد";
    }
  };

  const filteredAlerts = filter === "all" 
    ? mockAlerts 
    : mockAlerts.filter(alert => alert.type === filter);

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            التنبيهات الفورية
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Filter className="h-3 w-3" />
              تصفية
            </Button>
          </div>
        </div>
        
        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap gap-2 mt-3 overflow-x-auto">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="flex-shrink-0"
          >
            الكل
          </Button>
          {Object.entries(alertTypes).map(([key, type]) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(key)}
              className="gap-1 flex-shrink-0"
            >
              <type.icon className="h-3 w-3" />
              {type.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-2 p-4">
            {filteredAlerts.map((alert) => {
              const alertType = alertTypes[alert.type as keyof typeof alertTypes];
              const isSelected = selectedAlert === alert.id;
              
              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(isSelected ? null : alert.id)}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all duration-200",
                    "hover:bg-card-accent hover:border-primary/20",
                    isSelected && "border-primary bg-card-accent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-full",
                      alertType.color === "danger" && "bg-danger/10 text-danger",
                      alertType.color === "warning" && "bg-warning/10 text-warning",
                      alertType.color === "success" && "bg-success/10 text-success"
                    )}>
                      <alertType.icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-card-foreground">
                          {alert.title}
                        </h4>
                        <Badge variant={getSeverityColor(alert.severity) as any}>
                          {getSeverityLabel(alert.severity)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {alert.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {alert.time}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          الحالة: {getStatusLabel(alert.status)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {alert.id}
                        </span>
                      </div>
                      
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          <div className="flex gap-2">
                            <Button size="sm" variant="success" className="flex-1">
                              إرسال فريق
                            </Button>
                            <Button size="sm" variant="warning" className="flex-1">
                              مراقبة
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1">
                              تفاصيل
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AlertsPanel;