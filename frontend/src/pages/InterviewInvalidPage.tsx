import { AlertTriangle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import BrandMark from '../components/brand/BrandMark';

export default function InterviewInvalidPage() {
  const location = useLocation();
  const message = (location.state as { message?: string } | undefined)?.message;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'radial-gradient(circle at top left, rgba(239,68,68,0.10), transparent 24%), radial-gradient(circle at bottom right, rgba(249,115,22,0.10), transparent 24%), linear-gradient(135deg, #fbf7f5 0%, #f8f4ef 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '28px',
          background: 'rgba(255,255,255,0.84)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(21,35,29,0.08)',
          boxShadow: '0 24px 70px rgba(15, 23, 42, 0.10)',
          padding: '34px 30px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '62px',
            height: '62px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #0f766e, #f97316)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 18px',
          }}
        >
          <BrandMark size={26} />
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: '#fff1ed',
            color: '#b93815',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '18px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          <AlertTriangle size={14} />
          Link unavailable
        </div>

        <h1 style={{ margin: 0, fontSize: '30px', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.04em', color: '#15231d' }}>
          This interview link can&apos;t be used.
        </h1>

        <p style={{ margin: '16px 0 0', fontSize: '14px', lineHeight: 1.8, color: '#557266' }}>
          {message || 'This interview link is invalid or expired. Please contact the HR team to request a fresh invitation.'}
        </p>

        <Link
          to="/"
          style={{
            marginTop: '24px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '13px 18px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0f766e, #115e59)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 700,
            minWidth: '190px',
          }}
        >
          Go to HR Login
        </Link>
      </div>
    </div>
  );
}
