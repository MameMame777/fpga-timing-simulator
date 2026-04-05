import type { ClockParams, CaptureClockParams, AnalysisResult, AnimationPhase, ClockTopology, SourceSyncParams } from '../types/timing.ts';

// Color palette (EDA dark theme style)
const COLORS = {
  bg: '#1a1a2e',
  grid: '#2a2a4a',
  text: '#c8c8e0',
  textDim: '#6a6a8a',
  clock: '#4fc3f7',
  dataOk: '#66bb6a',
  dataViolation: '#ef5350',
  dataRange: 'rgba(255,183,77,0.25)',
  setupWindow: 'rgba(255,152,0,0.3)',
  holdWindow: 'rgba(66,165,245,0.3)',
  setupLine: '#ff9800',
  holdLine: '#42a5f5',
  launchMarker: '#4fc3f7',
  captureMarker: '#ff7043',
  fwdClock: '#80cbc4',
  propagationDot: '#fdd835',
};

interface RenderParams {
  clock: ClockParams;
  result: AnalysisResult;
  isInputPath: boolean;
  topology: ClockTopology;
  sourceSyncParams?: SourceSyncParams;
  captureClock?: CaptureClockParams;
}

export class WaveformRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId = 0;
  private startTime = 0;
  private playing = false;
  private speed = 1.0;
  private params: RenderParams;
  private currentPhase: AnimationPhase = 'idle';
  private cycleProgress = 0;

  // Layout
  private readonly MARGIN_LEFT = 130;
  private readonly MARGIN_RIGHT = 40;
  private readonly MARGIN_TOP = 40;
  private readonly LANE_HEIGHT = 48;
  private readonly LANE_GAP = 12;
  private readonly CYCLE_DURATION_MS = 4000;

  constructor(canvas: HTMLCanvasElement, params: RenderParams) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.params = params;
    this.resizeCanvas();
    this.drawStatic();
  }

  setParams(params: RenderParams): void {
    this.params = params;
    if (!this.playing) this.drawFrame(this.cycleProgress);
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(5.0, speed));
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.startTime = performance.now() - (this.cycleProgress * this.CYCLE_DURATION_MS / this.speed);
    this.loop();
  }

  pause(): void {
    this.playing = false;
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = 0; }
  }

  reset(): void {
    this.pause();
    this.cycleProgress = 0;
    this.currentPhase = 'idle';
    this.drawFrame(0);
  }

  step(): void {
    this.pause();
    const phases: [number, AnimationPhase][] = [
      [0.0, 'launching'], [0.15, 'propagating'], [0.65, 'capturing'], [0.85, 'result'],
    ];
    let next = 1.0;
    for (const [t] of phases) { if (t > this.cycleProgress + 0.001) { next = t; break; } }
    if (next >= 1.0) next = 0;
    this.cycleProgress = next;
    this.drawFrame(this.cycleProgress);
  }

  destroy(): void { this.pause(); }

  resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const neededHeight = this.computeHeight();
    this.canvas.style.height = `${neededHeight}px`;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = neededHeight * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  // --- Helpers ---

  /** Compute the pixel height needed based on the number of lanes */
  private computeHeight(): number {
    const numLanes = this.showFwdClk ? 6 : 5;
    return this.MARGIN_TOP + numLanes * this.LANE_HEIGHT + (numLanes - 1) * this.LANE_GAP + 22;
  }

  /** Whether we show the forwarded clock lane */
  private get showFwdClk(): boolean {
    return this.params.topology === 'source_sync';
  }

  /** The "window" within which we plot: from launchTime to captureTime */
  private get plotWindow(): number {
    return this.params.result.captureTime - this.params.result.launchTime;
  }

  // --- Animation loop ---

  private loop = (): void => {
    if (!this.playing) return;
    const elapsed = (performance.now() - this.startTime) * this.speed;
    this.cycleProgress = (elapsed % this.CYCLE_DURATION_MS) / this.CYCLE_DURATION_MS;
    this.drawFrame(this.cycleProgress);
    this.animId = requestAnimationFrame(this.loop);
  };

  private getPhase(p: number): AnimationPhase {
    if (p < 0.05) return 'launching';
    if (p < 0.60) return 'propagating';
    if (p < 0.85) return 'capturing';
    return 'result';
  }

  // --- Main draw ---

  private drawFrame(progress: number): void {
    const ctx = this.ctx;
    const w = this.canvas.getBoundingClientRect().width;
    const h = this.canvas.getBoundingClientRect().height;
    this.currentPhase = this.getPhase(progress);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    const chartLeft = this.MARGIN_LEFT;
    const chartRight = w - this.MARGIN_RIGHT;
    const chartWidth = chartRight - chartLeft;
    const window = this.plotWindow;
    const preEdge = Math.max(1, window * 0.2);
    const postEdge = Math.max(1, window * 0.2);
    const chartSpan = preEdge + window + postEdge;
    const plotLeft = chartLeft + (preEdge / chartSpan) * chartWidth;
    const plotWidth = (window / chartSpan) * chartWidth;
    const chartStart = -preEdge;
    const chartEnd = window + postEdge;

    this.drawGrid(ctx, chartLeft, chartRight, chartWidth, h, chartStart, chartEnd);

    const laneY = (i: number) => this.MARGIN_TOP + i * (this.LANE_HEIGHT + this.LANE_GAP);

    // Lanes: Launch Clock, Data@Source, Data@Capture, [FwdClock?], Capture Clock, Verdict
    let laneIdx = 0;
    this.drawClockLane(ctx, chartLeft, chartRight, plotLeft, plotWidth, laneY(laneIdx), 'Launch Clock', window, progress, true);
    laneIdx++;
    this.drawDataLaunchLane(ctx, chartLeft, chartRight, plotLeft, plotWidth, laneY(laneIdx), window, progress);
    const launchLaneY = laneY(laneIdx);
    laneIdx++;
    this.drawDataCaptureLane(ctx, chartLeft, chartRight, plotLeft, plotWidth, laneY(laneIdx), window, progress);
    const captureLaneY = laneY(laneIdx);
    laneIdx++;
    if (this.showFwdClk) {
      this.drawFwdClockLane(ctx, chartLeft, chartRight, plotLeft, plotWidth, laneY(laneIdx), window, progress);
      laneIdx++;
    }
    this.drawCaptureClockLane(ctx, chartLeft, chartRight, plotLeft, plotWidth, laneY(laneIdx), window, progress);
    laneIdx++;
    this.drawVerdictLane(ctx, plotLeft, plotWidth, laneY(laneIdx), window, progress);
    const verdictBottom = laneY(laneIdx) + this.LANE_HEIGHT;

    this.drawEdgeMarkers(ctx, plotLeft, plotWidth, this.MARGIN_TOP, verdictBottom, window, progress);

    if (this.currentPhase === 'propagating') {
      this.drawPropagationDot(ctx, plotLeft, plotWidth, launchLaneY, captureLaneY, window, progress);
    }

    this.drawPhaseLabel(ctx, w);
  }

  // --- Grid ---

  private drawGrid(
    ctx: CanvasRenderingContext2D, plotLeft: number, plotRight: number,
    plotWidth: number, h: number, chartStart: number, chartEnd: number,
  ): void {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    const span = chartEnd - chartStart;
    const step = span <= 20 ? 1 : span <= 50 ? 5 : 10;
    const firstTick = Math.ceil(chartStart / step) * step;
    for (let t = firstTick; t <= chartEnd + 1e-9; t += step) {
      const x = plotLeft + ((t - chartStart) / span) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, this.MARGIN_TOP - 10);
      ctx.lineTo(x, h - 10);
      ctx.stroke();
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(t)}`, x, this.MARGIN_TOP - 15);
    }
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ns', plotRight + 8, this.MARGIN_TOP - 28);
  }

  // --- Clock lane (shared helper for launch and capture) ---

  private drawClockLane(
    ctx: CanvasRenderingContext2D, chartLeft: number, chartRight: number,
    plotLeft: number, plotWidth: number,
    y: number, label: string, window: number, progress: number,
    isLaunchClock: boolean,
  ): void {
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(label, this.MARGIN_LEFT - 8, y + this.LANE_HEIGHT / 2 + 4);

    const result = this.params.result;
    const edgeCfg = result.edgeConfig;
    // Arrow direction: launch lane shows launch edge, capture lane shows capture edge
    const edgeDir = isLaunchClock ? edgeCfg.launchEdge : edgeCfg.captureEdge;
    // For the capture clock lane, use independent capture clock params if available.
    const capClk = this.params.captureClock;
    const useCapClk = !isLaunchClock && capClk;

    const duty = useCapClk ? capClk.dutyCycle / 100 : this.params.clock.dutyCycle / 100;
    const period = useCapClk ? capClk.period : this.params.clock.period;
    const highTime = period * duty;
    // Phase anchor:
    // - Launch clock lane: launch edge is at window start (t=0)
    // - Capture clock lane: capture edge is at window end (t=window)
    const firstRising = isLaunchClock
      ? (edgeCfg.launchEdge === 'rising' ? 0 : -(period - highTime))
      : (edgeCfg.captureEdge === 'rising' ? window : window - highTime);
    const low = y + this.LANE_HEIGHT - 5;
    const high = y + 5;
    const color = isLaunchClock ? COLORS.clock : COLORS.captureMarker;
    const isHighAt = (t: number): boolean => {
      const phase = (((t - firstRising) % period) + period) % period;
      return phase < highTime;
    };
    const preLevel = isHighAt(-1e-9) ? high : low;
    const postLevel = isHighAt(window + 1e-9) ? high : low;

    // Extend clock illustration before launch and after capture.
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartLeft, preLevel);
    ctx.lineTo(plotLeft, preLevel);
    ctx.moveTo(plotLeft + plotWidth, postLevel);
    ctx.lineTo(chartRight, postLevel);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Draw full clock template dimmed
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    this.drawSquareWave(ctx, plotLeft, plotWidth, high, low, period, highTime, window, firstRising);
    ctx.globalAlpha = 1.0;

    // Animate bright
    const visibleTime = progress * window;
    if (visibleTime > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotLeft, y - 5, (visibleTime / window) * plotWidth, this.LANE_HEIGHT + 10);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      this.drawSquareWave(ctx, plotLeft, plotWidth, high, low, period, highTime, window, firstRising);
      ctx.restore();
    }

    // Edge direction indicator at launch/capture position
    const edgeX = isLaunchClock ? plotLeft : plotLeft + plotWidth;
    const arrowSize = 8;
    const edgeY = edgeDir === 'rising' ? high : low;

    // Strong local guide to make edge timing obvious on each clock lane.
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(edgeX, y - 2);
    ctx.lineTo(edgeX, y + this.LANE_HEIGHT + 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Dot marker at the sampled edge level (high for rising, low for falling).
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(edgeX, edgeY, 4, 0, Math.PI * 2);
    ctx.fill();

    const tag = `${isLaunchClock ? 'L' : 'C'}${edgeDir === 'rising' ? '↑' : '↓'}`;
    ctx.font = '10px monospace';
    ctx.textAlign = isLaunchClock ? 'left' : 'right';
    ctx.fillText(tag, isLaunchClock ? edgeX + 8 : edgeX - 8, edgeY - 6);

    ctx.fillStyle = color;
    if (edgeDir === 'rising') {
      // Up arrow
      ctx.beginPath();
      ctx.moveTo(edgeX - arrowSize / 2, y + this.LANE_HEIGHT / 2 + arrowSize / 2);
      ctx.lineTo(edgeX + arrowSize / 2, y + this.LANE_HEIGHT / 2 + arrowSize / 2);
      ctx.lineTo(edgeX, y + this.LANE_HEIGHT / 2 - arrowSize / 2);
      ctx.closePath();
      ctx.fill();
    } else {
      // Down arrow
      ctx.beginPath();
      ctx.moveTo(edgeX - arrowSize / 2, y + this.LANE_HEIGHT / 2 - arrowSize / 2);
      ctx.lineTo(edgeX + arrowSize / 2, y + this.LANE_HEIGHT / 2 - arrowSize / 2);
      ctx.lineTo(edgeX, y + this.LANE_HEIGHT / 2 + arrowSize / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawSquareWave(
    ctx: CanvasRenderingContext2D, plotLeft: number, plotWidth: number,
    high: number, low: number, period: number, highTime: number, window: number,
    firstRising: number,
  ): void {
    const toX = (t: number) => plotLeft + (t / window) * plotWidth;
    const isHighAt = (t: number): boolean => {
      const phase = (((t - firstRising) % period) + period) % period;
      return phase < highTime;
    };

    const transitions: number[] = [];
    const kStart = Math.floor((0 - firstRising) / period) - 1;
    const kEnd = Math.ceil((window - firstRising) / period) + 1;
    for (let k = kStart; k <= kEnd; k++) {
      const rise = firstRising + k * period;
      const fall = rise + highTime;
      if (rise >= -1e-9 && rise <= window + 1e-9) transitions.push(Math.max(0, Math.min(window, rise)));
      if (fall >= -1e-9 && fall <= window + 1e-9) transitions.push(Math.max(0, Math.min(window, fall)));
    }

    transitions.sort((a, b) => a - b);
    const uniqTransitions: number[] = [];
    for (const t of transitions) {
      if (uniqTransitions.length === 0 || Math.abs(t - uniqTransitions[uniqTransitions.length - 1]) > 1e-6) {
        uniqTransitions.push(t);
      }
    }

    let highState = isHighAt(-1e-9);
    ctx.beginPath();
    ctx.moveTo(plotLeft, highState ? high : low);

    for (const t of uniqTransitions) {
      const x = toX(t);
      ctx.lineTo(x, highState ? high : low);
      highState = !highState;
      ctx.lineTo(x, highState ? high : low);
    }
    ctx.lineTo(plotLeft + plotWidth, highState ? high : low);
    ctx.stroke();
  }

  // --- Forwarded clock lane (source sync only) ---

  private drawFwdClockLane(
    ctx: CanvasRenderingContext2D, chartLeft: number, chartRight: number,
    plotLeft: number, plotWidth: number,
    y: number, window: number, progress: number,
  ): void {
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Fwd Clock', this.MARGIN_LEFT - 8, y + this.LANE_HEIGHT / 2 + 4);

    const ss = this.params.sourceSyncParams;
    if (!ss) return;
    const avgDelay = (ss.fwdClockBoardDelayMax + ss.fwdClockBoardDelayMin) / 2;
    const offsetX = (avgDelay / window) * plotWidth;
    const high = y + 5;
    const low = y + this.LANE_HEIGHT - 5;

    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = COLORS.fwdClock;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartLeft, low);
    ctx.lineTo(plotLeft, low);
    ctx.moveTo(plotLeft + plotWidth, high);
    ctx.lineTo(chartRight, high);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Simple: show the forwarded clock arriving with an offset
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = COLORS.fwdClock;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotLeft, low);
    ctx.lineTo(plotLeft + offsetX, low);
    ctx.lineTo(plotLeft + offsetX, high);
    ctx.lineTo(plotLeft + plotWidth, high);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    const visibleTime = progress * window;
    if (visibleTime > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotLeft, y - 5, (visibleTime / window) * plotWidth, this.LANE_HEIGHT + 10);
      ctx.clip();
      ctx.strokeStyle = COLORS.fwdClock;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(plotLeft, low);
      ctx.lineTo(plotLeft + offsetX, low);
      ctx.lineTo(plotLeft + offsetX, high);
      ctx.lineTo(plotLeft + plotWidth, high);
      ctx.stroke();
      ctx.restore();
    }

    // Delay label
    ctx.fillStyle = COLORS.fwdClock;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`delay: ${avgDelay.toFixed(1)} ns`, plotLeft + offsetX / 2, y - 3);
  }

  // --- Data at Launch FF output ---

  private drawDataLaunchLane(
    ctx: CanvasRenderingContext2D, chartLeft: number, chartRight: number,
    plotLeft: number, plotWidth: number,
    y: number, window: number, progress: number,
  ): void {
    const label = this.params.isInputPath ? 'Data @ Source' : 'Data @ FPGA FF';
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(label, this.MARGIN_LEFT - 8, y + this.LANE_HEIGHT / 2 + 4);

    const result = this.params.result;
    const mid = y + this.LANE_HEIGHT / 2;
    const amp = this.LANE_HEIGHT / 2 - 8;
    const hasViolation = result.isSetupViolation || result.isHoldViolation;
    ctx.strokeStyle = hasViolation ? COLORS.dataViolation : COLORS.dataOk;
    ctx.lineWidth = 2;

    ctx.globalAlpha = 0.3;
    this.drawDataWave(ctx, chartLeft, chartRight, plotLeft, plotWidth, mid, amp, window, 0);
    ctx.globalAlpha = 1.0;

    const visibleTime = progress * window;
    if (visibleTime > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotLeft, y - 5, (visibleTime / window) * plotWidth, this.LANE_HEIGHT + 10);
      ctx.clip();
      this.drawDataWave(ctx, chartLeft, chartRight, plotLeft, plotWidth, mid, amp, window, 0);
      ctx.restore();
    }
  }

  private drawDataWave(
    ctx: CanvasRenderingContext2D,
    chartLeft: number, chartRight: number,
    plotLeft: number, plotWidth: number,
    mid: number, amp: number, window: number, changeTime: number,
  ): void {
    const changeX = plotLeft + (changeTime / window) * plotWidth;
    const transWidth = Math.max(plotWidth * 0.03, 4);

    ctx.beginPath();
    ctx.moveTo(chartLeft, mid + amp);
    if (changeTime > 0) ctx.lineTo(changeX, mid + amp);
    ctx.lineTo(changeX + transWidth / 2, mid - amp);
    ctx.lineTo(chartRight, mid - amp);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(chartLeft, mid - amp);
    if (changeTime > 0) ctx.lineTo(changeX, mid - amp);
    ctx.lineTo(changeX + transWidth / 2, mid + amp);
    ctx.lineTo(chartRight, mid + amp);
    ctx.stroke();

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    if (changeTime > 0) {
      ctx.fillText('OLD', (chartLeft + changeX) / 2, mid + 3);
    }
    ctx.fillText('NEW', (changeX + transWidth + chartRight) / 2, mid + 3);
  }

  // --- Data at Capture FF input (delayed) ---

  private drawDataCaptureLane(
    ctx: CanvasRenderingContext2D, chartLeft: number, chartRight: number,
    plotLeft: number, plotWidth: number,
    y: number, window: number, progress: number,
  ): void {
    const label = this.params.isInputPath ? 'Data @ FPGA FF' : 'Data @ Dest FF';
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(label, this.MARGIN_LEFT - 8, y + this.LANE_HEIGHT / 2 + 4);

    const result = this.params.result;
    const mid = y + this.LANE_HEIGHT / 2;
    const amp = this.LANE_HEIGHT / 2 - 8;
    const hasViolation = result.isSetupViolation || result.isHoldViolation;

    // Data arrival range shading
    const arrMinX = plotLeft + (result.dataArrivalMin / window) * plotWidth;
    const arrMaxX = plotLeft + (result.dataArrivalMax / window) * plotWidth;
    ctx.fillStyle = COLORS.dataRange;
    ctx.fillRect(arrMinX, y, arrMaxX - arrMinX, this.LANE_HEIGHT);

    // Setup window
    const setupX = plotLeft + (result.setupRequired / window) * plotWidth;
    ctx.fillStyle = COLORS.setupWindow;
    ctx.fillRect(setupX, y, plotLeft + plotWidth - setupX, this.LANE_HEIGHT);

    // Hold window
    const holdX = plotLeft + (result.holdRequired / window) * plotWidth;
    ctx.fillStyle = COLORS.holdWindow;
    ctx.fillRect(plotLeft, y, holdX - plotLeft, this.LANE_HEIGHT);

    // Setup/Hold boundary lines
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLORS.setupLine;
    ctx.beginPath(); ctx.moveTo(setupX, y); ctx.lineTo(setupX, y + this.LANE_HEIGHT); ctx.stroke();
    ctx.strokeStyle = COLORS.holdLine;
    ctx.beginPath(); ctx.moveTo(holdX, y); ctx.lineTo(holdX, y + this.LANE_HEIGHT); ctx.stroke();
    ctx.setLineDash([]);

    // Data waveform
    ctx.strokeStyle = hasViolation ? COLORS.dataViolation : COLORS.dataOk;
    ctx.lineWidth = 2;

    ctx.globalAlpha = 0.3;
    this.drawDataWaveWithRange(ctx, chartLeft, chartRight, plotLeft, plotWidth, mid, amp, window, result.dataArrivalMin, result.dataArrivalMax);
    ctx.globalAlpha = 1.0;

    const visibleTime = progress * window;
    if (visibleTime > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotLeft, y - 5, (visibleTime / window) * plotWidth, this.LANE_HEIGHT + 10);
      ctx.clip();
      this.drawDataWaveWithRange(ctx, chartLeft, chartRight, plotLeft, plotWidth, mid, amp, window, result.dataArrivalMin, result.dataArrivalMax);
      ctx.restore();
    }

    // Labels
    ctx.fillStyle = COLORS.setupLine;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('setup req', setupX, y - 3);
    ctx.fillStyle = COLORS.holdLine;
    ctx.fillText('hold req', holdX, y - 3);
  }

  private drawDataWaveWithRange(
    ctx: CanvasRenderingContext2D,
    chartLeft: number, chartRight: number,
    plotLeft: number, plotWidth: number,
    mid: number, amp: number, window: number, arrivalMin: number, arrivalMax: number,
  ): void {
    const arrMinX = plotLeft + (arrivalMin / window) * plotWidth;
    const arrMaxX = plotLeft + (arrivalMax / window) * plotWidth;
    const transWidth = arrMaxX - arrMinX + 4;

    ctx.beginPath();
    ctx.moveTo(chartLeft, mid + amp);
    ctx.lineTo(arrMinX, mid + amp);
    ctx.lineTo(arrMaxX, mid - amp);
    ctx.lineTo(chartRight, mid - amp);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(chartLeft, mid - amp);
    ctx.lineTo(arrMinX, mid - amp);
    ctx.lineTo(arrMaxX, mid + amp);
    ctx.lineTo(chartRight, mid + amp);
    ctx.stroke();

    // X pattern in transition zone
    if (transWidth > 2) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = COLORS.dataViolation;
      ctx.lineWidth = 1;
      const steps = Math.max(2, Math.floor(transWidth / 6));
      for (let i = 0; i < steps; i++) {
        const x = arrMinX + (i / steps) * (arrMaxX - arrMinX);
        ctx.beginPath();
        ctx.moveTo(x, mid - amp);
        ctx.lineTo(x + (arrMaxX - arrMinX) / steps, mid + amp);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OLD', (chartLeft + arrMinX) / 2, mid + 3);
    ctx.fillText('NEW', (arrMaxX + chartRight) / 2, mid + 3);
  }

  // --- Capture clock (reuses drawClockLane) ---

  private drawCaptureClockLane(
    ctx: CanvasRenderingContext2D, chartLeft: number, chartRight: number,
    plotLeft: number, plotWidth: number,
    y: number, window: number, progress: number,
  ): void {
    this.drawClockLane(ctx, chartLeft, chartRight, plotLeft, plotWidth, y, 'Capture Clock', window, progress, false);
  }

  // --- Verdict lane ---

  private drawVerdictLane(
    ctx: CanvasRenderingContext2D, plotLeft: number, plotWidth: number,
    y: number, _window: number, progress: number,
  ): void {
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Verdict', this.MARGIN_LEFT - 8, y + this.LANE_HEIGHT / 2 + 4);

    if (this.currentPhase !== 'result') return;

    const result = this.params.result;
    const flashAlpha = 0.3 + 0.3 * Math.sin((progress - 0.85) * 50);

    if (result.isSetupViolation || result.isHoldViolation) {
      ctx.fillStyle = `rgba(255,0,0,${flashAlpha})`;
      ctx.fillRect(plotLeft, y, plotWidth, this.LANE_HEIGHT);
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      const msg = result.isSetupViolation && result.isHoldViolation
        ? 'SETUP + HOLD VIOLATION'
        : result.isSetupViolation ? 'SETUP VIOLATION' : 'HOLD VIOLATION';
      ctx.fillText(msg, plotLeft + plotWidth / 2, y + this.LANE_HEIGHT / 2 + 6);
    } else {
      ctx.fillStyle = `rgba(0,200,0,${flashAlpha * 0.5})`;
      ctx.fillRect(plotLeft, y, plotWidth, this.LANE_HEIGHT);
      ctx.fillStyle = '#66bb6a';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `PASS (setup: +${result.setupSlack.toFixed(2)}ns, hold: +${result.holdSlack.toFixed(2)}ns)`,
        plotLeft + plotWidth / 2, y + this.LANE_HEIGHT / 2 + 6,
      );
    }
  }

  // --- Edge markers ---

  private drawEdgeMarkers(
    ctx: CanvasRenderingContext2D, plotLeft: number, plotWidth: number,
    top: number, bottom: number, _window: number, progress: number,
  ): void {
    const edgeCfg = this.params.result.edgeConfig;
    const launchSymbol = edgeCfg.launchEdge === 'rising' ? '↑' : '↓';
    const captureSymbol = edgeCfg.captureEdge === 'rising' ? '↑' : '↓';

    // Launch edge at left
    if (progress >= 0.0) {
      ctx.strokeStyle = COLORS.launchMarker;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(plotLeft, top - 5);
      ctx.lineTo(plotLeft, bottom + 5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.launchMarker;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`LAUNCH ${launchSymbol}`, plotLeft, bottom + 16);
    }

    // Capture edge at right
    if (progress >= 0.60) {
      const alpha = Math.min(1.0, (progress - 0.60) / 0.1);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = COLORS.captureMarker;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(plotLeft + plotWidth, top - 5);
      ctx.lineTo(plotLeft + plotWidth, bottom + 5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.captureMarker;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`CAPTURE ${captureSymbol}`, plotLeft + plotWidth, bottom + 16);
      ctx.globalAlpha = 1.0;
    }
  }

  // --- Propagation dot ---

  private drawPropagationDot(
    ctx: CanvasRenderingContext2D, plotLeft: number, plotWidth: number,
    launchLaneY: number, captureLaneY: number, window: number, progress: number,
  ): void {
    const propProgress = Math.max(0, Math.min(1, (progress - 0.05) / 0.55));
    const result = this.params.result;
    const arrivalAvg = (result.dataArrivalMax + result.dataArrivalMin) / 2;
    const targetX = plotLeft + (arrivalAvg / window) * plotWidth;

    const startX = plotLeft;
    const startY = launchLaneY + this.LANE_HEIGHT / 2;
    const endX = targetX;
    const endY = captureLaneY + this.LANE_HEIGHT / 2;

    const x = startX + (endX - startX) * propProgress;
    const y = startY + (endY - startY) * propProgress;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
    gradient.addColorStop(0, COLORS.propagationDot);
    gradient.addColorStop(1, 'rgba(253,216,53,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = COLORS.propagationDot;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();

    const currentNs = arrivalAvg * propProgress;
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${currentNs.toFixed(1)} ns`, x + 10, y - 5);
  }

  // --- Phase label ---

  private drawPhaseLabel(ctx: CanvasRenderingContext2D, w: number): void {
    const labels: Record<AnimationPhase, string> = {
      idle: '',
      launching: 'Launch Edge — Data departs from source FF',
      propagating: 'Data propagating through path...',
      capturing: 'Capture Edge — Checking setup/hold',
      result: this.params.result.isSetupViolation || this.params.result.isHoldViolation
        ? 'Timing Violation Detected!'
        : 'Timing Met — Data captured successfully',
    };
    const label = labels[this.currentPhase];
    if (!label) return;
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, w / 2, 20);
  }

  private drawStatic(): void {
    this.drawFrame(0);
  }
}
