# FPGA Timing Constraint Simulator
![Version](https://img.shields.io/badge/version-0.1.0-blue) 
![License](https://img.shields.io/badge/license-MIT-green) 
![Vivado](https://img.shields.io/badge/Vivado-not%20tested-lightgrey)

Interactive browser-based tool for visualizing FPGA I/O timing and generating Xilinx XDC (SDC-compatible) constraints.

<img width="1882" height="774" alt="main-ui" src="https://github.com/user-attachments/assets/20f13450-6800-49fa-8657-6855fdda079d" />

Timing diagram view:

<img width="1122" height="507" alt="timing-diagram" src="https://github.com/user-attachments/assets/ea05bcb6-923e-42a1-b9e7-47f3a6dfa1ad" />

Live demo:

**[https://MameMame777.github.io/fpga-timing-simulator/](https://MameMame777.github.io/fpga-timing-simulator/)**

## What This Tool Models

- System-synchronous and source-synchronous interfaces
- SDR and DDR edge relationships
- Setup/hold required times and slack
- Launch/capture edge pairing across shared or independent clocks
- Jitter, uncertainty, skew, board delay, and routing delay contributions

## Features

- **Clock topologies**
	- System synchronous (common clock baseline)
	- Source synchronous (forwarded clock path)
- **Edge control**
	- Launch/Capture edges: rising/falling
	- SDR and opposite-edge DDR behavior
- **Independent capture clock**
	- Optional capture clock with separate period/duty/port
	- Correct capture-edge anchoring in both Canvas and SVG views
- **Delay modeling**
	- Input path: source Tco min/max, board min/max, routing min/max
	- Output path: FPGA Tco min/max, board min/max, routing min/max
- **Dual visualization**
	- Animated waveform (Canvas)
	- Static timing diagram (SVG)
	- Signal path block diagram
- **Constraint generation**
	- `create_clock`, `set_input_delay`, `set_output_delay`
	- `set_input_jitter`, `set_system_jitter`, `set_clock_uncertainty`
	- In-app equation breakdown modal
- **Validation and tests**
	- Range validation for min/max parameters
	- Unit tests for edge timing, topology behavior, and routing contribution

## Timing Equations (High Level)

The analyzer computes:

- Data arrival max/min
- Setup required / hold required
- Setup slack / hold slack

Examples (system synchronous):

- Input arrival max = `tco_src_max + board_delay_max + routing_delay_max`
- Input arrival min = `tco_src_min + board_delay_min + routing_delay_min`
- Output arrival max = `tco_fpga_max + board_delay_max + routing_delay_max`
- Output arrival min = `tco_fpga_min + board_delay_min + routing_delay_min`

Source-synchronous mode additionally folds forwarded-clock arrival into required-time terms and effective skew.

## Quick Start

```bash
npm install
npm run dev
```

Then open:

- http://localhost:5173/fpga-timing-simulator/

## Build and Preview

```bash
npm run build
npm run preview
```

## Test

```bash
npm test
npm run test:watch
```

## Tech Stack

- React 19
- TypeScript 5.9 (strict mode)
- Vite 8
- Vitest 4
- Canvas 2D + SVG rendering

## Project Structure

```text
src/
	types/timing.ts            Domain types
	engine/timing-analyzer.ts  Timing analysis core
	utils/xdc-generator.ts     XDC generation
	components/                UI panels and controls
	canvas/WaveformRenderer.ts Canvas waveform renderer
	svg/TimingDiagram.tsx      Static timing diagram
	svg/PathDiagram.tsx        Path block diagram
	App.tsx                    App state and composition
	App.css                    Layout and theme
```

Additional UI screenshots:

<img width="1138" height="250" alt="formula-help-1" src="https://github.com/user-attachments/assets/58c66681-49e2-4778-a12e-68056cd4cdf1" />

<img width="1116" height="245" alt="formula-help-2" src="https://github.com/user-attachments/assets/9b23372a-ae9a-431f-8737-6523bad2a3f2" />

Parameter panel:

<img width="318" height="802" alt="parameter-panel" src="https://github.com/user-attachments/assets/25dc82c9-2c16-4256-80f7-7b42f7d121de" />

## License

[MIT](LICENSE)
