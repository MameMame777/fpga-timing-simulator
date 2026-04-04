import { useCallback, useEffect, useState } from 'react';
import type {
  ClockParams,
  InputPathParams,
  OutputPathParams,
  ClockTopology,
  EdgeConfig,
  SourceSyncParams,
} from '../types/timing.ts';

interface Props {
  xdcText: string;
  clock: ClockParams;
  inputPath: InputPathParams;
  outputPath: OutputPathParams;
  topology: ClockTopology;
  edgeConfig: EdgeConfig;
  sourceSyncParams: SourceSyncParams;
}

function fmt(value: number): string {
  return value.toFixed(3);
}

function fmtSigned(value: number): string {
  return value >= 0 ? `+ ${fmt(value)}` : `- ${fmt(Math.abs(value))}`;
}

export function ConstraintOutput({
  xdcText,
  clock,
  inputPath,
  outputPath,
  topology,
  edgeConfig,
  sourceSyncParams,
}: Props) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(xdcText);
  }, [xdcText]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([xdcText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timing_constraints.xdc';
    a.click();
    URL.revokeObjectURL(url);
  }, [xdcText]);

  const isSourceSync = topology === 'source_sync';
  const captureEdgeFlag = edgeConfig.captureEdge === 'falling' ? '-clock_fall' : '(rising edge)';
  const inputClockRef = isSourceSync ? sourceSyncParams.fwdClockPortName : clock.portName;
  const outputClockRef = isSourceSync ? sourceSyncParams.fwdClockPortName : clock.portName;

  const inputMax = isSourceSync
    ? inputPath.tcoSourceMax + clock.skew
    : inputPath.tcoSourceMax + inputPath.boardDelayMax + clock.skew;
  const inputMin = isSourceSync
    ? inputPath.tcoSourceMin + clock.skew
    : inputPath.tcoSourceMin + inputPath.boardDelayMin + clock.skew;

  const outputMax = isSourceSync
    ? outputPath.boardDelayMax + outputPath.tsuDest - sourceSyncParams.fwdClockBoardDelayMin + clock.skew
    : outputPath.boardDelayMax + outputPath.tsuDest + clock.skew;
  const outputMin = isSourceSync
    ? outputPath.boardDelayMin - outputPath.thDest - sourceSyncParams.fwdClockBoardDelayMax + clock.skew
    : outputPath.boardDelayMin - outputPath.thDest + clock.skew;

  const inputMaxExpr = isSourceSync
    ? `${fmt(inputPath.tcoSourceMax)} ${fmtSigned(clock.skew)}`
    : `${fmt(inputPath.tcoSourceMax)} + ${fmt(inputPath.boardDelayMax)} ${fmtSigned(clock.skew)}`;
  const inputMinExpr = isSourceSync
    ? `${fmt(inputPath.tcoSourceMin)} ${fmtSigned(clock.skew)}`
    : `${fmt(inputPath.tcoSourceMin)} + ${fmt(inputPath.boardDelayMin)} ${fmtSigned(clock.skew)}`;
  const outputMaxExpr = isSourceSync
    ? `${fmt(outputPath.boardDelayMax)} + ${fmt(outputPath.tsuDest)} - ${fmt(sourceSyncParams.fwdClockBoardDelayMin)} ${fmtSigned(clock.skew)}`
    : `${fmt(outputPath.boardDelayMax)} + ${fmt(outputPath.tsuDest)} ${fmtSigned(clock.skew)}`;
  const outputMinExpr = isSourceSync
    ? `${fmt(outputPath.boardDelayMin)} - ${fmt(outputPath.thDest)} - ${fmt(sourceSyncParams.fwdClockBoardDelayMax)} ${fmtSigned(clock.skew)}`
    : `${fmt(outputPath.boardDelayMin)} - ${fmt(outputPath.thDest)} ${fmtSigned(clock.skew)}`;
  const topologyLabel = isSourceSync ? 'Source-synchronous' : 'System-synchronous';

  useEffect(() => {
    if (!isHelpOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsHelpOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isHelpOpen]);

  return (
    <div className="constraint-output">
      <h2>XDC Constraints</h2>
      <div className="constraint-actions">
        <button onClick={() => setIsHelpOpen(true)} title="Show equation details">Help</button>
        <button onClick={handleCopy} title="Copy to clipboard">Copy</button>
        <button onClick={handleDownload} title="Download .xdc file">Download</button>
      </div>
      <pre className="xdc-text">{xdcText}</pre>

      {isHelpOpen && (
        <div className="modal-overlay" onClick={() => setIsHelpOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Constraint equations help">
            <div className="modal-header">
              <h3>Constraint Value Breakdown</h3>
              <button className="modal-close-btn" onClick={() => setIsHelpOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <div className="constraint-note compact">
                <div className="constraint-line formula-title">{topologyLabel} equations and substituted values</div>

                <div className="constraint-block">
                  <div className="constraint-block-title">Clock / Reference</div>
                  <div className="constraint-line">create_clock -period = {fmt(clock.period)} ns (clock: {clock.portName})</div>
                  <div className="constraint-line">Configured clock skew = {fmt(clock.skew)} ns</div>
                  <div className="constraint-line">set_input_jitter = {fmt(clock.inputJitter)} ns</div>
                  <div className="constraint-line">set_system_jitter = {fmt(clock.systemJitter)} ns</div>
                  <div className="constraint-line">set_clock_uncertainty = {fmt(clock.uncertainty)} ns</div>
                  <div className="constraint-line">Capture edge mode: {captureEdgeFlag}</div>
                  <div className="constraint-line">Input reference clock: {inputClockRef}</div>
                  <div className="constraint-line">Output reference clock: {outputClockRef}</div>
                </div>

                <div className="constraint-block">
                  <div className="constraint-block-title">Input delay</div>
                {!isSourceSync && (
                  <>
                    <div className="constraint-line">Equation: input_delay(max/min) = tco_src(max/min) + board_delay(max/min)</div>
                    <div className="constraint-line">Equation (applied): input_delay(max/min) += clk_skew</div>
                  </>
                )}
                {isSourceSync && (
                  <>
                    <div className="constraint-line">Equation: input_delay(max/min) = tco_src(max/min)</div>
                    <div className="constraint-line">Equation (applied): input_delay(max/min) += clk_skew</div>
                  </>
                )}
                <div className="constraint-line">set_input_delay -max = {inputMaxExpr} = {fmt(inputMax)} ns</div>
                <div className="constraint-line">set_input_delay -min = {inputMinExpr} = {fmt(inputMin)} ns</div>
                </div>

                <div className="constraint-block">
                  <div className="constraint-block-title">Output delay</div>
                  {!isSourceSync && (
                    <>
                      <div className="constraint-line">Equation(max): output_delay_max = board_delay_max + tsu_dest</div>
                      <div className="constraint-line">Equation(min): output_delay_min = board_delay_min - th_dest</div>
                      <div className="constraint-line">Equation (applied): output_delay(max/min) += clk_skew</div>
                    </>
                  )}
                  {isSourceSync && (
                    <>
                      <div className="constraint-line">Equation(max): output_delay_max = board_delay_max + tsu_dest - fwd_clk_delay_min</div>
                      <div className="constraint-line">Equation(min): output_delay_min = board_delay_min - th_dest - fwd_clk_delay_max</div>
                      <div className="constraint-line">Equation (applied): output_delay(max/min) += clk_skew</div>
                    </>
                  )}
                <div className="constraint-line">set_output_delay -max = {outputMaxExpr} = {fmt(outputMax)} ns</div>
                <div className="constraint-line">set_output_delay -min = {outputMinExpr} = {fmt(outputMin)} ns</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
