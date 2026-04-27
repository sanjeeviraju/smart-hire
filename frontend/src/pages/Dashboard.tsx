import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getCurrentHRUser } from '../api/auth';
import { getDashboardStats } from '../api/dashboard';
import { deleteJD, getJDs, updateJDHiringStatus } from '../api/jd';
import AppShell from '../components/layout/AppShell';
import { useAuthStore } from '../store/authStore';
import type { DashboardStats, JobDescription, JobHiringStatus } from '../types';
import CreateJD from './dashboard/CreateJD';
import CandidateInterviewDetailPage from './CandidateInterviewDetailPage';
import DashboardHome from './dashboard/DashboardHome';
import InterviewResults from './dashboard/InterviewResults';
import JDDetail from './dashboard/JDDetail';
import JobDisplay from './dashboard/JobDisplay';

export type ActivePage = 'dashboard' | 'jobs' | 'jd-detail' | 'create-jd' | 'jd-results' | 'candidate-interview-detail';

const EMPTY_STATS: DashboardStats = {
  total_jds: 0,
  total_candidates: 0,
  screened: 0,
  interviews_sent: 0,
  interviewed: 0,
};

const CSS = `
  .db-toast {
    margin-bottom: 12px;
    background: rgba(17,17,17,0.9);
    color: #fff;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 12.5px;
    display: inline-flex;
    align-items: center;
  }

  .db-error {
    margin-bottom: 12px;
    color: #dc2626;
    font-size: 12.5px;
  }
`;

export default function Dashboard() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [activeJdId, setActiveJdId] = useState<number | null>(null);
  const [activeCandidateId, setActiveCandidateId] = useState<number | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [editingJob, setEditingJob] = useState<JobDescription | null>(null);
  const [userFullName, setUserFullName] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [statsData, jdsData, user] = await Promise.all([
          getDashboardStats(),
          getJDs(),
          getCurrentHRUser(),
        ]);
        if (!ignore) {
          setStats(statsData);
          setJds(jdsData);
          setUserFullName(user.full_name);
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to load dashboard');
        }
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      logout();
      navigate('/', { replace: true });
    }

    window.addEventListener('smarthiring:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('smarthiring:unauthorized', handleUnauthorized);
    };
  }, [logout, navigate]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function refreshDashboard() {
    const [statsData, jdsData] = await Promise.all([getDashboardStats(), getJDs()]);
    setStats(statsData);
    setJds(jdsData);
  }

  function handleNavigate(page: ActivePage, jdId?: number, candidateId?: number) {
    setActivePage(page);
    if (page !== 'create-jd') {
      setEditingJob(null);
    }
    if (typeof jdId === 'number') {
      setActiveJdId(jdId);
    }
    if (typeof candidateId === 'number') {
      setActiveCandidateId(candidateId);
    }
  }

  async function handleDeleteJD(jdId: number) {
    try {
      await deleteJD(jdId);
      await refreshDashboard();
      if (activeJdId === jdId) {
        setActiveJdId(null);
        setActivePage('jobs');
      }
      setToast('Job description deleted.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to delete job description');
    }
  }

  function handleEditJD(job: JobDescription) {
    setEditingJob(job);
    setActiveJdId(job.id);
    setActivePage('create-jd');
  }

  async function handleUpdateJDHiringStatus(jdId: number, hiringStatus: JobHiringStatus) {
    try {
      await updateJDHiringStatus(jdId, hiringStatus);
      await refreshDashboard();
      const statusMessage = {
        active: 'Job reopened.',
        applications_closed: 'Applications closed for this job.',
        hiring_ended: 'Hiring marked as ended.',
      }[hiringStatus];
      setToast(statusMessage);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update job status');
    }
  }

  function handleLogout() {
    localStorage.removeItem('access_token');
    logout();
    navigate('/', { replace: true });
  }

  return (
    <AppShell activeJdId={activeJdId} activePage={activePage} jds={jds} onLogout={handleLogout} onNavigate={handleNavigate} userFullName={userFullName}>
      <style>{CSS}</style>
      {toast && <div className="db-toast">{toast}</div>}
      {error && <div className="db-error">{error}</div>}

      {activePage === 'dashboard' && <DashboardHome jds={jds} onNavigate={handleNavigate} stats={stats} />}

      {activePage === 'jobs' && (
        <JobDisplay
          jds={jds}
          onCloseApplications={(jdId) => void handleUpdateJDHiringStatus(jdId, 'applications_closed')}
          onCreateJD={() => {
            setEditingJob(null);
            handleNavigate('create-jd');
          }}
          onDeleteJD={handleDeleteJD}
          onEditJD={handleEditJD}
          onEndHiring={(jdId) => void handleUpdateJDHiringStatus(jdId, 'hiring_ended')}
          onReopenJob={(jdId) => void handleUpdateJDHiringStatus(jdId, 'active')}
          onOpenJD={(jdId) => handleNavigate('jd-detail', jdId)}
        />
      )}

      {activePage === 'create-jd' && (
        <CreateJD
          onBack={() => handleNavigate('jobs')}
          initialJob={editingJob}
          onSuccess={async (job) => {
            await refreshDashboard();
            setEditingJob(null);
            setActiveJdId(job.id);
            setActivePage('jobs');
            setToast(editingJob ? 'Job description updated.' : 'Job description created.');
          }}
        />
      )}

      {activePage === 'jd-detail' && <JDDetail jdId={activeJdId} onBack={() => handleNavigate('jobs')} onNavigate={handleNavigate} onRefresh={refreshDashboard} />}

      {activePage === 'jd-results' && <InterviewResults jdId={activeJdId} onBack={() => handleNavigate('jd-detail', activeJdId || undefined)} />}

      {activePage === 'candidate-interview-detail' && (
        <CandidateInterviewDetailPage
          candidateId={activeCandidateId}
          onBack={() => handleNavigate('jd-detail', activeJdId || undefined)}
        />
      )}
    </AppShell>
  );
}
