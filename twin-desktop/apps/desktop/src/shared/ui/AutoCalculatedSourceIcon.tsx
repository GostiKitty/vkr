import type { SourceBadgeIconProps } from "./sourceBadgeIcon";
import { SourceBadgeFxIcon } from "./sourceBadgeIcon";

export { AUTO_CALCULATED_SOURCE_LABEL, isAutoCalculatedDataSource } from "../constants/sourceDataLabels";

export function AutoCalculatedSourceIcon(props: SourceBadgeIconProps) {
  return <SourceBadgeFxIcon {...props} />;
}
