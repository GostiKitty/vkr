import type { Space, Twin } from "../../shared/api/types";

export interface UseTwinResult {
  twin: Twin | null;
  spaces: Space[];
  selectedSpace: Space | null;
  selectSpace: (spaceId: string | null) => void;
  loading: boolean;
  error: string | null;
}

export type { Twin, Space };
