# FPGA Timing Constraint Simulator
An interactive browser-based tool for visualizing and generating FPGA I/O timing constraints (Xilinx XDC / SDC).

<img width="1882" height="774" alt="image" src="https://github.com/user-attachments/assets/20f13450-6800-49fa-8657-6855fdda079d" />

- Timing Diagram
<img width="1150" height="773" alt="image" src="https://github.com/user-attachments/assets/c7208467-6341-49b5-9432-c2e1b28a458e" />


**[Live Demo](https://MameMame777.github.io/fpga-timing-simulator/)**

## Features

- **System & Source Synchronous** topologies with forwarded clock support
- **SDR / DDR** data rate modes with all four edge combinations (R→R, R→F, F→R, F→F)
- **Real-time setup/hold slack** calculation with pass/fail indicators
- **Animated waveform** (Canvas) — launch, propagation, and capture cycle visualization
- **Static timing diagram** (SVG) — clock edges, data windows, slack annotations
- **Signal path block diagram** — visual clock distribution and data flow
- **XDC constraint generation** — copy-ready `create_clock`, `set_input_delay`, `set_output_delay` commands
- **Clock jitter & uncertainty** — `set_input_jitter`, `set_system_jitter`, `set_clock_uncertainty`
- **Clock skew** modeling folded into both analysis and constraints
- Dark EDA-themed UI

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173/fpga-timing-simulator/ in your browser.

## Build

```bash
npm run build     # TypeScript check + Vite production build → dist/
npm run preview   # Preview the production build locally
```

## Test

```bash
npm test          # Run unit tests (Vitest)
npm run test:watch # Watch mode
```

## Tech Stack

- React 19 + TypeScript 5.9 (strict mode)
- Vite 8 (build tooling)
- Vitest (unit testing)
- Canvas 2D + SVG (visualization)
- Zero runtime dependencies beyond React

## Project Structure

```
src/
├── types/timing.ts          # Domain type definitions
├── engine/timing-analyzer.ts # Core timing analysis logic
├── utils/xdc-generator.ts    # XDC/SDC constraint generation
├── components/               # React UI components
│   ├── ParameterPanel.tsx    # Left panel — all parameter controls
│   ├── ResultPanel.tsx       # Right panel — slack results
│   ├── ConstraintOutput.tsx  # Right panel — XDC output + help modal
│   ├── WaveformView.tsx      # Canvas animation wrapper
│   └── ErrorBoundary.tsx     # Error boundary
├── canvas/WaveformRenderer.ts # Canvas 2D waveform engine
├── svg/
│   ├── TimingDiagram.tsx     # SVG static timing diagram
│   └── PathDiagram.tsx       # SVG signal path diagram
├── App.tsx                   # Root component + state management
└── App.css                   # Dark EDA theme styles
```

## License

[MIT](LICENSE)
