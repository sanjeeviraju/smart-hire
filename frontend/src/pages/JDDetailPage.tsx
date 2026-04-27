import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ResumeEvaluationMetrics from '../components/ResumeEvaluationMetrics';
import { Candidate, CandidateListResponse, JobDescription } from '../types';

type Filters = {
  min_score: string;
  max_score: string;
  skill: string;
  passed_only: boolean;
};

const INITIAL_FILTERS: Filters = {
  min_score: '',
  max_score: '',
  skill: '',
  passed_only: false,
};

export default function JDDetailPage() {
  const { id } = useParams();
  const jdId = Number(id);

  const [jd, setJd] = useState<JobDescription | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskInfo, setTaskInfo] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<Array<{ candidate_id: string; email: string; interview_link: string; expires_at: string }>>([]);

  const allSelected = useMemo(() => candidates.length > 0 && selectedIds.size === candidates.length, [candidates, selectedIds]);

  useEffect(() => {
    if (!jdId) return;
    void loadInitial();
  }, [jdId]);

  useEffect(() => {
    if (!taskId) return;
    const timer = setInterval(async () => {
      try {
        const res = await api.get(`/jd/${jdId}/screen/${taskId}`);
        const state = res.data.state;
        const meta = res.data.meta;
        if (meta?.current && meta?.total) {
          setTaskInfo(`Screening ${meta.current}/${meta.total}`);
        } else {
          setTaskInfo(state);
        }
        if (state === 'SUCCESS' || state === 'FAILURE') {
          setTaskId(null);
          await loadCandidates(filters);
        }
      } catch {
        setTaskId(null);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [taskId, jdId, filters]);

  async function loadInitial() {
    setError('');
    const [jdRes, cRes] = await Promise.all([api.get<JobDescription>(`/jd/${jdId}`), api.get<CandidateListResponse>(`/jd/${jdId}/candidates`)]);
    setJd(jdRes.data);
    setCandidates(cRes.data.items);
  }

  async function loadCandidates(nextFilters: Filters) {
    const params: Record<string, string | boolean> = {};
    if (nextFilters.min_score) params.min_score = nextFilters.min_score;
    if (nextFilters.max_score) params.max_score = nextFilters.max_score;
    if (nextFilters.skill) params.skill = nextFilters.skill;
    if (nextFilters.passed_only) params.passed_only = true;

    const response = await api.get<CandidateListResponse>(`/jd/${jdId}/candidates`, { params });
    setCandidates(response.data.items);
    setSelectedIds(new Set());
  }

  async function uploadResumes(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('files', f));

    setBusy(`Uploading ${files.length} resumes...`);
    setMessage('');
    setError('');
    try {
      const response = await api.post<{ uploaded: number; failed: Array<{ file: string; error: string }> }>(`/jd/${jdId}/candidates/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadCandidates(filters);
      setMessage(`Uploaded ${response.data.uploaded} resume(s).`);
      if (response.data.failed.length) {
        setError(`Some files failed: ${response.data.failed.slice(0, 2).map((x) => `${x.file} (${x.error})`).join(', ')}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setBusy('');
      e.target.value = '';
    }
  }

  async function applyFilters() {
    setBusy('Applying filters...');
    setError('');
    try {
      await loadCandidates(filters);
    } finally {
      setBusy('');
    }
  }

  async function runScreening() {
    setBusy('Queueing screening...');
    setError('');
    setMessage('');
    setGeneratedLinks([]);
    try {
      const res = await api.post(`/jd/${jdId}/screen`);
      setTaskId(res.data.task_id);
      setTaskInfo('Queued');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to queue screening');
    } finally {
      setBusy('');
    }
  }

  async function shortlist() {
    if (!selectedIds.size) return setError('Select at least one candidate.');
    setBusy('Shortlisting...');
    setError('');
    try {
      await api.post('/candidates/shortlist', { candidate_ids: [...selectedIds] });
      await loadCandidates(filters);
      setMessage('Candidates shortlisted.');
    } finally {
      setBusy('');
    }
  }

  async function sendInterviews(force = false) {
    if (!selectedIds.size) return setError('Select at least one candidate.');
    setBusy('Sending interview links...');
    setError('');
    setMessage('');
    setGeneratedLinks([]);
    try {
      const res = await api.post('/candidates/send-interviews', { candidate_ids: [...selectedIds], force_regenerate: force });
      await loadCandidates(filters);
      setMessage(`Sent ${res.data.sent} invitation(s).`);
      setGeneratedLinks(res.data.links || []);
      if (res.data.failed?.length) {
        setError(`Failed for ${res.data.failed.length}: ${res.data.failed.slice(0, 2).map((x: any) => x.error).join(', ')}`);
      }
    } finally {
      setBusy('');
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  }

  async function openCandidateView(candidateId: number) {
    const fallback = candidates.find((c) => c.id === candidateId) || null;
    setViewCandidate(fallback);
    setViewLoading(true);
    try {
      const res = await api.get<Candidate>(`/candidates/${candidateId}`);
      setViewCandidate(res.data);
    } finally {
      setViewLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card">
        <h1 className="font-display text-2xl font-semibold">{jd?.title || 'Job Detail'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {jd?.department} | Threshold {jd?.screening_threshold}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer">
            Choose Resumes
            <input type="file" multiple accept=".pdf,.docx" className="hidden" onChange={uploadResumes} />
          </label>
          <button className="btn-primary" onClick={runScreening}>
            Run Screening
          </button>
          <button className="btn-secondary" onClick={shortlist}>
            Shortlist Selected
          </button>
          <button className="btn-secondary" onClick={() => sendInterviews(false)}>
            Send Interview
          </button>
          <button className="btn-secondary" onClick={() => sendInterviews(true)}>
            Force Resend
          </button>
          <Link className="btn-secondary" to={`/jd/${jdId}/results`}>
            Interview Results
          </Link>
        </div>

        {taskId && <p className="mt-3 text-sm text-teal">{taskInfo}</p>}
        {busy && <p className="mt-2 text-sm text-slate-600">{busy}</p>}
        {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {generatedLinks.length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            {generatedLinks.map((x) => (
              <div key={x.interview_link} className="mb-2 flex flex-wrap items-center gap-2">
                <span>
                  {x.email} | Expires {new Date(x.expires_at).toLocaleString()}
                </span>
                <button className="btn-secondary !px-2 !py-1" onClick={() => navigator.clipboard.writeText(x.interview_link)}>
                  Copy Link
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-semibold">Filters</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="Min Score" value={filters.min_score} onChange={(v) => setFilters((f) => ({ ...f, min_score: v }))} />
          <Field label="Max Score" value={filters.max_score} onChange={(v) => setFilters((f) => ({ ...f, max_score: v }))} />
          <Field label="Skill" value={filters.skill} onChange={(v) => setFilters((f) => ({ ...f, skill: v }))} />
          <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={filters.passed_only} onChange={(e) => setFilters((f) => ({ ...f, passed_only: e.target.checked }))} />
            Passed only
          </label>
        </div>
        <button className="btn-primary mt-3" onClick={applyFilters}>
          Apply
        </button>
      </section>

      <section className="card overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Overall</th>
              <th>Exp</th>
              <th>View</th>
              <th>Interview</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-2">
                  <input checked={selectedIds.has(c.id)} onChange={() => toggleSelected(c.id)} type="checkbox" />
                </td>
                <td className="py-2">{c.full_name}</td>
                <td>{c.email}</td>
                <td>{c.status}</td>
                <td>{c.resume_score?.overall_score?.toFixed(1) || '-'}</td>
                <td>{c.extracted_experience_years}</td>
                <td>
                  <button className="btn-secondary !px-3 !py-1.5" onClick={() => openCandidateView(c.id)}>
                    View
                  </button>
                </td>
                <td>
                  {['Interviewed', 'Selected', 'Rejected'].includes(c.status) ? (
                    <Link className="btn-secondary !px-3 !py-1.5" to={`/candidate/${c.id}`}>
                      Result
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-slate-500">
                  No candidates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {viewCandidate && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-glass">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-ink">{viewCandidate.full_name}</h3>
                <p className="text-sm text-slate-600">{viewCandidate.email}</p>
                <p className="text-sm text-slate-600">{viewCandidate.phone || 'No contact number'}</p>
              </div>
              <button className="btn-secondary" onClick={() => setViewCandidate(null)}>
                Close
              </button>
            </div>

            {viewLoading && <p className="mt-3 text-sm text-slate-500">Loading candidate details...</p>}

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <InsightCard label="Overall Score" value={viewCandidate.resume_score?.overall_score?.toFixed(1) || '-'} />
              <InsightCard label="Status" value={viewCandidate.status} />
              <InsightCard label="Experience" value={`${viewCandidate.extracted_experience_years} yrs`} />
            </div>

            {viewCandidate.resume_score ? (
              <div className="mt-5">
                <ResumeEvaluationMetrics resumeScore={viewCandidate.resume_score} screeningThreshold={jd?.screening_threshold} />
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-ink">AI Model Evaluation Metrics</h4>
                <p className="mt-2 text-sm text-slate-600">Run screening to view semantic cosine similarity and all factor-wise metrics.</p>
              </div>
            )}

            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <h4 className="font-semibold text-ink">Matched Requirements</h4>
              <p className="mt-1 text-sm text-slate-600">
                Skills matched: {(viewCandidate.resume_score?.matched_skills || []).join(', ') || 'No matched skills detected'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Missing required skills: {(viewCandidate.resume_score?.missing_skills || []).join(', ') || 'None'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Pass threshold: {viewCandidate.resume_score?.passed ? 'Yes' : 'No'}
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold text-ink">Resume</h4>
                <a className="text-sm font-semibold text-teal underline" href={viewCandidate.resume_url} target="_blank" rel="noreferrer">
                  Open in new tab
                </a>
              </div>
              {viewCandidate.resume_url.toLowerCase().includes('.pdf') ? (
                <iframe title="Candidate Resume" src={viewCandidate.resume_url} className="h-[460px] w-full rounded-lg border border-slate-200" />
              ) : (
                <p className="text-sm text-slate-600">Inline preview is available for PDF. Open this resume in new tab.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
