import { BriefcaseBusiness, FilePlus2, LayoutDashboard, MoonStar, SunMedium } from 'lucide-react';
import { ReactNode, useMemo } from 'react';

import BrandMark from '../brand/BrandMark';
import { useTheme } from '../../context/ThemeContext';
import type { JobDescription } from '../../types';

type ActivePage = 'dashboard' | 'jobs' | 'jd-detail' | 'create-jd' | 'jd-results' | 'candidate-interview-detail';

type AppShellProps = {
  children: ReactNode;
  activePage: ActivePage;
  activeJdId: number | null;
  jds: JobDescription[];
  userFullName?: string;
  onNavigate: (page: ActivePage, jdId?: number, candidateId?: number) => void;
  onLogout: () => void;
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');

  .as-root {
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, rgba(20, 184, 166, 0.12), transparent 24%),
      radial-gradient(circle at top right, rgba(249, 115, 22, 0.10), transparent 26%),
      linear-gradient(180deg, var(--bg-page) 0%, var(--bg-page-alt) 100%);
    color: var(--text-primary);
  }

  .as-frame {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .as-header {
    position: sticky;
    top: 0;
    z-index: 20;
    backdrop-filter: blur(16px);
    background: var(--bg-shell);
    border-bottom: 1px solid var(--border-shell);
    box-shadow: 0 16px 42px rgba(15, 23, 42, 0.08);
  }

  .as-header-inner {
    width: min(1320px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 18px 0 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .as-header-top {
    display: flex;
    align-items: center;
    gap: 16px;
    justify-content: space-between;
  }

  .as-brand {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .as-brand-mark {
    width: 46px;
    height: 46px;
    border-radius: 15px;
    background: linear-gradient(135deg, var(--brand-strong), var(--brand-soft));
    color: #ffffff;
    display: grid;
    place-items: center;
    box-shadow: 0 12px 32px rgba(13, 148, 136, 0.28);
    flex-shrink: 0;
  }

  .as-brand-copy {
    min-width: 0;
  }

  .as-brand-title {
    margin: 0;
    font-family: 'Space Grotesk', 'Manrope', sans-serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }

  .as-brand-subtitle {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .as-top-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .as-user-badge {
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-card);
    background: var(--bg-card-soft);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
  }

  .as-icon-btn,
  .as-logout,
  .as-link,
  .as-jd-item {
    transition:
      transform 0.18s ease,
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease,
      box-shadow 0.18s ease;
  }

  .as-icon-btn,
  .as-logout {
    height: 42px;
    border-radius: 14px;
    border: 1px solid var(--border-card);
    background: var(--bg-card-soft);
    color: var(--text-primary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .as-icon-btn {
    width: 42px;
    padding: 0;
  }

  .as-logout {
    padding: 0 16px;
    font-size: 12px;
    font-weight: 700;
  }

  .as-icon-btn:hover,
  .as-logout:hover {
    transform: translateY(-1px);
    background: var(--bg-card);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
  }

  .as-nav-row {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .as-nav-group,
  .as-jd-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .as-nav-group {
    flex-wrap: wrap;
  }

  .as-nav-label,
  .as-jd-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--text-hint);
    flex-shrink: 0;
  }

  .as-link {
    border: 1px solid transparent;
    background: transparent;
    padding: 11px 16px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 9px;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .as-link:hover {
    transform: translateY(-1px);
    background: var(--bg-card-soft);
    border-color: var(--border-card);
    color: var(--text-primary);
  }

  .as-link.is-active {
    background: linear-gradient(135deg, var(--brand-strong), var(--brand-soft));
    border-color: transparent;
    color: #ffffff;
    box-shadow: 0 16px 36px rgba(13, 148, 136, 0.28);
  }

  .as-link-icon {
    display: inline-flex;
    align-items: center;
  }

  .as-jd-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    border-top: 1px solid var(--border-divider);
    padding-top: 12px;
    min-width: 0;
  }

  .as-jd-scroller {
    display: flex;
    gap: 10px;
    min-width: 0;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
  }

  .as-jd-item {
    border: 1px solid var(--border-card);
    background: var(--bg-card-soft);
    color: var(--text-secondary);
    padding: 10px 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .as-jd-item:hover {
    transform: translateY(-1px);
    background: var(--bg-card);
    color: var(--text-primary);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  }

  .as-jd-item.is-active {
    border-color: rgba(13, 148, 136, 0.22);
    background: rgba(20, 184, 166, 0.14);
    color: var(--brand-strong);
  }

  .as-empty {
    font-size: 12px;
    color: var(--text-muted);
  }

  .as-main {
    width: min(1320px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 28px 0 40px;
    box-sizing: border-box;
  }

  @media (max-width: 900px) {
    .as-header-inner,
    .as-main {
      width: min(100vw - 20px, 1320px);
    }

    .as-header-top {
      align-items: flex-start;
      flex-direction: column;
    }

    .as-top-actions {
      width: 100%;
      justify-content: space-between;
    }

    .as-nav-row,
    .as-jd-strip {
      align-items: flex-start;
      flex-direction: column;
    }

    .as-jd-scroller {
      width: 100%;
    }
  }

  @media (max-width: 640px) {
    .as-header-inner {
      padding-top: 14px;
      padding-bottom: 12px;
      gap: 12px;
    }

    .as-brand-title {
      font-size: 16px;
    }

    .as-top-actions {
      gap: 8px;
    }

    .as-user-badge {
      width: 100%;
      text-align: center;
    }

    .as-icon-btn,
    .as-logout {
      flex: 1;
    }

    .as-main {
      padding-top: 18px;
      padding-bottom: 28px;
    }
  }
`;

const NAV_ITEMS: Array<{ key: ActivePage; label: string; icon: JSX.Element }> = [
  {
    key: 'dashboard',
    label: 'Overview',
    icon: <LayoutDashboard size={15} strokeWidth={2} />,
  },
  {
    key: 'jobs',
    label: 'Job Board',
    icon: <BriefcaseBusiness size={15} strokeWidth={2} />,
  },
  {
    key: 'create-jd',
    label: 'Create JD',
    icon: <FilePlus2 size={15} strokeWidth={2} />,
  },
];

function decodeUserName(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = JSON.parse(window.atob(parts[1]));
    return json.full_name || json.name || null;
  } catch {
    return null;
  }
}

export default function AppShell({ children, activePage, activeJdId, jds, userFullName, onNavigate, onLogout }: AppShellProps) {
  const { theme, toggleTheme } = useTheme();
  const displayName = useMemo(() => userFullName || decodeUserName(localStorage.getItem('access_token')) || 'HR User', [userFullName]);

  return (
    <div className="as-root">
      <style>{CSS}</style>
      <div className="as-frame">
        <header className="as-header">
          <div className="as-header-inner">
            <div className="as-header-top">
              <div className="as-brand">
                <div className="as-brand-mark">
                  <BrandMark />
                </div>
                <div className="as-brand-copy">
                  <h1 className="as-brand-title">Smart Hiring Workspace</h1>
                  <p className="as-brand-subtitle">The same workflow, just sharper and easier to scan.</p>
                </div>
              </div>

              <div className="as-top-actions">
                <span className="as-user-badge">{displayName}</span>
                <button
                  className="as-icon-btn"
                  onClick={(event) => {
                    const btn = event.currentTarget;
                    btn.style.transform = 'scale(0.88) rotate(14deg)';
                    toggleTheme();
                    window.setTimeout(() => {
                      btn.style.transform = '';
                    }, 150);
                  }}
                  aria-label="Toggle theme"
                  title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                  type="button"
                >
                  {theme === 'light' ? <MoonStar size={16} strokeWidth={2} /> : <SunMedium size={16} strokeWidth={2} />}
                </button>
                <button className="as-logout" onClick={onLogout} type="button">
                  Logout
                </button>
              </div>
            </div>

            <div className="as-nav-row">
              <div className="as-nav-group">
                <span className="as-nav-label">Navigate</span>
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    className={`as-link ${activePage === item.key ? 'is-active' : ''}`}
                    onClick={() => onNavigate(item.key)}
                    type="button"
                  >
                    <span className="as-link-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="as-jd-strip">
              <span className="as-jd-label">Active Roles</span>
              <div className="as-jd-scroller">
                {jds.length === 0 ? (
                  <div className="as-empty">No active job descriptions yet.</div>
                ) : (
                  jds.map((jd) => (
                    <button
                      key={jd.id}
                      className={`as-jd-item ${activePage === 'jd-detail' && activeJdId === jd.id ? 'is-active' : ''}`}
                      onClick={() => onNavigate('jd-detail', jd.id)}
                      title={jd.title}
                      type="button"
                    >
                      {jd.title}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="as-main">{children}</main>
      </div>
    </div>
  );
}
