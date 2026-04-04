import type { AnalysisResult, ActivePath } from '../types/timing.ts';

interface Props {
  inputResult: AnalysisResult;
  outputResult: AnalysisResult;
  activePath: ActivePath;
}

function SlackBadge({ label, value }: { label: string; value: number }) {
  const isViolation = value < 0;
  return (
    <div className={`slack-badge ${isViolation ? 'violation' : 'ok'}`}>
      <span className="slack-label">{label}</span>
      <span className="slack-value">{value.toFixed(3)} ns</span>
      {isViolation && <span className="violation-icon">&#x2716;</span>}
      {!isViolation && <span className="ok-icon">&#x2714;</span>}
    </div>
  );
}

function PathResult({
  title,
  result,
  active,
}: {
  title: string;
  result: AnalysisResult;
  active: boolean;
}) {
  const hasViolation = result.isSetupViolation || result.isHoldViolation;
  return (
    <div className={`path-result ${active ? 'active' : ''} ${hasViolation ? 'has-violation' : ''}`}>
      <h4>{title}</h4>
      <SlackBadge label="Setup Slack" value={result.setupSlack} />
      <SlackBadge label="Hold Slack" value={result.holdSlack} />
      <div className="timing-detail">
        <div>Data Arrival: {result.dataArrivalMin.toFixed(3)} ~ {result.dataArrivalMax.toFixed(3)} ns</div>
        <div>Setup Required: &lt; {result.setupRequired.toFixed(3)} ns</div>
        <div>Hold Required: &gt; {result.holdRequired.toFixed(3)} ns</div>
        <div>Clock Skew: {result.clockSkew.toFixed(3)} ns</div>
        <div>Total Uncertainty: {result.totalUncertainty.toFixed(3)} ns</div>
      </div>
      {result.isSetupViolation && (
        <div className="warning-msg">
          Setup Violation: Data arrives at {result.dataArrivalMax.toFixed(3)} ns
          but must be stable before {result.setupRequired.toFixed(3)} ns
        </div>
      )}
      {result.isHoldViolation && (
        <div className="warning-msg">
          Hold Violation: Data may change at {result.dataArrivalMin.toFixed(3)} ns
          but must remain stable until {result.holdRequired.toFixed(3)} ns
        </div>
      )}
    </div>
  );
}

export function ResultPanel({ inputResult, outputResult, activePath }: Props) {
  return (
    <div className="result-panel">
      <h2>Analysis Results</h2>
      <PathResult
        title="Input Path (Source → FPGA)"
        result={inputResult}
        active={activePath === 'input'}
      />
      <PathResult
        title="Output Path (FPGA → Dest)"
        result={outputResult}
        active={activePath === 'output'}
      />
    </div>
  );
}
