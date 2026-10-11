import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  House line-art placeholder for a listing with no image or a broken
  image. Consistent illustration style: 1.5px ink outlines, round caps,
  oat/cream/ivory fills, single clay accent shape.
*/
export function HousePlaceholder({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 200"
      className={cn("h-full w-full", className)}
      role="img"
      aria-label="Chưa có ảnh phòng"
      fill="none"
    >
      <rect width="300" height="200" fill="var(--color-oat)" />
      <g
        stroke="var(--color-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* body */}
        <path d="M75 130 L75 90 L150 60 L225 90 L225 130 Z" fill="var(--color-cream)" />
        {/* roof */}
        <path d="M65 92 L150 55 L235 92" fill="var(--color-ivory)" />
        {/* door */}
        <rect x="138" y="98" width="24" height="32" rx="2" fill="var(--color-clay)" />
        {/* windows */}
        <rect x="95" y="98" width="24" height="18" rx="2" fill="var(--color-cream)" />
        <line x1="107" y1="98" x2="107" y2="116" />
        <rect x="181" y="98" width="24" height="18" rx="2" fill="var(--color-cream)" />
        <line x1="193" y1="98" x2="193" y2="116" />
        {/* ground */}
        <line x1="55" y1="130" x2="245" y2="130" />
        <line x1="90" y1="145" x2="120" y2="145" />
        <line x1="180" y1="145" x2="220" y2="145" />
      </g>
    </svg>
  );
}

/* Magnifier over a map pin — used for empty search results. */
export function SearchEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-hidden
      fill="none"
    >
      <rect width="320" height="240" fill="var(--color-oat)" />
      <g
        stroke="var(--color-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* map fold */}
        <path
          d="M60 80 L130 60 L190 80 L260 60 L260 160 L190 180 L130 160 L60 180 Z"
          fill="var(--color-cream)"
        />
        <path d="M130 60 L130 160" />
        <path d="M190 80 L190 180" />
        {/* roads */}
        <path d="M75 150 L115 105" strokeDasharray="4 6" />
        <path d="M205 120 L245 90" strokeDasharray="4 6" />
        {/* pin accent */}
        <path
          d="M160 105 C147 105 137 115 137 128 C137 141 160 160 160 160 C160 160 183 141 183 128 C183 115 173 105 160 105 Z"
          fill="var(--color-clay)"
        />
        <circle cx="160" cy="127" r="7" fill="var(--color-cream)" />
        {/* magnifier */}
        <circle cx="225" cy="185" r="28" fill="var(--color-cream)" strokeWidth="3" />
        <line x1="205" y1="205" x2="185" y2="225" strokeWidth="5" />
      </g>
    </svg>
  );
}

/* House with a key — favorites empty state. */
export function FavoriteEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-hidden
      fill="none"
    >
      <rect width="320" height="240" fill="var(--color-oat)" />
      <g
        stroke="var(--color-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M70 140 L70 100 L160 70 L250 100 L250 140 Z"
          fill="var(--color-cream)"
        />
        <path d="M58 102 L160 65 L262 102" fill="var(--color-ivory)" />
        <rect x="148" y="108" width="24" height="32" rx="2" fill="var(--color-clay)" />
        <rect x="90" y="108" width="24" height="18" rx="2" fill="var(--color-cream)" />
        <rect x="206" y="108" width="24" height="18" rx="2" fill="var(--color-cream)" />
        <line x1="58" y1="140" x2="262" y2="140" />
        {/* floating key */}
        <g transform="translate(255,165)">
          <circle cx="0" cy="0" r="10" fill="var(--color-clay)" />
          <circle cx="0" cy="0" r="3.5" fill="var(--color-oat)" />
          <line x1="10" y1="0" x2="26" y2="0" strokeWidth="4" />
          <line x1="20" y1="0" x2="20" y2="7" strokeWidth="4" />
        </g>
      </g>
    </svg>
  );
}

