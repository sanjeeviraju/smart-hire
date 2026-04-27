import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { api } from '../../api/client';
import { bulkDeleteCandidates, getCandidateScore, getCandidates, runScreening, sendInterviews, shortlistCandidates } from '../../api/candidates';
import { getJD, uploadCandidateResumes } from '../../api/jd';
import ScreeningConfigModal from '../../components/ScreeningConfigModal';
import { useTheme } from '../../context/ThemeContext';
import type { Candidate, JobDescription, ResumeScore, ScreeningConfig } from '../../types';
import { formatExp } from '../../utils/formatters';

type ActivePage = 'dashboard' | 'jobs' | 'jd-detail' | 'create-jd' | 'jd-results' | 'candidate-interview-detail';
type JDDetailData = JobDescription;

type JDDetailProps = {
  jdId: number | null;
  onBack: () => void;
  onNavigate: (page: ActivePage, jdId?: number, candidateId?: number) => void;
  onRefresh: () => Promise<void>;
};

const CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes rowSlide {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  @keyframes indeterminate {
    0% { transform: translateX(-100%) scaleX(0.5); }
    50% { transform: translateX(0%) scaleX(0.8); }
    100% { transform: translateX(100%) scaleX(0.5); }
  }

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .jdx-page {
    padding: 20px 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--bg-page);
    min-height: 100vh;
    box-sizing: border-box;
  }

  .jdx-back {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12.5px;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .jdx-back:hover { color: var(--text-primary); }

  .jdx-head-card,
  .jdx-empty-card,
  .jdx-table-card {
    background: var(--bg-card);
    border: 1px solid var(--border-card);
    border-radius: 16px;
  }

  .jdx-head-card {
    padding: 22px 24px;
    animation: fadeUp 0.35s ease both;
  }

  .jdx-head-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .jdx-title {
    margin: 0;
    font-size: 21px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.2;
  }

  .jdx-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .jdx-chip {
    font-size: 11.5px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 6px;
  }

  .jdx-edit-btn,
  .jdx-action-btn,
  .jdx-outline-btn,
  .jdx-danger-btn,
  .jdx-dark-btn,
  .jdx-solid-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    box-sizing: border-box;
  }

  .jdx-edit-btn {
    padding: 8px 15px;
    border: 1px solid var(--border-input);
    border-radius: 10px;
    background: var(--bg-action-btn);
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .jdx-edit-btn:hover {
    background: var(--bg-dark-btn);
    color: var(--text-dark-btn);
    border-color: var(--bg-dark-btn);
  }

  .jdx-desc-toggle {
    margin-top: 16px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .jdx-desc-toggle:hover { color: var(--text-primary); }
  .jdx-desc-chevron { transition: transform 0.2s ease; }
  .jdx-desc-wrap { overflow: hidden; transition: max-height 0.3s ease; }

  .jdx-desc-card {
    margin-top: 12px;
    background: var(--bg-desc);
    border: 1px solid var(--border-desc);
    border-radius: 10px;
    padding: 14px 16px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.75;
    white-space: pre-wrap;
  }

  .jdx-actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    padding-top: 14px;
    border-top: 1px solid var(--border-divider);
    margin-top: 14px;
  }

  .jdx-progress {
    height: 3px;
    background: var(--bg-chip-gray);
    border-radius: 99px;
    overflow: hidden;
    margin-top: 8px;
  }

  .jdx-progress-fill {
    height: 100%;
    border-radius: 99px;
    animation: indeterminate 1.5s ease infinite;
    transform-origin: left center;
  }

  .jdx-action-btn,
  .jdx-dark-btn {
    padding: 8px 14px;
    border: 1px solid var(--border-btn);
    border-radius: 9px;
    background: var(--bg-action-btn);
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .jdx-action-btn:hover { background: var(--bg-card-hover); }
  .jdx-action-btn:disabled,
  .jdx-dark-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .jdx-dark-btn {
    background: var(--bg-dark-btn);
    color: var(--text-dark-btn);
    border-color: var(--bg-dark-btn);
  }

  .jdx-dark-btn:hover { filter: brightness(0.92); }

  .jdx-empty-card {
    padding: 52px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    animation: fadeUp 0.4s ease 0.1s both;
    text-align: center;
  }

  .jdx-empty-illustration {
    width: 64px;
    height: 64px;
    margin-bottom: 20px;
    animation: float 3s ease-in-out infinite;
  }

  .jdx-upload-zone {
    width: min(620px, 100%);
    border: 2px dashed var(--border-dashed);
    border-radius: 14px;
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease;
    box-sizing: border-box;
  }

  .jdx-upload-zone:hover {
    border-color: var(--text-primary);
    background: var(--bg-card-hover);
  }

  .jdx-upload-zone:hover .jdx-upload-icon { transform: scale(1.08); }

  .jdx-upload-icon {
    width: 36px;
    height: 36px;
    stroke: var(--icon-muted);
    transition: transform 0.2s ease;
  }

  .jdx-upload-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .jdx-upload-sub {
    font-size: 13px;
    color: var(--text-hint);
    text-align: center;
  }

  .jdx-solid-btn {
    padding: 10px 24px;
    background: var(--bg-dark-btn);
    color: var(--text-dark-btn);
    border: none;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 500;
  }

  .jdx-upload-hint,
  .jdx-empty-note {
    font-size: 11.5px;
    color: var(--text-faint);
  }

  .jdx-state-b { animation: fadeUp 0.4s ease both; }
  .jdx-table-card { overflow: hidden; animation: fadeUp 0.35s ease 0.08s both; }

  .jdx-table-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-divider);
    flex-wrap: wrap;
  }

  .jdx-screening-toast {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 10px;
    padding: 12px 16px;
    margin: 0 20px 12px;
    animation: fadeUp 0.3s ease both;
    font-size: 13px;
    color: #166534;
  }

  .jdx-screening-toast-close {
    margin-left: auto;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }

  .jdx-table-title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 14.5px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .jdx-table-count {
    font-size: 12px;
    color: var(--text-hint);
    font-weight: 500;
  }

  .jdx-delete-bar {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    background: var(--bg-del-bar);
    border: 1px solid var(--border-del);
    border-radius: 8px;
    padding: 5px 11px;
    font-size: 12.5px;
    color: var(--text-del);
  }

  .jdx-danger-btn {
    padding: 6px 10px;
    border: none;
    border-radius: 7px;
    background: var(--score-red);
    color: var(--text-dark-btn);
    font-size: 12px;
    font-weight: 600;
  }

  .jdx-outline-btn {
    padding: 6px 10px;
    border: 1px solid var(--border-del);
    border-radius: 7px;
    background: transparent;
    color: var(--text-del);
    font-size: 12px;
    font-weight: 500;
  }

  .jdx-table-wrap { overflow-x: auto; }

  .jdx-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 80;
    padding: 20px;
    animation: fadeIn 0.2s ease both;
    box-sizing: border-box;
  }

  .jdx-modal,
  .jdx-modal-wide {
    background: var(--bg-modal);
    border-radius: 18px;
    padding: 24px;
    border: 1px solid var(--border-card);
    box-sizing: border-box;
    max-height: calc(100vh - 40px);
    overflow-y: auto;
  }

  .jdx-modal { width: 360px; }
  .jdx-modal-wide { width: 500px; }

  .jdx-modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .jdx-modal-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .jdx-close {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 8px;
    background: var(--bg-muted);
    color: var(--text-secondary);
    font-size: 16px;
    cursor: pointer;
  }

  .jdx-field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .jdx-field-full { grid-column: 1 / -1; }

  .jdx-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .jdx-field label,
  .jdx-checkbox {
    font-size: 12.5px;
    color: var(--text-label);
  }

  .jdx-field input,
  .jdx-field textarea,
  .jdx-field select {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--border-input);
    border-radius: 9px;
    font-size: 13.5px;
    color: var(--text-primary);
    outline: none;
    box-sizing: border-box;
    background: var(--bg-input);
  }

  .jdx-field textarea {
    min-height: 72px;
    resize: vertical;
  }

  .jdx-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    user-select: none;
  }

  .jdx-modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 18px;
  }

  .jdx-feedback {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    font-size: 12.5px;
    margin-top: 10px;
  }

  .jdx-feedback-note { color: var(--score-green); }
  .jdx-feedback-warn { color: var(--score-amber); }
  .jdx-feedback-error { color: var(--score-red); }

  @media (max-width: 920px) {
    .jdx-page { padding: 16px; }
    .jdx-head-top { flex-direction: column; align-items: stretch; }
    .jdx-edit-btn { align-self: flex-start; }
    .jdx-field-grid { grid-template-columns: 1fr; }
  }
