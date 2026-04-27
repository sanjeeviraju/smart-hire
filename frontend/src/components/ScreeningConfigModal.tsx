import { useEffect, useState } from 'react';

import type { ScreeningConfig } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  onRun: (config: ScreeningConfig) => void;
  jdTitle: string;
  jdSkills: string[];
  selectedCount: number;
  selectedNames: string[];
  defaultThreshold: number;
};

function importanceLabel(value: number): string {
  return ['Very low', 'Low', 'Medium', 'High', 'Critical'][value - 1];
}

function importanceColor(value: number): string {
  return ['#aaa', '#888', '#d97706', '#2563eb', '#dc2626'][value - 1];
}

function thresholdLabel(value: number): { text: string; bg: string; color: string } {
  if (value < 45) return { text: 'Lenient', bg: '#dcfce7', color: '#166534' };
  if (value < 65) return { text: 'Moderate', bg: '#fef3c7', color: '#92400e' };
  if (value < 80) return { text: 'Strict', bg: '#fee2e2', color: '#991b1b' };
  return { text: 'Very strict', bg: '#fee2e2', color: '#991b1b' };
}

function ImportanceSlider({
  label,
  description,
  color,
  value,
  onChange,
}: {
  label: string;
  description: string;
  color: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: '11.5px',
              color: 'var(--text-hint)',
            }}
          >
            - {description}
          </span>
        </div>
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 600,
            color: importanceColor(value),
          }}
        >
          {importanceLabel(value)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-faint)',
            width: '28px',
          }}
        >
          Low
        </span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          style={{ flex: 1, accentColor: color }}
        />
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-faint)',
            width: '40px',
            textAlign: 'right',
          }}
        >
          Critical
        </span>
      </div>
    </div>
  );
}

export default function ScreeningConfigModal({
  open,
  onClose,
  onRun,
  jdTitle,
  jdSkills,
  selectedCount,
  selectedNames,
  defaultThreshold,
}: Props) {
  function buildDefaultConfig(): ScreeningConfig {
    return {
      skill_importance: 4,
      exp_importance: 3,
      edu_importance: 2,
      project_importance: 2,
      active_skills: [...jdSkills],
      threshold: defaultThreshold || 65,
    };
  }

  const [config, setConfig] = useState<ScreeningConfig>(buildDefaultConfig);

  useEffect(() => {
    if (open) {
      setConfig(buildDefaultConfig());
    }
  }, [open, jdSkills, defaultThreshold]);

  function toggleSkill(skill: string) {
    setConfig((prev) => {
      const active = prev.active_skills;
      if (active.includes(skill)) {
        return {
          ...prev,
          active_skills: active.filter((item) => item !== skill),
        };
      }

      return {
        ...prev,
        active_skills: [...active, skill],
      };
    });
  }

  if (!open) return null;

  const tl = thresholdLabel(config.threshold);
  const activeCount = config.active_skills.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-modal)',
          borderRadius: '18px',
          width: '520px',
          maxWidth: 'calc(100vw - 24px)',
          border: '1px solid var(--border-card)',
          animation: 'popIn 0.25s ease both',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-divider)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-modal)',
            zIndex: 1,
          }}
        >
          <div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Configure screening
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-hint)',
                marginTop: '2px',
              }}
            >
              {jdTitle}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              border: '1px solid var(--border-btn)',
              background: 'var(--bg-action-btn)',
              fontSize: '18px',
              color: 'var(--text-hint)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            type="button"
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-muted)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {selectedNames.slice(0, 5).map((name, index) => {
                const initials = name
                  .trim()
                  .split(' ')
                  .slice(0, 2)
                  .map((part) => part[0] ?? '')
                  .join('')
                  .toUpperCase();
                const bgColors = ['#dbeafe', '#dcfce7', '#fef3c7', '#ede9fe', '#fce7f3'];
                const fgColors = ['#1e40af', '#166534', '#92400e', '#5b21b6', '#9d174d'];

                return (
                  <div
                    key={`${name}-${index}`}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: bgColors[index % 5],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 500,
                      color: fgColors[index % 5],
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                );
              })}
              <span
                style={{
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)',
                  marginLeft: '4px',
                }}
              >
                {selectedCount} candidate{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-hint)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px',
              }}
            >
              Factor importance
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-faint)',
                marginBottom: '16px',
              }}
            >
              How much each factor influences the final score
            </div>

            <ImportanceSlider
              label="Skill match"
              description="how many JD skills candidate has"
              color="var(--text-primary)"
              value={config.skill_importance}
              onChange={(value) => setConfig((prev) => ({ ...prev, skill_importance: value }))}
            />
            <ImportanceSlider
              label="Experience"
              description="years of work experience"
              color="#378add"
              value={config.exp_importance}
              onChange={(value) => setConfig((prev) => ({ ...prev, exp_importance: value }))}
            />
            <ImportanceSlider
              label="Education"
              description="qualification level"
              color="#34d399"
              value={config.edu_importance}
              onChange={(value) => setConfig((prev) => ({ ...prev, edu_importance: value }))}
            />
            <ImportanceSlider
              label="Projects"
              description="relevance to JD domain"
              color="#fbbf24"
              value={config.project_importance}
              onChange={(value) => setConfig((prev) => ({ ...prev, project_importance: value }))}
            />
          </div>

          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-hint)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px',
              }}
            >
              Pass threshold
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-faint)',
                marginBottom: '12px',
              }}
            >
              Candidates scoring below this will fail
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={config.threshold}
                onChange={(event) => setConfig((prev) => ({ ...prev, threshold: Number(event.target.value) }))}
                style={{ flex: 1, accentColor: 'var(--text-primary)' }}
              />
              <div style={{ textAlign: 'center', minWidth: '80px' }}>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {config.threshold}
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '5px',
                    background: tl.bg,
                    color: tl.color,
                    display: 'inline-block',
                    marginTop: '4px',
                  }}
                >
                  {tl.text}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-hint)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Skills to evaluate</span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-hint)',
                  textTransform: 'none',
                }}
              >
                {activeCount} of {jdSkills.length} active
              </span>
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-faint)',
                marginBottom: '10px',
              }}
            >
              Toggle off skills to exclude from matching
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {jdSkills.map((skill) => {
                const isActive = config.active_skills.includes(skill);
                return (
                  <span
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      padding: '5px 11px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      userSelect: 'none',
                      background: isActive ? 'var(--text-primary)' : 'var(--bg-chip-gray)',
                      color: isActive ? 'var(--bg-card)' : 'var(--text-hint)',
                      border: `1px solid ${isActive ? 'var(--text-primary)' : 'transparent'}`,
                    }}
                  >
                    {skill}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-divider)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            bottom: 0,
            background: 'var(--bg-modal)',
          }}
        >
          <button
            onClick={() => setConfig(buildDefaultConfig())}
            style={{
              padding: '8px 14px',
              borderRadius: '9px',
              border: '1px solid var(--border-btn)',
              background: 'var(--bg-action-btn)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '12.5px',
              color: 'var(--text-hint)',
              cursor: 'pointer',
            }}
            type="button"
          >
            Reset defaults
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: '9px',
                border: '1px solid var(--border-btn)',
                background: 'var(--bg-action-btn)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={() => onRun(config)}
              style={{
                padding: '9px 20px',
                borderRadius: '9px',
                background: 'var(--bg-tag-dark)',
                color: 'var(--text-tag-dark)',
                border: 'none',
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
              type="button"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Run screening
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
