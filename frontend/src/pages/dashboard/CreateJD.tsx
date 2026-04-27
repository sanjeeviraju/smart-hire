import { FormEvent, useState } from 'react';

import { createJD, updateJD } from '../../api/jd';
import type { JobDescription } from '../../types';

type CreateJDProps = {
  onBack: () => void;
  onSuccess: (job: JobDescription) => void;
  initialJob?: JobDescription | null;
};

const CSS = `
  .cjd-card {
    background: var(--bg-card);
    border: 1px solid var(--border-card);
    border-radius: 11px;
    padding: 20px;
  }

  .cjd-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .cjd-head h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
  }

  .cjd-back {
    border: 1px solid var(--border-btn);
    background: transparent;
    color: var(--text-primary);
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
  }

  .cjd-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 16px;
  }

  .cjd-full {
    grid-column: 1 / -1;
  }

  .cjd-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .cjd-field label,
  .cjd-field span {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-label);
  }

  .cjd-field input,
  .cjd-field select,
  .cjd-field textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--border-input);
    background: var(--bg-input);
    color: var(--text-primary);
    border-radius: 9px;
    padding: 11px 12px;
    font: inherit;
    outline: none;
  }

  .cjd-field textarea {
    min-height: 170px;
    resize: vertical;
  }

  .cjd-note,
  .cjd-error {
    font-size: 12px;
    margin-top: 12px;
  }

  .cjd-note { color: var(--score-green); }
  .cjd-error { color: var(--score-red); }

  .cjd-submit {
    margin-top: 16px;
    border: 0;
    background: var(--bg-dark-btn);
    color: var(--text-dark-btn);
    border-radius: 8px;
    padding: 12px 18px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    min-width: 180px;
  }

  @media (max-width: 760px) {
    .cjd-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default function CreateJD({ onBack, onSuccess, initialJob = null }: CreateJDProps) {
  const isEditMode = Boolean(initialJob);
  const [form, setForm] = useState({
    title: initialJob?.title || '',
    department: initialJob?.department || '',
    required_skills: (initialJob?.required_skills || []).join(', '),
    preferred_skills: (initialJob?.preferred_skills || []).join(', '),
    min_experience_years: String(initialJob?.min_experience_years ?? 0),
    max_experience_years: initialJob?.max_experience_years != null ? String(initialJob.max_experience_years) : '',
    education_requirement: initialJob?.education_requirement || "Bachelor's",
    screening_threshold: String(initialJob?.screening_threshold ?? 60),
    description: initialJob?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.department.trim()) {
      setError('Department is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        department: form.department.trim(),
        description: form.description.trim(),
        required_skills: splitSkills(form.required_skills),
        preferred_skills: splitSkills(form.preferred_skills),
        min_experience_years: Number(form.min_experience_years || 0),
        max_experience_years: form.max_experience_years ? Number(form.max_experience_years) : null,
        education_requirement: form.education_requirement,
        screening_threshold: Number(form.screening_threshold || 60),
      };
      const saved = initialJob ? await updateJD(initialJob.id, payload) : await createJD(payload);
      onSuccess(saved);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || `Failed to ${isEditMode ? 'update' : 'create'} JD`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="cjd-card" onSubmit={handleSubmit}>
      <style>{CSS}</style>

      <div className="cjd-head">
        <div>
          <h2>{isEditMode ? 'Edit Job Description' : 'Create Job Description'}</h2>
        </div>
        <button className="cjd-back" onClick={onBack} type="button">
          Back
        </button>
      </div>

      <div className="cjd-grid">
        <Field label="Job Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
        <Field label="Department" required value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} />
        <Field
          label="Required Skills (comma sep)"
          value={form.required_skills}
          onChange={(value) => setForm((current) => ({ ...current, required_skills: value }))}
        />
        <Field label="Preferred Skills" value={form.preferred_skills} onChange={(value) => setForm((current) => ({ ...current, preferred_skills: value }))} />
        <Field
          label="Min Experience (years)"
          type="number"
          value={form.min_experience_years}
          onChange={(value) => setForm((current) => ({ ...current, min_experience_years: value }))}
        />
        <Field
          label="Max Experience (optional)"
          type="number"
          value={form.max_experience_years}
          onChange={(value) => setForm((current) => ({ ...current, max_experience_years: value }))}
        />

        <label className="cjd-field">
          <span>Education Requirement</span>
          <select value={form.education_requirement} onChange={(event) => setForm((current) => ({ ...current, education_requirement: event.target.value }))}>
            <option value="Bachelor's">Bachelor&apos;s</option>
            <option value="Master's">Master&apos;s</option>
            <option value="PhD">PhD</option>
            <option value="Any">Any</option>
          </select>
        </label>

        <Field
          label="Threshold (0-100)"
          type="number"
          value={form.screening_threshold}
          onChange={(value) => setForm((current) => ({ ...current, screening_threshold: value }))}
        />

        <label className="cjd-field cjd-full">
          <span>Job Description</span>
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </label>
      </div>

      {error && <div className="cjd-error">{error}</div>}

      <button className="cjd-submit" disabled={saving} type="submit">
        {saving ? (isEditMode ? 'Saving...' : 'Creating...') : isEditMode ? 'Save Changes' : 'Create JD'}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="cjd-field">
      <span>{label}</span>
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function splitSkills(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