`;

export default function JDDetail({ jdId, onBack, onNavigate, onRefresh }: JDDetailProps) {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const [jd, setJd] = useState<JDDetailData | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [descOpen, setDescOpen] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [screeningModalOpen, setScreeningModalOpen] = useState(false);
  const [filterActive, setFilterActive] = useState(false);

  const [filterMin, setFilterMin] = useState('');
  const [filterMax, setFilterMax] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterPassed, setFilterPassed] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editExp, setEditExp] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [editEducation, setEditEducation] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');
  const [screening, setScreening] = useState(false);
  const [screeningProgress, setScreeningProgress] = useState<{ current: number; total: number } | null>(null);
  const [screeningDone, setScreeningDone] = useState(false);
  const [screeningSummary, setScreeningSummary] = useState<{ passed: number; failed: number; total: number } | null>(null);

  const [panelCandidate, setPanelCandidate] = useState<Candidate | null>(null);
  const [panelScore, setPanelScore] = useState<ResumeScore | null>(null);
  const [panelLoadingScore, setPanelLoadingScore] = useState(false);
  const [panelResumePreviewSrc, setPanelResumePreviewSrc] = useState<string | null>(null);
  const [panelResumeLoading, setPanelResumeLoading] = useState(false);
  const [panelResumeError, setPanelResumeError] = useState('');
  const [selectionLoadingId, setSelectionLoadingId] = useState<number | null>(null);

  const hasCandidates = candidates.length > 0;
  const allSelected = hasCandidates && selected.size === candidates.length;
  const partiallySelected = selected.size > 0 && selected.size < candidates.length;
  const screenedCount = useMemo(
    () =>
      candidates.filter((candidate) =>
        ['Screened', 'Shortlisted', 'Interview Sent', 'Interviewed', 'Selected', 'Rejected'].includes(candidate.status),
      ).length,
    [candidates],
  );

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFilterOpen(false);
        setEditOpen(false);
        setScreeningModalOpen(false);
        setPanelCandidate(null);
      }
    }

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (!jdId) {
      setLoading(false);
      return;
    }

    const currentJdId = jdId;
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [jobData, candidateData] = await Promise.all([getJD(currentJdId), getCandidates(currentJdId)]);
        if (ignore) return;
        setJd(jobData);
        setCandidates(candidateData);
        setSelected(new Set());
        fillEditForm(jobData);
      } catch (err: any) {
        if (!ignore) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to load job description');
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

  useEffect(() => {
    if (!screeningDone) return undefined;

    const timer = window.setTimeout(() => {
      setScreeningDone(false);
      setScreeningSummary(null);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [screeningDone]);

  useEffect(() => {
    if (!panelCandidate || !jdId) {
      setPanelScore(null);
      setPanelLoadingScore(false);
      return;
    }

    let ignore = false;
    setPanelLoadingScore(true);
    void getCandidateScore(panelCandidate.id, jdId)
      .then((score) => {
        if (!ignore) setPanelScore(score);
      })
      .catch(() => {
        if (!ignore) setPanelScore(panelCandidate.resume_score ?? null);
      })
      .finally(() => {
        if (!ignore) setPanelLoadingScore(false);
      });

    return () => {
      ignore = true;
    };
  }, [panelCandidate, jdId]);

  useEffect(() => {
    if (!panelCandidate?.resume_url) {
      setPanelResumePreviewSrc(null);
      setPanelResumeError('');
      setPanelResumeLoading(false);
      return undefined;
    }

    let ignore = false;
    let objectUrl: string | null = null;

    setPanelResumeLoading(true);
    setPanelResumeError('');
    setPanelResumePreviewSrc(null);

    void api.get(`/candidates/${panelCandidate.id}/resume-preview`, { responseType: 'blob' })
      .then((response) => {
        if (ignore) return;
        objectUrl = URL.createObjectURL(response.data);
        setPanelResumePreviewSrc(objectUrl);
      })
      .catch((err: any) => {
        if (ignore) return;
        setPanelResumeError(err?.response?.data?.detail || err?.message || 'Unable to load resume preview');
      })
      .finally(() => {
        if (!ignore) {
          setPanelResumeLoading(false);
        }
      });

    return () => {
      ignore = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [panelCandidate]);

  function fillEditForm(job: JDDetailData) {
    setEditTitle(job.title || '');
    setEditDept(job.department || '');
    setEditExp(String(job.min_experience_years ?? ''));
    setEditThreshold(String(job.screening_threshold ?? ''));
    setEditEducation(job.education_requirement || '');
    setEditSkills((job.required_skills || []).join(', '));
    setEditDesc(job.description || '');
  }

  async function refreshCurrent(refreshParent = false) {
    if (!jdId) return;
    const filters = buildFilters();
    const [jobData, candidateData] = await Promise.all([
      getJD(jdId),
      getCandidates(jdId, filterActive ? filters : {}),
    ]);
    setJd(jobData);
    setCandidates(candidateData);
    setSelected(new Set());
    fillEditForm(jobData);
    if (panelCandidate) {
      const refreshedPanel = candidateData.find((candidate) => candidate.id === panelCandidate.id) || null;
      setPanelCandidate(refreshedPanel);
    }
    if (refreshParent) {
      await onRefresh();
    }
  }

  function buildFilters() {
    return {
      min_score: filterMin ? Number(filterMin) : undefined,
      max_score: filterMax ? Number(filterMax) : undefined,
      skill: filterSkill.trim() || undefined,
      passed_only: filterPassed || undefined,
    };
  }

  function openUploadDialog() {
    if (jd?.hiring_status && jd.hiring_status !== 'active') {
      setError(
        jd.hiring_status === 'applications_closed'
          ? 'Applications are closed for this job. New candidates cannot be uploaded.'
          : 'Hiring has ended for this job. New candidates cannot be uploaded.',
      );
      return;
    }
    fileInputRef.current?.click();
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!jdId || files.length === 0) return;

    setWorking(`Uploading ${files.length} resume(s)...`);
    setMessage('');
    setWarning('');
    setError('');

    try {
      const result = await uploadCandidateResumes(jdId, files);
      await refreshCurrent(true);
      setMessage(`Uploaded ${result.uploaded} resume(s).`);
      if (result.failed.length > 0) {
        setWarning(result.failed.map((item) => `${item.file}: ${item.error}`).slice(0, 2).join(' | '));
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to upload resumes');
    } finally {
      setWorking('');
      if (event.target) {
        event.target.value = '';
      }
    }
  }

  async function handleRunScreening(config: ScreeningConfig) {
    if (!jdId) return;

    const ids = [...selected];
    setScreening(true);
    setScreeningProgress({ current: 0, total: ids.length });
    setScreeningDone(false);
    setScreeningSummary(null);
    setMessage('');
    setWarning('');
    setError('');

    try {
      const response = await runScreening(jdId, ids, config);
      const byId = new Map(response.results.map((item) => [item.candidate_id, item]));

      setCandidates((prev) =>
        prev.map((candidate) => {
          const result = byId.get(candidate.id);
          if (!result) return candidate;
          return {
            ...candidate,
            status: result.passed ? 'Shortlisted' : 'Screened',
            resume_score: {
              candidate_id: candidate.id,
              jd_id: jdId,
              skill_score: result.skill_score,
              exp_score: result.exp_score,
              edu_score: result.edu_score,
              project_score: result.project_score,
              overall_score: result.overall_score,
              passed: result.passed,
              matched_skills: result.matched_skills,
              missing_skills: result.missing_skills,
              screened_at: new Date().toISOString(),
            },
          };
        }),
      );

      setSelected(new Set());
      setScreeningDone(true);
      setScreeningSummary({
        passed: response.total_passed,
        failed: response.total_failed,
        total: response.total_screened,
      });
      setScreeningProgress({ current: response.total_screened, total: response.total_screened });
      await refreshCurrent(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Screening failed');
    } finally {
      setScreening(false);
    }
  }

  async function handleShortlist() {
    if (!selected.size) {
      setError('Select at least one candidate.');
      return;
    }
    setWorking('Shortlisting candidates...');
    setMessage('');
    setWarning('');
    setError('');
    try {
      await shortlistCandidates([...selected]);
      await refreshCurrent(true);
      setMessage(`${selected.size} candidate(s) shortlisted.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to shortlist candidates');
    } finally {
      setWorking('');
    }
  }

  async function handleSendInterviews(force = false) {
    if (!selected.size) {
      setError('Select at least one candidate.');
      return;
    }
    setWorking(force ? 'Force resending interviews...' : 'Sending interviews...');
    setMessage('');
    setWarning('');
    setError('');
    try {
      const result = await sendInterviews([...selected], force);
      const failed = result.results.filter((item) => !item.success);
      await refreshCurrent(true);
      setMessage(`${result.sent} interview invite(s) sent.`);
      if (failed.length > 0) {
        setWarning(
          failed
            .map((item) => item.error || 'Failed to send interview')
            .slice(0, 2)
            .join(' | '),
        );
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to send interviews');
    } finally {
      setWorking('');
    }
  }

  async function handleDeleteSelected() {
    if (!selected.size) return;
    setWorking('Deleting selected candidates...');
    setMessage('');
    setWarning('');
    setError('');
    const ids = [...selected];
    try {
      await bulkDeleteCandidates(ids);
      setCandidates((prev) => prev.filter((candidate) => !selected.has(candidate.id)));
      setSelected(new Set());
      setMessage(`${ids.length} candidate(s) deleted.`);
      await onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to delete candidates');
    } finally {
      setWorking('');
    }
  }

  async function handleApplyFilters() {
    if (!jdId) return;
    setWorking('Applying filters...');
    setError('');
    try {
      const rows = await getCandidates(jdId, buildFilters());
      setCandidates(rows);
      setSelected(new Set());
      setFilterActive(Boolean(filterMin || filterMax || filterSkill.trim() || filterPassed));
      setFilterOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to apply filters');
    } finally {
      setWorking('');
    }
  }

  async function handleResetFilters() {
    if (!jdId) return;
    setFilterMin('');
    setFilterMax('');
    setFilterSkill('');
    setFilterPassed(false);
    setFilterActive(false);
    setFilterOpen(false);
    setWorking('Resetting filters...');
    try {
      const rows = await getCandidates(jdId);
      setCandidates(rows);
      setSelected(new Set());
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to reset filters');
    } finally {
      setWorking('');
    }
  }

  async function handleSaveEdit() {
    if (!jdId || !jd) return;
    setWorking('Saving JD changes...');
    setError('');
    try {
      const payload = {
        title: editTitle.trim(),
        department: editDept.trim(),
        description: editDesc,
        required_skills: editSkills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
        min_experience_years: editExp ? Number(editExp) : 0,
        education_requirement: editEducation.trim() || jd.education_requirement,
        screening_threshold: editThreshold ? Number(editThreshold) : jd.screening_threshold,
      };
      const response = await api.put<JDDetailData>(`/jd/${jdId}`, payload);
      setJd(response.data);
      fillEditForm(response.data);
      setEditOpen(false);
      setMessage('Job description updated.');
      await onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update job description');
    } finally {
      setWorking('');
    }
  }

  function openPanel(candidate: Candidate) {
    setPanelCandidate(candidate);
    setPanelScore(candidate.resume_score ?? null);
  }

  async function handleToggleSelection(candidate: Candidate) {
    if (candidate.status !== 'Interviewed') return;

    const nextSelection = getNextSelection(candidate.selection ?? null);
    setSelectionLoadingId(candidate.id);
    setError('');

    try {
      await api.patch(`/candidates/${candidate.id}/selection`, { selection: nextSelection });
      setCandidates((prev) =>
        prev.map((item) =>
          item.id === candidate.id
            ? { ...item, selection: nextSelection }
            : item,
        ),
      );
      if (panelCandidate?.id === candidate.id) {
        setPanelCandidate({ ...panelCandidate, selection: nextSelection });
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update selection');
    } finally {
      setSelectionLoadingId(null);
    }
  }

  function handleViewResult(candidateId: number) {
    onNavigate('candidate-interview-detail', jdId || undefined, candidateId);
  }

  const chips = useMemo(() => {
    const items: Array<{ label: string; style: CSSProperties }> = [];
    if (jd) {
      const statusMeta = getJobHiringStatusMeta(jd.hiring_status);
      items.push({ label: statusMeta.label, style: statusMeta.style });
    }
    if (jd?.department) {
      items.push({ label: jd.department, style: { background: 'var(--bg-chip-gray)', color: 'var(--text-chip-gray)' } });
    }
    if (jd) {
      items.push({
        label: `Threshold: ${jd.screening_threshold}`,
        style: { background: 'var(--bg-chip-blue)', color: 'var(--text-chip-blue)' },
      });
    }
    if (hasCandidates) {
      items.push({
        label: `${candidates.length} candidates`,
        style: { background: 'var(--bg-chip-green)', color: 'var(--text-chip-grn)' },
      });
    } else {
      items.push({
        label: 'No resumes yet',
        style: { background: 'var(--bg-chip-red)', color: 'var(--text-chip-red)' },
      });
    }
    if (screeningSummary && jd) {
      items.push({
        label: `${screeningSummary.passed}/${screeningSummary.total} passed threshold (${jd.screening_threshold})`,
        style: { background: 'var(--bg-chip-green)', color: 'var(--text-chip-grn)' },
      });
    } else if (hasCandidates && screenedCount === 0) {
      items.push({
        label: 'Screening pending',
        style: { background: 'var(--bg-chip-amber)', color: 'var(--text-chip-amber)' },
      });
    }
    return items;
  }, [candidates.length, hasCandidates, jd, screenedCount, screeningSummary]);

  const thStyle: CSSProperties = {
    padding: '9px 16px',
    textAlign: 'left',
    fontSize: '10.5px',
    fontWeight: 500,
    color: 'var(--text-hint)',
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--border-divider)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: CSSProperties = {
    padding: '12px 16px',
    verticalAlign: 'middle',
    overflow: 'hidden',
  };

  if (!jdId) {
    return (
      <div className="jdx-page">
        <style>{CSS}</style>
        <button className="jdx-back" onClick={onBack} type="button">
          <ChevronLeftIcon />
          Back
        </button>
      </div>
    );
  }

  const panelResumeScore = panelScore ?? panelCandidate?.resume_score ?? null;
  const panelSkills = panelCandidate?.resume_score?.matched_skills?.length
    ? panelCandidate.resume_score.matched_skills
    : panelCandidate?.extracted_skills ?? [];
  const missingSkills = panelCandidate?.resume_score?.missing_skills ?? [];
  const projectLines = getProjectLines(panelCandidate);
  const applicationsOpen = jd?.hiring_status === 'active';
  const uploadDisabledReason = jd?.hiring_status === 'applications_closed'
    ? 'Applications are closed for this job'
    : jd?.hiring_status === 'hiring_ended'
      ? 'Hiring has ended for this job'
      : 'Upload resumes to get started';
  return (
    <div className="jdx-page">
      <style>{CSS}</style>

      <button className="jdx-back" onClick={onBack} type="button">
        <ChevronLeftIcon />
        Back
      </button>

      <section className="jdx-head-card">
        <div className="jdx-head-top">
          <div>
            <h2 className="jdx-title">{loading ? 'Loading job description...' : jd?.title || 'Job description'}</h2>
            <div className="jdx-chip-row">
              {chips.map((chip) => (
                <span className="jdx-chip" key={chip.label} style={chip.style}>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>

          <button className="jdx-edit-btn" onClick={() => {
            if (jd) fillEditForm(jd);
            setEditOpen(true);
          }} type="button">
            <EditIcon />
            Edit JD
          </button>
        </div>

        <button className="jdx-desc-toggle" onClick={() => setDescOpen((current) => !current)} type="button">
          <span className="jdx-desc-chevron" style={{ transform: descOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <ChevronDownIcon />
          </span>
          Job description
        </button>

        <div className="jdx-desc-wrap" style={{ maxHeight: descOpen ? '420px' : '0px' }}>
          <div className="jdx-desc-card">{jd?.description || 'No description available.'}</div>
        </div>

        {hasCandidates && (
          <div className="jdx-actions">
            <button className="jdx-action-btn" disabled={screening || !applicationsOpen} onClick={openUploadDialog} type="button">
              <UploadIcon />
              {applicationsOpen ? 'Add More Resumes' : 'Applications Closed'}
            </button>
            <button
              className="jdx-dark-btn"
              disabled={screening}
              onClick={() => {
                if (selected.size === 0) {
                  setError('Please select at least one candidate to screen');
                  return;
                }
                setScreeningModalOpen(true);
              }}
              style={{
                background: theme === 'dark' ? '#ffffff' : '#111111',
                color: theme === 'dark' ? '#111111' : '#ffffff',
                borderColor: theme === 'dark' ? '#ffffff' : '#111111',
              }}
              type="button"
            >
              <ScreeningIcon />
              {screening && screeningProgress ? `Screening ${screeningProgress.total} resume(s)...` : 'Run Screening'}
            </button>
            <button className="jdx-action-btn" disabled={screening} onClick={handleShortlist} type="button">
              <UsersIcon />
              Shortlist Selected
            </button>
            <button className="jdx-action-btn" disabled={screening} onClick={() => void handleSendInterviews(false)} type="button">
              <MailIcon />
              Send Interview
            </button>
            <button className="jdx-action-btn" disabled={screening} onClick={() => void handleSendInterviews(true)} type="button">
              <RefreshIcon />
              Force Resend
            </button>
            <button className="jdx-action-btn" disabled={screening} onClick={() => onNavigate('jd-results', jdId)} type="button">
              <FileIcon />
              Interview Results
            </button>
            <button
              className="jdx-action-btn"
              disabled={screening}
              onClick={() => setFilterOpen(true)}
              style={filterActive ? { background: 'var(--bg-filter-on)', borderColor: 'var(--border-filter)', color: 'var(--text-filter-on)' } : undefined}
              type="button"
            >
              <FilterIcon />
              {filterActive ? 'Filters applied' : 'Filters'}
            </button>
          </div>
        )}

        {screening && (
          <div className="jdx-progress">
            <div className="jdx-progress-fill" style={{ background: theme === 'dark' ? '#ffffff' : '#111111' }} />
          </div>
        )}

        {(working || message || warning || error) && (
          <div className="jdx-feedback">
            {working && <span>{working}</span>}
            {message && <span className="jdx-feedback-note">{message}</span>}
            {warning && <span className="jdx-feedback-warn">{warning}</span>}
            {error && <span className="jdx-feedback-error">{error}</span>}
          </div>
        )}
      </section>

      {!hasCandidates ? (
        <section className="jdx-empty-card">
          <DocumentIcon className="jdx-empty-illustration" />
          <div
            className="jdx-upload-zone"
            onClick={applicationsOpen ? openUploadDialog : undefined}
            role={applicationsOpen ? 'button' : undefined}
            style={applicationsOpen ? undefined : { opacity: 0.72, cursor: 'not-allowed' }}
            tabIndex={applicationsOpen ? 0 : undefined}
          >
            <UploadCloudIcon className="jdx-upload-icon" />
            <div className="jdx-upload-title">{uploadDisabledReason}</div>
            <div className="jdx-upload-sub">
              {applicationsOpen
                ? 'Drop PDF or DOCX files here, or click to browse.'
                : 'This role is no longer accepting new candidates, but it stays available for HR review.'}
            </div>
            <button
              className="jdx-solid-btn"
              disabled={!applicationsOpen}
              onClick={(event) => {
                event.stopPropagation();
                openUploadDialog();
              }}
              type="button"
            >
              {applicationsOpen ? 'Choose resumes' : 'Uploads disabled'}
            </button>
            <div className="jdx-upload-hint">PDF, DOCX · Max 10MB per file</div>
          </div>
          <div className="jdx-empty-note">
            {applicationsOpen
              ? 'Screening, shortlisting and interview tools will appear after resumes are uploaded.'
              : 'Existing candidates can still be reviewed from the dashboard if resumes were uploaded earlier.'}
          </div>
        </section>
      ) : (
        <div className="jdx-state-b">
          <section className="jdx-table-card">
            {screeningDone && screeningSummary && (
              <div className="jdx-screening-toast">
                <SuccessCheckIcon />
                <span>
                  Screening complete - {screeningSummary.passed} passed, {screeningSummary.failed} failed out of {screeningSummary.total} screened
                </span>
                <button
                  className="jdx-screening-toast-close"
                  onClick={() => {
                    setScreeningDone(false);
                    setScreeningSummary(null);
                  }}
                  type="button"
                >
                  ×
                </button>
              </div>
            )}

            <div className="jdx-table-top">
              <div className="jdx-table-title">
                <span>Candidates</span>
                <span className="jdx-table-count">{candidates.length}</span>
              </div>

              {selected.size > 0 && (
                <div className="jdx-delete-bar">
                  <span>{selected.size} selected</span>
                  <button className="jdx-danger-btn" onClick={() => void handleDeleteSelected()} type="button">
                    Delete
                  </button>
                  <button className="jdx-outline-btn" onClick={() => setSelected(new Set())} type="button">
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="jdx-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '36px' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '150px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ padding: '9px 16px' }}>
                      <input
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(candidates.map((candidate) => candidate.id)))}
                        ref={selectAllRef}
                        type="checkbox"
                      />
                    </th>
                    <th style={thStyle}>Name + Email</th>
                    <th style={thStyle}>Score</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Selection</th>
                    <th style={thStyle}>Interview</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate, index) => {
                    const score = candidate.resume_score?.overall_score ?? null;
                    return (
                      <tr
                        key={candidate.id}
                        style={{
                          borderBottom: '1px solid var(--border-divider)',
                          transition: 'background 0.1s',
                          animation: `rowSlide 0.24s ease ${index * 0.06}s both`,
                        }}
                      >
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                          <input
                            style={{ accentColor: '#111' }}
                            checked={selected.has(candidate.id)}
                            onChange={() =>
                              setSelected((current) => {
                                const next = new Set(current);
                                if (next.has(candidate.id)) next.delete(candidate.id);
                                else next.add(candidate.id);
                                return next;
                              })
                            }
                            type="checkbox"
                          />
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'var(--bg-chip-blue)',
                                color: 'var(--text-chip-blue)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 500,
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(candidate.full_name)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  color: 'var(--text-primary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {candidate.full_name || '—'}
                              </div>
                              <div
                                style={{
                                  fontSize: '11.5px',
                                  color: 'var(--text-hint)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  marginTop: '3px',
                                }}
                              >
                                {candidate.email || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>{renderScoreBadge(score)}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 500,
                              padding: '3px 9px',
                              borderRadius: '6px',
                              background: getStatusBg(candidate.status),
                              color: getStatusColor(candidate.status),
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                            }}
                          >
                            {candidate.status}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => void handleToggleSelection(candidate)}
                            disabled={candidate.status !== 'Interviewed' || selectionLoadingId === candidate.id}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: 0,
                              cursor: candidate.status === 'Interviewed' ? 'pointer' : 'default',
                            }}
                            type="button"
                          >
                            <SelectionBadge selection={candidate.selection} status={candidate.status} />
                          </button>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: candidate.status === 'Interview Sent' || candidate.status === 'Interviewed' ? '11.5px' : '12px',
                              fontWeight: 500,
                              padding: candidate.status === 'Interview Sent' || candidate.status === 'Interviewed' ? '3px 10px' : 0,
                              borderRadius: '6px',
                              background: getInterviewBadgeBg(candidate.status),
                              color: getInterviewBadgeColor(candidate.status),
                              display: 'inline-block',
                            }}
                          >
                            {getInterviewBadgeText(candidate.status)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            {candidate.status === 'Interviewed' && (
                              <ActionButton label="Result" onClick={() => handleViewResult(candidate.id)} />
                            )}
                            <ActionButton label="View" onClick={() => openPanel(candidate)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <input accept=".pdf,.docx" hidden multiple onChange={handleUpload} ref={fileInputRef} type="file" />

      {filterOpen && (
        <div className="jdx-modal-overlay" onClick={(event) => event.target === event.currentTarget && setFilterOpen(false)}>
          <div className="jdx-modal">
            <div className="jdx-modal-head">
              <h3 className="jdx-modal-title">Filter candidates</h3>
              <button className="jdx-close" onClick={() => setFilterOpen(false)} type="button">×</button>
            </div>

            <div className="jdx-field-grid">
              <div className="jdx-field jdx-field-full">
                <label htmlFor="filter-min">Min score</label>
                <input id="filter-min" onChange={(event) => setFilterMin(event.target.value)} type="number" value={filterMin} />
              </div>

              <div className="jdx-field jdx-field-full">
                <label htmlFor="filter-max">Max score</label>
                <input id="filter-max" onChange={(event) => setFilterMax(event.target.value)} type="number" value={filterMax} />
              </div>

              <div className="jdx-field jdx-field-full">
                <label htmlFor="filter-skill">Skill keyword</label>
                <input id="filter-skill" onChange={(event) => setFilterSkill(event.target.value)} type="text" value={filterSkill} />
              </div>

              <label className="jdx-checkbox jdx-field-full">
                <input checked={filterPassed} onChange={(event) => setFilterPassed(event.target.checked)} type="checkbox" />
                Passed threshold only
              </label>
            </div>

            <div className="jdx-modal-foot">
              <button className="jdx-outline-btn" onClick={() => void handleResetFilters()} type="button">Reset</button>
              <button className="jdx-solid-btn" onClick={() => void handleApplyFilters()} type="button">Apply filters</button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="jdx-modal-overlay" onClick={(event) => event.target === event.currentTarget && setEditOpen(false)}>
          <div className="jdx-modal-wide">
            <div className="jdx-modal-head">
              <h3 className="jdx-modal-title">Edit job description</h3>
              <button className="jdx-close" onClick={() => setEditOpen(false)} type="button">×</button>
            </div>

            <div className="jdx-field-grid">
              <div className="jdx-field">
                <label htmlFor="edit-title">Job title</label>
                <input id="edit-title" onChange={(event) => setEditTitle(event.target.value)} type="text" value={editTitle} />
              </div>

              <div className="jdx-field">
                <label htmlFor="edit-dept">Department</label>
                <input id="edit-dept" onChange={(event) => setEditDept(event.target.value)} type="text" value={editDept} />
              </div>

              <div className="jdx-field">
                <label htmlFor="edit-exp">Min experience (yrs)</label>
                <input id="edit-exp" onChange={(event) => setEditExp(event.target.value)} type="number" value={editExp} />
              </div>

              <div className="jdx-field">
                <label htmlFor="edit-threshold">Score threshold</label>
                <input id="edit-threshold" max="100" min="0" onChange={(event) => setEditThreshold(event.target.value)} type="number" value={editThreshold} />
              </div>

              <div className="jdx-field">
                <label htmlFor="edit-education">Education requirement</label>
                <select id="edit-education" onChange={(event) => setEditEducation(event.target.value)} value={editEducation}>
                  <option value="Bachelor's">Bachelor&apos;s</option>
                  <option value="Master's">Master&apos;s</option>
                  <option value="PhD">PhD</option>
                  <option value="Diploma">Diploma</option>
                  <option value="High School">High School</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>

              <div className="jdx-field">
                <label htmlFor="edit-skills">Required skills</label>
                <input id="edit-skills" onChange={(event) => setEditSkills(event.target.value)} type="text" value={editSkills} />
              </div>

              <div className="jdx-field jdx-field-full">
                <label htmlFor="edit-desc">Description</label>
                <textarea id="edit-desc" onChange={(event) => setEditDesc(event.target.value)} value={editDesc} />
              </div>
            </div>

            <div className="jdx-modal-foot">
              <button className="jdx-outline-btn" onClick={() => setEditOpen(false)} type="button">Cancel</button>
              <button className="jdx-solid-btn" onClick={() => void handleSaveEdit()} type="button">Save changes</button>
            </div>
          </div>
        </div>
      )}

      {panelCandidate && (
        <>
          <div
            onClick={() => setPanelCandidate(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.2)',
              zIndex: 99,
            }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 400,
              height: '100vh',
              background: '#fff',
              borderLeft: '1px solid rgba(0,0,0,0.08)',
              zIndex: 100,
              overflowY: 'auto',
              animation: 'slideIn 0.25s ease',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                background: '#fff',
                zIndex: 2,
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 20px',
              }}
            >
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#111' }}>Candidate Profile</div>
              <button
                onClick={() => setPanelCandidate(null)}
                style={{
                  border: 'none',
                  background: '#f5f5f5',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 18,
                  color: '#555',
                }}
                type="button"
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: '50%',
                      background: '#eef2ff',
                      color: '#3730a3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(panelCandidate.full_name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#111' }}>{panelCandidate.full_name}</div>
                    <div style={{ fontSize: '12.5px', color: '#666', marginTop: '3px', wordBreak: 'break-word' }}>
                      {panelCandidate.email}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>{renderLargeScoreBadge(panelCandidate.resume_score?.overall_score ?? null)}</div>

                <div
                  style={{
                    marginTop: '16px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '10px',
                  }}
                >
                  <InfoGridCard label="Status" value={panelCandidate.status} />
                  <InfoGridCard label="Selection" value={getSelectionText(panelCandidate.status, panelCandidate.selection)} />
                  <InfoGridCard label="Experience" value={formatExp(panelCandidate.extracted_experience_years ?? 0)} />
                  <InfoGridCard label="Education" value={panelCandidate.extracted_education || 'Unknown'} />
                </div>
              </section>

              <PanelSection title="SKILLS MATCHED">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {panelSkills.length > 0 ? (
                    panelSkills.map((skill) => (
                      <SkillChip key={skill} label={skill} tone="neutral" />
                    ))
                  ) : (
                    <span style={{ fontSize: '12px', color: '#999' }}>No skills available.</span>
                  )}
                </div>
                {!panelCandidate.resume_score?.matched_skills?.length && (
                  <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#999' }}>
                    Run screening to see matched skills
                  </div>
                )}
                <div style={{ marginTop: '16px', fontSize: '11px', fontWeight: 600, color: '#999', letterSpacing: '0.08em' }}>
                  MISSING SKILLS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                  {missingSkills.length > 0 ? (
                    missingSkills.map((skill) => (
                      <SkillChip key={skill} label={skill} tone="danger" />
                    ))
                  ) : (
                    <span style={{ fontSize: '12px', color: '#999' }}>No missing skills.</span>
                  )}
                </div>
              </PanelSection>

              <PanelSection title="PROJECTS">
                {projectLines.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {projectLines.map((project, index) => (
                      <div
                        key={`${project}-${index}`}
                        style={{
                          border: '1px solid rgba(0,0,0,0.06)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#111',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {index + 1}
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#444', lineHeight: 1.6 }}>{project}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#999' }}>No project details available.</div>
                )}
              </PanelSection>

              {(panelResumeScore?.overall_score ?? 0) > 0 && (
                <PanelSection title="SCORE BREAKDOWN">
                  {panelLoadingScore && <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>Loading breakdown...</div>}
                  <BreakdownRow color="#111" label="Skill match" value={panelResumeScore?.skill_score ?? 0} />
                  <BreakdownRow color="#378add" label="Experience" value={panelResumeScore?.exp_score ?? 0} />
                  <BreakdownRow color="#34d399" label="Education" value={panelResumeScore?.edu_score ?? 0} />
                  <BreakdownRow color="#fbbf24" label="Projects" value={panelResumeScore?.project_score ?? 0} />
                </PanelSection>
              )}

              <PanelSection
                action={panelCandidate.resume_url ? (
                  <a
                    href={panelCandidate.resume_url}
                    target="_blank"
                    download
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: 500,
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,0,0,0.1)',
                      background: '#fff',
                      color: '#111',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <DownloadIcon />
                    Download Resume
                  </a>
                ) : undefined}
                title="RESUME"
              >
                {panelResumeLoading ? (
                  <div
                    style={{
                      height: '420px',
                      background: '#f8f8f8',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12.5px',
                      color: 'var(--text-hint)',
                      border: '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    Loading resume preview...
                  </div>
                ) : panelResumePreviewSrc ? (
                  <div
                    style={{
                      border: '1px solid rgba(0,0,0,0.07)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      background: '#f8f8f8',
                    }}
                    >
                      <iframe
                      src={panelResumePreviewSrc}
                      title="Resume"
                      width="100%"
                      height="420px"
                      style={{
                        display: 'block',
                        border: 'none',
                      }}
                    />
                  </div>
                ) : panelResumeError ? (
                  <div
                    style={{
                      minHeight: '100px',
                      background: 'var(--bg-muted)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '16px',
                      fontSize: '12.5px',
                      color: '#b91c1c',
                      border: '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    {panelResumeError}
                  </div>
                ) : (
                  <div
                    style={{
                      height: '100px',
                      background: 'var(--bg-muted)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12.5px',
                      color: 'var(--text-hint)',
                      border: '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    No resume uploaded
                  </div>
                )}
              </PanelSection>
            </div>
          </aside>
        </>
      )}

      <ScreeningConfigModal
        open={screeningModalOpen}
        onClose={() => setScreeningModalOpen(false)}
        onRun={async (config) => {
          setScreeningModalOpen(false);
          await handleRunScreening(config);
        }}
        jdTitle={jd?.title ?? ''}
        jdSkills={jd?.required_skills ?? []}
        selectedCount={selected.size}
        selectedNames={candidates.filter((candidate) => selected.has(candidate.id)).map((candidate) => candidate.full_name)}
        defaultThreshold={jd?.screening_threshold ?? 65}
      />
    </div>
  );
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function getScoreBg(score: number | null): string {
  if (score == null) return '#f3f4f6';
  if (score >= 70) return '#dcfce7';
  if (score >= 50) return '#fef3c7';
  return '#fee2e2';
}

function getScoreColor(score: number | null): string {
  if (score == null) return '#9ca3af';
  if (score >= 70) return '#166534';
  if (score >= 50) return '#92400e';
  return '#991b1b';
}

function renderScoreBadge(score: number | null) {
  if (score == null) {
    return <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>;
  }

  return (
    <span
      style={{
        fontSize: '13px',
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: '7px',
        background: getScoreBg(score),
        color: getScoreColor(score),
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span>●</span>
      <span>{score.toFixed(1)}</span>
    </span>
  );
}

function renderLargeScoreBadge(score: number | null) {
  if (score == null) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '24px',
          fontWeight: 700,
          color: '#999',
        }}
      >
        —
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '24px',
        fontWeight: 700,
        color: getScoreColor(score),
      }}
    >
      <span>●</span>
      <span>{score.toFixed(1)}</span>
    </span>
  );
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'Interview Sent':
      return '#dbeafe';
    case 'Interviewed':
      return '#ede9fe';
    case 'Shortlisted':
      return '#dcfce7';
    default:
      return '#f0f0f0';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Interview Sent':
      return '#1e40af';
    case 'Interviewed':
      return '#5b21b6';
    case 'Shortlisted':
      return '#166534';
    default:
      return '#555';
  }
}

function getInterviewBadgeText(status: Candidate['status']) {
  if (status === 'Interview Sent') return 'Link Sent';
  if (status === 'Interviewed') return 'Completed';
  return '—';
}

function getInterviewBadgeBg(status: Candidate['status']) {
  if (status === 'Interview Sent') return '#dbeafe';
  if (status === 'Interviewed') return '#ede9fe';
  return 'transparent';
}

function getInterviewBadgeColor(status: Candidate['status']) {
  if (status === 'Interview Sent') return '#1e40af';
  if (status === 'Interviewed') return '#5b21b6';
  return '#ccc';
}

function getNextSelection(selection: Candidate['selection']) {
  if (selection === 'selected') return 'rejected';
  if (selection === 'rejected') return null;
  return 'selected';
}

function getSelectionText(status: Candidate['status'], selection: Candidate['selection']) {
  if (status !== 'Interviewed') return '—';
  if (selection === 'selected') return 'Selected';
  if (selection === 'rejected') return 'Rejected';
  return 'Pending';
}

function getProjectLines(candidate: Candidate | null) {
  if (!candidate?.extracted_projects?.length) return [];
  return candidate.extracted_projects
    .map((project) => {
      const title = String(project?.title || '').trim();
      const description = String(project?.description || '').trim();
      return [title, description].filter(Boolean).join(': ');
    })
    .filter(Boolean);
}

function getJobHiringStatusMeta(hiringStatus: JobDescription['hiring_status']) {
  if (hiringStatus === 'applications_closed') {
    return {
      label: 'Applications Closed',
      style: { background: 'var(--bg-chip-amber)', color: 'var(--text-chip-amber)' } as CSSProperties,
    };
  }
  if (hiringStatus === 'hiring_ended') {
    return {
      label: 'Ended',
      style: { background: 'var(--bg-chip-red)', color: 'var(--text-chip-red)' } as CSSProperties,
    };
  }
  return {
    label: 'Active',
    style: { background: 'var(--bg-chip-green)', color: 'var(--text-chip-grn)' } as CSSProperties,
  };
}

function SelectionBadge({
  status,
  selection,
}: {
  status: string;
  selection?: string | null;
}) {
  if (status !== 'Interviewed') {
    return <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>;
  }

  if (selection === 'selected') {
    return (
      <span
        style={{
          fontSize: '11.5px',
          fontWeight: 500,
          padding: '3px 10px',
          borderRadius: '6px',
          background: '#dcfce7',
          color: '#166534',
        }}
      >
        Selected
      </span>
    );
  }

  if (selection === 'rejected') {
    return (
      <span
        style={{
          fontSize: '11.5px',
          fontWeight: 500,
          padding: '3px 10px',
          borderRadius: '6px',
          background: '#fee2e2',
          color: '#991b1b',
        }}
      >
        Rejected
      </span>
    );
  }

  return (
    <span
      style={{
        fontSize: '11.5px',
        fontWeight: 400,
        padding: '3px 10px',
        borderRadius: '6px',
        background: '#f0f0f0',
        color: '#aaa',
      }}
    >
      Pending
    </span>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: '7px',
        border: '1px solid rgba(0,0,0,0.09)',
        background: '#fff',
        fontSize: '11.5px',
        cursor: 'pointer',
      }}
      type="button"
    >
      {label}
    </button>
  );
}

function PanelSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#999', letterSpacing: '0.08em' }}>{title}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoGridCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#fafafa',
        border: '1px solid rgba(0,0,0,0.05)',
        borderRadius: '12px',
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '13px', color: '#222', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function SkillChip({ label, tone }: { label: string; tone: 'neutral' | 'danger' }) {
  return (
    <span
      style={{
        background: tone === 'danger' ? '#fee2e2' : '#f0f0f0',
        color: tone === 'danger' ? '#991b1b' : '#555',
        fontSize: '11px',
        padding: '4px 9px',
        borderRadius: '999px',
      }}
    >
      {label}
    </span>
  );
}

function BreakdownRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#444' }}>
        <span>{label}</span>
        <span>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: color,
            borderRadius: '999px',
          }}
        />
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg height="13" viewBox="0 0 16 16" width="13" fill="none">
      <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg height="12" viewBox="0 0 16 16" width="12" fill="none">
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg height="13" viewBox="0 0 16 16" width="13" fill="none">
      <path
        d="M11.9 2.6a1.5 1.5 0 1 1 2.1 2.1L6.2 12.5 3 13l.5-3.2L11.9 2.6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg height="13" viewBox="0 0 16 16" width="13" fill="none">
      <path d="M8 10V3.5M5.5 6 8 3.5 10.5 6M3 12.5h10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

function ScreeningIcon() {
  return (
    <svg height="13" viewBox="0 0 16 16" width="13" fill="none">
      <path d="M2.5 10.5c1 0 1-5 2-5s1 7 2 7 1-9 2-9 1 5 2 5 1 2 2 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg height="13" viewBox="0 0 16 16" width="13" fill="none">
      <path d="M5.2 7.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5.6.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM2.8 12.8c0-1.7 1.8-3 4-3s4 1.3 4 3M10 12.4c.3-1.1 1.4-1.9 2.8-1.9 1.5 0 2.7.9 2.9 2.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg height="13" viewBox="0 0 16 16" width="13" fill="none">
      <path d="M2.8 4.2h10.4v7.6H2.8zM3.2 4.6 8 8.2l4.8-3.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg height="13" viewBox="0 0 16 16" width="13" fill="none">
      <path d="M12.8 6.3V3.5h-2.8M3.2 9.7v2.8H6M4.3 6.1a4.5 4.5 0 0 1 7.7-1.1l.8.9M11.7 9.9a4.5 4.5 0 0 1-7.7 1.1l-.8-.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg height="13" viewBox="0 0 16 16" width="13" fill="none">
      <path d="M5 2.8h4.2l2.3 2.3v8.1H5zM9.2 2.8V5h2.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg height="13" viewBox="0 0 16 16" width="13" fill="none">
      <path d="M2.8 4h10.4M4.8 8h6.4M6.5 12h3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

function SuccessCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.2 6.7 11.4 12.5 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M20 10h18l10 10v34H20z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      <path d="M38 10v10h10M25 31h18M25 39h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}

function UploadCloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none">
      <path d="M12 29.5h16a6 6 0 0 0 1.2-11.9A8.5 8.5 0 0 0 13 15.5a5.5 5.5 0 0 0-1 10.9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M20 25V16.5M16.8 19.8 20 16.5l3.2 3.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
