import type { BuildSceneCameraState } from "../view3d/sceneContracts";

interface OrientationHelper3DProps {
  cameraState: BuildSceneCameraState | null;
  levelName: string;
}

export function OrientationHelper3D({ cameraState, levelName }: OrientationHelper3DProps) {
  const azimuthDeg = cameraState ? (-cameraState.azimuthRad * 180) / Math.PI : 0;

  return (
    <div className="ui-overlay pointer-events-none flex items-center gap-2">
      <div
        className="relative aspect-square w-14 shrink-0 overflow-hidden rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] shadow-sm"
        aria-label={`Компас 3D, ${levelName}`}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="2" />
          <circle cx="50" cy="50" r="3" fill="#cbd5e1" />
          <text x="50" y="15" textAnchor="middle" fontSize="12" fontWeight="700" fill="#64748b">
            С
          </text>
          <text x="50" y="92" textAnchor="middle" fontSize="12" fontWeight="700" fill="#64748b">
            Ю
          </text>
          <text x="13" y="54" textAnchor="middle" fontSize="12" fontWeight="700" fill="#64748b">
            З
          </text>
          <text x="87" y="54" textAnchor="middle" fontSize="12" fontWeight="700" fill="#64748b">
            В
          </text>
          <g transform={`rotate(${azimuthDeg} 50 50)`}>
            <path d="M50 19 L57 47 H43 Z" fill="#ef4444" />
            <path d="M50 81 L57 53 H43 Z" fill="#cbd5e1" />
            <rect x="49" y="30" width="2" height="40" rx="1" fill="#ef4444" opacity="0.75" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default OrientationHelper3D;
