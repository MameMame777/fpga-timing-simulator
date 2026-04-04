import { useRef, useEffect, useCallback, useState } from 'react';
import { WaveformRenderer } from '../canvas/WaveformRenderer.ts';
import type { ClockParams, AnalysisResult, ClockTopology, SourceSyncParams } from '../types/timing.ts';

interface Props {
  clock: ClockParams;
  result: AnalysisResult;
  isInputPath: boolean;
  topology: ClockTopology;
  sourceSyncParams?: SourceSyncParams;
}

export function WaveformView({ clock, result, isInputPath, topology, sourceSyncParams }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WaveformRenderer | null>(null);
  const latestParamsRef = useRef({ clock, result, isInputPath, topology, sourceSyncParams });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);

  useEffect(() => {
    latestParamsRef.current = { clock, result, isInputPath, topology, sourceSyncParams };
  }, [clock, result, isInputPath, topology, sourceSyncParams]);

  // Init renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new WaveformRenderer(canvas, latestParamsRef.current);
    rendererRef.current = renderer;

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        rendererRef.current?.resizeCanvas();
        rendererRef.current?.setParams(latestParamsRef.current);
      }, 200);
    };
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(resizeTimer);
      renderer.destroy();
      rendererRef.current = null;
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Update params
  useEffect(() => {
    rendererRef.current?.setParams({ clock, result, isInputPath, topology, sourceSyncParams });
  }, [clock, result, isInputPath, topology, sourceSyncParams]);

  // Update speed
  useEffect(() => {
    rendererRef.current?.setSpeed(speed);
  }, [speed]);

  const handlePlay = useCallback(() => {
    rendererRef.current?.play();
    setPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    rendererRef.current?.pause();
    setPlaying(false);
  }, []);

  const handleReset = useCallback(() => {
    rendererRef.current?.reset();
    setPlaying(false);
  }, []);

  const handleStep = useCallback(() => {
    rendererRef.current?.step();
    setPlaying(false);
  }, []);

  return (
    <div className="waveform-view">
      <div className="waveform-controls">
        {!playing ? (
          <button onClick={handlePlay} title="Play">&#9654; Play</button>
        ) : (
          <button onClick={handlePause} title="Pause">&#9646;&#9646; Pause</button>
        )}
        <button onClick={handleStep} title="Step to next phase">&#9654;&#124; Step</button>
        <button onClick={handleReset} title="Reset">&#8634; Reset</button>
        <label className="speed-control">
          Speed:
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <span>{speed.toFixed(1)}x</span>
        </label>
      </div>
      <canvas ref={canvasRef} className="waveform-canvas" />
    </div>
  );
}
