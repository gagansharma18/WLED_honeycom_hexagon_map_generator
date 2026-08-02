# HexaMap WLED — Honeycomb LED Display Mapper & Simulator

An interactive, browser-based visual mapper designed to create, wire, simulate, and export pixel-perfect honeycomb LED layouts for **WLED 2D Matrix (`ledmap.json`)**, **WLED Segments**, **FastLED / C++**, and **xLights**.

---

## ✨ Features

- **Interactive Honeycomb Canvas**:
  - Pointy-Topped & Flat-Topped hex orientations.
  - Snap-to-grid honeycomb placement with single-click adding and deleting.
  - Pan & Zoom infinite canvas.
  - Preset layout templates: 7-Hex Flower, 19-Hex Supercluster, 18-Hex Concentric Rings, Pyramid 10, Diamond 9, and Serpentine Snake.

- **Dual Display Modes**:
  - **Modular / Perimeter Mode (Nanoleaf / 3D modules)**: Custom LEDs per edge (e.g., 3 LEDs/edge $\to$ 18 LEDs/hex), start corner selection (0–5), and winding direction (Clockwise vs Counter-Clockwise).
  - **Dense Hex Matrix Mode**: 1 LED per hexagon center for high-density honeycomb pixel matrices.

- **Smart Auto-Wiring Engine**:
  - Serpentine (Row-by-Row alternating directions).
  - Outward Spiral.
  - Radial Distance from center.
  - Manual click-to-chain routing tool.

- **Real-Time WLED 2D FX Simulator**:
  - 🌈 **Rainbow Edge Runner**
  - 🌌 **2D Plasma & Simplex Noise**
  - 🌊 **Expanding Radial Ripple**
  - 🎵 **Audio Reactive Pulse (GEQ simulation)**
  - 🔥 **Fire 2D Matrix**
  - 💡 **Single LED Tracer** (Diagnostic test for physical solder & wiring order)
  - Customizable color palettes, speed, and brightness.

- **One-Click Multi-Format Exporters**:
  - **WLED `ledmap.json`**: Ready to upload directly to `http://[wled-ip]/edit`.
  - **WLED Segments**: JSON segment boundaries for custom presets.
  - **FastLED / C++ Header (`HexMatrix.h`)**: Ready for Arduino / ESP-IDF with `XY(x, y)` lookup function.
  - **xLights Custom Model (`.xmodel`)**: XML format for stage & holiday light shows.
  - **Wiring Blueprint & Assembly Guide**: Printable high-resolution schematic with solder points (`DI`, `DO`, `5V`, `GND`) and power injection node indicators.

---

## 🚀 How to Run

1. Simply open `index.html` in any modern web browser, or run a local HTTP server:
   ```bash
   python3 -m http.server 8181
   ```
2. Open `http://localhost:8181/` in your browser.

---

## 🛠️ Uploading to WLED

1. In **HexaMap WLED**, build your hexagon layout and click **Export WLED Map**.
2. Click **Download ledmap.json**.
3. Open your browser to `http://<your-wled-ip>/edit`.
4. Upload `ledmap.json` to the root filesystem.
5. In WLED, navigate to **Config** $\rightarrow$ **2D Configuration**, set the matrix width & height indicated in HexaMap, and save.
6. Enjoy seamless 2D effects across your honeycomb display!
