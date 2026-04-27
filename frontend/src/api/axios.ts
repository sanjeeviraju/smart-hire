import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL,
});

function getSanitizedToken() {
  const token = localStorage.getItem('access_token')?.trim() || '';
  if (!token) {
    return null;
  }

  // Access JWTs should always have exactly 3 dot-separated parts.
  if (token.split('.').length !== 3) {
    localStorage.removeItem('access_token');
    return null;
  }

  return token;
}

api.interceptors.request.use((config) => {
  const token = getSanitizedToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.dispatchEvent(new Event('smart-hiring:unauthorized'));
    }
    return Promise.reject(error);
  },
);
