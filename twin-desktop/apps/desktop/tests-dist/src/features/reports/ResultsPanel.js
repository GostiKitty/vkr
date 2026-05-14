import React, { useEffect, useState } from "react";
import { useTwinStore } from "../../entities/twin/twin.store";
import { Tabs } from "../../shared/ui";
import SpaceDetails from "../twin/SpaceDetails";
import SpaceList from "../twin/SpaceList";
import SpaceViewer3D from "../twin/SpaceViewer3D";
import SimulationPanel from "../runs/SimulationPanel";
import ReportGenerator from "./ReportGenerator";
import { formatTemperature, temperatureToColor } from "../twin/twin.theme";
const tabItems = [
    { id: "overview", label: "Обзор" },
    { id: "simulation", label: "Симуляция" },
    { id: "view3d", label: "3D вид" },
];
export function ResultsPanel({ projectId }) {
    const frames = useTwinStore((state) => state.simulationFrames);
    const timeIndex = useTwinStore((state) => state.timeIndex);
    const setTimeIndex = useTwinStore((state) => state.setTimeIndex);
    const thermalGraph = useTwinStore((state) => state.thermalGraph);
    const selectSpace = useTwinStore((state) => state.selectSpace);
    const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
    const [playing, setPlaying] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const currentFrame = frames[timeIndex] ?? null;
    const timeLabel = currentFrame ? formatTime(currentFrame.time) : "—";
    useEffect(() => {
        if (!playing || frames.length < 2) {
            return;
        }
        const interval = setInterval(() => {
            const { setTimeIndex: update, timeIndex: current } = useTwinStore.getState();
            const next = current + 1 >= frames.length ? 0 : current + 1;
            update(next);
        }, 800);
        return () => clearInterval(interval);
    }, [playing, frames.length]);
    const handleSliderChange = (event) => {
        setTimeIndex(Number(event.target.value));
    };
    const handlePlayToggle = () => {
        if (!frames.length) {
            return;
        }
        setPlaying((prev) => !prev);
    };
    useEffect(() => {
        if (!frames.length) {
            setPlaying(false);
        }
    }, [frames.length]);
    const timeline = (<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Режим просмотра</p>
          <h3 className="text-xl font-semibold text-slate-900">Температура по времени</h3>
          <p className="text-sm text-slate-500">Используйте таймлайн, чтобы анимировать распределение тепла.</p>
        </div>
        <div className="flex flex-col gap-3 lg:min-w-[320px]">
          <div className="flex items-center justify-between text-sm font-medium text-slate-600">
            <span>Время</span>
            <span>{timeLabel}</span>
          </div>
          <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={timeIndex} onChange={handleSliderChange} className="w-full accent-slate-900"/>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePlayToggle} disabled={!frames.length} className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition ${playing ? "bg-rose-500 hover:bg-rose-600" : "bg-slate-900 hover:bg-slate-800"}`}>
              {playing ? "Пауза" : "Пуск"}
            </button>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {frames.length ? `${frames.length} шагов` : "Нет данных"}
            </span>
          </div>
        </div>
      </div>
    </div>);
    const overviewContent = (<div className="grid gap-4 lg:grid-cols-[1fr,0.7fr]">
      <SpaceList />
      <SpaceDetails />
    </div>);
    const simulationContent = <SimulationPanel projectId={projectId}/>;
    const view3dContent = (<div className="space-y-4">
      <SpaceViewer3D heatmap caption="Thermal heatmap" height={380}/>
      <GraphPanel graph={thermalGraph} frame={currentFrame} selectedId={selectedSpaceId} onSelect={selectSpace}/>
    </div>);
    const tabContent = {
        overview: overviewContent,
        simulation: simulationContent,
        view3d: view3dContent,
    };
    return (<div className="space-y-6">
      {timeline}
      <Tabs tabs={tabItems.map((item) => ({
            ...item,
            disabled: item.id === "simulation" && !projectId,
        }))} value={activeTab} onChange={setActiveTab}/>
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm transition-all duration-300">
        {tabContent[activeTab]}
      </div>
      <ReportGenerator />
    </div>);
}
function GraphPanel({ graph, frame, selectedId, onSelect, }) {
    if (!graph || !graph.nodes.length) {
        return (<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        Термический граф появится после загрузки модели.
      </div>);
    }
    const width = 600;
    const height = 320;
    const nodes = graph.nodes;
    const edges = graph.edges;
    const temps = frame?.temperatures ?? {};
    const positions = new Map();
    const spaceNodes = nodes.filter((node) => node.type === "space");
    const radius = Math.min(width, height) / 2 - 40;
    spaceNodes.forEach((node, index) => {
        const angle = (index / spaceNodes.length) * Math.PI * 2;
        positions.set(node.id, {
            x: width / 2 + radius * Math.cos(angle),
            y: height / 2 + radius * Math.sin(angle),
        });
    });
    const outdoorPos = { x: width / 2, y: 40 };
    positions.set("outdoor", outdoorPos);
    return (<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Thermal graph</h3>
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height} className="max-w-full">
          {edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) {
                return null;
            }
            return (<line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#cbd5f5" strokeWidth={Math.max(1, edge.conductance * 4)} strokeOpacity={0.8}/>);
        })}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos)
                return null;
            const temp = frame?.temperatures[node.id] ?? node.initialTemp;
            const color = temperatureToColor(temp);
            const isSelected = selectedId === node.id;
            return (<g key={node.id} onClick={() => node.type === "space" && onSelect(node.id)} cursor={node.type === "space" ? "pointer" : "default"}>
                <circle cx={pos.x} cy={pos.y} r={isSelected ? 18 : 14} fill={color} stroke={node.type === "space" ? "#0f172a" : "#64748b"} strokeWidth={node.type === "space" ? 2 : 1} opacity={node.type === "space" ? 0.95 : 0.7}/>
                <text x={pos.x} y={pos.y + 30} textAnchor="middle" className="text-xs font-medium fill-slate-600">
                  {node.label}
                </text>
                <text x={pos.x} y={pos.y + 44} textAnchor="middle" className="text-[10px] fill-slate-400">
                  {formatTemperature(temp)}
                </text>
              </g>);
        })}
        </svg>
      </div>
    </div>);
}
function formatTime(timeHours) {
    const hours = Math.floor(timeHours);
    const minutes = Math.round((timeHours - hours) * 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
export default ResultsPanel;
