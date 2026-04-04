import { useCallback } from 'react';
import type {
  ActivePath,
  ClockParams,
  InputPathParams,
  OutputPathParams,
  FPGADeviceParams,
  ClockTopology,
  DataRateMode,
  EdgeConfig,
  EdgeType,
  SourceSyncParams,
} from '../types/timing.ts';

interface Props {
  activePath: ActivePath;
  clock: ClockParams;
  inputPath: InputPathParams;
  outputPath: OutputPathParams;
  fpga: FPGADeviceParams;
  topology: ClockTopology;
  dataRateMode: DataRateMode;
  edgeConfig: EdgeConfig;
  sourceSyncParams: SourceSyncParams;
  onClockChange: (c: ClockParams) => void;
  onInputPathChange: (p: InputPathParams) => void;
  onOutputPathChange: (p: OutputPathParams) => void;
  onFPGAChange: (d: FPGADeviceParams) => void;
  onTopologyChange: (t: ClockTopology) => void;
  onDataRateModeChange: (m: DataRateMode) => void;
  onEdgeConfigChange: (e: EdgeConfig) => void;
  onSourceSyncChange: (s: SourceSyncParams) => void;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function NumField({
  label,
  value,
  min,
  max,
  step,
  unit,
  description,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  description?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="param-field">
      <label>{label}</label>
      <div className="param-input-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (!Number.isFinite(parsed)) return;
            onChange(clampNumber(parsed, min, max));
          }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (!Number.isFinite(parsed)) return;
            onChange(clampNumber(parsed, min, max));
          }}
        />
        <span className="unit">{unit}</span>
      </div>
      {description && <p className="param-description">{description}</p>}
    </div>
  );
}

