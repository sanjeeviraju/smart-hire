import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { JDInterviewResultsResponse } from '../types';

const RECOMMENDATIONS = ['Highly Recommended', 'Recommended', 'Neutral', 'Not Recommended'];

export default function JDResultsPage() {
  const { id } = useParams();
  const jdId = Number(id);
  const [recommendation, setRecommendation] = useState('');
  const [data, setData] = useState<JDInterviewResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!jdId) return;
    void loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jdId, recommendation]);

  async function loadResults() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<JDInterviewResultsResponse>(`/dashboard/jd/${jdId}/results`, {
        params: {
          sort: 'desc',
          recommendation: recommendation || undefined,
        },
      });
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load interview results');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Interview Results</h1>
            <p className="mt-1 text-sm text-slate-500">JD ID: {jdId}</p>
          </div>
          <label className="text-sm font-medium text-slate-700">
            Recommendation Filter
            <select className="input" value={recommendation} onChange={(e) => setRecommendation(e.target.value)}>
              <option value="">All</option>
              {RECOMMENDATIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {loading && <p className="mt-3 text-sm text-slate-600">Loading results...</p>}
      </section>

      <section className="card overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2">Candidate</th>
              <th>Email</th>
              <th>Total Score</th>
              <th>Recommendation</th>
              <th>Status</th>
              <th>Interview Date</th>
              <th>View</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((item) => (
              <tr key={item.candidate_id} className="border-t border-slate-100">
                <td className="py-2">{item.candidate_name}</td>
                <td>{item.email}</td>
                <td>{item.total_score != null ? item.total_score.toFixed(1) : '-'}</td>
                <td>{item.recommendation || '-'}</td>
                <td>{item.status}</td>
                <td>{item.completed_at ? new Date(item.completed_at).toLocaleString() : '-'}</td>
                <td>
                  <Link className="btn-secondary !px-3 !py-1.5" to={`/candidate/${item.candidate_id}`}>
                    View Detail
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && (data?.items || []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-slate-500">
                  No interview results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
