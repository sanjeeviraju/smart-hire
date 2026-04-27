import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginHR, registerHR } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function RegisterPage() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const [form, setForm] = useState({ full_name: '', email: '', company_name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerHR(form);
      const token = await loginHR(form.email, form.password);
      login(token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-glass">
        <h1 className="font-display text-2xl font-semibold text-ink">Create HR Account</h1>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Full Name
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Work Email
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Company Name
            <input className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Password
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button className="btn-primary mt-5 w-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <p className="mt-4 text-sm text-slate-600">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-teal">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
