import { describe, it, expect } from 'vitest';
import { computeEdgeTimes, analyzeInputPath, analyzeOutputPath } from './timing-analyzer.ts';
import type {
  ClockParams,
  InputPathParams,
  OutputPathParams,
  FPGADeviceParams,
  EdgeConfig,
  SourceSyncParams,
} from '../types/timing.ts';

// ── Helpers ──

const baseClock: ClockParams = {
  period: 10,
  dutyCycle: 50,
  portName: 'clk',
  skew: 0,
  inputJitter: 0,
  systemJitter: 0,
  uncertainty: 0,
};

const baseInput: InputPathParams = {
  tcoSourceMax: 2.0,
  tcoSourceMin: 1.0,
  boardDelayMax: 1.5,
  boardDelayMin: 0.5,
  portName: 'din',
};

const baseOutput: OutputPathParams = {
  boardDelayMax: 2.0,
  boardDelayMin: 0.5,
  tsuDest: 1.5,
  thDest: 0.3,
  portName: 'dout',
};

const baseFPGA: FPGADeviceParams = {
  tsu: 1.2,
  th: 0.3,
  tcoMax: 3.0,
  tcoMin: 1.5,
};

const baseSourceSync: SourceSyncParams = {
  fwdClockBoardDelayMax: 1.5,
  fwdClockBoardDelayMin: 0.5,
  fwdClockPortName: 'fwd_clk',
};

const RR: EdgeConfig = { launchEdge: 'rising', captureEdge: 'rising' };
const RF: EdgeConfig = { launchEdge: 'rising', captureEdge: 'falling' };
const FR: EdgeConfig = { launchEdge: 'falling', captureEdge: 'rising' };
const FF: EdgeConfig = { launchEdge: 'falling', captureEdge: 'falling' };

// ── computeEdgeTimes ──

describe('computeEdgeTimes', () => {
  it('R→R: full period window', () => {
    const r = computeEdgeTimes(baseClock, RR);
    expect(r.launchTime).toBe(0);
    expect(r.captureTime).toBe(10);
    expect(r.effectiveWindow).toBe(10);
  });

  it('R→F: half period at 50% duty', () => {
    const r = computeEdgeTimes(baseClock, RF);
    expect(r.launchTime).toBe(0);
    expect(r.captureTime).toBe(5);
    expect(r.effectiveWindow).toBe(5);
  });

  it('F→R: remaining half at 50% duty', () => {
    const r = computeEdgeTimes(baseClock, FR);
    expect(r.launchTime).toBe(5);
    expect(r.captureTime).toBe(10);
    expect(r.effectiveWindow).toBe(5);
  });

  it('F→F: full period window', () => {
    const r = computeEdgeTimes(baseClock, FF);
    expect(r.launchTime).toBe(5);
    expect(r.captureTime).toBe(15);
    expect(r.effectiveWindow).toBe(10);
  });

  it('asymmetric duty cycle (30%)', () => {
    const asymClock = { ...baseClock, dutyCycle: 30 };
    // Falling edge at T * 0.3 = 3ns
    const rr = computeEdgeTimes(asymClock, RR);
    expect(rr.effectiveWindow).toBe(10);

    const rf = computeEdgeTimes(asymClock, RF);
    expect(rf.captureTime).toBeCloseTo(3.0);
    expect(rf.effectiveWindow).toBeCloseTo(3.0);

    const fr = computeEdgeTimes(asymClock, FR);
    expect(fr.launchTime).toBeCloseTo(3.0);
    expect(fr.effectiveWindow).toBeCloseTo(7.0);

    const ff = computeEdgeTimes(asymClock, FF);
    expect(ff.launchTime).toBeCloseTo(3.0);
    expect(ff.captureTime).toBeCloseTo(13.0);
    expect(ff.effectiveWindow).toBe(10);
  });

  it('period = 1 ns edge case', () => {
    const fast = { ...baseClock, period: 1 };
    const r = computeEdgeTimes(fast, RR);
    expect(r.effectiveWindow).toBe(1);
  });
});

// ── analyzeInputPath — System Synchronous ──

