// --- Clock Topology & Edge Types ---

export type ClockTopology = 'system_sync' | 'source_sync';

export type EdgeType = 'rising' | 'falling';

export type DataRateMode = 'sdr' | 'ddr';

export interface EdgeConfig {
  launchEdge: EdgeType;
  captureEdge: EdgeType;
}

// Source-synchronous: forwarded clock travels with data from source device
export interface SourceSyncParams {
  fwdClockBoardDelayMax: number; // Forwarded clock board trace delay max (ns)
  fwdClockBoardDelayMin: number; // Forwarded clock board trace delay min (ns)
  fwdClockPortName: string;
}

// Clock parameters (used as launch clock; also serves as capture clock when independent capture is off)
export interface ClockParams {
  period: number;      // ns
  dutyCycle: number;   // 0-100 (%)
  portName: string;
  skew: number;        // Capture clock skew relative to launch clock (ns)
  inputJitter: number; // set_input_jitter value (ns)
  systemJitter: number; // set_system_jitter value (ns)
  uncertainty: number; // set_clock_uncertainty value (ns)
}

// Independent capture clock parameters (period, duty, port only; jitter/uncertainty are shared)
export interface CaptureClockParams {
  period: number;      // ns
  dutyCycle: number;   // 0-100 (%)
  portName: string;
}

// Input path: External device launches data -> board trace -> FPGA pin -> FPGA internal FF captures
export interface InputPathParams {
  tcoSourceMax: number;    // Source device clock-to-output max (ns)
  tcoSourceMin: number;    // Source device clock-to-output min (ns)
  boardDelayMax: number;   // PCB trace delay max (ns)
  boardDelayMin: number;   // PCB trace delay min (ns)
  routingDelayMax: number; // FPGA internal routing delay max (ns)
  routingDelayMin: number; // FPGA internal routing delay min (ns)
  portName: string;
}

// Output path: FPGA internal FF launches -> FPGA pin -> board trace -> External device captures
export interface OutputPathParams {
  boardDelayMax: number;   // PCB trace delay max (ns)
  boardDelayMin: number;   // PCB trace delay min (ns)
  routingDelayMax: number; // FPGA internal routing delay max (ns)
  routingDelayMin: number; // FPGA internal routing delay min (ns)
  tsuDest: number;         // Destination device setup time (ns)
  thDest: number;          // Destination device hold time (ns)
  portName: string;
}

// FPGA internal FF characteristics
export interface FPGADeviceParams {
  tsu: number;    // Setup time (ns)
  th: number;     // Hold time (ns)
  tcoMax: number; // Clock-to-output max (ns)
  tcoMin: number; // Clock-to-output min (ns)
}

// Analysis result for a single path
export interface AnalysisResult {
  setupSlack: number;
  holdSlack: number;
  isSetupViolation: boolean;
  isHoldViolation: boolean;
  dataArrivalMax: number;  // Max data arrival time from launch edge (ns)
  dataArrivalMin: number;  // Min data arrival time from launch edge (ns)
  setupRequired: number;   // Setup required time from launch edge (ns)
  holdRequired: number;    // Hold required time from launch edge (ns)
  launchTime: number;      // Effective launch edge time within the period (ns)
  captureTime: number;     // Effective capture edge time within the period (ns)
  clockSkew: number;       // Clock skew (ns) — nonzero for source sync
  totalUncertainty: number; // Jitter + uncertainty margin used in analysis (ns)
  topology: ClockTopology;
  edgeConfig: EdgeConfig;
}

// Animation phase
export type AnimationPhase =
  | 'idle'
  | 'launching'
  | 'propagating'
  | 'capturing'
  | 'result';

// Animation keyframe for waveform rendering
export interface AnimationKeyframe {
  time: number;          // Normalized time 0.0-1.0 within the animation cycle
  phase: AnimationPhase;
  label: string;
  dataProgress: number;  // 0.0-1.0, how far data has traveled along the path
}

// Full animation state
export interface AnimationState {
  phase: AnimationPhase;
  progress: number;          // 0.0-1.0 within current phase
  globalTime: number;        // 0.0-1.0 across entire cycle
  dataPosition: number;      // 0.0-1.0 along the path
  keyframes: AnimationKeyframe[];
}

// Which path is currently selected for display
export type ActivePath = 'input' | 'output';

// Complete app state
export interface TimingState {
  clock: ClockParams;
  useIndependentCaptureClock: boolean;
  captureClock: CaptureClockParams;
  inputPath: InputPathParams;
  outputPath: OutputPathParams;
  fpga: FPGADeviceParams;
  topology: ClockTopology;
  dataRateMode: DataRateMode;
  edgeConfig: EdgeConfig;
  sourceSyncParams: SourceSyncParams;
  inputResult: AnalysisResult;
  outputResult: AnalysisResult;
  activePath: ActivePath;
}
