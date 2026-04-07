import { useState, useMemo } from 'react';
import type {
  ClockParams,
  CaptureClockParams,
  InputPathParams,
  OutputPathParams,
  FPGADeviceParams,
  ActivePath,
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
  routingDelayMax: 0.0,
  routingDelayMin: 0.0,
  portName: 'data_in',
};

const DEFAULT_OUTPUT: OutputPathParams = {
  boardDelayMax: 2.0,
  boardDelayMin: 0.5,
  routingDelayMax: 0.0,
  routingDelayMin: 0.0,
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

const DEFAULT_CAPTURE_CLOCK: CaptureClockParams = {
  period: 10,
  dutyCycle: 50,
  portName: 'cap_clk',
};

export default function App() {
  const [clock, setClock] = useState<ClockParams>(DEFAULT_CLOCK);
  const [useIndependentCaptureClock, setUseIndependentCaptureClock] = useState(false);
  const [captureClock, setCaptureClock] = useState<CaptureClockParams>(DEFAULT_CAPTURE_CLOCK);
  const [inputPath, setInputPath] = useState<InputPathParams>(DEFAULT_INPUT);
  const [outputPath, setOutputPath] = useState<OutputPathParams>(DEFAULT_OUTPUT);
  const [fpga, setFPGA] = useState<FPGADeviceParams>(DEFAULT_FPGA);
  const [activePath, setActivePath] = useState<ActivePath>('input');
  const [topology, setTopology] = useState<ClockTopology>('system_sync');
  const [dataRateMode, setDataRateMode] = useState<DataRateMode>('sdr');
  const [edgeConfig, setEdgeConfig] = useState<EdgeConfig>({ launchEdge: 'rising', captureEdge: 'rising' });
  const [sourceSyncParams, setSourceSyncParams] = useState<SourceSyncParams>(DEFAULT_SOURCE_SYNC);

  const effectiveCaptureClock = useIndependentCaptureClock ? captureClock : undefined;

  const inputResult = useMemo(
    () => analyzeInputPath(clock, inputPath, fpga, topology, edgeConfig, sourceSyncParams, effectiveCaptureClock),
    [clock, inputPath, fpga, topology, edgeConfig, sourceSyncParams, effectiveCaptureClock],
  );

  const outputResult = useMemo(
    () => analyzeOutputPath(clock, outputPath, fpga, topology, edgeConfig, sourceSyncParams, effectiveCaptureClock),
    [clock, outputPath, fpga, topology, edgeConfig, sourceSyncParams, effectiveCaptureClock],
  );

  const xdcText = useMemo(
    () => generateXDC(clock, inputPath, outputPath, fpga, topology, edgeConfig, sourceSyncParams, effectiveCaptureClock),
    [clock, inputPath, outputPath, fpga, topology, edgeConfig, sourceSyncParams, effectiveCaptureClock],
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
        routingDelay: inputPath.routingDelayMax,
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
        routingDelay: outputPath.routingDelayMax,
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
            useIndependentCaptureClock={useIndependentCaptureClock}
            captureClock={captureClock}
            onClockChange={setClock}
            onInputPathChange={setInputPath}
            onOutputPathChange={setOutputPath}
            onFPGAChange={setFPGA}
            onTopologyChange={setTopology}
            onDataRateModeChange={setDataRateMode}
            onEdgeConfigChange={setEdgeConfig}
            onSourceSyncChange={setSourceSyncParams}
            onUseIndependentCaptureClockChange={setUseIndependentCaptureClock}
            onCaptureClockChange={setCaptureClock}
          />
        </aside>

        {/* Center: Visualization */}
        <main className="panel-center">
          {/* Path selector */}
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
          </div>

          {/* Path block diagram */}
          <div className="path-diagram-container">
            <PathDiagram {...pathDiagramProps} />
          </div>

          {/* Main visualization */}
          <div className="visualization diagram-mode">
            <TimingDiagram
              clock={clock}
              result={activeResult}
              isInputPath={isInputPath}
              captureClock={effectiveCaptureClock}
            />
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
