import { EllipsisVertical, FileText, PencilLine, RotateCcw, Trash2, UserRoundX, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { JobDescription } from '../../types';

type JobDisplayProps = {
  jds: JobDescription[];
  onOpenJD: (jdId: number) => void;
  onCreateJD: () => void;
  onDeleteJD: (jdId: number) => void;
  onEditJD: (job: JobDescription) => void;
  onCloseApplications: (jdId: number) => void;
  onEndHiring: (jdId: number) => void;
  onReopenJob: (jdId: number) => void;
};

const CSS = `
  .jd-card {
    background: var(--bg-card);
    border: 1px solid var(--border-card);
    border-radius: 18px;
    padding: 18px;
  }

  .jd-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 16px;
  }

  .jd-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .jd-create {
    border: 0;
    background: var(--bg-dark-btn);
    color: var(--text-dark-btn);
    border-radius: 12px;
    padding: 11px 15px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }

  .jd-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 14px;
  }

  .jd-item,
  .jd-add {
    position: relative;
    border-radius: 18px;
    padding: 16px;
    box-sizing: border-box;
    min-height: 196px;
  }

  .jd-item {
    background: linear-gradient(180deg, var(--bg-muted), var(--bg-card));
    border: 1px solid var(--border-card);
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  }

  .jd-item:hover {
    background: var(--bg-card-hover);
    border-color: var(--border-strong);
    transform: translateY(-2px);
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.07);
  }

  .jd-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }

  .jd-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--bg-chip-gray);
    display: grid;
    place-items: center;
    color: var(--text-primary);
    flex-shrink: 0;
  }

  .jd-menu-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .jd-menu-btn {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1px solid var(--border-card);
    background: linear-gradient(180deg, rgba(23, 78, 71, 0.45), rgba(14, 56, 52, 0.55));
    color: #d8f5e8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }

  .jd-menu-btn:hover {
    background: linear-gradient(180deg, rgba(30, 97, 88, 0.52), rgba(18, 70, 64, 0.65));
    border-color: rgba(121, 216, 183, 0.45);
    color: #ecfff7;
  }

  .jd-menu-btn:focus-visible {
    outline: 2px solid rgba(121, 216, 183, 0.65);
    outline-offset: 2px;
  }

  .jd-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 188px;
    border-radius: 14px;
    border: 1px solid var(--border-card);
    background: var(--bg-card);
    box-shadow: 0 18px 34px rgba(15, 23, 42, 0.14);
    padding: 8px;
    z-index: 20;
  }

  .jd-menu-item {
    width: 100%;
    border: 0;
    background: transparent;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 11px;
    text-align: left;
    color: var(--text-secondary);
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .jd-menu-item:hover {
    background: var(--bg-card-hover);
    color: var(--text-primary);
  }

  .jd-menu-item:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .jd-menu-item.is-danger {
    color: var(--score-red);
  }

  .jd-name {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.5;
    margin-bottom: 6px;
    color: var(--text-primary);
  }

  .jd-dept {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 14px;
  }

  .jd-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .jd-badge {
    font-size: 10.5px;
    border-radius: 999px;
    padding: 5px 9px;
    display: inline-flex;
    align-items: center;
    font-weight: 700;
  }

  .jd-badge.gray { background: var(--bg-chip-gray); color: var(--text-chip-gray); }
  .jd-badge.blue { background: var(--bg-chip-blue); color: var(--text-chip-blue); }
  .jd-badge.green { background: var(--bg-chip-green); color: var(--text-chip-grn); }
  .jd-badge.amber { background: var(--bg-chip-amber); color: var(--text-chip-amber); }
  .jd-badge.red { background: var(--bg-chip-red); color: var(--text-chip-red); }

  .jd-add {
    border: 1px dashed var(--border-dashed);
    background: transparent;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
  }
`;

export default function JobDisplay({
  jds,
  onOpenJD,
  onCreateJD,
  onDeleteJD,
  onEditJD,
  onCloseApplications,
  onEndHiring,
  onReopenJob,
}: JobDisplayProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div className="jd-card">
      <style>{CSS}</style>

      <div className="jd-head">
        <h2 className="jd-title">Job Display</h2>
        <button className="jd-create" onClick={onCreateJD} type="button">
          + Create JD
        </button>
      </div>

      <div className="jd-grid">
        {jds.map((jd) => {
          const isMenuOpen = openMenuId === jd.id;
          const statusMeta = getHiringStatusMeta(jd.hiring_status);

          return (
            <div
              className="jd-item"
              key={jd.id}
              onClick={() => onOpenJD(jd.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onOpenJD(jd.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="jd-top">
                <div className="jd-icon">
                  <FileText size={18} strokeWidth={2} />
                </div>

                <div className="jd-menu-wrap" ref={isMenuOpen ? menuRef : null}>
                  <button
                    className="jd-menu-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuId(isMenuOpen ? null : jd.id);
                    }}
                    type="button"
                    aria-label="Job actions"
                  >
                    <EllipsisVertical size={16} strokeWidth={2} />
                  </button>

                  {isMenuOpen && (
                    <div className="jd-menu" onClick={(event) => event.stopPropagation()}>
                      <button
                        className="jd-menu-item"
                        onClick={() => {
                          setOpenMenuId(null);
                          onEditJD(jd);
                        }}
                        type="button"
                      >
                        <PencilLine size={15} strokeWidth={2} />
                        Edit job
                      </button>
                      <button
                        className="jd-menu-item"
                        disabled={jd.hiring_status !== 'active'}
                        onClick={() => {
                          setOpenMenuId(null);
                          onCloseApplications(jd.id);
                        }}
                        type="button"
                      >
                        <UserRoundX size={15} strokeWidth={2} />
                        Close application
                      </button>
                      <button
                        className="jd-menu-item"
                        disabled={jd.hiring_status === 'hiring_ended'}
                        onClick={() => {
                          setOpenMenuId(null);
                          onEndHiring(jd.id);
                        }}
                        type="button"
                      >
                        <XCircle size={15} strokeWidth={2} />
                        End job
                      </button>
                      {jd.hiring_status === 'applications_closed' && (
                        <button
                          className="jd-menu-item"
                          onClick={() => {
                            setOpenMenuId(null);
                            onReopenJob(jd.id);
                          }}
                          type="button"
                        >
                          <RotateCcw size={15} strokeWidth={2} />
                          Reopen job
                        </button>
                      )}
                      <button
                        className="jd-menu-item is-danger"
                        onClick={() => {
                          setOpenMenuId(null);
                          if (window.confirm('Delete this JD?')) {
                            onDeleteJD(jd.id);
                          }
                        }}
                        type="button"
                      >
                        <Trash2 size={15} strokeWidth={2} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="jd-name">{jd.title}</div>
              <div className="jd-dept">{jd.department || 'General'}</div>
              <div className="jd-badges">
                <span className="jd-badge gray">Threshold: {jd.screening_threshold}</span>
                <span className="jd-badge blue">{jd.candidate_count || 0} resumes</span>
                <span className={`jd-badge ${statusMeta.tone}`}>{statusMeta.label}</span>
              </div>
            </div>
          );
        })}

        <button className="jd-add" onClick={onCreateJD} type="button">
          <span>+ New Job Description</span>
        </button>
      </div>
    </div>
  );
}

function getHiringStatusMeta(hiringStatus: JobDescription['hiring_status']) {
  switch (hiringStatus) {
    case 'applications_closed':
      return { label: 'Applications Closed', tone: 'amber' };
    case 'hiring_ended':
      return { label: 'Ended', tone: 'red' };
    default:
      return { label: 'Active', tone: 'green' };
  }
}
