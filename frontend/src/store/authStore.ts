import { create } from 'zustand';

type AuthState = {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const storedToken = localStorage.getItem('access_token');

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  isAuthenticated: Boolean(storedToken),
  login: (token) => {
    localStorage.setItem('access_token', token);
    set({ token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('access_token');
    set({ token: null, isAuthenticated: false });
  },
}));
