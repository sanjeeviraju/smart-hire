import { ResumeScore } from '../types';

type ResumeEvaluationMetricsProps = {
  resumeScore: ResumeScore;
  screeningThreshold?: number;
};

type Metric = {
  label: string;
  score: number;
  weight: number;
  tone: 'teal' | 'emerald' | 'amber' | 'indigo';
  note: string;
};

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function toneClass(tone: Metric['tone']): string {
  if (tone === 'teal') return 'bg-teal';
  if (tone === 'emerald') return 'bg-emerald-500';
  if (tone === 'amber') return 'bg-amber-500';
  return 'bg-indigo-500';
}

export default function ResumeEvaluationMetrics({ resumeScore, screeningThreshold }: ResumeEvaluationMetricsProps) {
  const skillsWeight = 0.4;
  const experienceWeight = 0.3;
  const educationWeight = 0.2;
  const projectWeight = 0.1;

  const metrics: Metric[] = [
    {
      label: 'Skills Match',
      score: clamp(resumeScore.skill_score),
      tone: 'teal',
      weight: skillsWeight,
      note: 'Required skills alignment',
    },
    {
      label: 'Experience Match',
      score: clamp(resumeScore.exp_score),
      weight: experienceWeight,
      tone: 'amber',
      note: 'Minimum experience fit',
    },
    {
      label: 'Education Match',
      score: clamp(resumeScore.edu_score),
      weight: educationWeight,
      tone: 'indigo',
      note: 'Degree level requirement fit',
    },
    {
      label: 'Project Match',
      score: clamp(resumeScore.project_score),
      weight: projectWeight,
      tone: 'emerald',
      note: 'Project and resume keyword relevance',
    },
  ];

  const overall = clamp(resumeScore.overall_score);
  const threshold = screeningThreshold ?? 60;
  const pass = overall >= threshold;

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-semibold text-ink">AI Model Evaluation Metrics</h4>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {pass ? 'Pass' : 'Below Threshold'} ({overall.toFixed(1)}/{threshold})
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricTile label="Overall Score" value={overall.toFixed(1)} subtitle="Weighted final score (0-100)" />
        <MetricTile label="Matched Skills" value={String(resumeScore.matched_skills.length)} subtitle="Required skills matched" />
        <MetricTile label="Missing Skills" value={String(resumeScore.missing_skills.length)} subtitle="Required skills missing" />
      </div>

      <div className="mt-4 space-y-3">
        {metrics.map((metric) => {
          const weightedContribution = metric.score * metric.weight;
          return (
            <div key={metric.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-700">{metric.label}</span>
                <span className="font-semibold text-ink">{metric.score.toFixed(1)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200">
                <div className={`h-2.5 rounded-full transition-all duration-500 ${toneClass(metric.tone)}`} style={{ width: `${metric.score}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Weight: {(metric.weight * 100).toFixed(0)}% | Weighted contribution: {weightedContribution.toFixed(1)} | {metric.note}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Major factors: skills alignment, experience fit, education fit, and project relevance.
      </p>
    </section>
  );
}

function MetricTile({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
