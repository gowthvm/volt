import { useOnboardingStore } from '@/store/onboardingStore';

const STEP_DOTS = 8;

export default function OnboardingOverlay() {
  const active = useOnboardingStore((s) => s.active);
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const steps = useOnboardingStore((s) => s.steps);
  const next = useOnboardingStore((s) => s.next);
  const prev = useOnboardingStore((s) => s.prev);
  const dismiss = useOnboardingStore((s) => s.dismiss);

  if (!active) return null;

  const step = steps[currentStep];
  const isCenter = step.position === 'center';
  const isLast = currentStep >= steps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: isCenter ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: isCenter ? 'center' : 'flex-start',
      justifyContent: isCenter ? 'center' : 'flex-start',
      pointerEvents: 'auto',
      transition: 'background 240ms ease',
    }}>
      <div
        onClick={next}
        style={{
          position: 'absolute', inset: 0, cursor: 'default',
        }}
      />
      <div style={{
        position: 'relative',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 32px',
        maxWidth: 380,
        boxShadow: 'var(--shadow-lg)',
        pointerEvents: 'auto',
        ...(isCenter ? {} : { margin: '80px 0 0 280px' }),
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <span style={{
            fontSize: 10, fontFamily: 'monospace',
            color: 'var(--text-tertiary)', letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            style={{
              background: 'none', border: 'none', color: 'var(--text-tertiary)',
              fontSize: 14, cursor: 'pointer', padding: '2px 4px', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <h3 style={{
          fontSize: 18, fontWeight: 600, color: 'var(--text-primary)',
          margin: '0 0 8px 0', fontFamily: 'inherit',
        }}>
          {step.title}
        </h3>
        <p style={{
          fontSize: 13, color: 'var(--text-secondary)',
          margin: '0 0 24px 0', lineHeight: 1.5, fontFamily: 'inherit',
        }}>
          {step.description}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: STEP_DOTS }).map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === currentStep ? 'var(--accent)' : 'var(--border-default)',
                transition: 'background 200ms ease',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isFirst && (
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                style={{
                  padding: '4px 14px', borderRadius: 'var(--radius-md)',
                  background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              style={{
                padding: '4px 16px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent)',
                border: 'none',
                color: '#000',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
