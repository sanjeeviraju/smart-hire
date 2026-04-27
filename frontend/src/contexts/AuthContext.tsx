import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

type User = {
  id: number;
  full_name: string;
  email: string;
  company_name: string;
};

type AuthContextShape = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { full_name: string; email: string; company_name: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get<User>('/auth/me');
        setUser(response.data);
      } catch {
        localStorage.removeItem('auth_token');
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function login(email: string, password: string) {
    const response = await api.post<{ access_token: string }>('/auth/login', { email, password });
    localStorage.setItem('auth_token', response.data.access_token);
    const me = await api.get<User>('/auth/me');
    setUser(me.data);
  }

  async function register(payload: { full_name: string; email: string; company_name: string; password: string }) {
    await api.post('/auth/register', payload);
    await login(payload.email, payload.password);
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