/* Two speech bubbles — messages empty state. */
export function MessagesEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-hidden
      fill="none"
    >
      <rect width="320" height="240" fill="var(--color-oat)" />
      <g
        stroke="var(--color-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M60 70 Q60 55 75 55 L225 55 Q240 55 240 70 L240 130 Q240 145 225 145 L100 145 L75 175 L75 145 L75 145 Q60 145 60 130 Z"
          fill="var(--color-cream)"
        />
        <path
          d="M110 165 Q110 152 125 152 L260 152 Q275 152 275 165 L275 205 Q275 218 260 218 L135 218 L160 218 L135 218 L135 218 L128 236 L128 218 L125 218 Q110 218 110 205 Z"
          fill="var(--color-clay)"
        />
      </g>
    </svg>
  );
}

/* Bot off — AI unavailable. */
export function AiUnavailableIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-hidden
      fill="none"
    >
      <rect width="320" height="240" fill="var(--color-oat)" />
      <g
        stroke="var(--color-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="100" y="80" width="120" height="90" rx="14" fill="var(--color-cream)" />
        <line x1="160" y1="60" x2="160" y2="80" />
        <circle cx="160" cy="55" r="6" fill="var(--color-clay)" />
        <circle cx="130" cy="115" r="8" fill="var(--color-ivory)" />
        <circle cx="190" cy="115" r="8" fill="var(--color-ivory)" />
        <path d="M125 145 q35 12 70 0" />
      </g>
      <g stroke="var(--color-clay)" strokeWidth="4" strokeLinecap="round">
        <line x1="95" y1="70" x2="235" y2="190" />
      </g>
    </svg>
  );
}

/* 404 page illustration — closed door. */
export function NotFoundIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-hidden
      fill="none"
    >
      <rect width="320" height="240" fill="var(--color-oat)" />
      <g
        stroke="var(--color-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="120" y="60" width="80" height="130" rx="4" fill="var(--color-cream)" />
        <rect x="128" y="68" width="64" height="114" rx="3" fill="var(--color-ivory)" />
        <circle cx="178" cy="125" r="4" fill="var(--color-clay)" />
        <line x1="90" y1="190" x2="230" y2="190" />
      </g>
    </svg>
  );
}

/*
  Product-rail icon set: 32px grid, 2px stroke, round caps — the same
  weight/rhythm as Zillow's rail glyphs. currentColor so active/inactive
  states come from the parent.
*/
function RailIconBase({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function RailSearchIcon({ className }: { className?: string }) {
  return (
    <RailIconBase className={className}>
      <circle cx="14" cy="14" r="9" />
      <line x1="21" y1="21" x2="27.5" y2="27.5" />
    </RailIconBase>
  );
}

export function RailHeartIcon({ className }: { className?: string }) {
  return (
    <RailIconBase className={className}>
      <path d="M16 28.5C9.5 23 5 18.6 5 13.4 5 10 7.4 7.5 10.6 7.5c2.2 0 4 1.3 5.4 3.3 1.4-2 3.2-3.3 5.4-3.3 3.2 0 5.6 2.5 5.6 5.9 0 5.2-4.5 9.6-11 15.1z" />
    </RailIconBase>
  );
}

export function RailMessageIcon({ className }: { className?: string }) {
  return (
    <RailIconBase className={className}>
      <path d="M24 5H8a3.5 3.5 0 0 0-3.5 3.5v11A3.5 3.5 0 0 0 8 23h2v5.5L15.5 23H24a3.5 3.5 0 0 0 3.5-3.5v-11A3.5 3.5 0 0 0 24 5z" />
    </RailIconBase>
  );
}

export function RailUserIcon({ className }: { className?: string }) {
  return (
    <RailIconBase className={className}>
      <circle cx="16" cy="11" r="5.5" />
      <path d="M7 27c1.7-4.5 5.1-7 9-7s7.3 2.5 9 7" />
    </RailIconBase>
  );
}

export function RailBuildingIcon({ className }: { className?: string }) {
  return (
    <RailIconBase className={className}>
      <rect x="8" y="4" width="16" height="24" rx="2" />
      <line x1="12" y1="9.5" x2="14.5" y2="9.5" />
      <line x1="17.5" y1="9.5" x2="20" y2="9.5" />
      <line x1="12" y1="14" x2="14.5" y2="14" />
      <line x1="17.5" y1="14" x2="20" y2="14" />
      <path d="M13.5 28v-4.5h5V28" />
    </RailIconBase>
  );
}
