import { useState } from 'react';
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

type BreakdownItem = { label: string; value: number };

function BreakdownSection({ items }: { items: BreakdownItem[] }) {
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="breakdown-row">
          <span className="breakdown-label">{item.label}</span>
          <span className={`breakdown-value ${item.value < 0 ? 'negative' : ''}`}>
            {item.value >= 0 ? '+' : ''}{item.value.toFixed(3)} ns
          </span>
        </div>
      ))}
      <div className="breakdown-total">
        <span className="breakdown-label">= Total</span>
        <span className="breakdown-value">
          {items.reduce((s, it) => s + it.value, 0).toFixed(3)} ns
        </span>
      </div>
    </>
  );
}

function HoverRow({
  label,
  display,
  items,
  minItems,
  maxItems,
}: {
  label: string;
  display: string;
  items?: BreakdownItem[];
  minItems?: BreakdownItem[];
  maxItems?: BreakdownItem[];
}) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = items || (minItems && maxItems);
  return (
    <div
      className="timing-row"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span>{label} <span className="timing-value">{display}</span></span>
      {hasBreakdown && <span className="breakdown-hint">▸</span>}
      {open && hasBreakdown && (
        <div className="breakdown-tooltip">
          {items && <BreakdownSection items={items} />}
          {minItems && maxItems && (
            <>
              <div className="breakdown-section-header">min path</div>
              <BreakdownSection items={minItems} />
              <div className="breakdown-section-header" style={{ marginTop: 6 }}>max path</div>
              <BreakdownSection items={maxItems} />
            </>
          )}
        </div>
      )}
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
  const { breakdown } = result;
  return (
    <div className={`path-result ${active ? 'active' : ''} ${hasViolation ? 'has-violation' : ''}`}>
      <h4>{title}</h4>
      <SlackBadge label="Setup Slack" value={result.setupSlack} />
      <SlackBadge label="Hold Slack" value={result.holdSlack} />
      <div className="timing-detail">
        <HoverRow
          label="Data Arrival:"
          display={`${result.dataArrivalMin.toFixed(3)} ~ ${result.dataArrivalMax.toFixed(3)} ns`}
          minItems={breakdown.arrivalMinItems}
          maxItems={breakdown.arrivalMaxItems}
        />
        <HoverRow
          label="Setup Required: <"
          display={`${result.setupRequired.toFixed(3)} ns`}
          items={breakdown.setupItems}
        />
        <HoverRow
          label="Hold Required: >"
          display={`${result.holdRequired.toFixed(3)} ns`}
          items={breakdown.holdItems}
        />
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
