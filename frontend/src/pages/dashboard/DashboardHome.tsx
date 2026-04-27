import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

import { deleteActivity, getActivity } from '../../api/dashboard';
import { useTheme } from '../../context/ThemeContext';
import type { ActivityItem, DashboardStats, JobDescription } from '../../types';

type ActivePage = 'dashboard' | 'jobs' | 'jd-detail' | 'create-jd' | 'jd-results';

type DashboardHomeProps = {
  stats: DashboardStats;
  jds: JobDescription[];
  onNavigate: (page: ActivePage, jdId?: number, candidateId?: number) => void;
};

const CSS = `
  .dh-wrap {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .dh-row {
    display: grid;
    gap: 14px;
  }

  .dh-row-stats {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .dh-card {
    background:
      radial-gradient(120% 120% at 0% 0%, rgba(89, 245, 180, 0.08), transparent 52%),
      linear-gradient(180deg, color-mix(in srgb, var(--bg-stat) 94%, #041b17 6%), var(--bg-stat));
    border: 1px solid var(--border-card);
    border-radius: 16px;
    padding: 17px 18px;
    box-sizing: border-box;
    box-shadow: 0 12px 30px rgba(3, 18, 16, 0.16);
  }

  .dh-stat-card {
    position: relative;
    overflow: hidden;
  }

  .dh-stat-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, var(--tone-a), var(--tone-b));
    opacity: 0.95;
  }

  .dh-stat-card::after {
    content: '';
    position: absolute;
    right: -22px;
    top: -26px;
    width: 78px;
    height: 78px;
    border-radius: 999px;
    background: radial-gradient(circle at center, color-mix(in srgb, var(--tone-a) 20%, transparent) 0%, transparent 68%);
    pointer-events: none;
  }

  .dh-stat-card.tone-aqua { --tone-a: #5af2d3; --tone-b: #47dcb7; }
  .dh-stat-card.tone-blue { --tone-a: #77bcff; --tone-b: #5d9ef5; }
  .dh-stat-card.tone-emerald { --tone-a: #57f5ad; --tone-b: #34d68f; }
  .dh-stat-card.tone-amber { --tone-a: #f5d675; --tone-b: #f4b35f; }
  .dh-stat-card.tone-violet { --tone-a: #b99dff; --tone-b: #9d87f2; }

  .dh-stat-label {
    margin: 0;
    font-size: 10.5px;
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    color: var(--text-hint);
  }

  .dh-stat-value {
    margin: 14px 0 0;
    font-size: 38px;
    line-height: 1;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.04em;
  }

  .dh-stat-sub {
    margin: 8px 0 0;
    font-size: 11px;
    color: color-mix(in srgb, var(--text-hint) 90%, #a7fff0 10%);
  }

  .dh-title {
    margin: 0 0 16px;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.015em;
  }

  .dh-bars {
    display: flex;
    flex-direction: column;
    gap: 11px;
  }

  .dh-bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }

  .dh-bar-label {
    width: 170px;
    min-width: 170px;
    font-size: 12px;
    color: color-mix(in srgb, var(--text-secondary) 88%, #d7fff5 12%);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dh-bar-track {
    flex: 1;
    height: 8px;
    background: color-mix(in srgb, var(--bg-chip-gray) 76%, #0f3b35 24%);
    border-radius: 99px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--border-card) 80%, transparent);
  }

  .dh-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #4ee8bf, #4aa4ff);
    border-radius: inherit;
    box-shadow: 0 0 16px rgba(74, 164, 255, 0.28);
  }

  .dh-bar-value {
    min-width: 30px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: #d7f7ee;
    background: color-mix(in srgb, var(--bg-chip-blue) 50%, transparent);
    border: 1px solid color-mix(in srgb, var(--border-card) 75%, #5eb7ff 25%);
    border-radius: 999px;
    padding: 3px 7px;
  }

  .dh-empty {
    padding: 12px 0;
    font-size: 13px;
    color: var(--text-hint);
  }

  .dh-activity {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dh-act-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px;
    border: 1px solid color-mix(in srgb, var(--border-divider) 82%, #2e6a63 18%);
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg-card) 90%, #0b2a25 10%);
    position: relative;
    cursor: default;
    transition: border-color 0.2s ease, transform 0.2s ease;
  }

  .dh-act-row:hover {
    border-color: color-mix(in srgb, var(--border-strong) 74%, #6df5ca 26%);
    transform: translateY(-1px);
  }

  .dh-act-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    flex-shrink: 0;
    box-shadow: 0 0 0 5px color-mix(in srgb, currentColor 15%, transparent);
  }

  .dh-act-message {
    flex: 1;
    min-width: 0;
    font-size: 13.5px;
    color: var(--text-secondary);
  }

  .dh-act-side {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .dh-act-time {
    font-size: 10.5px;
    color: color-mix(in srgb, var(--text-hint) 86%, #d5fff4 14%);
    background: color-mix(in srgb, var(--bg-chip-gray) 66%, transparent);
    border: 1px solid color-mix(in srgb, var(--border-divider) 82%, transparent);
    border-radius: 999px;
    padding: 3px 8px;
    white-space: nowrap;
  }

  .dh-del-btn {
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-del);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }

  .dh-del-btn:hover {
    background: var(--bg-del-bar);
  }

  .dh-act-row .dh-del-btn {
    opacity: 0;
    transition: opacity 0.15s;
  }

  .dh-act-row:hover .dh-del-btn {
    opacity: 1;
  }

  .dh-skeleton-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--border-divider) 82%, #2e6a63 18%);
    background: color-mix(in srgb, var(--bg-card) 90%, #0b2a25 10%);
  }

  .dh-skeleton-dot,
  .dh-skeleton-line,
  .dh-skeleton-time {
    background: linear-gradient(90deg, var(--bg-muted) 0%, var(--bg-card-hover) 50%, var(--bg-muted) 100%);
    background-size: 200% 100%;
    animation: dh-shimmer 1.2s linear infinite;
  }

  .dh-skeleton-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .dh-skeleton-line {
    flex: 1;
    height: 12px;
    border-radius: 999px;
  }

  .dh-skeleton-time {
    width: 88px;
    height: 11px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  @keyframes dh-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @media (max-width: 1200px) {
    .dh-row-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 840px) {
    .dh-row-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .dh-bar-row {
      flex-wrap: wrap;
    }

    .dh-bar-label {
      width: 100%;
      min-width: 0;
    }

    .dh-bar-value {
      min-width: 0;
      margin-left: auto;
    }
  }

  @media (max-width: 560px) {
    .dh-row-stats {
      grid-template-columns: 1fr;
    }

    .dh-act-row {
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .dh-act-side {
      width: 100%;
      justify-content: flex-end;
    }
  }
`;

