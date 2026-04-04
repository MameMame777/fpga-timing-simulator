import { useState, useMemo } from 'react';
import type {
  ClockParams,
  InputPathParams,
  OutputPathParams,
  FPGADeviceParams,
  ActivePath,
  ViewMode,
  ClockTopology,
  DataRateMode,
  EdgeConfig,
  SourceSyncParams,
} from './types/timing.ts';
import { analyzeInputPath, analyzeOutputPath } from './engine/timing-analyzer.ts';
import { generateXDC } from './utils/xdc-generator.ts';
import { ParameterPanel } from './components/ParameterPanel.tsx';
import { ResultPanel } from './components/ResultPanel.tsx';
import { ConstraintOutput } from './components/ConstraintOutput.tsx';
import { WaveformView } from './components/WaveformView.tsx';
import { TimingDiagram } from './svg/TimingDiagram.tsx';
import { PathDiagram } from './svg/PathDiagram.tsx';
import './App.css';

const DEFAULT_CLOCK: ClockParams = {
  period: 10,
  dutyCycle: 50,
  portName: 'sys_clk',
  skew: 0,
  inputJitter: 0.1,
  systemJitter: 0.05,
  uncertainty: 0.1,
};

const DEFAULT_INPUT: InputPathParams = {
  tcoSourceMax: 2.0,
  tcoSourceMin: 1.0,
  boardDelayMax: 1.5,
  boardDelayMin: 0.5,
  portName: 'data_in',
};

const DEFAULT_OUTPUT: OutputPathParams = {
  boardDelayMax: 2.0,
  boardDelayMin: 0.5,
  tsuDest: 1.5,
  thDest: 0.3,
  portName: 'data_out',
};

const DEFAULT_FPGA: FPGADeviceParams = {
  tsu: 1.2,
  th: 0.3,
  tcoMax: 3.0,
  tcoMin: 1.5,
};

const DEFAULT_SOURCE_SYNC: SourceSyncParams = {
  fwdClockBoardDelayMax: 1.5,
  fwdClockBoardDelayMin: 0.5,
  fwdClockPortName: 'fwd_clk',
};

export default function App() {
  const [clock, setClock] = useState<ClockParams>(DEFAULT_CLOCK);
  const [inputPath, setInputPath] = useState<InputPathParams>(DEFAULT_INPUT);
  const [outputPath, setOutputPath] = useState<OutputPathParams>(DEFAULT_OUTPUT);
  const [fpga, setFPGA] = useState<FPGADeviceParams>(DEFAULT_FPGA);
  const [activePath, setActivePath] = useState<ActivePath>('input');
  const [viewMode, setViewMode] = useState<ViewMode>('waveform');
  const [topology, setTopology] = useState<ClockTopology>('system_sync');
  const [dataRateMode, setDataRateMode] = useState<DataRateMode>('sdr');
  const [edgeConfig, setEdgeConfig] = useState<EdgeConfig>({ launchEdge: 'rising', captureEdge: 'rising' });
  const [sourceSyncParams, setSourceSyncParams] = useState<SourceSyncParams>(DEFAULT_SOURCE_SYNC);

  const inputResult = useMemo(
    () => analyzeInputPath(clock, inputPath, fpga, topology, edgeConfig, sourceSyncParams),
    [clock, inputPath, fpga, topology, edgeConfig, sourceSyncParams],
  );

  const outputResult = useMemo(
    () => analyzeOutputPath(clock, outputPath, fpga, topology, edgeConfig, sourceSyncParams),
    [clock, outputPath, fpga, topology, edgeConfig, sourceSyncParams],
  );

  const xdcText = useMemo(
    () => generateXDC(clock, inputPath, outputPath, fpga, topology, edgeConfig, sourceSyncParams),
    [clock, inputPath, outputPath, fpga, topology, edgeConfig, sourceSyncParams],
  );

  const activeResult = activePath === 'input' ? inputResult : outputResult;
  const isInputPath = activePath === 'input';

  // Path diagram props
  const pathDiagramProps = isInputPath
    ? {
        result: activeResult,
        isInputPath: true,
        tcoLabel: 'Tco src',
        boardLabel: `${inputPath.boardDelayMin}~${inputPath.boardDelayMax} ns`,
        tco: inputPath.tcoSourceMax,
        boardDelay: inputPath.boardDelayMax,
        topology,
        sourceSyncParams,
      }
    : {
        result: activeResult,
        isInputPath: false,
        tcoLabel: 'Tco FPGA',
        boardLabel: `${outputPath.boardDelayMin}~${outputPath.boardDelayMax} ns`,
        tco: fpga.tcoMax,
        boardDelay: outputPath.boardDelayMax,
        topology,
        sourceSyncParams,
      };

  return (
    <div className="app">
      <header className="app-header">
        <h1>FPGA Timing Constraint Simulator</h1>
        <p>Launch Edge &rarr; Data Propagation &rarr; Capture Edge</p>
      </header>

      <div className="app-layout">
        {/* Left: Parameters */}
        <aside className="panel-left">
          <ParameterPanel
            activePath={activePath}
            clock={clock}
            inputPath={inputPath}
            outputPath={outputPath}
            fpga={fpga}
            topology={topology}
            dataRateMode={dataRateMode}
            edgeConfig={edgeConfig}
            sourceSyncParams={sourceSyncParams}
            onClockChange={setClock}
            onInputPathChange={setInputPath}
            onOutputPathChange={setOutputPath}
            onFPGAChange={setFPGA}
            onTopologyChange={setTopology}
            onDataRateModeChange={setDataRateMode}
            onEdgeConfigChange={setEdgeConfig}
            onSourceSyncChange={setSourceSyncParams}
          />
        </aside>

        {/* Center: Visualization */}
        <main className="panel-center">
          {/* Path selector + View toggle */}
          <div className="view-controls">
            <div className="path-selector">
              <button
                className={activePath === 'input' ? 'active' : ''}
                onClick={() => setActivePath('input')}
              >
                Input Path
              </button>
              <button
                className={activePath === 'output' ? 'active' : ''}
                onClick={() => setActivePath('output')}
              >
                Output Path
              </button>
            </div>
            <div className="view-toggle">
              <button
                className={viewMode === 'waveform' ? 'active' : ''}
                onClick={() => setViewMode('waveform')}
              >
                Waveform Animation
              </button>
              <button
                className={viewMode === 'diagram' ? 'active' : ''}
                onClick={() => setViewMode('diagram')}
              >
                Timing Diagram
              </button>
            </div>
          </div>

          {/* Main visualization */}
          <div className="visualization">
            {viewMode === 'waveform' ? (
              <WaveformView
                clock={clock}
                result={activeResult}
                isInputPath={isInputPath}
                topology={topology}
                sourceSyncParams={sourceSyncParams}
              />
            ) : (
              <TimingDiagram
                clock={clock}
                result={activeResult}
                isInputPath={isInputPath}
              />
            )}
          </div>

          {/* Path block diagram */}
          <div className="path-diagram-container">
            <PathDiagram {...pathDiagramProps} />
          </div>
        </main>

        {/* Right: Results + Constraints */}
        <aside className="panel-right">
          <ResultPanel
            inputResult={inputResult}
            outputResult={outputResult}
            activePath={activePath}
          />
          <ConstraintOutput
            xdcText={xdcText}
            clock={clock}
            inputPath={inputPath}
            outputPath={outputPath}
            topology={topology}
            edgeConfig={edgeConfig}
            sourceSyncParams={sourceSyncParams}
          />
        </aside>
      </div>
    </div>
  );
}
