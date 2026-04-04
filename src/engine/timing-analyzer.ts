import type {
  ClockParams,
  InputPathParams,
  OutputPathParams,
  FPGADeviceParams,
  AnalysisResult,
  AnimationKeyframe,
  ClockTopology,
  EdgeConfig,
  SourceSyncParams,
} from '../types/timing.ts';

/**
 * Compute effective launch and capture edge times (ns) within one analysis window.
 *
 * The "window" starts at the launch edge and ends at the next capture edge of
 * the specified polarity.  For example:
 *   R→R : launch = 0,         capture = T                   (full period)
 *   R→F : launch = 0,         capture = T × duty            (half-period for 50%)
 *   F→R : launch = T × duty,  capture = T                   (remaining half)
 *   F→F : launch = T × duty,  capture = T + T × duty = T(1+duty) → window = T
 */
export function computeEdgeTimes(
  clock: ClockParams,
  edgeConfig: EdgeConfig,
): { launchTime: number; captureTime: number; effectiveWindow: number } {
  const T = clock.period;
  const duty = clock.dutyCycle / 100;
  const fallingEdge = T * duty; // time of the first falling edge within one period

  let launchTime: number;
  let captureTime: number;

  if (edgeConfig.launchEdge === 'rising' && edgeConfig.captureEdge === 'rising') {
    launchTime = 0;
    captureTime = T;
  } else if (edgeConfig.launchEdge === 'rising' && edgeConfig.captureEdge === 'falling') {
    launchTime = 0;
    captureTime = fallingEdge;
  } else if (edgeConfig.launchEdge === 'falling' && edgeConfig.captureEdge === 'rising') {
    launchTime = fallingEdge;
    captureTime = T;
  } else {
    // F→F
    launchTime = fallingEdge;
    captureTime = T + fallingEdge;
  }

  const effectiveWindow = captureTime - launchTime;
  return { launchTime, captureTime, effectiveWindow };
}

/**
 * Analyze input path timing (external device launches → FPGA FF captures).
 *
 * System Synchronous: common clock, zero skew assumed.
 * Source Synchronous: forwarded clock travels with data; clock skew = fwdClkDelay − dataBoardDelay.
 */
export function analyzeInputPath(
  clock: ClockParams,
  input: InputPathParams,
  fpga: FPGADeviceParams,
  topology: ClockTopology,
  edgeConfig: EdgeConfig,
  sourceSync?: SourceSyncParams,
): AnalysisResult {
  const { launchTime, captureTime, effectiveWindow } = computeEdgeTimes(clock, edgeConfig);
  const totalUncertainty = clock.inputJitter + clock.systemJitter + clock.uncertainty;

  const dataArrivalMax = input.tcoSourceMax + input.boardDelayMax;
  const dataArrivalMin = input.tcoSourceMin + input.boardDelayMin;

  let baseClockSkew = 0;
  let setupRequired: number;
  let holdRequired: number;

  if (topology === 'source_sync' && sourceSync) {
    // Source sync: the capture clock (forwarded) has its own board delay.
    // Clock skew from the FPGA's perspective:
    //   skewMax = fwdClkDelayMax − dataBoardDelayMin  (worst-case for hold)
    //   skewMin = fwdClkDelayMin − dataBoardDelayMax  (worst-case for setup)
    // But we fold the skew into setup/hold required calculations.
    const clockArrivalMax = sourceSync.fwdClockBoardDelayMax;
    const clockArrivalMin = sourceSync.fwdClockBoardDelayMin;
    baseClockSkew = (clockArrivalMax + clockArrivalMin) / 2 - (input.boardDelayMax + input.boardDelayMin) / 2;

    // Setup: data must settle before capture edge + clock arrival - tsu
    // Required time = effectiveWindow + clockArrivalMin - tsu  (from launch perspective)
    setupRequired = effectiveWindow + clockArrivalMin + clock.skew - fpga.tsu - totalUncertainty;
    // Hold: data must not change until after capture edge + clock arrival + th
    holdRequired = clockArrivalMax + clock.skew + fpga.th + totalUncertainty;
  } else {
    // System synchronous: common clock, zero skew
    setupRequired = effectiveWindow + clock.skew - fpga.tsu - totalUncertainty;
    holdRequired = clock.skew + fpga.th + totalUncertainty;
  }

  const clockSkew = baseClockSkew + clock.skew;

  const setupSlack = setupRequired - dataArrivalMax;
  const holdSlack = dataArrivalMin - holdRequired;

  return {
    setupSlack,
    holdSlack,
    isSetupViolation: setupSlack < 0,
    isHoldViolation: holdSlack < 0,
    dataArrivalMax,
    dataArrivalMin,
    setupRequired,
    holdRequired,
    launchTime,
    captureTime,
    clockSkew,
    totalUncertainty,
    topology,
    edgeConfig,
  };
}

