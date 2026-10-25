import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const stroke = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  ...props,
});

export function ArrowUpRight({ size = 16, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function ArrowDown({ size = 16, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

export function ArrowUp({ size = 16, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function Send({ size = 16, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" />
    </svg>
  );
}

export function Close({ size = 18, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ChevronDown({ size = 16, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function Download({ size = 16, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

export function Play({ size = 16, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="M7 5v14l11-7L7 5Z" />
    </svg>
  );
}

export function Code({ size = 16, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
    </svg>
  );
}

export function Mail({ size = 20, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function Spark({ size = 16, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  );
}

export function GitHub({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable={false} {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
