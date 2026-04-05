import type { ClockParams, CaptureClockParams, AnalysisResult } from '../types/timing.ts';

interface Props {
  clock: ClockParams;
  result: AnalysisResult;
  isInputPath: boolean;
  captureClock?: CaptureClockParams;
}

const W = 800;
const PLOT_LEFT = 100;
const PLOT_RIGHT = W - 40;
const PLOT_W = PLOT_RIGHT - PLOT_LEFT;

export function TimingDiagram({ clock, result, isInputPath, captureClock }: Props) {
  const window = result.captureTime - result.launchTime;
  if (window <= 0) return null;

  // Show context before launch and after capture so edge neighborhoods are visible.
  const preEdgeMargin = Math.max(1, window * 0.2);
  const postEdgeMargin = Math.max(1, window * 0.2);
  const chartStart = -preEdgeMargin;
  const chartEnd = window + postEdgeMargin;
  const chartSpan = chartEnd - chartStart;

  const toX = (ns: number) => PLOT_LEFT + ((ns - chartStart) / chartSpan) * PLOT_W;

  const launchX = toX(0);
  const captureX = toX(window);
  const dataStartX = toX(chartStart);
  const dataEndX = toX(chartEnd);
  const arrMinX = toX(result.dataArrivalMin);
  const arrMaxX = toX(result.dataArrivalMax);
  const setupReqX = toX(result.setupRequired);
  const holdReqX = toX(result.holdRequired);

  const hasSetupV = result.isSetupViolation;
  const hasHoldV = result.isHoldViolation;

  const edgeCfg = result.edgeConfig;
  const launchSymbol = edgeCfg.launchEdge === 'rising' ? '↑' : '↓';
  const captureSymbol = edgeCfg.captureEdge === 'rising' ? '↑' : '↓';

  // Independent capture clock mode: show separate lane whenever capture clock is provided.
  const hasIndependentCap = !!captureClock;
  const extraLane = hasIndependentCap ? 60 : 0;
  // Compact height so the full diagram fits without requiring container scrolling.
  const H = 390 + extraLane;

  // Clock waveform Y
  const clkY = 60;
  const clkH = 40;
  const launchClkEdgeY = edgeCfg.launchEdge === 'rising' ? clkY : clkY + clkH;
  const capClkY = clkY + extraLane;
  const captureClkEdgeY = edgeCfg.captureEdge === 'rising' ? capClkY : capClkY + clkH;
  // Data waveform Y
  const dataY = 140 + extraLane;
  const dataH = 40;
  // Margin annotations Y
  const annY = 220 + extraLane;

  const duty = clock.dutyCycle / 100;
  const period = clock.period;
  const highTime = period * duty;

  // Build launch clock polyline
  const launchClkPoints = buildClockPoints(
    clkY,
    clkH,
    toX,
    chartStart,
    chartEnd,
    period,
    highTime,
    0,
    edgeCfg.launchEdge,
  );

  // Build capture clock polyline (independent or same as launch)
  const capDuty = hasIndependentCap ? captureClock!.dutyCycle / 100 : duty;
  const capPeriod = hasIndependentCap ? captureClock!.period : period;
  const capHighTime = capPeriod * capDuty;
  const captureClkPoints = hasIndependentCap
    ? buildClockPoints(
      capClkY,
      clkH,
      toX,
      chartStart,
      chartEnd,
      capPeriod,
      capHighTime,
      window,
      edgeCfg.captureEdge,
    )
    : null;

  // Topology label
  const topoLabel = result.topology === 'source_sync' ? 'Source Synchronous' : 'System Synchronous';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="timing-diagram-svg">
      <rect x={0} y={0} width={W} height={H} fill="#1a1a2e" />

      {/* Grid */}
      {Array.from({ length: Math.ceil(chartEnd) - Math.floor(chartStart) + 1 }, (_, i) => {
        const t = Math.floor(chartStart) + i;
        return (
        <line key={i} x1={toX(t)} y1={30} x2={toX(t)} y2={H - 10}
          stroke="#2a2a4a" strokeWidth={0.5} />
        );
      })}
      {Array.from({ length: Math.ceil(chartEnd) - Math.floor(chartStart) + 1 }, (_, i) => {
        const t = Math.floor(chartStart) + i;
        return (
        <text key={i} x={toX(t)} y={25} fill="#6a6a8a" fontSize={9}
          textAnchor="middle" fontFamily="monospace">{t}</text>
        );
      })}
      <text x={PLOT_RIGHT + 22} y={17} fill="#c8c8e0" fontSize={10} fontFamily="monospace">ns</text>

      {/* Topology badge */}
      <text x={PLOT_LEFT} y={15} fill="#6a6a8a" fontSize={8} fontFamily="monospace">{topoLabel}</text>

      {/* Timing summary */}
      <rect x={PLOT_RIGHT - 210} y={32} width={200} height={30} rx={4} ry={4}
        fill="rgba(13,13,26,0.65)" stroke="#2a2a4a" strokeWidth={1} />
      <text x={PLOT_RIGHT - 202} y={44} fill="#ffa726" fontSize={8} fontFamily="monospace">
        Arrival(min/max): {result.dataArrivalMin.toFixed(2)} / {result.dataArrivalMax.toFixed(2)} ns
      </text>
      <text x={PLOT_RIGHT - 202} y={56} fill="#4fc3f7" fontSize={8} fontFamily="monospace">
        Required(setup/hold): {result.setupRequired.toFixed(2)} / {result.holdRequired.toFixed(2)} ns
      </text>

      {/* Launch clock waveform */}
      <text x={PLOT_LEFT - 8} y={clkY + clkH / 2 + 4} fill="#c8c8e0"
        fontSize={11} textAnchor="end" fontFamily="monospace">{hasIndependentCap ? 'Launch Clk' : 'Clock'}</text>
      <polyline points={launchClkPoints} fill="none" stroke="#4fc3f7" strokeWidth={2.5} />

      {/* Capture clock waveform (independent) */}
      {hasIndependentCap && captureClkPoints && (
        <>
          <text x={PLOT_LEFT - 8} y={capClkY + clkH / 2 + 4} fill="#c8c8e0"
            fontSize={11} textAnchor="end" fontFamily="monospace">Capture Clk</text>
          <polyline points={captureClkPoints} fill="none" stroke="#ff7043" strokeWidth={2.5} />
        </>
      )}

      {/* Clock edge points */}
      <circle cx={launchX} cy={launchClkEdgeY} r={5} fill="#4fc3f7" stroke="#0d0d1a" strokeWidth={1.5} />
      <circle cx={captureX} cy={captureClkEdgeY} r={5} fill="#ff7043" stroke="#0d0d1a" strokeWidth={1.5} />

      {/* Launch edge marker */}
      <line x1={launchX} y1={30} x2={launchX} y2={H - 20}
        stroke="#4fc3f7" strokeWidth={2} strokeDasharray="6,3" />
      <text x={launchX + 4} y={H - 5} fill="#4fc3f7" fontSize={10}
        textAnchor="start" fontFamily="monospace" fontWeight="bold">LAUNCH {launchSymbol}</text>

      {/* Capture edge marker */}
      <line x1={captureX} y1={30} x2={captureX} y2={H - 20}
        stroke="#ff7043" strokeWidth={2} strokeDasharray="6,3" />
      <text x={captureX - 4} y={H - 5} fill="#ff7043" fontSize={10}
        textAnchor="end" fontFamily="monospace" fontWeight="bold">CAPTURE {captureSymbol}</text>

      {/* Data waveform label */}
      <text x={PLOT_LEFT - 8} y={dataY + dataH / 2 + 4} fill="#c8c8e0"
        fontSize={11} textAnchor="end" fontFamily="monospace">
        {isInputPath ? 'Data@FF' : 'Data@Dest'}
      </text>

      {/* Setup window shading */}
      <rect x={setupReqX} y={dataY - 5} width={captureX - setupReqX} height={dataH + 10}
        fill="rgba(255,152,0,0.2)" />
      {/* Hold window shading */}
      <rect x={launchX} y={dataY - 5} width={holdReqX - launchX} height={dataH + 10}
        fill="rgba(66,165,245,0.2)" />
      {/* Data arrival range */}
      <rect x={arrMinX} y={dataY} width={arrMaxX - arrMinX} height={dataH}
        fill="rgba(255,183,77,0.25)" />

      {/* Data waveform */}
      <polyline
        points={`${dataStartX},${dataY + dataH} ${arrMinX},${dataY + dataH} ${arrMaxX},${dataY} ${dataEndX},${dataY}`}
        fill="none" stroke={hasSetupV || hasHoldV ? '#ef5350' : '#66bb6a'} strokeWidth={2}
      />
      <polyline
        points={`${dataStartX},${dataY} ${arrMinX},${dataY} ${arrMaxX},${dataY + dataH} ${dataEndX},${dataY + dataH}`}
        fill="none" stroke={hasSetupV || hasHoldV ? '#ef5350' : '#66bb6a'} strokeWidth={2}
      />
      <text x={(dataStartX + arrMinX) / 2} y={dataY + dataH / 2 + 3} fill="#6a6a8a"
        fontSize={9} textAnchor="middle" fontFamily="monospace">OLD</text>
      <text x={(arrMaxX + dataEndX) / 2} y={dataY + dataH / 2 + 3} fill="#6a6a8a"
        fontSize={9} textAnchor="middle" fontFamily="monospace">NEW</text>

      {/* Setup required line */}
      <line x1={setupReqX} y1={dataY - 8} x2={setupReqX} y2={dataY + dataH + 8}
        stroke="#ff9800" strokeWidth={1.5} strokeDasharray="4,3" />
      <text x={setupReqX} y={dataY - 12} fill="#ff9800" fontSize={9}
        textAnchor="middle" fontFamily="monospace">
        setup req {result.setupRequired.toFixed(1)}ns
      </text>

      {/* Hold required line */}
      <line x1={holdReqX} y1={dataY - 8} x2={holdReqX} y2={dataY + dataH + 8}
        stroke="#42a5f5" strokeWidth={1.5} strokeDasharray="4,3" />
      <text x={holdReqX} y={dataY - 12} fill="#42a5f5" fontSize={9}
        textAnchor="middle" fontFamily="monospace">
        hold req {result.holdRequired.toFixed(1)}ns
      </text>

      {/* Clock skew annotation (source sync) */}
      {result.clockSkew !== 0 && (
        <text x={captureX} y={capClkY + clkH + 18} fill="#80cbc4" fontSize={9}
          textAnchor="middle" fontFamily="monospace">
          clk skew: {result.clockSkew.toFixed(2)}ns
        </text>
      )}

      {/* Annotation arrows */}
      <DimensionArrow x1={arrMaxX} x2={setupReqX} y={annY}
        label={`Setup Slack: ${result.setupSlack.toFixed(2)} ns`}
        color={hasSetupV ? '#ef5350' : '#66bb6a'} />
      <DimensionArrow x1={holdReqX} x2={arrMinX} y={annY + 24}
        label={`Hold Slack: ${result.holdSlack.toFixed(2)} ns`}
        color={hasHoldV ? '#ef5350' : '#66bb6a'} />
      <DimensionArrow x1={launchX} x2={setupReqX} y={annY + 48}
        label={`Required(setup): ${result.setupRequired.toFixed(2)} ns`}
        color="#ff9800" />
      <DimensionArrow x1={launchX} x2={holdReqX} y={annY + 66}
        label={`Required(hold): ${result.holdRequired.toFixed(2)} ns`}
        color="#42a5f5" />
      <DimensionArrow x1={launchX} x2={arrMaxX} y={annY + 90}
        label={`Data Arrival(max): ${result.dataArrivalMax.toFixed(2)} ns`}
        color="#ffa726" />

      {/* Edge window annotation */}
      <DimensionArrow x1={launchX} x2={captureX} y={annY + 108}
        label={`Effective Window: ${window.toFixed(2)} ns (${edgeCfg.launchEdge[0].toUpperCase()}→${edgeCfg.captureEdge[0].toUpperCase()})`}
        color="#6a6a8a" />

      {/* Pre/post edge context annotation */}
      <DimensionArrow x1={toX(chartStart)} x2={launchX} y={annY + 126}
        label={`Pre-edge: ${preEdgeMargin.toFixed(2)} ns`}
        color="#5f6b8a" />
      <DimensionArrow x1={captureX} x2={toX(chartEnd)} y={annY + 144}
        label={`Post-edge: ${postEdgeMargin.toFixed(2)} ns`}
        color="#5f6b8a" />

      {/* Violation markers */}
      {hasSetupV && (
        <text x={(arrMaxX + captureX) / 2} y={dataY + dataH + 25} fill="#ef5350"
          fontSize={12} textAnchor="middle" fontFamily="monospace" fontWeight="bold">
          &#x2716; SETUP VIOLATION
        </text>
      )}
      {hasHoldV && (
        <text x={(launchX + arrMinX) / 2} y={dataY + dataH + 25} fill="#ef5350"
          fontSize={12} textAnchor="middle" fontFamily="monospace" fontWeight="bold">
          &#x2716; HOLD VIOLATION
        </text>
      )}
    </svg>
  );
}

