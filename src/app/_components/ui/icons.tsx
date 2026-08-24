import type { SVGProps } from "react";

/*
 * AuditorAI icon family — drawn on a 24px grid, 1.6px stroke, round caps.
 * One voice: technical, quiet, subject-native (roads, evidence, road users).
 * No filled blobs, no sparkles. `fill="none"` unless the glyph demands ink.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ————— brand ————— */

export function MarkLogo(props: IconProps) {
  return (
    <Base strokeWidth={1.7} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <path d="M6 16.5 12 7l6 9.5" />
      <circle cx="12" cy="13.4" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

/* ————— direction & process ————— */

export function ArrowRight(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" />
    </Base>
  );
}

export function ArrowLeft(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 12H5M10.5 6.5 5 12l5.5 5.5" />
    </Base>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Base>
  );
}

export function Check(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m4.5 12.5 5 5L19.5 7" />
    </Base>
  );
}

export function X(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}

export function Plus(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function Sun(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" />
    </Base>
  );
}

export function Moon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Base>
  );
}

export function Spinner(props: IconProps) {
  return (
    <Base {...props} className={`anim-pulse ${props.className ?? ""}`}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Base>
  );
}

/* ————— audit nouns ————— */

export function Pin(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s-6.5-5.4-6.5-10.2A6.5 6.5 0 0 1 12 4.3a6.5 6.5 0 0 1 6.5 6.5C18.5 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.8" r="2" />
    </Base>
  );
}

/** Evidence clause: a document carrying quoted lines. */
export function Clause(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 3.5h7.5L19 8v12.5H7z" />
      <path d="M14 3.5V8h5" />
      <path d="M9.8 12h5.4M9.8 15h5.4M9.8 18h3.2" />
    </Base>
  );
}

/** Compliance question: weighing two claims. */
export function Scales(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4v16M8.5 20h7M12 6.5 5.5 8m6.5-1.5L18.5 8" />
      <path d="M5.5 8 3 13.5a2.8 2.8 0 0 0 5 0L5.5 8ZM18.5 8 16 13.5a2.8 2.8 0 0 0 5 0L18.5 8Z" />
    </Base>
  );
}

export function AlertTriangle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.8 2.8 19.5h18.4L12 3.8Z" />
      <path d="M12 10v4.2" />
      <circle cx="12" cy="16.9" r="0.5" fill="currentColor" stroke="none" />
    </Base>
  );
}

/** Issued revision: a sealed rosette. */
export function Seal(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="10" r="6" />
      <path d="m8.8 14.8-1.3 5 4.5-2.3 4.5 2.3-1.3-5" />
      <path d="m9.8 10 1.6 1.6 2.8-3" />
    </Base>
  );
}

export function Road(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7.5 3.5 4 20.5M16.5 3.5 20 20.5" />
      <path d="M12 4v2.6M12 10.4V13M12 16.8v2.6" strokeDasharray="0 0" />
    </Base>
  );
}

export function Clock(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  );
}

export function Layers(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" />
      <path d="m4.5 12.5 7.5 4 7.5-4M4.5 16.5l7.5 4 7.5-4" />
    </Base>
  );
}

/* ————— files & actions ————— */

export function Upload(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" />
      <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </Base>
  );
}

export function Paperclip(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m20 11.5-7.9 7.9a5 5 0 0 1-7.1-7.1l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.5-2.5l7.3-7.3" />
    </Base>
  );
}

export function Download(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4.5v11M7.5 11l4.5 4.5L16.5 11" />
      <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </Base>
  );
}

export function Printer(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 8V3.5h10V8" />
      <rect x="4" y="8" width="16" height="8" rx="1.5" />
      <path d="M7 13.5h10v7H7z" />
    </Base>
  );
}

/* ————— road users (affected-party glyphs for findings) ————— */

export function Pedestrian(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="4.6" r="2" />
      <path d="M12 7.2v5.3M12 9.4l-3.2 1.4M12 9.4l3 1.6M12 12.5l-2.6 7M12 12.5l2.6 3 1.4 4" />
    </Base>
  );
}

export function Cyclist(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="5.5" cy="16.8" r="3.1" />
      <circle cx="18.5" cy="16.8" r="3.1" />
      <path d="M8.5 16.8h5.8L11.8 8H9.4M11.8 8l3.1 3.2h3.4" />
      <circle cx="12.4" cy="4.4" r="1.6" />
    </Base>
  );
}

export function Motorcyclist(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="5.5" cy="16.8" r="3.1" />
      <circle cx="18.5" cy="16.8" r="3.1" />
      <path d="M8.5 16.8h6.2l-1.6-6h-3" />
      <path d="m13.1 10.8 3.2-3.4 2.4.6" />
      <circle cx="13.6" cy="4.2" r="1.6" />
    </Base>
  );
}

export function Vehicle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 13.5 5.5 8a2 2 0 0 1 1.9-1.5h9.2A2 2 0 0 1 18.5 8l1.5 5.5" />
      <path d="M3.5 13.5h17v4h-17z" />
      <path d="M6.2 20v-2.5M17.8 20v-2.5" />
      <path d="M6.5 15.5h1.8M15.7 15.5h1.8" />
    </Base>
  );
}

export function HorseRider(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="14.5" cy="4.4" r="1.7" />
      <path d="M13.5 6.5c-1 2-3.5 3-5 5.5-1 1.6-1 3.5-1 5.5" />
      <path d="M13.5 6.5c.5 2.5 0 4.5-1.5 6.5l2 7.5M16 8.5l3-2.5 1.5 2" />
      <path d="M9 20.5h9.5" />
    </Base>
  );
}

/** Map a road_users string to its glyph; falls back to a generic user dot. */
export function RoadUserGlyph({ user, ...rest }: IconProps & { user: string }) {
  const u = user.toLowerCase();
  if (u.includes("pedestrian")) return <Pedestrian {...rest} />;
  if (u.includes("cycl")) return <Cyclist {...rest} />;
  if (u.includes("motorcycl")) return <Motorcyclist {...rest} />;
  if (u.includes("horse")) return <HorseRider {...rest} />;
  if (u.includes("vehicle") || u.includes("driver") || u.includes("occupant")) return <Vehicle {...rest} />;
  return (
    <Base {...rest}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </Base>
  );
}
