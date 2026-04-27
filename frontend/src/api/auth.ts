import { api } from './axios';

export type RegisterHRPayload = {
  full_name: string;
  email: string;
  company_name: string;
  password: string;
};

export type HRUser = {
  id: number;
  full_name: string;
  email: string;
  company_name: string;
  is_active: boolean;
  created_at: string;
};

type TokenResponse = {
  access_token: string;
  token_type: 'bearer';
};

export async function loginHR(email: string, password: string): Promise<string> {
  try {
    const response = await api.post<TokenResponse>('/auth/login', { email, password });
    const token = response.data.access_token;
    localStorage.setItem('access_token', token);
    return token;
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Login failed';
    throw new Error(detail);
  }
}

export async function registerHR(payload: RegisterHRPayload): Promise<HRUser> {
  try {
    const response = await api.post<HRUser>('/auth/register', payload);
    return response.data;
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Registration failed';
    throw new Error(detail);
  }
}

export async function getCurrentHRUser(): Promise<HRUser> {
  const response = await api.get<HRUser>('/auth/me');
  return response.data;
}