export function ParameterPanel({
  activePath,
  clock,
  inputPath,
  outputPath,
  fpga,
  topology,
  dataRateMode,
  edgeConfig,
  sourceSyncParams,
  onClockChange,
  onInputPathChange,
  onOutputPathChange,
  onFPGAChange,
  onTopologyChange,
  onDataRateModeChange,
  onEdgeConfigChange,
  onSourceSyncChange,
}: Props) {
  const updateClock = useCallback(
    (key: keyof ClockParams, val: number | string) => {
      if (key === 'portName') {
        onClockChange({ ...clock, portName: String(val) });
        return;
      }
      if (key === 'period' && typeof val === 'number') {
        onClockChange({ ...clock, period: clampNumber(val, 1, 100) });
        return;
      }
      if (key === 'dutyCycle' && typeof val === 'number') {
        onClockChange({ ...clock, dutyCycle: clampNumber(val, 10, 90) });
        return;
      }
      if (key === 'skew' && typeof val === 'number') {
        onClockChange({ ...clock, skew: clampNumber(val, -5, 5) });
        return;
      }
      if (key === 'inputJitter' && typeof val === 'number') {
        onClockChange({ ...clock, inputJitter: clampNumber(val, 0, 2) });
        return;
      }
      if (key === 'systemJitter' && typeof val === 'number') {
        onClockChange({ ...clock, systemJitter: clampNumber(val, 0, 2) });
        return;
      }
      if (key === 'uncertainty' && typeof val === 'number') {
        onClockChange({ ...clock, uncertainty: clampNumber(val, 0, 5) });
      }
    },
    [clock, onClockChange],
  );

  const updateInput = useCallback(
    (key: keyof InputPathParams, val: number | string) => {
      if (key === 'portName') {
        onInputPathChange({ ...inputPath, portName: String(val) });
        return;
      }

      if (typeof val !== 'number') return;

      const clamped = clampNumber(val, 0, 20);
      if (key === 'tcoSourceMin') {
        onInputPathChange({
          ...inputPath,
          tcoSourceMin: clamped,
          tcoSourceMax: Math.max(inputPath.tcoSourceMax, clamped),
        });
        return;
      }
      if (key === 'tcoSourceMax') {
        onInputPathChange({
          ...inputPath,
          tcoSourceMax: clamped,
          tcoSourceMin: Math.min(inputPath.tcoSourceMin, clamped),
        });
        return;
      }
      if (key === 'boardDelayMin') {
        onInputPathChange({
          ...inputPath,
          boardDelayMin: clamped,
          boardDelayMax: Math.max(inputPath.boardDelayMax, clamped),
        });
        return;
      }
      if (key === 'boardDelayMax') {
        onInputPathChange({
          ...inputPath,
          boardDelayMax: clamped,
          boardDelayMin: Math.min(inputPath.boardDelayMin, clamped),
        });
      }
    },
    [inputPath, onInputPathChange],
  );

  const updateOutput = useCallback(
    (key: keyof OutputPathParams, val: number | string) => {
      if (key === 'portName') {
        onOutputPathChange({ ...outputPath, portName: String(val) });
        return;
      }

      if (typeof val !== 'number') return;

      if (key === 'boardDelayMin') {
        const clamped = clampNumber(val, 0, 20);
        onOutputPathChange({
          ...outputPath,
          boardDelayMin: clamped,
          boardDelayMax: Math.max(outputPath.boardDelayMax, clamped),
        });
        return;
      }
      if (key === 'boardDelayMax') {
        const clamped = clampNumber(val, 0, 20);
        onOutputPathChange({
          ...outputPath,
          boardDelayMax: clamped,
          boardDelayMin: Math.min(outputPath.boardDelayMin, clamped),
        });
        return;
      }
      if (key === 'tsuDest') {
        onOutputPathChange({ ...outputPath, tsuDest: clampNumber(val, 0, 10) });
        return;
      }
      if (key === 'thDest') {
        onOutputPathChange({ ...outputPath, thDest: clampNumber(val, -5, 10) });
      }
    },
    [outputPath, onOutputPathChange],
  );

  const updateFPGA = useCallback(
    (key: keyof FPGADeviceParams, val: number) => {
      if (key === 'tsu') {
        onFPGAChange({ ...fpga, tsu: clampNumber(val, 0, 5) });
        return;
      }
      if (key === 'th') {
        onFPGAChange({ ...fpga, th: clampNumber(val, -5, 5) });
        return;
      }
      if (key === 'tcoMin') {
        const clamped = clampNumber(val, 0, 10);
        onFPGAChange({
          ...fpga,
          tcoMin: clamped,
          tcoMax: Math.max(fpga.tcoMax, clamped),
        });
        return;
      }
      if (key === 'tcoMax') {
        const clamped = clampNumber(val, 0, 10);
        onFPGAChange({
          ...fpga,
          tcoMax: clamped,
          tcoMin: Math.min(fpga.tcoMin, clamped),
        });
      }
    },
    [fpga, onFPGAChange],
  );

  const updateSourceSync = useCallback(
    (key: keyof SourceSyncParams, val: number | string) => {
      if (key === 'fwdClockPortName') {
        onSourceSyncChange({ ...sourceSyncParams, fwdClockPortName: String(val) });
        return;
      }

      if (typeof val !== 'number') return;

      const clamped = clampNumber(val, 0, 20);
      if (key === 'fwdClockBoardDelayMin') {
        onSourceSyncChange({
          ...sourceSyncParams,
          fwdClockBoardDelayMin: clamped,
          fwdClockBoardDelayMax: Math.max(sourceSyncParams.fwdClockBoardDelayMax, clamped),
        });
        return;
      }
      if (key === 'fwdClockBoardDelayMax') {
        onSourceSyncChange({
          ...sourceSyncParams,
          fwdClockBoardDelayMax: clamped,
          fwdClockBoardDelayMin: Math.min(sourceSyncParams.fwdClockBoardDelayMin, clamped),
        });
      }
    },
    [sourceSyncParams, onSourceSyncChange],
  );

  const isOppositeEdgeSDR =
    dataRateMode === 'sdr' && (
      (edgeConfig.launchEdge === 'rising' && edgeConfig.captureEdge === 'falling') ||
      (edgeConfig.launchEdge === 'falling' && edgeConfig.captureEdge === 'rising')
    );

  // Compute validation warnings
  const warnings: string[] = [];
  if (inputPath.tcoSourceMin > inputPath.tcoSourceMax) warnings.push('Input: Tco min > Tco max');
  if (inputPath.boardDelayMin > inputPath.boardDelayMax) warnings.push('Input: Board Delay min > max');
  if (outputPath.boardDelayMin > outputPath.boardDelayMax) warnings.push('Output: Board Delay min > max');
  if (fpga.tcoMin > fpga.tcoMax) warnings.push('FPGA: Tco min > Tco max');
  if (topology === 'source_sync' && sourceSyncParams.fwdClockBoardDelayMin > sourceSyncParams.fwdClockBoardDelayMax)
    warnings.push('Fwd Clock: Delay min > max');
  const totalUncertainty = clock.inputJitter + clock.systemJitter + clock.uncertainty;
  if (totalUncertainty > clock.period * 0.5) warnings.push('Total uncertainty exceeds 50% of clock period');

  const oppositeEdge = (edge: EdgeType): EdgeType => (edge === 'rising' ? 'falling' : 'rising');

  const handleLaunchEdgeChange = (edge: EdgeType) => {
    if (dataRateMode === 'ddr') {
      onEdgeConfigChange({ launchEdge: edge, captureEdge: oppositeEdge(edge) });
      return;
    }
    onEdgeConfigChange({ ...edgeConfig, launchEdge: edge });
  };

  const handleCaptureEdgeChange = (edge: EdgeType) => {
    if (dataRateMode === 'ddr') {
      onEdgeConfigChange({ launchEdge: oppositeEdge(edge), captureEdge: edge });
      return;
    }
    onEdgeConfigChange({ ...edgeConfig, captureEdge: edge });
  };

  const handleDataRateModeChange = (mode: DataRateMode) => {
    onDataRateModeChange(mode);
    if (mode === 'ddr' && edgeConfig.launchEdge === edgeConfig.captureEdge) {
      onEdgeConfigChange({
        launchEdge: edgeConfig.launchEdge,
        captureEdge: oppositeEdge(edgeConfig.launchEdge),
      });
    }
  };

  return (
    <div className="parameter-panel">
      <h2>Parameters</h2>

      {warnings.length > 0 && (
        <div className="validation-warnings">
          {warnings.map((w) => (
            <div key={w} className="validation-warning">⚠ {w}</div>
          ))}
        </div>
      )}

      {/* Topology selector */}
      <section className="param-section">
        <h3>Clock Topology</h3>
        <div className="topology-selector">
          <button
            className={topology === 'system_sync' ? 'active' : ''}
            onClick={() => onTopologyChange('system_sync')}
          >
            System Synchronous
          </button>
          <button
            className={topology === 'source_sync' ? 'active' : ''}
            onClick={() => onTopologyChange('source_sync')}
          >
            Source Synchronous
          </button>
        </div>
        <p className="param-hint">
          {topology === 'system_sync'
            ? 'Common clock: both source and FPGA share the same clock.'
            : 'Forwarded clock: source sends clock alongside data.'}
        </p>
      </section>

      {/* Edge configuration */}
      <section className="param-section">
        <div className="rate-selector">
          <button
            className={dataRateMode === 'sdr' ? 'active' : ''}
            onClick={() => handleDataRateModeChange('sdr')}
          >
            SDR
          </button>
          <button
            className={dataRateMode === 'ddr' ? 'active' : ''}
            onClick={() => handleDataRateModeChange('ddr')}
          >
            DDR
          </button>
        </div>
        <h3>
          Edge Configuration
          {dataRateMode === 'ddr' && <span className="ddr-badge">(DDR)</span>}
          {isOppositeEdgeSDR && <span className="ddr-badge">(Opposite-edge SDR)</span>}
        </h3>
        <div className="edge-selectors">
          <div className="edge-field">
            <label>Launch Edge</label>
            <select
              value={edgeConfig.launchEdge}
              onChange={(e) => handleLaunchEdgeChange(e.target.value as EdgeType)}
            >
              <option value="rising">Rising ↑</option>
              <option value="falling">Falling ↓</option>
            </select>
          </div>
          <span className="edge-arrow">&rarr;</span>
          <div className="edge-field">
            <label>Capture Edge</label>
            <select
              value={edgeConfig.captureEdge}
              onChange={(e) => handleCaptureEdgeChange(e.target.value as EdgeType)}
            >
              <option value="rising">Rising ↑</option>
              <option value="falling">Falling ↓</option>
            </select>
          </div>
        </div>
        {dataRateMode === 'ddr' && <p className="param-hint">DDR mode ties launch/capture to opposite edges.</p>}
      </section>

      <section className="param-section">
        <h3>Clock</h3>
        <NumField
          label="Period"
          value={clock.period}
          min={1}
          max={100}
          step={0.1}
          unit="ns"
          description="Clock period. This value is used directly in create_clock -period."
          onChange={(v) => updateClock('period', v)}
        />
        <NumField
          label="Duty Cycle"
          value={clock.dutyCycle}
          min={10}
          max={90}
          step={1}
          unit="%"
          description="Clock high-time ratio. Affects waveform shape and rising/falling edge positions."
          onChange={(v) => updateClock('dutyCycle', v)}
        />
        <NumField
          label="Clock Skew"
          value={clock.skew}
          min={-5}
          max={5}
          step={0.05}
          unit="ns"
          description="Capture clock shift relative to launch clock. Positive skew helps setup and hurts hold."
          onChange={(v) => updateClock('skew', v)}
        />
        <NumField
          label="Input Jitter"
          value={clock.inputJitter}
          min={0}
          max={2}
          step={0.01}
          unit="ns"
          description="Primary-clock input jitter (set_input_jitter)."
          onChange={(v) => updateClock('inputJitter', v)}
        />
        <NumField
          label="System Jitter"
          value={clock.systemJitter}
          min={0}
          max={2}
          step={0.01}
          unit="ns"
          description="Global board/power jitter (set_system_jitter)."
          onChange={(v) => updateClock('systemJitter', v)}
        />
        <NumField
          label="Clock Uncertainty"
          value={clock.uncertainty}
          min={0}
          max={5}
          step={0.01}
          unit="ns"
          description="Additional timing margin (set_clock_uncertainty)."
          onChange={(v) => updateClock('uncertainty', v)}
        />
        <div className="param-field">
          <label>Port Name</label>
          <input type="text" value={clock.portName} onChange={(e) => updateClock('portName', e.target.value)} />
          <p className="param-description">Clock port name used in get_ports and create_clock -name.</p>
        </div>
      </section>

      {/* Source sync params — only when source_sync */}
      {topology === 'source_sync' && (
        <section className="param-section source-sync-section">
          <h3>Forwarded Clock</h3>
          <NumField
            label="Fwd Clk Delay max"
            value={sourceSyncParams.fwdClockBoardDelayMax}
            min={0}
            max={20}
            step={0.1}
            unit="ns"
            description="Maximum board delay of the forwarded clock. Mainly affects output_delay -min."
            onChange={(v) => updateSourceSync('fwdClockBoardDelayMax', v)}
          />
          <NumField
            label="Fwd Clk Delay min"
            value={sourceSyncParams.fwdClockBoardDelayMin}
            min={0}
            max={20}
            step={0.1}
            unit="ns"
            description="Minimum board delay of the forwarded clock. Mainly affects output_delay -max."
            onChange={(v) => updateSourceSync('fwdClockBoardDelayMin', v)}
          />
          <div className="param-field">
            <label>Fwd Clock Port</label>
            <input type="text" value={sourceSyncParams.fwdClockPortName} onChange={(e) => updateSourceSync('fwdClockPortName', e.target.value)} />
            <p className="param-description">Reference forwarded clock port name for source-synchronous timing.</p>
          </div>
        </section>
      )}

      {activePath === 'input' && (
        <section className="param-section">
          <h3>Input Path (Source &rarr; FPGA)</h3>
          <NumField
            label="Source Tco max"
            value={inputPath.tcoSourceMax}
            min={0}
            max={20}
            step={0.1}
            unit="ns"
            description="Maximum source device clock-to-output delay. Used for slow-arrival (setup) analysis."
            onChange={(v) => updateInput('tcoSourceMax', v)}
          />
          <NumField
            label="Source Tco min"
            value={inputPath.tcoSourceMin}
            min={0}
            max={20}
            step={0.1}
            unit="ns"
            description="Minimum source device clock-to-output delay. Used for early-arrival (hold) analysis."
            onChange={(v) => updateInput('tcoSourceMin', v)}
          />
          <NumField
            label="Board Delay max"
            value={inputPath.boardDelayMax}
            min={0}
            max={20}
            step={0.1}
            unit="ns"
            description="Maximum board delay on data trace. Added to system-synchronous input_delay -max."
            onChange={(v) => updateInput('boardDelayMax', v)}
          />
          <NumField
            label="Board Delay min"
            value={inputPath.boardDelayMin}
            min={0}
            max={20}
            step={0.1}
            unit="ns"
            description="Minimum board delay on data trace. Added to system-synchronous input_delay -min."
            onChange={(v) => updateInput('boardDelayMin', v)}
          />
          <div className="param-field">
            <label>Port Name</label>
            <input type="text" value={inputPath.portName} onChange={(e) => updateInput('portName', e.target.value)} />
            <p className="param-description">Input port targeted by set_input_delay constraints.</p>
          </div>
        </section>
      )}

      {activePath === 'output' && (
        <section className="param-section">
          <h3>Output Path (FPGA &rarr; Dest)</h3>
          <NumField
            label="Board Delay max"
            value={outputPath.boardDelayMax}
            min={0}
            max={20}
            step={0.1}
            unit="ns"
            description="Maximum board delay from FPGA output to destination device. Main term of output_delay -max."
            onChange={(v) => updateOutput('boardDelayMax', v)}
          />
          <NumField
            label="Board Delay min"
            value={outputPath.boardDelayMin}
            min={0}
            max={20}
            step={0.1}
            unit="ns"
            description="Minimum board delay from FPGA output to destination device. Main term of output_delay -min."
            onChange={(v) => updateOutput('boardDelayMin', v)}
          />
          <NumField
            label="Dest Tsu"
            value={outputPath.tsuDest}
            min={0}
            max={10}
            step={0.1}
            unit="ns"
            description="Destination device setup time. Added in output_delay -max calculation."
            onChange={(v) => updateOutput('tsuDest', v)}
          />
          <NumField
            label="Dest Th"
            value={outputPath.thDest}
            min={-5}
            max={10}
            step={0.1}
            unit="ns"
            description="Destination device hold time. Subtracted in output_delay -min calculation."
            onChange={(v) => updateOutput('thDest', v)}
          />
          <div className="param-field">
            <label>Port Name</label>
            <input type="text" value={outputPath.portName} onChange={(e) => updateOutput('portName', e.target.value)} />
            <p className="param-description">Output port targeted by set_output_delay constraints.</p>
          </div>
        </section>
      )}

      <section className="param-section">
        <h3>FPGA Device</h3>
        <NumField
          label="Tsu (setup)"
          value={fpga.tsu}
          min={0}
          max={5}
          step={0.01}
          unit="ns"
          description="FPGA input flip-flop setup time used in input-path required-time calculation."
          onChange={(v) => updateFPGA('tsu', v)}
        />
        <NumField
          label="Th (hold)"
          value={fpga.th}
          min={-5}
          max={5}
          step={0.01}
          unit="ns"
          description="FPGA input flip-flop hold time used in input-path hold checks."
          onChange={(v) => updateFPGA('th', v)}
        />
        <NumField
          label="Tco max"
          value={fpga.tcoMax}
          min={0}
          max={10}
          step={0.1}
          unit="ns"
          description="Maximum FPGA output flip-flop clock-to-output delay for slow output arrival."
          onChange={(v) => updateFPGA('tcoMax', v)}
        />
        <NumField
          label="Tco min"
          value={fpga.tcoMin}
          min={0}
          max={10}
          step={0.1}
          unit="ns"
          description="Minimum FPGA output flip-flop clock-to-output delay for early output arrival."
          onChange={(v) => updateFPGA('tcoMin', v)}
        />
      </section>
    </div>
  );
}
