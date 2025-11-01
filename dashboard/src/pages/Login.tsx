import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import loginBg from "@/assets/login-bg.jpg";

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate authentication
    setTimeout(() => {
      const isValid =
        credentials.username.trim().toLowerCase() === "maria" &&
        credentials.password === "1234";

      if (isValid) {
        toast({
          title: t('login.successTitle'),
          description: t('login.successMessage', { 
            username: credentials.username
          }),
        });
        navigate("/dashboard");
      } else {
        toast({
          variant: "destructive",
          title: t('login.errorTitle'),
          description: t('login.errorMessage'),
        });
      }
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      {/* Login Form */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="mb-4 flex justify-center">
          <LanguageSwitcher />
        </div>
        <Card className="bg-card/95 backdrop-blur-md border-border shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold text-card-foreground">
              {t('login.title')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('login.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-card-foreground">
                  {t('login.username')}
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t('login.username')}
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="bg-input border-border"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-card-foreground">
                  {t('login.password')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('login.password')}
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="bg-input border-border pl-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                variant="login" 
                size="lg" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? `${t('login.button')}...` : t('login.button')}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t('login.systemInfo')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;