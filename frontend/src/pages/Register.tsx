import { ArrowRight, Building2, LockKeyhole, Mail, User2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { registerHR } from '../api/auth';
import BrandMark from '../components/brand/BrandMark';

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');

  @keyframes arFadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .ar-scene {
    min-height: 100vh;
    background:
      radial-gradient(circle at 12% 18%, rgba(20, 184, 166, 0.18), transparent 24%),
      radial-gradient(circle at 88% 14%, rgba(249, 115, 22, 0.18), transparent 24%),
      linear-gradient(135deg, #f4fbf7 0%, #eff8f4 50%, #f8f4ed 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Manrope', system-ui, sans-serif;
    padding: 24px;
  }

  .ar-shell {
    width: min(1120px, 100%);
    display: grid;
    grid-template-columns: 0.95fr 1.05fr;
    gap: 24px;
    animation: arFadeUp 0.6s ease both;
  }

  .ar-side,
  .ar-card {
    background: rgba(255,255,255,0.78);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1px solid rgba(21,35,29,0.08);
    border-radius: 30px;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
  }

  .ar-side {
    padding: 34px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .ar-side-mark {
    width: 58px;
    height: 58px;
    border-radius: 20px;
    background: linear-gradient(135deg, #0f766e, #f97316);
    color: #fff;
    display: grid;
    place-items: center;
    margin-bottom: 22px;
  }

  .ar-side-title {
    margin: 0;
    font-family: 'Space Grotesk', 'Manrope', sans-serif;
    font-size: clamp(32px, 4vw, 46px);
    line-height: 0.98;
    letter-spacing: -0.05em;
    color: #15231d;
  }

  .ar-side-copy {
    margin: 18px 0 0;
    font-size: 15px;
    line-height: 1.8;
    color: #557266;
  }

  .ar-points {
    display: grid;
    gap: 12px;
    margin-top: 28px;
  }

  .ar-point {
    padding: 16px;
    border-radius: 20px;
    background: rgba(255,255,255,0.72);
    border: 1px solid rgba(21,35,29,0.08);
  }

  .ar-point-title {
    font-size: 14px;
    font-weight: 700;
    color: #15231d;
    margin-bottom: 6px;
  }

  .ar-point-copy {
    font-size: 13px;
    line-height: 1.7;
    color: #557266;
  }

  .ar-card {
    padding: 34px 32px;
  }

  .ar-logo-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .ar-logo-mark {
    width: 44px;
    height: 44px;
    border-radius: 16px;
    background: linear-gradient(135deg, #0f766e, #f97316);
    color: #fff;
    display: grid;
    place-items: center;
  }

  .ar-logo-name {
    font-family: 'Space Grotesk', 'Manrope', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #15231d;
    letter-spacing: -0.03em;
  }

  .ar-card h2 {
    margin: 0;
    font-family: 'Space Grotesk', 'Manrope', sans-serif;
    font-size: 30px;
    line-height: 1;
    letter-spacing: -0.04em;
    color: #15231d;
  }

  .ar-subtext {
    margin: 12px 0 26px;
    font-size: 14px;
    color: #678275;
    line-height: 1.7;
  }

  .ar-error {
    background: #fff1ed;
    border: 1px solid #fdc9bb;
    border-radius: 16px;
    padding: 12px 14px;
    font-size: 13px;
    color: #b93815;
    margin-bottom: 16px;
  }

  .ar-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .ar-field {
    margin-bottom: 14px;
  }

  .ar-field.full {
    grid-column: 1 / -1;
  }

  .ar-field label {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: #426155;
    margin-bottom: 8px;
  }

  .ar-input-wrap {
    position: relative;
  }

  .ar-input-wrap svg {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #92a79d;
  }

  .ar-field input {
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

  .ar-field input:focus {
    border-color: rgba(15,118,110,0.30);
    box-shadow: 0 0 0 4px rgba(20,184,166,0.12);
    background: #fff;
  }

  .ar-strength {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .ar-sbar {
    flex: 1;
    height: 6px;
    border-radius: 999px;
    background: rgba(21,35,29,0.08);
    transition: background 0.3s;
  }

  .ar-weak {
    background: #fb7185;
  }

  .ar-ok {
    background: #f59e0b;
  }

  .ar-good {
    background: #10b981;
  }

  .ar-btn {
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
    box-shadow: 0 16px 34px rgba(15,118,110,0.22);
  }

  .ar-btn:hover {
    filter: brightness(1.03);
    transform: translateY(-1px);
  }

  .ar-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .ar-signin-line {
    font-size: 13px;
    color: #678275;
    text-align: center;
    margin-top: 22px;
  }

  .ar-signin-line a {
    color: #0f766e;
    font-weight: 700;
    text-decoration: none;
  }

  @media (max-width: 920px) {
    .ar-shell {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .ar-scene {
      padding: 16px;
    }

    .ar-side,
    .ar-card {
      padding: 24px 20px;
      border-radius: 24px;
    }

    .ar-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    company_name: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [strength, setStrength] = useState(0);

  function getStrength(password: string) {
    if (!password) return 0;
    if (password.length < 6) return 1;
    if (password.length < 10) return 2;
    return 3;
  }

  function updateField(field: keyof typeof form, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);

    if (field === 'password') {
      setStrength(getStrength(value));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await registerHR(form);
      navigate('/');
    } catch (submitError: any) {
      setError(submitError?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ar-scene">
      <style>{CSS}</style>

      <div className="ar-shell">
        <section className="ar-side">
          <div>
            <div className="ar-side-mark">
              <BrandMark size={28} />
            </div>
            <h1 className="ar-side-title">Create the hiring workspace your team actually wants to use.</h1>
            <p className="ar-side-copy">
              Register your HR account to manage job descriptions, review AI screening results, and track candidate interviews in one place.
            </p>
          </div>

          <div className="ar-points">
            <div className="ar-point">
              <div className="ar-point-title">Role-by-role evaluation</div>
              <div className="ar-point-copy">Define each job description and score candidates against the exact requirements that matter.</div>
            </div>
            <div className="ar-point">
              <div className="ar-point-title">Candidate interview visibility</div>
              <div className="ar-point-copy">Review interview outcomes, warnings, and response progress without jumping between screens.</div>
            </div>
            <div className="ar-point">
              <div className="ar-point-title">A cleaner control surface</div>
              <div className="ar-point-copy">The workflow stays the same, but the interface is more deliberate, readable, and distinct.</div>
            </div>
          </div>
        </section>

        <div className="ar-card">
          <div className="ar-logo-row">
            <div className="ar-logo-mark">
              <BrandMark size={22} />
            </div>
            <span className="ar-logo-name">Smart Hiring</span>
          </div>

          <h2>Create account</h2>
          <p className="ar-subtext">Set up your HR workspace and start screening candidates with the new dashboard experience.</p>

          {error && <div className="ar-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="ar-grid">
              <div className="ar-field">
                <label htmlFor="ar-full-name">Full name</label>
                <div className="ar-input-wrap">
                  <User2 size={18} />
                  <input
                    id="ar-full-name"
                    type="text"
                    placeholder="Jane Smith"
                    autoComplete="name"
                    required
                    value={form.full_name}
                    onChange={(event) => updateField('full_name', event.target.value)}
                  />
                </div>
              </div>

              <div className="ar-field">
                <label htmlFor="ar-company">Company name</label>
                <div className="ar-input-wrap">
                  <Building2 size={18} />
                  <input
                    id="ar-company"
                    type="text"
                    placeholder="Acme Inc."
                    autoComplete="organization"
                    required
                    value={form.company_name}
                    onChange={(event) => updateField('company_name', event.target.value)}
                  />
                </div>
              </div>

              <div className="ar-field full">
                <label htmlFor="ar-email">Work email</label>
                <div className="ar-input-wrap">
                  <Mail size={18} />
                  <input
                    id="ar-email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                  />
                </div>
              </div>

              <div className="ar-field full">
                <label htmlFor="ar-password">Password</label>
                <div className="ar-input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    id="ar-password"
                    type="password"
                    placeholder="Create a secure password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                  />
                </div>

                <div className="ar-strength">
                  <div className={`ar-sbar ${strength >= 1 ? (strength === 1 ? 'ar-weak' : strength === 2 ? 'ar-ok' : 'ar-good') : ''}`} />
                  <div className={`ar-sbar ${strength >= 2 ? (strength === 2 ? 'ar-ok' : 'ar-good') : ''}`} />
                  <div className={`ar-sbar ${strength >= 3 ? 'ar-good' : ''}`} />
                </div>
              </div>
            </div>

            <button className="ar-btn" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create workspace'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="ar-signin-line">
            Already have an account? <Link to="/">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
