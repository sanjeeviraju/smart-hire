import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentHRUser, type HRUser } from '../api/auth';
import { useAuthStore } from '../store/authStore';

const nav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/jd/new', label: 'Create JD' },
];

export default function AppLayout() {
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<HRUser | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const currentUser = await getCurrentHRUser();
        if (mounted) {
          setUser(currentUser);
        }
      } catch {
        logout();
        navigate('/', { replace: true });
      }
    }

    void loadUser();

    return () => {
      mounted = false;
    };
  }, [logout, navigate]);

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-display text-lg font-semibold text-ink">AI Hiring Platform</p>
            <p className="text-xs text-slate-500">{user?.company_name || 'Talent Intelligence'}</p>
          </div>
          <button onClick={handleLogout} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
            Logout
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl bg-white p-3 shadow-glass">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`mb-1 block rounded-xl px-3 py-2 text-sm ${
                location.pathname.startsWith(item.to) ? 'bg-teal text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </aside>
        <main className="space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
