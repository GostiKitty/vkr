import { useId, type SVGProps } from "react";

type TherNestLogoProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * Brand mark: a house cradled by nest arcs with an inner thermal pulse.
 * Reads clearly at 16–36 px in the TopBar badge.
 */
export function TherNestLogo({ size = 22, className, ...rest }: TherNestLogoProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      {...rest}
    >
      <defs>
        <linearGradient id={`${gradientId}-warm`} x1="12" y1="15.5" x2="12" y2="12.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B8E4FF" />
          <stop offset="1" stopColor="#FAC024" />
        </linearGradient>
      </defs>

      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path
          d="M3.8 13.8C3.8 8.8 7.4 5.2 12 5.2s8.2 3.6 8.2 8.6"
          strokeWidth="1.55"
          opacity="0.92"
        />
        <path
          d="M6.4 15.6C6.4 12.6 8.8 10.6 12 10.6s5.6 2 5.6 5"
          strokeWidth="1.35"
          opacity="0.42"
        />
        <path d="M12 8.1L16 11.9V16.4H8V11.9L12 8.1Z" strokeWidth="1.45" />
        <path
          d="M9.4 14.1c.75-.55 1.45-.55 2.2 0 .75.55 1.45.55 2.2 0"
          stroke={`url(#${gradientId}-warm)`}
          strokeWidth="1.35"
        />
      </g>
    </svg>
  );
}
