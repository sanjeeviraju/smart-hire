import { CheckCheck, Clock3, FileCheck2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import BrandMark from '../components/brand/BrandMark';

function formatDuration(totalSeconds?: number) {
  const safe = Math.max(0, totalSeconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export default function InterviewCompletePage() {
  const location = useLocation();
  const { candidateName, jobTitle, answeredCount, timeTaken } =
    (location.state as {
      candidateName?: string;
      jobTitle?: string;
      answeredCount?: number;
      timeTaken?: number;
    } | null) || {};

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(20,184,166,0.14), transparent 26%), radial-gradient(circle at bottom right, rgba(249,115,22,0.14), transparent 24%), linear-gradient(135deg, #f4fbf7 0%, #eef8f4 55%, #f8f5ef 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          textAlign: 'center',
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(18px)',
          borderRadius: '28px',
          padding: '38px 32px',
          border: '1px solid rgba(21,35,29,0.08)',
          boxSizing: 'border-box',
          boxShadow: '0 24px 70px rgba(15, 23, 42, 0.10)',
        }}
      >
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, #0f766e, #f97316)',
            margin: '0 auto 18px',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
          }}
        >
          <BrandMark size={30} />
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: '#dff7ee',
            color: '#166543',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <CheckCheck size={14} />
          Interview Submitted
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: '34px',
            lineHeight: 1,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: '#15231d',
          }}
        >
          You&apos;re all set.
        </h1>

        <p
          style={{
            margin: '16px auto 0',
            maxWidth: '430px',
            fontSize: '14px',
            color: '#557266',
            lineHeight: 1.8,
          }}
        >
          Thank you for completing the interview{candidateName ? `, ${candidateName}` : ''}. Your responses have been
          submitted and are ready for HR review.
        </p>

        <div
          style={{
            marginTop: '26px',
            display: 'grid',
            gap: '12px',
            textAlign: 'left',
          }}
        >
          <SummaryCard icon={<FileCheck2 size={18} />} label="Position" value={jobTitle || '-'} />
          <SummaryCard icon={<CheckCheck size={18} />} label="Questions answered" value={`${answeredCount ?? 10} / 10`} />
          <SummaryCard icon={<Clock3 size={18} />} label="Time taken" value={formatDuration(timeTaken)} />
        </div>

        <p
          style={{
            margin: '20px 0 0',
            fontSize: '12px',
            color: '#7a9187',
            lineHeight: 1.7,
          }}
        >
          The HR team will review your results and contact you with the next steps. You can close this window now.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '16px',
        borderRadius: '18px',
        background: 'rgba(255,255,255,0.76)',
        border: '1px solid rgba(21,35,29,0.08)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '14px',
          background: '#edf7f3',
          color: '#0f766e',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', color: '#7a9187', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ marginTop: '4px', fontSize: '14px', color: '#15231d', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}
