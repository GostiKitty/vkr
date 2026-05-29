import type { SourceBadgeIconProps } from "./sourceBadgeIcon";
import { SourceBadgeRefreshIcon } from "./sourceBadgeIcon";

export { DEMO_FALLBACK_SOURCE_LABEL, isDemoFallbackDataSource } from "../constants/sourceDataLabels";

export function DemoFallbackSourceIcon(props: SourceBadgeIconProps) {
  return <SourceBadgeRefreshIcon {...props} />;
}