describe('analyzeInputPath — system_sync', () => {
  it('basic R→R with default params: positive setup slack', () => {
    const r = analyzeInputPath(baseClock, baseInput, baseFPGA, 'system_sync', RR);
    // setupRequired = window(10) + skew(0) - tsu(1.2) - uncertainty(0) = 8.8
    // dataArrivalMax = tcoMax(2) + boardMax(1.5) = 3.5
    // setupSlack = 8.8 - 3.5 = 5.3
    expect(r.setupRequired).toBeCloseTo(8.8);
    expect(r.dataArrivalMax).toBeCloseTo(3.5);
    expect(r.setupSlack).toBeCloseTo(5.3);
    expect(r.isSetupViolation).toBe(false);
  });

  it('basic R→R with default params: positive hold slack', () => {
    const r = analyzeInputPath(baseClock, baseInput, baseFPGA, 'system_sync', RR);
    // holdRequired = skew(0) + th(0.3) + uncertainty(0) = 0.3
    // dataArrivalMin = tcoMin(1) + boardMin(0.5) = 1.5
    // holdSlack = 1.5 - 0.3 = 1.2
    expect(r.holdRequired).toBeCloseTo(0.3);
    expect(r.dataArrivalMin).toBeCloseTo(1.5);
    expect(r.holdSlack).toBeCloseTo(1.2);
    expect(r.isHoldViolation).toBe(false);
  });

  it('R→F halves effective window → tighter setup', () => {
    const r = analyzeInputPath(baseClock, baseInput, baseFPGA, 'system_sync', RF);
    // window = 5, setupRequired = 5 - 1.2 = 3.8
    expect(r.setupRequired).toBeCloseTo(3.8);
    expect(r.setupSlack).toBeCloseTo(3.8 - 3.5);
  });

  it('clock skew shifts setup and hold', () => {
    const clock = { ...baseClock, skew: 0.5 };
    const r = analyzeInputPath(clock, baseInput, baseFPGA, 'system_sync', RR);
    // setupRequired = 10 + 0.5 - 1.2 = 9.3
    expect(r.setupRequired).toBeCloseTo(9.3);
    // holdRequired = 0.5 + 0.3 = 0.8
    expect(r.holdRequired).toBeCloseTo(0.8);
  });

  it('negative skew tightens setup, loosens hold', () => {
    const clock = { ...baseClock, skew: -0.5 };
    const r = analyzeInputPath(clock, baseInput, baseFPGA, 'system_sync', RR);
    expect(r.setupRequired).toBeCloseTo(8.3);
    expect(r.holdRequired).toBeCloseTo(-0.2);
  });

  it('jitter and uncertainty reduce setup margins', () => {
    const clock = { ...baseClock, inputJitter: 0.1, systemJitter: 0.05, uncertainty: 0.1 };
    const r = analyzeInputPath(clock, baseInput, baseFPGA, 'system_sync', RR);
    // totalUncertainty = 0.1 + 0.05 + 0.1 = 0.25
    // setupRequired = 10 - 1.2 - 0.25 = 8.55
    expect(r.setupRequired).toBeCloseTo(8.55);
    // holdRequired = 0.3 + 0.25 = 0.55
    expect(r.holdRequired).toBeCloseTo(0.55);
    expect(r.totalUncertainty).toBeCloseTo(0.25);
  });

  it('setup violation when data arrives too late', () => {
    const slowInput: InputPathParams = {
      ...baseInput,
      tcoSourceMax: 8.0, // very slow source
      boardDelayMax: 5.0,
    };
    const r = analyzeInputPath(baseClock, slowInput, baseFPGA, 'system_sync', RR);
    // dataArrivalMax = 13, setupRequired = 8.8 → slack = -4.2
    expect(r.isSetupViolation).toBe(true);
    expect(r.setupSlack).toBeLessThan(0);
  });

  it('hold violation when data arrives too early', () => {
    const fastInput: InputPathParams = {
      ...baseInput,
      tcoSourceMin: 0,
      boardDelayMin: 0,
    };
    const fpga: FPGADeviceParams = { ...baseFPGA, th: 1.0 };
    const r = analyzeInputPath(baseClock, fastInput, fpga, 'system_sync', RR);
    // dataArrivalMin = 0, holdRequired = 1.0 → holdSlack = -1.0
    expect(r.isHoldViolation).toBe(true);
    expect(r.holdSlack).toBeLessThan(0);
  });

  it('topology and edgeConfig are reflected in result', () => {
    const r = analyzeInputPath(baseClock, baseInput, baseFPGA, 'system_sync', FR);
    expect(r.topology).toBe('system_sync');
    expect(r.edgeConfig).toEqual(FR);
  });
});

// ── analyzeInputPath — Source Synchronous ──

describe('analyzeInputPath — source_sync', () => {
  it('source sync includes fwd clock arrival in calculations', () => {
    const r = analyzeInputPath(baseClock, baseInput, baseFPGA, 'source_sync', RR, baseSourceSync);
    // setupRequired = window(10) + clockArrivalMin(0.5) + skew(0) - tsu(1.2) - uncert(0) = 9.3
    expect(r.setupRequired).toBeCloseTo(9.3);
    // holdRequired = clockArrivalMax(1.5) + skew(0) + th(0.3) + uncert(0) = 1.8
    expect(r.holdRequired).toBeCloseTo(1.8);
  });

  it('source sync clockSkew is average difference', () => {
    const r = analyzeInputPath(baseClock, baseInput, baseFPGA, 'source_sync', RR, baseSourceSync);
    // baseClockSkew = (1.5+0.5)/2 - (1.5+0.5)/2 = 0
    expect(r.clockSkew).toBeCloseTo(0);
  });

  it('source sync with asymmetric delays gives nonzero skew', () => {
    const ss: SourceSyncParams = { ...baseSourceSync, fwdClockBoardDelayMax: 3.0, fwdClockBoardDelayMin: 2.0 };
    const r = analyzeInputPath(baseClock, baseInput, baseFPGA, 'source_sync', RR, ss);
    // baseClockSkew = (3+2)/2 - (1.5+0.5)/2 = 2.5 - 1.0 = 1.5
    expect(r.clockSkew).toBeCloseTo(1.5);
  });

  it('source sync + user skew accumulated', () => {
    const clock = { ...baseClock, skew: 0.3 };
    const r = analyzeInputPath(clock, baseInput, baseFPGA, 'source_sync', RR, baseSourceSync);
    // baseClockSkew = 0 (baseSourceSync with baseInput), + user skew 0.3 = 0.3
    expect(r.clockSkew).toBeCloseTo(0.3);
  });
});

