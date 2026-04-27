import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-glass">
        <h1 className="font-display text-2xl font-semibold text-ink">HR Login</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to manage resume screening and interviews.</p>

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Email
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className="mt-3 block text-sm font-medium text-slate-700">
          Password
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button className="btn-primary mt-5 w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="mt-4 text-sm text-slate-600">
          New HR account?{' '}
          <Link to="/register" className="font-semibold text-teal">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