/**
 * Analyze output path timing (FPGA FF launches → external device captures).
 *
 * Source synchronous on output path is not modeled (rare); always system-sync model.
 */
export function analyzeOutputPath(
  clock: ClockParams,
  output: OutputPathParams,
  fpga: FPGADeviceParams,
  topology: ClockTopology,
  edgeConfig: EdgeConfig,
  sourceSync?: SourceSyncParams,
): AnalysisResult {
  const { launchTime, captureTime, effectiveWindow } = computeEdgeTimes(clock, edgeConfig);
  const totalUncertainty = clock.inputJitter + clock.systemJitter + clock.uncertainty;

  const dataArrivalMax = fpga.tcoMax + output.boardDelayMax;
  const dataArrivalMin = fpga.tcoMin + output.boardDelayMin;
  let baseClockSkew = 0;
  let setupRequired: number;
  let holdRequired: number;

  if (topology === 'source_sync' && sourceSync) {
    const clockArrivalMax = sourceSync.fwdClockBoardDelayMax;
    const clockArrivalMin = sourceSync.fwdClockBoardDelayMin;
    baseClockSkew = (clockArrivalMax + clockArrivalMin) / 2 - (output.boardDelayMax + output.boardDelayMin) / 2;

    setupRequired = effectiveWindow + clockArrivalMin + clock.skew - output.tsuDest - totalUncertainty;
    holdRequired = clockArrivalMax + clock.skew + output.thDest + totalUncertainty;
  } else {
    setupRequired = effectiveWindow + clock.skew - output.tsuDest - totalUncertainty;
    holdRequired = clock.skew + output.thDest + totalUncertainty;
  }

  const clockSkew = baseClockSkew + clock.skew;

  const setupSlack = setupRequired - dataArrivalMax;
  const holdSlack = dataArrivalMin - holdRequired;

  return {
    setupSlack,
    holdSlack,
    isSetupViolation: setupSlack < 0,
    isHoldViolation: holdSlack < 0,
    dataArrivalMax,
    dataArrivalMin,
    setupRequired,
    holdRequired,
    launchTime,
    captureTime,
    clockSkew,
    totalUncertainty,
    topology,
    edgeConfig,
  };
}

/**
 * Generate animation keyframes for the Launch → Propagate → Capture sequence.
 * Times are normalized to 0.0-1.0 representing one analysis window.
 */
export function computeAnimationKeyframes(
  _clock: ClockParams,
  result: AnalysisResult,
): AnimationKeyframe[] {
  const window = result.captureTime - result.launchTime;
  if (window <= 0) return [];

  const arrivalMaxNorm = result.dataArrivalMax / window;
  const arrivalMinNorm = result.dataArrivalMin / window;
  const arrivalAvgNorm = (arrivalMaxNorm + arrivalMinNorm) / 2;

  const keyframes: AnimationKeyframe[] = [
    {
      time: 0,
      phase: 'launching',
      label: 'Launch Edge',
      dataProgress: 0,
    },
    {
      time: Math.min(arrivalAvgNorm * 0.5, 0.3),
      phase: 'propagating',
      label: 'Data Propagating',
      dataProgress: 0.5,
    },
    {
      time: Math.min(arrivalAvgNorm, 0.8),
      phase: 'propagating',
      label: 'Data Arrives',
      dataProgress: 1.0,
    },
    {
      time: 1.0,
      phase: 'capturing',
      label: 'Capture Edge',
      dataProgress: 1.0,
    },
  ];

  return keyframes;
}
