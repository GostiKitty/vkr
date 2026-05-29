import type { ImgHTMLAttributes } from "react";
import autoCalculatedSourceIconUrl from "../assets/auto-calculated-source.png";
import demoFallbackSourceIconUrl from "../assets/demo-fallback-source.png";
import modelSourceIconUrl from "../assets/model-source.png";

export type SourceBadgeIconProps = {
  size?: number;
  className?: string;
};

/** Натуральные пропорции эталонных PNG. */
const FX_ASPECT = 1024 / 933;
const HOUSE_ASPECT = 853 / 849;
const REFRESH_ASPECT = 920 / 768;

type SourceBadgeRasterIconProps = SourceBadgeIconProps &
  Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
    src: string;
    aspect: number;
    variant: "fx" | "house" | "refresh";
  };

/** Растровая иконка в фиксированном контейнере — без фильтров и без растягивания. */
function SourceBadgeRasterIcon({
  src,
  variant,
  aspect,
  size = 18,
  className = "",
  ...rest
}: SourceBadgeRasterIconProps) {
  const height = size;
  const width = Math.round(size * aspect);

  return (
    <span
      className={`ui-source-badge-icon-wrap ui-source-badge-icon-wrap--${variant} ${className}`.trim()}
      style={{ width, height }}
      aria-hidden
    >
      <img src={src} alt="" className="ui-source-badge-icon" {...rest} />
    </span>
  );
}

export function SourceBadgeFxIcon(
  props: SourceBadgeIconProps & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">
) {
  return (
    <SourceBadgeRasterIcon
      src={autoCalculatedSourceIconUrl}
      variant="fx"
      aspect={FX_ASPECT}
      {...props}
    />
  );
}

export function SourceBadgeHouseIcon(
  props: SourceBadgeIconProps & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">
) {
  return (
    <SourceBadgeRasterIcon
      src={modelSourceIconUrl}
      variant="house"
      aspect={HOUSE_ASPECT}
      {...props}
    />
  );
}

export function SourceBadgeRefreshIcon(
  props: SourceBadgeIconProps & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">
) {
  return (
    <SourceBadgeRasterIcon
      src={demoFallbackSourceIconUrl}
      variant="refresh"
      aspect={REFRESH_ASPECT}
      {...props}
    />
  );
}

/** Слегка утоньшает контур fx на прозрачном PNG (без перекраски в сплошной квадрат). */
export function SourceBadgeIconFilters() {
  return (
    <svg aria-hidden className="ui-source-badge-filters" width={0} height={0}>
      <defs>
        <filter
          id="ui-source-badge-fx-thin"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feMorphology in="SourceAlpha" operator="erode" radius="0.42" result="thinAlpha" />
          <feComposite in="SourceGraphic" in2="thinAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
