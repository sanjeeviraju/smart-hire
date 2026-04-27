import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';

import { api } from '../api/client';
import { CandidateInterviewDetail, InterviewAnswerDetail } from '../types';

type Props = {
  candidateId?: number | null;
  onBack?: () => void;
};

export default function CandidateInterviewDetailPage({ candidateId: propCandidateId, onBack }: Props) {
  const params = useParams();
  const candidateId = propCandidateId ?? Number(params.id);

  const [data, setData] = useState<CandidateInterviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeAnswer, setActiveAnswer] = useState<InterviewAnswerDetail | null>(null);

  useEffect(() => {
    if (!candidateId) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<CandidateInterviewDetail>(`/dashboard/candidate/${candidateId}/interview`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load interview detail');
    } finally {
      setLoading(false);
    }
  }

  const recommendationTone = useMemo(() => getRecommendationTone(data?.total_score), [data?.total_score]);
  const proctoring = data?.ai_analysis?.proctoring;
  const proctorEvents = proctoring?.events || [];

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f5f5f5',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '22px 24px 18px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: '#f5f5f5',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <button
              type="button"
              onClick={onBack}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                marginBottom: '10px',
                cursor: onBack ? 'pointer' : 'default',
                fontSize: '12px',
                color: '#777',
              }}
            >
              ← Back to candidates
            </button>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#111' }}>
              {data?.candidate_name || 'Candidate Interview Detail'}
            </div>
            <div style={{ marginTop: '6px', fontSize: '14px', color: '#777' }}>
              {data?.job_title || '-'} · {data?.email || '-'}
            </div>
          </div>
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              background: recommendationTone.bg,
              color: recommendationTone.color,
              fontSize: '12px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {recommendationTone.label}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 28px' }}>
        {error && (
          <div style={errorCardStyle}>
            {error}
          </div>
        )}
        {loading && (
          <div style={loadingCardStyle}>
            Loading interview details...
          </div>
        )}

        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                gap: '10px',
              }}
            >
              <MetricCard label="Overall" score={data.total_score} color="#111" weight="100%" />
              <MetricCard label="Technical" score={data.technical_score} color="#1e40af" weight="35%" />
              <MetricCard label="Communication" score={data.communication_score} color="#5b21b6" weight="25%" />
              <MetricCard label="Behavioral" score={data.behavioral_score} color="#92400e" weight="25%" />
              <MetricCard label="Confidence" score={data.confidence_score} color="#166534" weight="15%" />
            </section>

            <section style={whiteCardStyle}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#111', marginBottom: '14px' }}>AI Analysis</div>
              <p style={{ margin: 0, fontSize: '14px', color: '#555', lineHeight: 1.8 }}>
                {data.ai_analysis?.narrative_analysis || 'No narrative summary available.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                <InsightList
                  title="Top Strengths"
                  items={data.ai_analysis?.key_strengths || []}
                  background="#f0fdf4"
                  border="#bbf7d0"
                  textColor="#166534"
                />
                <InsightList
                  title="Top Concerns"
                  items={data.ai_analysis?.key_concerns || []}
                  background="#fef2f2"
                  border="#fecaca"
                  textColor="#b91c1c"
                />
              </div>

              <DetailStrip label="Cultural fit" value={data.ai_analysis?.cultural_fit_assessment || '-'} />
              <DetailStrip label="Hire reason" value={data.ai_analysis?.hire_recommendation_reason || '-'} />
            </section>

            <section style={whiteCardStyle}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#111', marginBottom: '14px' }}>Question breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.answers.map((answer) => (
                  <QuestionCard key={answer.question_index} answer={answer} onPlay={() => setActiveAnswer(answer)} />
                ))}
                {data.answers.length === 0 && <div style={{ color: '#888', fontSize: '13px' }}>No answers available.</div>}
              </div>
            </section>

            <section style={whiteCardStyle}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#111', marginBottom: '14px' }}>Proctoring Report</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <SummaryPill label="Total warnings" value={`${proctoring?.warnings ?? 0}/4`} />
                <SummaryPill label="Terminated" value={proctoring?.terminated ? 'Yes' : 'No'} tone={proctoring?.terminated ? 'danger' : 'neutral'} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {proctorEvents.length === 0 && (
                  <div style={{ fontSize: '13px', color: '#888' }}>No proctoring events recorded.</div>
                )}
                {proctorEvents.map((event, index) => {
                  const terminated = (event.reasons || []).some((reason) => reason?.toLowerCase().includes('terminate'));
                  return (
                    <div
                      key={`${event.timestamp || 'event'}-${index}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: terminated ? '#fef2f2' : '#fffbeb',
                        border: `1px solid ${terminated ? '#fecaca' : '#fde68a'}`,
                      }}
                    >
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: terminated ? '#fee2e2' : '#fef3c7',
                          color: terminated ? '#b91c1c' : '#92400e',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        !
                      </span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111' }}>
                          {(event.reasons || []).map(formatReason).join(', ') || 'Security event'}
                        </div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#777' }}>
                          {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Timestamp unavailable'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      {activeAnswer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setActiveAnswer(null);
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '700px',
              background: '#111',
              borderRadius: '18px',
              padding: '18px',
              color: '#fff',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>
                Q{activeAnswer.question_index} review
              </div>
              <button
                type="button"
                onClick={() => setActiveAnswer(null)}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                ×
              </button>
            </div>

            {activeAnswer.video_url || activeAnswer.audio_url ? (
              <video
                src={activeAnswer.video_url || activeAnswer.audio_url || undefined}
                controls
                autoPlay
                style={{
                  width: '100%',
                  maxWidth: '560px',
                  borderRadius: '12px',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
            ) : (
              <div style={{ padding: '28px', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', textAlign: 'center' }}>
                No media available for this answer.
              </div>
            )}

            <div style={{ marginTop: '14px', fontSize: '14px', lineHeight: 1.7, color: 'rgba(255,255,255,0.84)' }}>
              {activeAnswer.question_text}
            </div>
            <div style={{ marginTop: '10px', display: 'inline-flex', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', fontSize: '12px', fontWeight: 700 }}>
              Score {activeAnswer.score != null ? activeAnswer.score.toFixed(1) : '-'}/10
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  score,
  color,
  weight,
}: {
  label: string;
  score: number | null;
  color: string;
  weight: string;
}) {
  return (
    <div
      style={{
        background: '#f8f8f8',
        borderRadius: '10px',
        padding: '12px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 600, color }}>{score != null ? score.toFixed(1) : '-'}</div>
      <div style={{ marginTop: '4px', fontSize: '10px', color: '#aaa' }}>{weight}</div>
    </div>
  );
}

function InsightList({
  title,
  items,
  background,
  border,
  textColor,
}: {
  title: string;
  items: string[];
  background: string;
  border: string;
  textColor: string;
}) {
  return (
    <div
      style={{
        background,
        border: `1px solid ${border}`,
        borderRadius: '12px',
        padding: '14px',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, color: textColor, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(items.slice(0, 4).length ? items.slice(0, 4) : ['None noted']).map((item) => (
          <div key={item} style={{ fontSize: '13px', color: textColor, lineHeight: 1.6 }}>
            • {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailStrip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        marginTop: '12px',
        background: '#f8f8f8',
        borderRadius: '10px',
        padding: '12px 14px',
        fontSize: '13px',
        color: '#444',
        lineHeight: 1.7,
      }}
    >
      <strong style={{ color: '#111' }}>{label}:</strong> {value}
    </div>
  );
}

function QuestionCard({
  answer,
  onPlay,
}: {
  answer: InterviewAnswerDetail;
  onPlay: () => void;
}) {
  const scoreTone = getScoreTone(answer.score);
  const typeTone = getQuestionTypeTone(answer.question_type);
  return (
    <article
      style={{
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '14px',
        padding: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#111', background: '#f3f4f6', borderRadius: '999px', padding: '4px 8px' }}>
            Q{answer.question_index}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: typeTone.color,
              background: typeTone.bg,
              borderRadius: '999px',
              padding: '4px 8px',
            }}
          >
            {formatQuestionType(answer.question_type)}
          </span>
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#111', lineHeight: 1.6 }}>{answer.question_text}</div>
        <div style={{ marginTop: '10px', background: '#f8f8f8', borderRadius: '10px', padding: '12px', fontSize: '13px', color: '#555', lineHeight: 1.7 }}>
          {answer.answer_text || 'No answer text stored.'}
        </div>
        <div style={{ marginTop: '10px', fontSize: '13px', color: '#666', lineHeight: 1.7 }}>
          <strong style={{ color: '#111' }}>AI feedback:</strong> {answer.ai_feedback?.feedback_text || 'No feedback available.'}
        </div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#666' }}>
          <span>Communication rating: {renderStars(answer.ai_feedback?.communication_rating)}</span>
          <span>Technical rating: {renderStars(answer.ai_feedback?.technical_accuracy_rating)}</span>
        </div>
      </div>
      <div style={{ flexShrink: 0, width: '120px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            width: '86px',
            height: '86px',
            borderRadius: '50%',
            border: `6px solid ${scoreTone.ring}`,
            color: scoreTone.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            fontSize: '20px',
            fontWeight: 700,
            background: '#fff',
          }}
        >
          {answer.score != null ? answer.score.toFixed(1) : '-'}
        </div>
        <button
          type="button"
          onClick={onPlay}
          style={{
            border: 'none',
            borderRadius: '12px',
            background: '#111',
            color: '#fff',
            padding: '0',
            minHeight: '82px',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: '22px' }}>▶</span>
            Play response
          </span>
        </button>
      </div>
    </article>
  );
}

function SummaryPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div
      style={{
        background: tone === 'danger' ? '#fef2f2' : '#f8f8f8',
        border: `1px solid ${tone === 'danger' ? '#fecaca' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '999px',
        padding: '8px 12px',
        display: 'inline-flex',
        gap: '8px',
        fontSize: '12px',
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#999', fontWeight: 600 }}>{label}</span>
      <span style={{ color: tone === 'danger' ? '#b91c1c' : '#111', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function formatQuestionType(type: string) {
  if (!type) return 'General';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getQuestionTypeTone(type: string) {
  switch (type?.toLowerCase()) {
    case 'technical':
      return { bg: '#dbeafe', color: '#1e40af' };
    case 'project':
      return { bg: '#ede9fe', color: '#5b21b6' };
    case 'scenario':
      return { bg: '#fef3c7', color: '#92400e' };
    case 'behavioral':
      return { bg: '#dcfce7', color: '#166534' };
    case 'personality':
      return { bg: '#fce7f3', color: '#9d174d' };
    default:
      return { bg: '#f3f4f6', color: '#555' };
  }
}

function getScoreTone(score: number | null) {
  if ((score || 0) >= 8) return { ring: '#86efac', color: '#166534' };
  if ((score || 0) >= 6) return { ring: '#93c5fd', color: '#1e40af' };
  return { ring: '#fcd34d', color: '#92400e' };
}

function getRecommendationTone(score: number | null | undefined) {
  if ((score || 0) >= 85) return { label: 'Highly Recommended', bg: '#dcfce7', color: '#166534' };
  if ((score || 0) >= 70) return { label: 'Recommended', bg: '#dbeafe', color: '#1e40af' };
  if ((score || 0) >= 55) return { label: 'Neutral', bg: '#fef3c7', color: '#92400e' };
  return { label: 'Not Recommended', bg: '#fee2e2', color: '#991b1b' };
}

function formatReason(reason: string) {
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderStars(value?: number) {
  const count = Math.max(0, Math.min(5, value || 0));
  return `${'★'.repeat(count)}${'☆'.repeat(5 - count)}`;
}

const whiteCardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '16px',
  border: '1px solid rgba(0,0,0,0.07)',
  padding: '18px',
};

const loadingCardStyle: CSSProperties = {
  ...whiteCardStyle,
  color: '#666',
  fontSize: '14px',
};

const errorCardStyle: CSSProperties = {
  ...whiteCardStyle,
  color: '#b91c1c',
  background: '#fff7f7',
  border: '1px solid #fecaca',
  fontSize: '14px',
};
