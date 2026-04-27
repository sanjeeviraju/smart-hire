import { ArrowRight, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { loginHR } from '../api/auth';
import BrandMark from '../components/brand/BrandMark';
import { useAuthStore } from '../store/authStore';

type Phase = 'landing' | 'leaving' | 'login';

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');

  @keyframes alFadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes alFloat {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }

  @keyframes alSweep {
    from { width: 0; }
    to { width: 100%; }
  }

  .al-scene {
    min-height: 100vh;
    background:
      radial-gradient(circle at 15% 20%, rgba(20, 184, 166, 0.22), transparent 26%),
      radial-gradient(circle at 85% 15%, rgba(249, 115, 22, 0.18), transparent 24%),
      linear-gradient(135deg, #f3fbf7 0%, #eef7f4 42%, #f9f6f0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Manrope', system-ui, sans-serif;
    position: relative;
    overflow: hidden;
    padding: 24px;
  }

  .al-orb,
  .al-grid {
    position: absolute;
    pointer-events: none;
  }

  .al-orb {
    width: 420px;
    height: 420px;
    border-radius: 50%;
    filter: blur(18px);
    opacity: 0.38;
  }

  .al-orb.one {
    top: -120px;
    left: -80px;
    background: rgba(20, 184, 166, 0.20);
  }

  .al-orb.two {
    right: -90px;
    bottom: -140px;
    background: rgba(249, 115, 22, 0.18);
  }

  .al-grid {
    inset: 0;
    background-image:
      linear-gradient(rgba(21, 35, 29, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(21, 35, 29, 0.03) 1px, transparent 1px);
    background-size: 52px 52px;
    mask-image: radial-gradient(circle at center, black 40%, transparent 88%);
  }

  .al-landing {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    transition: opacity 0.8s ease;
    z-index: 1;
  }

  .al-out {
    opacity: 0;
    pointer-events: none;
  }

  .al-hero-mark {
    width: 88px;
    height: 88px;
    border-radius: 28px;
    background: linear-gradient(135deg, #0f766e, #f97316);
    display: grid;
    place-items: center;
    color: #fff;
    box-shadow: 0 26px 60px rgba(15, 118, 110, 0.28);
    margin-bottom: 28px;
    animation: alFadeUp 0.6s ease 0.15s both, alFloat 4.5s ease-in-out 0.8s infinite;
  }

  .al-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.68);
    border: 1px solid rgba(21, 35, 29, 0.08);
    color: #426155;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 18px;
    animation: alFadeUp 0.6s ease 0.28s both;
  }

  .al-brand {
    margin: 0 0 14px;
    font-family: 'Space Grotesk', 'Manrope', sans-serif;
    font-size: clamp(38px, 5vw, 62px);
    line-height: 0.95;
    font-weight: 700;
    color: #15231d;
    letter-spacing: -0.05em;
    animation: alFadeUp 0.6s ease 0.4s both;
  }

  .al-sub {
    margin: 0;
    max-width: 640px;
    font-size: 16px;
    line-height: 1.8;
    color: #557266;
    animation: alFadeUp 0.6s ease 0.55s both;
  }

  .al-highlights {
    margin-top: 30px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    animation: alFadeUp 0.6s ease 0.7s both;
  }

  .al-chip {
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,0.72);
    border: 1px solid rgba(21,35,29,0.08);
    font-size: 13px;
    color: #426155;
    font-weight: 600;
  }

  .al-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: rgba(21,35,29,0.08);
  }

  .al-bar-fill {
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, #0f766e, #f97316);
    animation: alSweep 3.8s linear 0.3s both;
  }

  .al-login-wrap {
    position: relative;
    width: min(1180px, 100%);
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 26px;
    align-items: stretch;
    z-index: 2;
    animation: alFadeUp 0.7s ease forwards;
  }

  .al-panel,
  .al-card {
    background: rgba(255,255,255,0.74);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1px solid rgba(21,35,29,0.08);
    border-radius: 30px;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
  }

  .al-panel {
    padding: 38px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 640px;
  }

  .al-panel-top {
    max-width: 560px;
  }

  .al-panel-mark {
    width: 62px;
    height: 62px;
    border-radius: 20px;
    background: linear-gradient(135deg, #0f766e, #f97316);
    color: #fff;
    display: grid;
    place-items: center;
    box-shadow: 0 18px 42px rgba(15, 118, 110, 0.28);
    margin-bottom: 24px;
  }

  .al-panel-title {
    margin: 0;
    font-family: 'Space Grotesk', 'Manrope', sans-serif;
    font-size: clamp(34px, 4vw, 54px);
    line-height: 0.98;
    letter-spacing: -0.05em;
    color: #15231d;
  }

  .al-panel-copy {
    margin: 18px 0 0;
    font-size: 16px;
    line-height: 1.8;
    color: #557266;
  }

  .al-metric-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 28px;
  }

  .al-metric {
    padding: 16px;
    border-radius: 22px;
    background: rgba(255,255,255,0.72);
    border: 1px solid rgba(21,35,29,0.08);
  }

  .al-metric-value {
    font-family: 'Space Grotesk', 'Manrope', sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #15231d;
    letter-spacing: -0.05em;
  }

  .al-metric-label {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: #678275;
  }

  .al-panel-bottom {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 28px;
  }

  .al-feature {
    padding: 18px;
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(248,251,250,0.68));
    border: 1px solid rgba(21,35,29,0.08);
  }

  .al-feature-title {
    margin: 14px 0 6px;
    font-size: 15px;
    font-weight: 700;
    color: #15231d;
  }

  .al-feature-copy {
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
    color: #557266;
  }

  .al-card {
    padding: 34px 32px;
    align-self: center;
    width: 100%;
    max-width: 430px;
  }

  .al-card-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .al-card-mark {
    width: 44px;
    height: 44px;
    border-radius: 16px;
    background: linear-gradient(135deg, #0f766e, #f97316);
    color: #fff;
    display: grid;
    place-items: center;
  }

  .al-card-brand {
    font-family: 'Space Grotesk', 'Manrope', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #15231d;
    letter-spacing: -0.03em;
  }

  .al-card h2 {
    margin: 0;
    font-family: 'Space Grotesk', 'Manrope', sans-serif;
    font-size: 30px;
    line-height: 1;
    color: #15231d;
    letter-spacing: -0.04em;
  }

  .al-login-subtext {
    font-size: 14px;
    color: #678275;
    margin: 12px 0 26px;
    line-height: 1.7;
  }

  .al-error {
    background: #fff1ed;
    border: 1px solid #fdc9bb;
    border-radius: 16px;
    padding: 12px 14px;
    font-size: 13px;
    color: #b93815;
    margin-bottom: 16px;
  }

  .al-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .al-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .al-field label {
    font-size: 13px;
    font-weight: 700;
    color: #426155;
  }

  .al-input-wrap {
    position: relative;
  }

  .al-input-wrap svg {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #92a79d;
  }

  .al-field input {
    width: 100%;
    padding: 14px 16px 14px 44px;
    background: rgba(255,255,255,0.92);
    border: 1px solid rgba(21,35,29,0.10);
    border-radius: 16px;
    font-size: 14.5px;
    color: #15231d;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-sizing: border-box;
  }

  .al-field input:focus {
    border-color: rgba(15, 118, 110, 0.30);
    box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.12);
    background: #fff;
  }

  .al-btn {
    width: 100%;
    padding: 14px 18px;
    margin-top: 6px;
    background: linear-gradient(135deg, #0f766e, #115e59);
    color: #fff;
    border: none;
    border-radius: 16px;
    font-size: 14.5px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 16px 34px rgba(15, 118, 110, 0.22);
  }

  .al-btn:hover {
    filter: brightness(1.03);
    transform: translateY(-1px);
  }

  .al-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .al-reg {
    text-align: center;
    margin-top: 22px;
    font-size: 13px;
    color: #678275;
  }

  .al-reg a {
    color: #0f766e;
    font-weight: 700;
    text-decoration: none;
  }

  @media (max-width: 980px) {
    .al-login-wrap {
      grid-template-columns: 1fr;
    }

    .al-panel {
      min-height: auto;
    }
  }

  @media (max-width: 640px) {
    .al-scene {
      padding: 16px;
    }

    .al-panel,
    .al-card {
      padding: 24px 20px;
      border-radius: 24px;
    }

    .al-panel-bottom,
    .al-metric-grid {
      grid-template-columns: 1fr;
    }

    .al-brand {
      font-size: 34px;
    }
  }
`;

export default function LandingLogin() {
  const navigate = useNavigate();
  const storeLogin = useAuthStore((state) => state.login);
  const [phase, setPhase] = useState<Phase>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const leavingTimer = window.setTimeout(() => {
      setPhase('leaving');
    }, 3800);

    const loginTimer = window.setTimeout(() => {
      setPhase('login');
    }, 4600);

    return () => {
      window.clearTimeout(leavingTimer);
      window.clearTimeout(loginTimer);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = await loginHR(email, password);
      storeLogin(token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="al-scene">
      <style>{CSS}</style>
      <div className="al-orb one" />
      <div className="al-orb two" />
      <div className="al-grid" />

      {phase !== 'login' && (
        <div className={`al-landing ${phase === 'leaving' ? 'al-out' : ''}`}>
          <div className="al-hero-mark">
            <BrandMark size={42} />
          </div>
          <div className="al-kicker">
            <Sparkles size={14} />
            Intelligent Hiring Platform
          </div>
          <h1 className="al-brand">Hire with more signal. Less noise.</h1>
          <p className="al-sub">
            Smart Hiring combines resume screening, AI interviews, and proctored candidate workflows into a
            cleaner hiring command center.
          </p>

          <div className="al-highlights">
            <span className="al-chip">AI resume evaluation</span>
            <span className="al-chip">Live candidate interviews</span>
            <span className="al-chip">Decision-ready analytics</span>
          </div>

          <div className="al-bar">
            <div className="al-bar-fill" />
          </div>
        </div>
      )}

      {phase === 'login' && (
        <div className="al-login-wrap">
          <section className="al-panel">
            <div className="al-panel-top">
              <div className="al-panel-mark">
                <BrandMark size={28} />
              </div>
              <h1 className="al-panel-title">Recruitment ops, redesigned for speed and clarity.</h1>
              <p className="al-panel-copy">
                Keep the same hiring workflow and candidate pipeline, but move through it in a calmer, sharper
                workspace built for real review sessions.
              </p>

              <div className="al-metric-grid">
                <div className="al-metric">
                  <div className="al-metric-value">10x</div>
                  <div className="al-metric-label">Faster first-pass screening across applicants</div>
                </div>
                <div className="al-metric">
                  <div className="al-metric-value">3</div>
                  <div className="al-metric-label">Modes for typed, audio, and video candidate answers</div>
                </div>
                <div className="al-metric">
                  <div className="al-metric-value">1</div>
                  <div className="al-metric-label">Unified dashboard for roles, interviews, and results</div>
                </div>
              </div>
            </div>

            <div className="al-panel-bottom">
              <div className="al-feature">
                <Mail size={18} color="#0f766e" />
                <div className="al-feature-title">Organized candidate journeys</div>
                <p className="al-feature-copy">Structured screening and interview stages without the clutter of a copied dashboard pattern.</p>
              </div>
              <div className="al-feature">
                <LockKeyhole size={18} color="#f97316" />
                <div className="al-feature-title">Secure candidate assessments</div>
                <p className="al-feature-copy">Proctored interviews, screen checks, and clearer permissions before the exam starts.</p>
              </div>
            </div>
          </section>

          <div className="al-card">
            <div className="al-card-head">
              <div className="al-card-mark">
                <BrandMark size={22} />
              </div>
              <div className="al-card-brand">Smart Hiring</div>
            </div>

            <h2>Welcome back</h2>
            <p className="al-login-subtext">Sign in to review candidates, manage job descriptions, and monitor interviews.</p>

            {error && <div className="al-error">{error}</div>}

            <form className="al-form" onSubmit={handleSubmit}>
              <div className="al-field">
                <label htmlFor="al-email">Work email</label>
                <div className="al-input-wrap">
                  <Mail size={18} />
                  <input
                    id="al-email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              <div className="al-field">
                <label htmlFor="al-password">Password</label>
                <div className="al-input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    id="al-password"
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </div>

              <button className="al-btn" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Enter workspace'}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="al-reg">
              Don&apos;t have an account? <Link to="/register">Create one</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
