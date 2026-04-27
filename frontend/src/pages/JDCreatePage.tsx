import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function JDCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    department: '',
    description: '',
    required_skills: '',
    preferred_skills: '',
    min_experience_years: '0',
    max_experience_years: '',
    education_requirement: "Bachelor's",
    screening_threshold: '60',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        required_skills: form.required_skills.split(',').map((s) => s.trim()).filter(Boolean),
        preferred_skills: form.preferred_skills.split(',').map((s) => s.trim()).filter(Boolean),
        min_experience_years: Number(form.min_experience_years || 0),
        max_experience_years: form.max_experience_years ? Number(form.max_experience_years) : null,
        screening_threshold: Number(form.screening_threshold || 60),
      };
      const res = await api.post('/jd/', payload);
      navigate(`/jd/${res.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create JD');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h1 className="font-display text-2xl font-semibold">Create Job Description</h1>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Job Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
        <Field label="Required Skills (comma separated)" value={form.required_skills} onChange={(v) => setForm({ ...form, required_skills: v })} />
        <Field label="Preferred Skills" value={form.preferred_skills} onChange={(v) => setForm({ ...form, preferred_skills: v })} />
        <Field label="Min Experience (years)" type="number" value={form.min_experience_years} onChange={(v) => setForm({ ...form, min_experience_years: v })} />
        <Field label="Max Experience (optional)" type="number" value={form.max_experience_years} onChange={(v) => setForm({ ...form, max_experience_years: v })} />
        <Field label="Education Requirement" value={form.education_requirement} onChange={(v) => setForm({ ...form, education_requirement: v })} />
        <Field label="Threshold (0-100)" type="number" value={form.screening_threshold} onChange={(v) => setForm({ ...form, screening_threshold: v })} />
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Job Description
        <textarea className="input min-h-40" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button className="btn-primary" disabled={saving}>
        {saving ? 'Saving...' : 'Create JD'}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={label !== 'Max Experience (optional)'} />
    </label>
  );
}
