import { useEffect } from 'react';

import { useTheme } from '../context/ThemeContext';
import type { CandidateDetail, CandidateStatus } from '../types';
import { formatExp } from '../utils/formatters';

type CandidateModalProps = {
  candidate: CandidateDetail;
  onClose: () => void;
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  .cm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
    box-sizing: border-box;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .cm-card {
    background: var(--bg-modal);
    border-radius: 16px;
    width: min(560px, 100%);
    max-height: 88vh;
    overflow-y: auto;
    box-shadow: 0 8px 48px rgba(0,0,0,0.14);
    scroll-behavior: smooth;
  }

  .cm-head {
    position: sticky;
    top: 0;
    background: var(--bg-modal);
    border-bottom: 1px solid var(--border-divider);
    padding: 22px 24px 16px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    z-index: 1;
  }

  .cm-head-left {
    display: flex;
    align-items: flex-start;
  }

  .cm-avatar {
    width: 48px;
    height: 48px;
    background: var(--bg-tag-dark);
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--text-tag-dark);
    font-size: 18px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .cm-name-wrap {
    margin-left: 14px;
  }

  .cm-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .cm-sub {
    margin-top: 4px;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
    word-break: break-word;
  }

  .cm-close {
    width: 30px;
    height: 30px;
    border: 1px solid var(--border-input);
    border-radius: 7px;
    background: var(--bg-action-btn);
    display: grid;
    place-items: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .cm-body {
    padding: 20px 24px 24px;
  }

  .cm-section + .cm-section {
    margin-top: 22px;
  }

  .cm-section-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .cm-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .cm-cell,
  .cm-score-box,
  .cm-projects {
    background: var(--bg-muted);
    border-radius: 9px;
    padding: 11px 14px;
  }

  .cm-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 6px;
  }

  .cm-value {
    font-size: 14px;
    color: var(--text-primary);
  }

  .cm-score-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .cm-score-box {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cm-score {
    font-size: 28px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .cm-score-label {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .cm-overall-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    background: var(--bg-muted);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 12px;
  }

  .cm-overall-status {
    font-size: 12px;
    font-weight: 600;
  }

  .cm-bar-label {
    width: 84px;
    flex-shrink: 0;
    font-size: 12.5px;
    color: var(--text-secondary);
  }

  .cm-bar-track {
    flex: 1;
    height: 6px;
    background: var(--bg-chip-gray);
    border-radius: 99px;
    overflow: hidden;
  }

  .cm-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.6s ease;
  }

  .cm-bar-value {
    width: 42px;
    text-align: right;
    font-size: 12px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .cm-muted {
    font-size: 13px;
    color: var(--text-muted);
  }

  .cm-badge {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
  }

  .cm-skills {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .cm-chip {
    background: var(--bg-chip-gray);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
  }

  .cm-chip-green {
    background: var(--bg-chip-green);
    color: var(--text-chip-grn);
  }

  .cm-chip-red {
    background: var(--bg-chip-red);
    color: var(--text-chip-red);
  }

  .cm-projects {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .cm-download {
    width: 100%;
    border: 0;
    border-radius: 10px;
    background: var(--bg-dark-btn);
    color: var(--text-dark-btn);
    padding: 12px 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    box-sizing: border-box;
  }

  @media (max-width: 640px) {
    .cm-grid,
    .cm-score-row {
      grid-template-columns: 1fr;
    }
  }
`;

export default function CandidateModal({ candidate, onClose }: CandidateModalProps) {
  const { theme } = useTheme();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const displayName = candidate.full_name?.trim() || candidate.email;
  const initials = getInitials(candidate.full_name);
  const skills = candidate.skills || [];
  const formattedEducation = formatEducation(candidate.education_level);
  const expDisplay = formatExp(candidate.years_of_experience);
  const isFresher = expDisplay === 'Fresher';

  return (
    <div
      className="cm-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <style>{CSS}</style>
      <div className="cm-card">
        <div className="cm-head">
          <div className="cm-head-left">
            <div className="cm-avatar">{initials}</div>
            <div className="cm-name-wrap">
              <h3 className="cm-name">{displayName}</h3>
              <div className="cm-sub">
                {candidate.email}
                {candidate.phone ? ` · ${candidate.phone}` : ''}
              </div>
            </div>
          </div>

          <button className="cm-close" onClick={onClose} type="button" aria-label="Close candidate modal">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="cm-body">
          <section className="cm-section">
            <h4 className="cm-section-title">Overview</h4>
            <div className="cm-grid">
              <div className="cm-cell">
                <div className="cm-label">Status</div>
                <div className="cm-value">
                  <span className="cm-badge" style={statusStyle(candidate.status)}>
                    {candidate.status}
                  </span>
                </div>
              </div>
              <div className="cm-cell">
                <div className="cm-label">Experience</div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: isFresher ? 400 : 600,
                    color: isFresher ? 'var(--text-hint)' : 'var(--text-primary)',
                    fontStyle: isFresher ? 'italic' : 'normal',
                  }}
                >
                  {expDisplay}
                </div>
              </div>
              <div className="cm-cell">
                <div className="cm-label">Education</div>
                <div className="cm-value">{formattedEducation}</div>
              </div>
              <div className="cm-cell">
                <div className="cm-label">Phone</div>
                <div className="cm-value">{candidate.phone || '—'}</div>
              </div>
            </div>
          </section>

          <section className="cm-section">
            <h4 className="cm-section-title">Screening scores</h4>
            {candidate.resume_score && candidate.status !== 'Uploaded' ? (
              <>
                <div className="cm-overall-wrap">
                  <div>
                    <div className="cm-label">Overall score</div>
                    <div className="cm-score" style={{ color: scoreColor(candidate.resume_score.overall_score) }}>
                      {candidate.resume_score.overall_score.toFixed(1)}
                    </div>
                    <div className="cm-overall-status" style={{ color: candidate.resume_score.passed ? 'var(--score-green)' : 'var(--score-red)' }}>
                      {candidate.resume_score.passed ? 'PASSED ✓' : 'FAILED ✗'}
                    </div>
                  </div>
                </div>

                <div className="cm-score-row">
                  <ScoreBar label="Skills" value={candidate.resume_score.skill_score} />
                  <ScoreBar label="Experience" value={candidate.resume_score.exp_score} />
                  <ScoreBar label="Education" value={candidate.resume_score.edu_score} />
                  <ScoreBar label="Projects" value={candidate.resume_score.project_score} />
                </div>

                <div className="cm-section" style={{ marginTop: '14px' }}>
                  <h4 className="cm-section-title">Matched skills</h4>
                  {candidate.resume_score.matched_skills.length === 0 ? (
                    <div className="cm-muted">No matched skills found</div>
                  ) : (
                    <div className="cm-skills">
                      {candidate.resume_score.matched_skills.map((skill) => (
                        <span className="cm-chip cm-chip-green" key={skill}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="cm-section" style={{ marginTop: '14px' }}>
                  <h4 className="cm-section-title">Missing skills</h4>
                  {candidate.resume_score.missing_skills.length === 0 ? (
                    <div className="cm-muted">No missing skills</div>
                  ) : (
                    <div className="cm-skills">
                      {candidate.resume_score.missing_skills.map((skill) => (
                        <span className="cm-chip cm-chip-red" key={skill}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="cm-muted">Scores available after screening</div>
            )}
          </section>

          <section className="cm-section">
            <h4 className="cm-section-title">Skills</h4>
            {skills.length === 0 ? (
              <div className="cm-muted">No skills extracted</div>
            ) : (
              <div className="cm-skills">
                {skills.map((skill) => (
                  <span className="cm-chip" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="cm-section">
            <h4 className="cm-section-title">Projects</h4>
            {candidate.projects ? <div className="cm-projects">{candidate.projects}</div> : <div className="cm-muted">No project information extracted</div>}
          </section>

          <section className="cm-section">
            <h4 className="cm-section-title">Resume</h4>
            {candidate.resume_url ? (
              <a
                className="cm-download"
                href={candidate.resume_url}
                style={{
                  background: theme === 'dark' ? '#ffffff' : '#111111',
                  color: theme === 'dark' ? '#111111' : '#ffffff',
                }}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2.5v7M5.5 7.5 8 10l2.5-2.5M3 12.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Resume PDF
              </a>
            ) : (
              <div className="cm-muted">Resume file not available</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function getInitials(fullName: string) {
  const parts = fullName
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  return parts.slice(0, 2).map((value) => value[0]?.toUpperCase() || '').join('') || '?';
}

function formatEducation(value: string | null) {
  if (!value) return 'Other';
  if (value === 'BACHELOR') return "Bachelor's";
  if (value === 'MASTER') return "Master's";
  if (value === 'PHD') return 'PhD';
  if (value === 'HIGH_SCHOOL') return 'High School';
  if (value === 'OTHER') return 'Other';
  return value;
}

function scoreColor(value: number | null | undefined) {
  if (value == null) return 'var(--text-secondary)';
  if (value >= 70) return 'var(--score-green)';
  if (value >= 50) return 'var(--score-amber)';
  return 'var(--score-red)';
}

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="cm-score-box">
      <div className="cm-bar-label">{label}</div>
      <div className="cm-bar-track">
        <div className="cm-bar-fill" style={{ width: `${value ?? 0}%`, background: scoreColor(value) }} />
      </div>
      <div className="cm-bar-value">{value == null ? '—' : value.toFixed(1)}</div>
    </div>
  );
}

function statusStyle(status: CandidateStatus) {
  switch (status) {
    case 'Uploaded':
      return { background: 'var(--bg-chip-gray)', color: 'var(--text-chip-gray)' };
    case 'Screened':
      return { background: 'var(--bg-chip-blue)', color: 'var(--text-chip-blue)' };
    case 'Shortlisted':
      return { background: 'var(--bg-chip-green)', color: 'var(--text-chip-grn)' };
    case 'Interview Sent':
      return { background: 'var(--bg-chip-amber)', color: 'var(--text-chip-amber)' };
    case 'Interviewed':
      return { background: 'var(--bg-filter-on)', color: 'var(--text-filter-on)' };
    default:
      return { background: 'var(--bg-chip-gray)', color: 'var(--text-chip-gray)' };
  }
}
