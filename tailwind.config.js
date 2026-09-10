/** @type {import('tailwindcss').Config} */
// GCO Partners semantic token map. Every color/radius/shadow reads from a CSS
// variable defined in src/styles/tokens.css — components use the semantic class
// (bg-surface-card, text-ink, border-subtle, accent-primary) and never raw hex.
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // brand
        'accent-primary': 'var(--accent-primary)',
        'accent-primary-hover': 'var(--accent-primary-hover)',
        'accent-secondary': 'var(--accent-secondary)',
        'accent-alert': 'var(--accent-alert)',
        'accent-alert-hover': 'var(--accent-alert-hover)',
        // surfaces
        'surface-page': 'var(--surface-page)',
        'surface-card': 'var(--surface-card)',
        'surface-cream': 'var(--surface-cream)',
        'surface-sunken': 'var(--surface-sunken)',
        'surface-report': 'var(--surface-report)',
        // text (ink = primary body text)
        ink: 'var(--text-primary)',
        'ink-secondary': 'var(--text-secondary)',
        'ink-tertiary': 'var(--text-tertiary)',
        // borders
        'border-subtle': 'var(--border-subtle)',
        'border-default': 'var(--border-default)',
        // fixed data semantics
        favorable: 'var(--data-favorable)',
        'favorable-tint': 'var(--data-favorable-tint)',
        unfavorable: 'var(--data-unfavorable)',
        'unfavorable-tint': 'var(--data-unfavorable-tint)',
        watch: 'var(--data-watch)',
        'watch-tint': 'var(--data-watch-tint)',
        neutral: 'var(--data-neutral)',
        'neutral-tint': 'var(--data-neutral-tint)',
        // chart series
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        'chart-4': 'var(--chart-4)',
        'chart-5': 'var(--chart-5)',
        'chart-6': 'var(--chart-6)',
      },
      // Semantic aliases: bg-page, text-ink already covered above. Provide
      // borderColor default so `border` picks up the hairline.
      borderColor: {
        DEFAULT: 'var(--border-subtle)',
      },
      borderRadius: {
        input: 'var(--radius-input)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        // Wired to next/font CSS variables in src/app/layout.tsx.
        sans: ['var(--font-open-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
        numeric: ['var(--font-poppins)', 'var(--font-montserrat)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Product scale (not poster scale).
        eyebrow: ['13px', { lineHeight: '1.2', letterSpacing: '0.14em', fontWeight: '600' }],
        'page-title': ['28px', { lineHeight: '1.15', fontWeight: '700' }],
        'section-title': ['20px', { lineHeight: '1.25', fontWeight: '700' }],
        'card-title': ['16px', { lineHeight: '1.3', fontWeight: '600' }],
        kpi: ['36px', { lineHeight: '1.05', fontWeight: '700' }],
      },
      letterSpacing: {
        eyebrow: '0.14em',
        header: '0.04em',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        slow: '200ms',
      },
      maxWidth: {
        content: '1440px',
        modal: '560px',
        'modal-form': '720px',
        'auth-card': '400px',
      },
      backgroundColor: {
        scrim: 'var(--scrim)',
      },
      ringColor: {
        focus: 'var(--focus-ring)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s var(--ease-standard) infinite',
      },
    },
  },
  plugins: [],
};
