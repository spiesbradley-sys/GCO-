import type { SVGProps } from 'react';

// Filled glyphs only — the house style uses no outline icons. Each takes normal
// SVG props; set size via width/height or a wrapping element, color via
// `fill="currentColor"` (the default here).

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.2 11.3 2.9 8l1.1-1.1 2.2 2.2 5-5L12.3 5z" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 1.5 15 14H1zM7.2 6v4h1.6V6zM8 11.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.8 3H7.2v4.3l3.3 2 .8-1.3-2.5-1.5z" />
  </Base>
);

export const IconArrowUp = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 3 3.5 7.5l1.1 1L7.2 5.9V13h1.6V5.9l2.6 2.6 1.1-1z" />
  </Base>
);

export const IconArrowDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 13l4.5-4.5-1.1-1L8.8 10.1V3H7.2v7.1L4.6 7.5l-1.1 1z" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.3 3.2 8 6.9l3.7-3.7 1.1 1.1L9.1 8l3.7 3.7-1.1 1.1L8 9.1l-3.7 3.7-1.1-1.1L6.9 8 3.2 4.3z" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 10.5 3.5 6l1.1-1L8 8.3 11.4 5l1.1 1z" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 3.5 10.5 8 6 12.5l-1-1.1L8.3 8 5 4.6z" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 2a5 5 0 0 1 3.9 8.1l3 3-1.1 1.1-3-3A5 5 0 1 1 7 2zm0 1.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" />
  </Base>
);

export const IconBell = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 1.5a3.5 3.5 0 0 0-3.5 3.5v2.2L3 9.5V11h10V9.5l-1.5-2.3V5A3.5 3.5 0 0 0 8 1.5zM6.4 12a1.6 1.6 0 0 0 3.2 0z" />
  </Base>
);

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 2 4.5 5.5l1.1 1L7.2 4.9V10h1.6V4.9l1.6 1.6 1.1-1zM3 11.5V13h10v-1.5z" />
  </Base>
);

export const IconDocument = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 1.5h5L12 4.5V14a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 14zM9 2v2.5h2.5z" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 3.5h12v1.6H2zM2 7.2h12v1.6H2zM2 10.9h12v1.6H2z" />
  </Base>
);

export const IconDots = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 3.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm0 3.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm0 3.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z" />
  </Base>
);

export const IconFilter = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 3h12l-4.6 5.4V13L6.6 11.5V8.4z" />
  </Base>
);

export const IconInfo = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.8 6v4H7.2V7zM8 4.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
  </Base>
);
