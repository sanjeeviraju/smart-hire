import { useEffect, useMemo, useState } from 'react';

import { getJDInterviewResults } from '../../api/dashboard';
import { sendInterviews } from '../../api/candidates';
import type { InterviewTrackingItem } from '../../types';

type InterviewResultsProps = {
  jdId: number | null;
  onBack: () => void;
};

const CSS = `
  .ires-card {
    background: var(--bg-card);
    border: 1px solid var(--border-card);
    border-radius: 16px;
    padding: 22px;
    box-sizing: border-box;
  }

  .ires-back {
    border: 0;
    background: transparent;
    padding: 0;
    font-size: 13px;
    color: var(--text-hint);
    cursor: pointer;
    margin-bottom: 14px;
  }

  .ires-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }

  .ires-title {
    margin: 0;
    font-size: 21px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .ires-sub {
    margin-top: 4px;
    font-size: 12.5px;
    color: var(--text-hint);
  }

  .ires-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .ires-stat {
    background: var(--bg-muted);
    border: 1px solid var(--border-divider);
    border-radius: 12px;
    padding: 14px 16px;
  }

  .ires-stat-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-hint);
  }

  .ires-stat-value {
    margin-top: 8px;
    font-size: 26px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .ires-table-wrap {
    overflow-x: auto;
  }

  .ires-table {
    width: 100%;
    border-collapse: collapse;
  }

  .ires-table th,
  .ires-table td {
    padding: 12px 10px;
    border-top: 1px solid var(--border-divider);
    text-align: left;
    vertical-align: middle;
    font-size: 13px;
  }

  .ires-table thead th {
    border-top: 0;
    color: var(--text-hint);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 500;
  }

  .ires-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11.5px;
    font-weight: 600;
  }

  .ires-score {
    display: inline-flex;
    align-items: center;
    padding: 4px 9px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    background: var(--bg-muted);
    color: var(--text-primary);
  }

  .ires-action {
    border: 1px solid var(--border-btn);
    background: var(--bg-action-btn);
    color: var(--text-primary);
    border-radius: 8px;
    padding: 7px 10px;
    font-size: 12px;
    cursor: pointer;
  }

  .ires-empty,
  .ires-error {
    font-size: 12.5px;
    margin-top: 14px;
  }

  .ires-empty {
    color: var(--text-hint);
  }

  .ires-error {
    color: #dc2626;
  }

  @media (max-width: 780px) {
    .ires-stats {
      grid-template-columns: 1fr;
    }
  }
`;

export default function InterviewResults({ jdId, onBack }: InterviewResultsProps) {
  const [items, setItems] = useState<InterviewTrackingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    if (!jdId) return;
    const currentJdId = jdId;
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await getJDInterviewResults(currentJdId);
        if (!ignore) {
          setItems(response);
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to load interview results');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [jdId]);

  const summary = useMemo(() => {
    const completed = items.filter((item) => item.status === 'Completed').length;
    const pending = items.filter((item) => item.status !== 'Completed').length;
    return {
      total: items.length,
      completed,
      pending,
    };
  }, [items]);

  async function handleForceResend(candidateId: number) {
    if (!jdId) return;
    setActionMessage('');
    setError('');
    try {
      const result = await sendInterviews([candidateId], true);
      const success = result.results.find((item) => item.candidate_id === candidateId)?.success;
      if (!success) {
        throw new Error(result.results.find((item) => item.candidate_id === candidateId)?.error || 'Force resend failed');
      }
      const refreshed = await getJDInterviewResults(jdId);
      setItems(refreshed);
      setActionMessage('New interview link sent successfully.');
    } catch (err: any) {
      setError(err?.message || 'Unable to force resend interview link');
    }
  }

  return (
    <div className="ires-card">
      <style>{CSS}</style>

      <button className="ires-back" onClick={onBack} type="button">
        ← Back
      </button>

      <div className="ires-top">
        <div>
          <h2 className="ires-title">Interview Results</h2>
          <div className="ires-sub">Track invite delivery, opens, completion, and resend eligibility.</div>
        </div>
      </div>

      <div className="ires-stats">
        <div className="ires-stat">
          <div className="ires-stat-label">Total Invited</div>
          <div className="ires-stat-value">{summary.total}</div>
        </div>
        <div className="ires-stat">
          <div className="ires-stat-label">Completed</div>
          <div className="ires-stat-value">{summary.completed}</div>
        </div>
        <div className="ires-stat">
          <div className="ires-stat-label">Pending</div>
          <div className="ires-stat-value">{summary.pending}</div>
        </div>
      </div>

      {actionMessage && <div className="ires-empty">{actionMessage}</div>}
      {error && <div className="ires-error">{error}</div>}

      <div className="ires-table-wrap">
        <table className="ires-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Screening Score</th>
              <th>Status</th>
              <th>Sent At</th>
              <th>Completed At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.candidate_id}-${item.sent_at}-${index}`}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.candidate_name}</div>
                  <div style={{ marginTop: '3px', fontSize: '12px', color: 'var(--text-hint)' }}>{item.email}</div>
                </td>
                <td>
                  <span className="ires-score">{item.overall_score != null ? item.overall_score.toFixed(1) : '—'}</span>
                </td>
                <td>
                  <span className="ires-badge" style={getStatusBadgeStyle(item.status)}>
                    {item.status}
                  </span>
                </td>
                <td>{new Date(item.sent_at).toLocaleString()}</td>
                <td>{item.completed_at ? new Date(item.completed_at).toLocaleString() : '—'}</td>
                <td>
                  {item.status === 'Completed' ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-hint)' }}>View result in candidate details</span>
                  ) : item.can_force_resend ? (
                    <button className="ires-action" onClick={() => void handleForceResend(item.candidate_id)} type="button">
                      Force Resend
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-hint)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && items.length === 0 && <div className="ires-empty">No interview invites found for this job description yet.</div>}
      {loading && <div className="ires-empty">Loading interview results...</div>}
    </div>
  );
}

function getStatusBadgeStyle(status: InterviewTrackingItem['status']) {
  switch (status) {
    case 'Pending':
      return { background: '#fef3c7', color: '#92400e' };
    case 'Opened':
      return { background: '#dbeafe', color: '#1e40af' };
    case 'Completed':
      return { background: '#ede9fe', color: '#5b21b6' };
    default:
      return { background: '#f3f4f6', color: '#4b5563' };
  }
}
