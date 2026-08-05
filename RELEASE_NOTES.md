# ⬡ HexaMap WLED v2.0 — Release Notes

> **Version**: 2.0.0  
> **Date**: August 5, 2026  
> **Target Hardware**: ESP8266 & ESP32 running WLED (v0.14+ / v0.15+ / v16)  
> **Repository**: [HexaMap WLED Generator](https://github.com/gagansharma18/WLED_honeycomb_hexagon_map_generator)

---

## 🌟 Highlights & Major Innovations

HexaMap WLED v2.0 is a complete overhaul and feature-packed major release designed specifically for **Custom 2D Hexagonal LED Displays, Honeycomb Grids, and Modular Perimeter Panel Displays**.

---

## 🚀 1. 1-Click WLED Auto-Configuration Engine
- **Full WLED Integration**: Click a single button (`🚀 1-Click Auto-Configure WLED`) to configure hardware output pins, 2D matrix panel settings, geometric pixel mapping, and WLED segment defaults automatically over Wi-Fi.
- **WLED v0.14+ & v16 2D Matrix Schema Alignment**: Updates WLED's hardware configuration (`cfg.json` & `/json/cfg` API) with exact 2D matrix panel properties:
  ```json
  "matrix": {
    "mpc": 1,
    "panels": [
      { "b": false, "r": false, "v": false, "s": false, "x": 0, "y": 0, "h": 13, "w": 13 }
    ]
  }
  ```
- **Automatic Hardware LED Length Update**: Automatically sets `hw.led.total = 169` and `hw.led.ins[0].len = 169` in WLED hardware settings, resolving truncation issues where LEDs beyond pin index 36 were remaining unlit.
- **Dual API Upload Strategy (`uploadFileToWled`)**: Tries `POST /upload` (standard WLED 0.14+ upload API) with fallbacks to `POST /edit`, completely eliminating `404 Not Found` console errors on custom WLED firmware builds.
- **Live Memory Application**: Sends live JSON payloads to `/json/cfg` and `/json/state` so hardware count and 2D matrix dimensions take effect immediately in RAM without requiring a device reboot.

---

## 📱 2. Embedded Standalone Web App (`honeycomb.htm`)
- **Direct Controller Hosting**: Generates and uploads a self-contained web controller (`honeycomb.htm`) directly onto WLED's onboard LittleFS flash memory.
- **Offline / Mobile Access**: Users can open `http://<wled-ip>/honeycomb.htm` on any smartphone, tablet, or PC on the local network for direct control.
- **Ultra-Compact Compression**: Encodes 169 LED spatial coordinates into a 600-byte flat array `[x0, y0, ...]`, reducing total HTML payload size to **~8.3 KB** to prevent LittleFS upload buffer truncation.
- **Zero-CORS Relative Pathing**: Streams live JSON color frames over relative URL `/json/state`, avoiding cross-origin security restrictions.
- **Universal ES5 JS Syntax**: Built with clean ES5 JavaScript for 100% compatibility across all mobile browsers and embedded web views.

---

## 🎨 3. Centralized 13-Effect Animation Engine
Integrated a single-source-of-truth **`EffectsCatalog`** driving both the main desktop app and the embedded `honeycomb.htm` web controller with **100% feature parity** across 13 live effects:

1. 🌌 **2D Color Plasma & Noise**: Multi-frequency 2D sine wave interference field.
2. 💻 **Cyberpunk Matrix Rain**: Digital code drops with bright neon green lead heads.
3. 🌀 **Rotating Spiral Galaxy**: Dual-arm rotating galactic spiral patterns.
4. ⚡ **Electric Neon Wave**: Pulsing intersecting neon sine & cosine waves.
5. 🎆 **Fireworks Burst Explosion**: Expanding radial firework explosion rings with particle decay.
6. 💎 **Hexagon Kaleidoscope**: 6-fold radial kaleidoscope symmetry.
7. ✨ **Deep Space Starfield**: Twinkling background starfield with randomized per-LED velocities.
8. 🌈 **Rainbow Edge Runner**: Continuous spectrum color rotation around physical wiring order.
9. 🌊 **Expanding Radial Ripple**: Pulsing outward concentric circular ripples from grid center.
10. 🎵 **Audio Reactive Pulse (GEQ)**: Simulated graphic equalizer pulse patterns across concentric rings.
11. 🔥 **Fire 2D Matrix**: Upward flickering thermal flame simulation.
12. 💡 **Single LED Tracer (Wiring Test)**: Hardware sequential wiring verification tracer.
13. 🎨 **Solid Palette Test**: Static uniform palette color check.

---

## ⚡ 4. Wi-Fi Frame Sync & Performance Optimizations
- **Single Atomic POST Payload**: Streams all 169 LED hex colors in a single atomic payload (`i: [0, ...hexColors]`) at ~12 FPS over Wi-Fi, completely eliminating frame tearing and packet drops.
- **Default Display Layout**: Pre-configures page load defaults to the popular **Solid Hexagon Grid (Side 8 — 169 LEDs)** with **Serpentine Wiring** and **8 LEDs per Phase**.
- **UI Overflow Polish**: Re-styled and shortened action buttons to fit seamlessly inside sidebar panels without text overflow across all screen resolutions.

---

## 🧪 5. Verification & Headless Testing
- Headless testing verified via Node.js (`node test_engine.js`):
  - `generateSolid(8)` $\implies$ **169 LEDs** (Verified).
  - WLED `ledmap.json` index quantization (Verified).
  - Standalone `honeycomb.htm` syntax & size checks (Verified).

---

## 📥 Installation & Usage Guide

1. **Launch Local Application**:
   Open `index.html` directly in any modern web browser or start a local server:
   ```bash
   python3 -m http.server 8080
   ```
2. **Auto-Configure WLED Hardware**:
   - Enter your WLED IP address (e.g. `10.130.79.95`) in the WLED hardware box.
   - Click **`🚀 1-Click Auto-Configure WLED`**.
3. **Control Standalone Web App**:
   Open `http://10.130.79.95/honeycomb.htm` on your phone or laptop!
