import type { AnalysisResult, ClockTopology, SourceSyncParams } from '../types/timing.ts';

interface Props {
  result: AnalysisResult;
  isInputPath: boolean;
  tcoLabel: string;    // e.g., "Tco src" or "Tco FPGA"
  boardLabel: string;  // e.g., "Board delay"
  tco: number;
  boardDelay: number;
  routingDelay: number;
  topology: ClockTopology;
  sourceSyncParams?: SourceSyncParams;
}

const W = 800;
const DATA_Y = 45;       // Y center for data path
const CLK_Y = 125;       // Y center for clock path
const BOX_W = 120;
const BOX_H = 45;

export function PathDiagram({ isInputPath, tcoLabel, boardLabel, tco, boardDelay, routingDelay, topology, sourceSyncParams }: Props) {
  const isSourceSync = topology === 'source_sync';
  const showSourceSyncClk = isSourceSync;
  const H = showSourceSyncClk ? 165 : 155;

  // Data path blocks
  const blocks = isInputPath
    ? [
        { x: 40, label: 'Source FF', sublabel: '(Launch)', color: '#4fc3f7' },
        { x: 250, label: 'Board Trace', sublabel: boardLabel, color: '#78909c' },
        { x: 460, label: 'FPGA Pin', sublabel: '', color: '#ab47bc' },
        { x: 650, label: 'FPGA FF', sublabel: '(Capture)', color: '#ff7043' },
      ]
    : [
        { x: 40, label: 'FPGA FF', sublabel: '(Launch)', color: '#4fc3f7' },
        { x: 250, label: 'FPGA Pin', sublabel: '', color: '#ab47bc' },
        { x: 460, label: 'Board Trace', sublabel: boardLabel, color: '#78909c' },
        { x: 650, label: 'Dest FF', sublabel: '(Capture)', color: '#ff7043' },
      ];

  const delays = isInputPath
    ? [
        { label: tcoLabel, value: tco },
        { label: 'Board', value: boardDelay },
        { label: 'Routing', value: routingDelay },
      ]
    : [
        { label: tcoLabel, value: tco },
        { label: 'Routing', value: routingDelay },
        { label: 'Board', value: boardDelay },
      ];

  // Clock source positions
  const oscX = 350; // Oscillator block center-X
  const oscW = 100;
  const sourceFFCenter = blocks[0].x + BOX_W / 2;
  const captureFFCenter = blocks[3].x + BOX_W / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="path-diagram-svg">
      <rect x={0} y={0} width={W} height={H} fill="#1a1a2e" />

      {/* Section label: Data Path */}
      <text x={15} y={DATA_Y - BOX_H / 2 - 8} fill="#6a6a8a" fontSize={9} fontFamily="monospace">DATA PATH</text>

      {/* Data path blocks & arrows */}
      {blocks.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x} y={DATA_Y - BOX_H / 2}
            width={BOX_W} height={BOX_H}
            rx={6} ry={6}
            fill="none" stroke={b.color} strokeWidth={2}
          />
          <text x={b.x + BOX_W / 2} y={DATA_Y - 3} fill="#c8c8e0"
            fontSize={11} textAnchor="middle" fontFamily="monospace">{b.label}</text>
          {b.sublabel && (
            <text x={b.x + BOX_W / 2} y={DATA_Y + 13} fill={b.color}
              fontSize={9} textAnchor="middle" fontFamily="monospace" fontWeight="bold">
              {b.sublabel}
            </text>
          )}

          {i < blocks.length - 1 && (
            <g>
              <line
                x1={b.x + BOX_W} y1={DATA_Y}
                x2={blocks[i + 1].x} y2={DATA_Y}
                stroke="#6a6a8a" strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
              />
              <text
                x={(b.x + BOX_W + blocks[i + 1].x) / 2}
                y={DATA_Y - BOX_H / 2 - 5}
                fill="#ffa726" fontSize={9} textAnchor="middle" fontFamily="monospace"
              >
                {delays[i].label}: {delays[i].value.toFixed(1)} ns
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Clock distribution section for system-sync mode */}
      {topology === 'system_sync' && (
        <g>
          <text x={15} y={CLK_Y - 20} fill="#6a6a8a" fontSize={9} fontFamily="monospace">CLOCK DISTRIBUTION</text>

          {/* Oscillator block */}
          <rect x={oscX - oscW / 2} y={CLK_Y - 15} width={oscW} height={30}
            rx={15} ry={15} fill="none" stroke="#4fc3f7" strokeWidth={2} strokeDasharray="4,2" />
          <text x={oscX} y={CLK_Y + 4} fill="#4fc3f7" fontSize={10}
            textAnchor="middle" fontFamily="monospace">Oscillator</text>

          {/* Arrow to source FF */}
          <line x1={oscX - oscW / 2} y1={CLK_Y}
            x2={sourceFFCenter} y2={CLK_Y}
            stroke="#4fc3f7" strokeWidth={1.5} strokeDasharray="4,2" />
          <line x1={sourceFFCenter} y1={CLK_Y}
            x2={sourceFFCenter} y2={DATA_Y + BOX_H / 2}
            stroke="#4fc3f7" strokeWidth={1.5} strokeDasharray="4,2"
            markerEnd="url(#clkArrow)" />

          {/* Arrow to capture FF */}
          <line x1={oscX + oscW / 2} y1={CLK_Y}
            x2={captureFFCenter} y2={CLK_Y}
            stroke="#4fc3f7" strokeWidth={1.5} strokeDasharray="4,2" />
          <line x1={captureFFCenter} y1={CLK_Y}
            x2={captureFFCenter} y2={DATA_Y + BOX_H / 2}
            stroke="#4fc3f7" strokeWidth={1.5} strokeDasharray="4,2"
            markerEnd="url(#clkArrow)" />

          <text x={oscX} y={CLK_Y + 25} fill="#4fc3f780" fontSize={8}
            textAnchor="middle" fontFamily="monospace">Common clock (nominal skew baseline)</text>
        </g>
      )}

      {showSourceSyncClk && sourceSyncParams && (
        <g>
          <text x={15} y={CLK_Y - 20} fill="#6a6a8a" fontSize={9} fontFamily="monospace">FORWARDED CLOCK PATH</text>

          {/* Clock originates from launch-side device */}
          <text x={sourceFFCenter} y={CLK_Y - 5} fill="#4fc3f7" fontSize={9}
            textAnchor="middle" fontFamily="monospace">Clk Out</text>

          {/* Forwarded clock board trace */}
          <line x1={sourceFFCenter + 30} y1={CLK_Y + 5}
            x2={captureFFCenter - 30} y2={CLK_Y + 5}
            stroke="#4fc3f7" strokeWidth={2} strokeDasharray="6,3"
            markerEnd="url(#clkArrow)" />

          {/* Fwd clock delay label */}
          <text x={(sourceFFCenter + captureFFCenter) / 2} y={CLK_Y - 8}
            fill="#4fc3f7" fontSize={9} textAnchor="middle" fontFamily="monospace">
            Fwd Clk: {sourceSyncParams.fwdClockBoardDelayMin.toFixed(1)}~{sourceSyncParams.fwdClockBoardDelayMax.toFixed(1)} ns
          </text>

          {/* Arrow down to capture FF */}
          <line x1={captureFFCenter} y1={CLK_Y + 5}
            x2={captureFFCenter} y2={DATA_Y + BOX_H / 2}
            stroke="#4fc3f7" strokeWidth={1.5} strokeDasharray="4,2"
            markerEnd="url(#clkArrow)" />

          {/* Vertical from source FF down to clock out */}
          <line x1={sourceFFCenter} y1={DATA_Y + BOX_H / 2}
            x2={sourceFFCenter} y2={CLK_Y + 5}
            stroke="#4fc3f7" strokeWidth={1.5} strokeDasharray="4,2" />

          <text x={(sourceFFCenter + captureFFCenter) / 2} y={CLK_Y + 22}
            fill="#4fc3f780" fontSize={8} textAnchor="middle" fontFamily="monospace">
            Clock travels with data (source synchronous)
          </text>
        </g>
      )}

      {/* Arrow marker definitions */}
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#6a6a8a" />
        </marker>
        <marker id="clkArrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#4fc3f7" />
        </marker>
      </defs>
    </svg>
  );
}
