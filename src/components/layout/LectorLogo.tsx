import { cn } from '@/lib/utils';

interface LectorLogoProps {
  className?: string;
}

export function LectorLogo({ className }: LectorLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="LectorBook logo"
      className={cn('w-8 h-8 shrink-0', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="lectorbook-gradient" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lectorbook-gradient)" />

      <path
        d="M20 17.5C20 16.67 20.67 16 21.5 16H41.5C42.33 16 43 16.67 43 17.5V44.5C43 45.33 42.33 46 41.5 46H22.5C21.12 46 20 44.88 20 43.5V17.5Z"
        fill="#FFFFFF"
        fillOpacity="0.95"
      />
      <path d="M24 22H39" stroke="#6366F1" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 27H39" stroke="#6366F1" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
      <path d="M24 32H34" stroke="#6366F1" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
      <path d="M25 38H39" stroke="#A78BFA" strokeWidth="3" strokeLinecap="round" />

      <path d="M14 17L30 17" stroke="#C4B5FD" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d="M14 22L30 22" stroke="#C4B5FD" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
