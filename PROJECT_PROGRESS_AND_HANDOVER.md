# ⬡ HexaMap WLED — Comprehensive Project Status & AI Handover Document

> **Quick AI Resume Directive**:  
> This file is a complete, self-contained snapshot of the **HexaMap WLED** project. If you are an AI assistant (Claude, ChatGPT, Cursor, Gemini, Copilot, Antigravity), read this entire document to instantly understand the exact project status, mathematical models, file architecture, and how to continue development without missing any context.

---

## 📌 1. Project Overview & Context

- **Repository**: [`git@github.com:gagansharma18/WLED_honeycom_hexagon_map_generator.git`](https://github.com/gagansharma18/WLED_honeycom_hexagon_map_generator.git)
- **Local Directory**: `/Users/gagansharma/Documents/GitHub/WLED_honeycom_hexagon_map_generator`
- **Technology Stack**:
  - **Core Logic**: Modern Vanilla JavaScript (ES6+ Modules / Pure Math Engine)
  - **Rendering**: HTML5 High-DPI Canvas (Dual-pass rendering: background grid, glow paths, LED indices, wiring vectors)
  - **Styling**: Vanilla Modern CSS3 (Dark Mode / Glassmorphism / Cyberpunk Cyan & Violet Theme / Zero Tailwind or external CSS frameworks)
  - **Dependencies**: **Zero** external runtime dependencies. Runs directly in any browser and tests headlessly with `node test_engine.js`.
- **Target Systems**:
  - **WLED** (`ledmap.json` 2D matrix mapping, `v2` segments JSON for JSON API)
  - **FastLED / ESP32 / Arduino** (C++ header 2D lookup tables `PROGMEM`)
  - **xLights / Falcon Player** (Custom Model XML import)

---

## 🎯 2. Display Modes & Core Geometry

The application supports **Two Distinct Display Architectures**:

### Mode A: `Dense Mode` — "1 LED = 1 Hexagon Pixel" (**DEFAULT**)
- **Concept**: Each individual hexagonal cell in the honeycomb matrix represents **1 discrete addressable RGB LED pixel** (e.g., acrylic honeycomb grid, hexagonal diffusers with 1 WS2812B/SK6812 LED in each cell).
- **Phase & Perimeter Auto-Generator**:
  - User specifies $N$ LEDs / Hexagons per Phase (Side length $S = N$).
  - Hexagon ring radius $R = N - 1$.
  - **Corner Sharing**:
    - **1 Common Corner LED per Vertex (Shared)**: Adjacent phases share 1 common corner hexagon.
      $$\text{Total Hexagons (LEDs)} = 6 \times (N - 1)$$
      *Example: $N = 8 \implies 6 \times (8 - 1) = \mathbf{42\text{ LEDs}}$.*
      *Example: $N = 5 \implies 6 \times (5 - 1) = \mathbf{24\text{ LEDs}}$.*
    - **Discrete Edge Strips (No Sharing)**:
      $$\text{Total Hexagons (LEDs)} = 6 \times N$$
      *Example: $N = 8 \implies 6 \times 8 = \mathbf{48\text{ LEDs}}$.*
  - **Solid Honeycomb Matrix**:
    - A fully filled hexagon of side length $N$ (radius $R = N - 1$):
      $$\text{Total Hexagons (LEDs)} = 3R^2 + 3R + 1$$
      *Example: $N = 8 \implies R = 7 \implies 3(49) + 21 + 1 = \mathbf{169\text{ LEDs}}$.*
      *Example: $N = 5 \implies R = 4 \implies 3(16) + 12 + 1 = \mathbf{61\text{ LEDs}}$.*
      *Example: $N = 3 \implies R = 2 \implies \mathbf{19\text{ LEDs}}$ ($19\text{-Hex Flower}$).*
      *Example: $N = 2 \implies R = 1 \implies \mathbf{7\text{ LEDs}}$ ($7\text{-Hex Flower}$).*

### Mode B: `Modular Mode` — "Perimeter Panels" (Nanoleaf / 3D Strip Modules)
- **Concept**: Each hexagon is a 3D module where LED strips are mounted along the perimeter edges (e.g., 8 LEDs on each of the 6 faces).
- **LED Calculation**:
  - With 1 common corner LED per vertex:
    $$\text{LEDs per Hexagon} = 6 \times (N - 1)$$
    *Example: $N = 8 \implies \mathbf{42\text{ LEDs per Hexagon}}$.*
  - For $M$ modular hexagons: $\text{Total LEDs} = M \times 42$.
  - Generates individual WLED segments for each hexagon module.

---

## 🧮 3. Hexagonal Mathematics & Coordinate Systems

All grid positions are computed using **Axial Coordinates $(q, r)$** and converted to/from **Cube Coordinates $(x, y, z)$** where $x + y + z = 0$.

### Axial $\iff$ Pixel Projections
1. **Pointy-Topped Orientation** ($\text{angles} = 30^\circ, 90^\circ, \dots$):
   $$x = \text{radius} \times \sqrt{3} \times \left(q + \frac{r}{2}\right)$$
   $$y = \text{radius} \times \frac{3}{2} \times r$$
2. **Flat-Topped Orientation** ($\text{angles} = 0^\circ, 60^\circ, \dots$):
   $$x = \text{radius} \times \frac{3}{2} \times q$$
   $$y = \text{radius} \times \sqrt{3} \times \left(r + \frac{q}{2}\right)$$

### 2D Bounding Matrix & WLED `ledmap.json` Quantization
To project non-rectangular honeycomb arrays onto WLED's 2D serpentine/matrix grid without distortion:
1. Every physical LED position $(x, y)$ in world space is mapped into normalized unit coordinates $(u, v) \in [0, 1]$.
2. The normalized coordinates are discretized into a bounding grid of size $W \times H$.
3. Any empty matrix coordinate is filled with `-1` (WLED gap sentinel).
4. Physical LED indices are assigned to the closest matrix cell.

---

## 📂 4. File Structure & Component Details

```
WLED_honeycom_hexagon_map_generator/
├── index.html                 # UI Layout, Sidebar controls, Modals, Canvas viewport
├── style.css                  # Cyberpunk dark theme, responsive grid, glassmorphism
├── app.js                     # Core Math, HexGenerator, Solvers, Exporters, FX Engine
├── test_engine.js             # Node.js automated test runner & test assertions
└── PROJECT_PROGRESS_AND_HANDOVER.md  # (This file) Complete AI Context & Resume Guide
```

### Breakdown of `app.js` Sections:
1. **`HexMath`**: Direction vectors (`POINTY_DIRECTIONS`, `FLAT_DIRECTIONS`), `axialToPixel`, `pixelToAxial`, `cubeRound`, `getHexCorners`, `hexDistance`.
2. **`AppState`**: Single reactive source of truth:
   ```javascript
   AppState = {
     orientation: 'pointy', // 'pointy' | 'flat'
     hexRadius: 36,
     displayMode: 'dense', // 'dense' (1 LED = 1 Hex) | 'modular' (Perimeter)
     ledsPerPhase: 8, // LEDs per face / side (Default 8)
     cornerMode: 'shared', // 'shared' (1 common corner LED) | 'discrete'
     defaultStartCorner: 0,
     defaultDirection: 'cw',
     currentTool: 'add', // 'add' | 'select' | 'wire' | 'delete'
     hexagons: [...], // Array of { id, q, r }
     wiringChain: [...], // Array of hex IDs in order of data wire
     cachedLeds: [...], // Computed list of all physical LEDs
     cachedMatrix: { width, height, map: [...] },
     simulator: { isRunning: false, effect: 'plasma_2d', palette: 'cyberpunk', speed: 1.0, brightness: 1.0 }
   }
   ```
3. **`HexGenerator`**:
   - `generateRing(phaseLeds, cornerMode)`: Generates ring perimeter.
   - `generateSolid(phaseLeds)`: Generates full filled honeycomb matrix.
   - `generateNested(phaseLeds, cornerMode)`: Generates nested concentric rings.
   - `wireCoordinates(coords, wiringPattern)`: Auto-wires in `perimeter`, `serpentine` (row-by-row S-curve), or `spiral` (inward concentric).
4. **`Templates`**: Preset configurations (`phaseRing8`, `phaseRing5`, `solidHex8`, `solidHex5`, `flower7`, `flower19`, `ring18`, `pyramid10`, `diamond9`, `snake7`).
5. **`WiringSolvers`**: Auto-solvers (`serpentine`, `spiralInward`, `nearestNeighborTSP`, `reverseWiring`).
6. **`Exporters`**:
   - `wledLedmap()`: WLED 2D JSON matrix format with width, height, map array.
   - `wledSegments()`: WLED Segment presets JSON.
   - `fastLedCpp()`: C++ `XY(x, y)` function and PROGMEM lookup tables.
   - `xLightsXml()`: xLights custom model XML definition.
7. **`SimulatorFX`**: 6 real-time 2D matrix effects:
   - `plasma_2d`, `rainbow_wave`, `fire_flicker`, `pulse_ripple`, `cyber_grid`, `sparkle_star`.
8. **UI & Blueprint Renderers**:
   - High-DPI interactive canvas rendering with zoom, pan, live glowing traces.
   - Printable / downloadable PNG wiring blueprint with labeled pinouts, solder pads, injection points, and power requirements.

---

## 🧪 5. Testing & Validation Status

All test suites run headlessly with Node.js:
```bash
node test_engine.js
```
**Test Results:**
- `HexGenerator.generateRing(8, 'shared')` $\implies$ **42 hexagons** (Verified).
- `HexGenerator.generateRing(5, 'shared')` $\implies$ **24 hexagons** (Verified).
- `HexGenerator.generateSolid(8)` $\implies$ **169 hexagons** (Verified).
- WLED `ledmap.json` contains all LED indices $0 \to 41$ (Verified).
- Serpentine & Spiral auto-wiring patterns verified (Verified).
- Browser UI rendering verified at `http://localhost:8181/` with live FX simulator.

---

## 🚀 6. How to Run Locally

1. **Start Local HTTP Server**:
   ```bash
   cd /Users/gagansharma/Documents/GitHub/WLED_honeycom_hexagon_map_generator
   python3 -m http.server 8181
   ```
2. **Open in Browser**:
   Navigate to [`http://localhost:8181/`](http://localhost:8181/)
3. **Run Unit Tests**:
   ```bash
   node test_engine.js
   ```

---

## 🔮 7. Future Extension Roadmap (Backlog for Future AI / Developers)

If a user asks for further features, here are the ready-to-implement extensions:
1. **Live WLED Device Sync via WiFi**:
   - Direct HTTP POST to WLED IP address (`http://<wled-ip>/edit` uploading `ledmap.json` directly to LittleFS).
2. **3D Printable Hexagon STL Exporter**:
   - Parametric 3D printable honeycomb grid generator (exporting `.stl` files based on phase LED count and diffuser thickness).
3. **SVG Vector Importer**:
   - Allow importing custom SVG outlines to automatically populate honeycomb pixel layouts.
4. **Multi-Output ESP32 Splitter**:
   - Split large arrays (> 300 LEDs) across multiple GPIO pins (e.g. GPIO 16, GPIO 17) with multi-strip WLED segment configs.

---

**Current Git Status**: Up to date on `origin/main` (`commit b9e5cb3` and subsequent commits).
