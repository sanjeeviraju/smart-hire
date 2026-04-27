import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { DashboardStats, JobDescription } from '../types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [sRes, jdRes] = await Promise.all([api.get<DashboardStats>('/dashboard/stats'), api.get<JobDescription[]>('/jd/')]);
        setStats(sRes.data);
        setJds(jdRes.data);
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Failed to load dashboard');
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-5">
        {[['Total JDs', stats?.total_jds], ['Candidates', stats?.total_candidates], ['Screened', stats?.screened_candidates], ['Interview Sent', stats?.interviews_sent], ['Interviewed', stats?.interviews_completed]].map((item) => (
          <article key={item[0]} className="card">
            <p className="text-xs uppercase tracking-wide text-slate-500">{item[0]}</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{item[1] ?? '-'}</h2>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Job Descriptions</h3>
          <Link className="btn-primary" to="/jd/new">
            New JD
          </Link>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="space-y-2">
          {jds.map((jd) => (
            <Link key={jd.id} to={`/jd/${jd.id}`} className="block rounded-xl border border-slate-200 px-4 py-3 transition hover:border-teal/40 hover:bg-slate-50">
              <p className="font-semibold text-ink">{jd.title}</p>
              <p className="text-sm text-slate-500">
                {jd.department} | Threshold: {jd.screening_threshold}
              </p>
            </Link>
          ))}
          {jds.length === 0 && <p className="text-sm text-slate-500">No job descriptions yet.</p>}
        </div>
      </section>
    </div>
  );
}