/** Build clock polyline over an arbitrary chart range around launch/capture edges. */
function buildClockPoints(
  clkY: number,
  clkH: number,
  toX: (ns: number) => number,
  chartStart: number,
  chartEnd: number,
  period: number,
  highTime: number,
  anchorTime: number,
  anchorEdge: 'rising' | 'falling',
): string {
  const low = clkY + clkH;
  const high = clkY;
  const pts: string[] = [];

  // Phase-anchor this lane so the requested edge polarity occurs at anchorTime.
  const firstRising = anchorEdge === 'rising'
    ? anchorTime
    : anchorTime - (period - highTime);
  const isHighAt = (t: number): boolean => {
    const phase = (((t - firstRising) % period) + period) % period;
    return phase < highTime;
  };

  const transitions: number[] = [];
  const kStart = Math.floor((chartStart - firstRising) / period) - 1;
  const kEnd = Math.ceil((chartEnd - firstRising) / period) + 1;
  for (let k = kStart; k <= kEnd; k++) {
    const rise = firstRising + k * period;
    const fall = rise + highTime;
    if (rise >= chartStart && rise <= chartEnd) transitions.push(rise);
    if (fall >= chartStart && fall <= chartEnd) transitions.push(fall);
  }

  transitions.sort((a, b) => a - b);
  let highState = isHighAt(chartStart + 1e-9);

  pts.push(`${toX(chartStart)},${highState ? high : low}`);
  for (const t of transitions) {
    const x = toX(t);
    pts.push(`${x},${highState ? high : low}`);
    highState = !highState;
    pts.push(`${x},${highState ? high : low}`);
  }
  pts.push(`${toX(chartEnd)},${highState ? high : low}`);

  return pts.join(' ');
}

function DimensionArrow({
  x1, x2, y, label, color,
}: {
  x1: number; x2: number; y: number; label: string; color: string;
}) {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const mid = (left + right) / 2;
  return (
    <g>
      <line x1={left} y1={y} x2={right} y2={y} stroke={color} strokeWidth={1.5} />
      <polygon points={`${left},${y} ${left + 5},${y - 3} ${left + 5},${y + 3}`} fill={color} />
      <polygon points={`${right},${y} ${right - 5},${y - 3} ${right - 5},${y + 3}`} fill={color} />
      <line x1={left} y1={y - 5} x2={left} y2={y + 5} stroke={color} strokeWidth={1} />
      <line x1={right} y1={y - 5} x2={right} y2={y + 5} stroke={color} strokeWidth={1} />
      <text x={mid} y={y - 5} fill={color} fontSize={9} textAnchor="middle" fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}
