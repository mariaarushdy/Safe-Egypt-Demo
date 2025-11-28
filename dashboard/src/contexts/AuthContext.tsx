import React, { createContext, useContext, useEffect, useState } from 'react';
import { HSEUser, LoginResponse, loginHSE } from '@/lib/api';

interface AuthContextValue {
  user: HSEUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (payload: { username: string; password: string; company_code: string }) => Promise<LoginResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<HSEUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const login = async (payload: { username: string; password: string; company_code: string }) => {
    const res = await loginHSE(payload);
    setToken(res.access_token);
    setUser(res.user);

    localStorage.setItem('token', res.access_token);
    localStorage.setItem('user', JSON.stringify(res.user));
    localStorage.setItem(
      'company',
      JSON.stringify({
        company_id: res.user.company_id,
        company_code: res.user.company_code,
        company_name: res.user.company_name,
      })
    );

    return res;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('company');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