const ACTIVITY_COLORS: Record<ActivityItem['type'], string> = {
  jd_created: 'var(--dot-created)',
  jd_deleted: 'var(--score-red)',
  resumes_uploaded: 'var(--dot-upload)',
  screening_done: 'var(--score-green)',
  interviews_sent: 'var(--text-filter-on)',
  shortlisted: '#a78bfa',
};

export default function DashboardHome({ stats, jds }: DashboardHomeProps) {
  const { theme } = useTheme();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const maxCount = Math.max(...jds.map((jd) => jd.candidate_count || 0), 1);

  useEffect(() => {
    let ignore = false;

    async function loadActivities() {
      try {
        const items = await getActivity();
        if (!ignore) {
          setActivities(items);
        }
      } catch {
        if (!ignore) {
          setActivities([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadActivities();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleDeleteActivity(activityId: number) {
    try {
      await deleteActivity(activityId);
      setActivities((prev) => prev.filter((activity) => activity.id !== activityId));
    } catch {
      // Keep the UI stable if delete fails.
    }
  }

  return (
    <div className="dh-wrap">
      <style>{CSS}</style>

      <div className="dh-row dh-row-stats">
        {[
          { label: 'Total JDs', value: stats.total_jds, sub: 'Active roles', tone: 'tone-aqua' },
          { label: 'Total Resumes', value: stats.total_candidates, sub: 'Uploaded', tone: 'tone-blue' },
          { label: 'Screened', value: stats.screened, sub: 'Pending', tone: 'tone-emerald' },
          { label: 'Interview Sent', value: stats.interviews_sent, sub: 'Awaiting', tone: 'tone-amber' },
          { label: 'Interviewed', value: stats.interviewed, sub: 'Completed', tone: 'tone-violet' },
        ].map(({ label, value, sub, tone }) => (
          <div className={`dh-card dh-stat-card ${tone}`} key={label}>
            <p className="dh-stat-label">{label}</p>
            <p className="dh-stat-value">{value}</p>
            <p className="dh-stat-sub">{sub}</p>
          </div>
        ))}
      </div>

      <div className="dh-row">
        <div className="dh-card">
          <p className="dh-title">Resumes per JD</p>
          {jds.length === 0 ? (
            <div className="dh-empty">Create a job description to start tracking resumes.</div>
          ) : (
            <div className="dh-bars">
              {jds.map((jd) => {
                const count = jd.candidate_count || 0;
                return (
                  <div className="dh-bar-row" key={jd.id}>
                    <span className="dh-bar-label" title={jd.title}>
                      {jd.title}
                    </span>
                    <div className="dh-bar-track">
                      <div
                        className="dh-bar-fill"
                        style={{
                          width: `${(count / maxCount) * 100}%`,
                          opacity: theme === 'dark' ? 0.95 : 0.9,
                        }}
                      />
                    </div>
                    <span className="dh-bar-value">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="dh-row">
        <div className="dh-card">
          <p className="dh-title">Recent activity</p>
          <div className="dh-activity">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div className="dh-skeleton-row" key={index}>
                  <div className="dh-skeleton-dot" />
                  <div className="dh-skeleton-line" />
                  <div className="dh-skeleton-time" />
                </div>
              ))
            ) : activities.length === 0 ? (
              <div className="dh-empty">No recent activity yet.</div>
            ) : (
              activities.map((activity) => (
                <div className="dh-act-row" key={activity.id}>
                  <span className="dh-act-dot" style={{ background: ACTIVITY_COLORS[activity.type] }} />
                  <div className="dh-act-message">{activity.message}</div>
                  <div className="dh-act-side">
                    <span className="dh-act-time">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
                    <button className="dh-del-btn" onClick={() => void handleDeleteActivity(activity.id)} type="button">
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
