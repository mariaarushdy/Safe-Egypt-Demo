import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import loginBg from "@/assets/login-bg.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    company_code: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = await login({
        username: credentials.username.trim(),
        password: credentials.password,
        company_code: credentials.company_code.trim().toUpperCase(),
      });

      toast({
        title: t('login.successTitle'),
        description: t('login.successMessage', { 
          username: data.user.full_name || credentials.username
        }),
      });
      
      navigate("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : t('login.errorMessage');
      toast({
        variant: "destructive",
        title: t('login.errorTitle'),
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />

      {/* Login Form */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <Card className="bg-card/95 backdrop-blur-md border-[hsl(215,20%,35%)] shadow-2xl shadow-black/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(214,24%,83%)] to-[hsl(214,20%,76%)] rounded-full blur-xl opacity-50" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[hsl(214,24%,83%)] to-[hsl(214,20%,76%)] flex items-center justify-center border-4 border-[hsl(20,100%,63%)] shadow-lg shadow-[hsl(20,100%,63%)]/30">
                <Shield className="h-10 w-10 text-[hsl(210,22%,23%)]" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-card-foreground mb-2">
              {t('login.title')}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-base">
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

              <div className="space-y-2">
                <Label htmlFor="company_code" className="text-card-foreground">
                  {t('login.companyCode')}
                </Label>
                <Input
                  id="company_code"
                  type="text"
                  placeholder={t('login.companyCodePlaceholder')}
                  value={credentials.company_code}
                  onChange={(e) => setCredentials(prev => ({ ...prev, company_code: e.target.value.toUpperCase() }))}
                  className="bg-input border-border"
                  required
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-to-r from-[hsl(20,100%,63%)] to-[hsl(22,96%,62%)] hover:from-[hsl(22,96%,62%)] hover:to-[hsl(45,96%,69%)] text-white font-bold shadow-lg shadow-[hsl(20,100%,63%)]/40 hover:shadow-xl hover:shadow-[hsl(20,100%,63%)]/50 transition-all duration-200 disabled:opacity-50"
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
