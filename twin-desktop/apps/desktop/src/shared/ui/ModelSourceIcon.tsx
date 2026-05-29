import type { SourceBadgeIconProps } from "./sourceBadgeIcon";
import { SourceBadgeHouseIcon } from "./sourceBadgeIcon";

export { MODEL_SOURCE_LABEL, isModelDataSource } from "../constants/sourceDataLabels";

export function ModelSourceIcon(props: SourceBadgeIconProps) {
  return <SourceBadgeHouseIcon {...props} />;
}