// ── analyzeOutputPath — System Synchronous ──

describe('analyzeOutputPath — system_sync', () => {
  it('basic R→R output path', () => {
    const r = analyzeOutputPath(baseClock, baseOutput, baseFPGA, 'system_sync', RR);
    // dataArrivalMax = tcoMax(3) + boardMax(2) = 5
    // setupRequired = 10 - tsuDest(1.5) = 8.5
    // setupSlack = 8.5 - 5 = 3.5
    expect(r.dataArrivalMax).toBeCloseTo(5.0);
    expect(r.setupRequired).toBeCloseTo(8.5);
    expect(r.setupSlack).toBeCloseTo(3.5);
    expect(r.isSetupViolation).toBe(false);
  });

  it('output hold check', () => {
    const r = analyzeOutputPath(baseClock, baseOutput, baseFPGA, 'system_sync', RR);
    // dataArrivalMin = tcoMin(1.5) + boardMin(0.5) = 2.0
    // holdRequired = skew(0) + thDest(0.3) + uncert(0) = 0.3
    // holdSlack = 2.0 - 0.3 = 1.7
    expect(r.dataArrivalMin).toBeCloseTo(2.0);
    expect(r.holdRequired).toBeCloseTo(0.3);
    expect(r.holdSlack).toBeCloseTo(1.7);
    expect(r.isHoldViolation).toBe(false);
  });

  it('output with uncertainty', () => {
    const clock = { ...baseClock, inputJitter: 0.1, systemJitter: 0.1, uncertainty: 0.1 };
    const r = analyzeOutputPath(clock, baseOutput, baseFPGA, 'system_sync', RR);
    const totalU = 0.3;
    expect(r.setupRequired).toBeCloseTo(10 - 1.5 - totalU);
    expect(r.holdRequired).toBeCloseTo(0.3 + totalU);
  });

  it('F→R output path with 50% duty', () => {
    const r = analyzeOutputPath(baseClock, baseOutput, baseFPGA, 'system_sync', FR);
    // window = 5 (10 - 5)
    expect(r.setupRequired).toBeCloseTo(5 - 1.5);
  });
});

// ── analyzeOutputPath — Source Synchronous ──

describe('analyzeOutputPath — source_sync', () => {
  it('source sync output path', () => {
    const r = analyzeOutputPath(baseClock, baseOutput, baseFPGA, 'source_sync', RR, baseSourceSync);
    // setupRequired = 10 + clockArrivalMin(0.5) - tsuDest(1.5) = 9.0
    expect(r.setupRequired).toBeCloseTo(9.0);
    // holdRequired = clockArrivalMax(1.5) + thDest(0.3) = 1.8
    expect(r.holdRequired).toBeCloseTo(1.8);
  });
});

// ── Symmetry / Edge Cases ──

describe('edge cases', () => {
  it('zero jitter means totalUncertainty = 0', () => {
    const r = analyzeInputPath(baseClock, baseInput, baseFPGA, 'system_sync', RR);
    expect(r.totalUncertainty).toBe(0);
  });

  it('R→R and F→F have same effective window for 50% duty', () => {
    const rr = computeEdgeTimes(baseClock, RR);
    const ff = computeEdgeTimes(baseClock, FF);
    expect(rr.effectiveWindow).toBe(ff.effectiveWindow);
  });

  it('R→F and F→R windows sum to full period for 50% duty', () => {
    const rf = computeEdgeTimes(baseClock, RF);
    const fr = computeEdgeTimes(baseClock, FR);
    expect(rf.effectiveWindow + fr.effectiveWindow).toBeCloseTo(baseClock.period);
  });

  it('all numeric results are finite', () => {
    const r = analyzeInputPath(baseClock, baseInput, baseFPGA, 'system_sync', RR);
    for (const val of [r.setupSlack, r.holdSlack, r.dataArrivalMax, r.dataArrivalMin, r.setupRequired, r.holdRequired]) {
      expect(Number.isFinite(val)).toBe(true);
    }
  });
});
