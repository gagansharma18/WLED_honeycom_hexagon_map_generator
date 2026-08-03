/**
 * HexaMap WLED — Honeycomb LED Display Mapper & Simulator
 * Core Engine, Geometry, Routing, 2D Projection, FX Simulator & Exporters
 */

// ==========================================================================
// 1. Math & Hexagonal Geometry Engine (Axial & Cube Coordinates)
// ==========================================================================
const HexMath = {
  // Axial directions for Pointy-topped hexagons
  POINTY_DIRECTIONS: [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
  ],

  // Axial directions for Flat-topped hexagons
  FLAT_DIRECTIONS: [
    { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
    { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }
  ],

  axialToPixel(q, r, radius, orientation = 'pointy') {
    let x, y;
    if (orientation === 'pointy') {
      x = radius * Math.sqrt(3) * (q + r / 2);
      y = radius * (3 / 2) * r;
    } else {
      x = radius * (3 / 2) * q;
      y = radius * Math.sqrt(3) * (r + q / 2);
    }
    return { x, y };
  },

  pixelToAxial(px, py, radius, orientation = 'pointy') {
    let q, r;
    if (orientation === 'pointy') {
      q = (Math.sqrt(3) / 3 * px - 1 / 3 * py) / radius;
      r = (2 / 3 * py) / radius;
    } else {
      q = (2 / 3 * px) / radius;
      r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / radius;
    }
    return this.cubeRound(this.axialToCube(q, r));
  },

  axialToCube(q, r) {
    const x = q;
    const z = r;
    const y = -x - z;
    return { x, y, z };
  },

  cubeToAxial(cube) {
    return { q: cube.x, r: cube.z };
  },

  cubeRound(cube) {
    let rx = Math.round(cube.x);
    let ry = Math.round(cube.y);
    let rz = Math.round(cube.z);

    const xDiff = Math.abs(rx - cube.x);
    const yDiff = Math.abs(ry - cube.y);
    const zDiff = Math.abs(rz - cube.z);

    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    } else {
      rz = -rx - ry;
    }
    return { q: rx, r: rz };
  },

  getHexCorners(centerX, centerY, radius, orientation = 'pointy') {
    const corners = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = orientation === 'pointy' ? 60 * i - 30 : 60 * i;
      const angleRad = (Math.PI / 180) * angleDeg;
      corners.push({
        x: centerX + radius * Math.cos(angleRad),
        y: centerY + radius * Math.sin(angleRad)
      });
    }
    return corners;
  },

  hexDistance(a, b) {
    const ac = this.axialToCube(a.q, a.r);
    const bc = this.axialToCube(b.q, b.r);
    return (Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y) + Math.abs(ac.z - bc.z)) / 2;
  }
};

// ==========================================================================
// 2. State & Data Model
// ==========================================================================
const AppState = {
  orientation: 'pointy', // 'pointy' | 'flat'
  displayMode: 'dense', // 'dense' (1 LED = 1 Hexagon pixel default) | 'modular' (phase / perimeter)
  hexRadius: 46,
  ledsPerPhase: 8, // LEDs per face / side (phase)
  cornerMode: 'shared', // 'shared' (1 common corner LED per vertex) | 'discrete'
  defaultStartCorner: 0,
  defaultDirection: 'cw', // 'cw' | 'ccw'
  
  // Array of hexagon items: { id, q, r, startCornerOverride, dirOverride }
  hexagons: [],
  // Ordered array of hexagon IDs defining the daisy-chain wiring route
  wiringChain: [],

  // Editor interaction state
  currentTool: 'add', // 'add' | 'select' | 'wire' | 'delete'
  selectedHexId: null,
  hoverAxial: null,
  snapEnabled: true,
  showLedLabels: true,
  showWiringLines: true,
  showCoords: false,

  // Camera Pan & Zoom
  camera: {
    x: 0,
    y: 0,
    zoom: 1.0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
  },

  // Simulator state
  simulator: {
    isRunning: true,
    effect: 'plasma_2d',
    palette: 'cyberpunk',
    speed: 1.0,
    brightness: 1.0,
    time: 0
  },

  // Computed layout caches
  cachedLeds: [], // Array of { globalIndex, hexId, hexSeq, x, y, u, v, r, g, b }
  cachedMatrix: null,
  quantizationMode: 'auto'
};

// ==========================================================================
// 3. Preset Layout Templates & Phase-Based Hexagon Generators (1 LED = 1 Hex)
// ==========================================================================
const HexGenerator = {
  // Generate a Hollow Hexagonal Ring of 1-LED hexagons
  // S = LEDs per phase (e.g. 8). Radius R = S - 1.
  // When cornerMode === 'shared', each of the 6 vertices is shared -> 6 * (S - 1) = 42 LEDs for S = 8.
  generateRing(phaseLeds = 8, cornerMode = 'shared') {
    const S = Math.max(2, parseInt(phaseLeds) || 8);
    const R = S - 1;
    const dirs = AppState.orientation === 'pointy' ? HexMath.POINTY_DIRECTIONS : HexMath.FLAT_DIRECTIONS;
    const list = [];

    // Start at corner vertex (dirs[4] * R)
    let cur = { q: dirs[4].q * R, r: dirs[4].r * R };

    for (let phase = 0; phase < 6; phase++) {
      const moveDir = dirs[phase];
      const count = cornerMode === 'shared' ? R : S;
      for (let step = 0; step < count; step++) {
        list.push({ q: cur.q, r: cur.r, phase: phase + 1, isCorner: step === 0 });
        cur = { q: cur.q + moveDir.q, r: cur.r + moveDir.r };
      }
    }
    return list;
  },

  // Generate a Solid Hexagonal Grid of side length S (radius R = S - 1)
  // Outer perimeter has S LEDs per phase with 1 common corner LED.
  generateSolid(phaseLeds = 8) {
    const S = Math.max(2, parseInt(phaseLeds) || 8);
    const R = S - 1;
    const list = [];
    for (let q = -R; q <= R; q++) {
      const r1 = Math.max(-R, -q - R);
      const r2 = Math.min(R, -q + R);
      for (let r = r1; r <= r2; r++) {
        list.push({ q, r });
      }
    }
    return list;
  },

  // Generate Concentric Hexagon Rings (e.g. Outer Ring + Inner Ring)
  generateNested(phaseLeds = 8, cornerMode = 'shared') {
    const S = Math.max(2, parseInt(phaseLeds) || 8);
    const list = [];
    const dirs = AppState.orientation === 'pointy' ? HexMath.POINTY_DIRECTIONS : HexMath.FLAT_DIRECTIONS;
    
    // Outer ring (Radius S - 1)
    const R1 = S - 1;
    let cur1 = { q: dirs[4].q * R1, r: dirs[4].r * R1 };
    for (let p = 0; p < 6; p++) {
      const moveDir = dirs[p];
      for (let s = 0; s < R1; s++) {
        list.push({ q: cur1.q, r: cur1.r });
        cur1 = { q: cur1.q + moveDir.q, r: cur1.r + moveDir.r };
      }
    }

    // Inner ring (Radius Math.max(1, S - 2)) if S >= 3
    if (S >= 3) {
      const R2 = S - 2;
      let cur2 = { q: dirs[4].q * R2, r: dirs[4].r * R2 };
      for (let p = 0; p < 6; p++) {
        const moveDir = dirs[p];
        for (let s = 0; s < R2; s++) {
          list.push({ q: cur2.q, r: cur2.r });
          cur2 = { q: cur2.q + moveDir.q, r: cur2.r + moveDir.r };
        }
      }
    }
    return list;
  },

  // Auto-Wire coordinate list based on pattern
  wireCoordinates(coords, wiringPattern = 'perimeter') {
    if (wiringPattern === 'serpentine') {
      // Sort by row (r), then alternate left-to-right (q asc) and right-to-left (q desc)
      const rowsMap = new Map();
      coords.forEach(c => {
        if (!rowsMap.has(c.r)) rowsMap.set(c.r, []);
        rowsMap.get(c.r).push(c);
      });
      const sortedRowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);
      const wired = [];
      sortedRowKeys.forEach((rowKey, rowIdx) => {
        const rowItems = rowsMap.get(rowKey);
        if (rowIdx % 2 === 0) {
          rowItems.sort((a, b) => a.q - b.q);
        } else {
          rowItems.sort((a, b) => b.q - a.q);
        }
        wired.push(...rowItems);
      });
      return wired;
    } else if (wiringPattern === 'spiral') {
      // Sort by distance from center descending
      const sorted = [...coords].sort((a, b) => {
        const dA = Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(-a.q - a.r));
        const dB = Math.max(Math.abs(b.q), Math.abs(b.r), Math.abs(-b.q - b.r));
        if (dA !== dB) return dB - dA;
        return Math.atan2(a.r, a.q) - Math.atan2(b.r, b.q);
      });
      return sorted;
    }
    // Default perimeter / natural sequence
    return [...coords];
  }
};

const Templates = {
  phaseRing8() {
    return HexGenerator.generateRing(8, 'shared');
  },
  phaseRing5() {
    return HexGenerator.generateRing(5, 'shared');
  },
  solidHex8() {
    return HexGenerator.generateSolid(8);
  },
  solidHex5() {
    return HexGenerator.generateSolid(5);
  },
  single() {
    return [{ q: 0, r: 0 }];
  },
  flower7() {
    return [
      { q: 0, r: 0 },
      { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
      { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
  },
  flower19() {
    return HexGenerator.generateSolid(3);
  },
  ring18() {
    return HexGenerator.generateNested(3);
  },
  pyramid10() {
    const list = [];
    for (let r = 0; r < 4; r++) {
      for (let q = 0; q <= r; q++) {
        list.push({ q: q - Math.floor(r / 2), r: r - 1 });
      }
    }
    return list;
  },
  diamond9() {
    const list = [];
    for (let q = -1; q <= 1; q++) {
      for (let r = -1; r <= 1; r++) {
        list.push({ q, r });
      }
    }
    return list;
  },
  snake7() {
    return [
      { q: -3, r: 0 }, { q: -2, r: 0 }, { q: -1, r: 0 },
      { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }
    ];
  }
};

// ==========================================================================
// 4. Core Mesh & LED Computation
// ==========================================================================
function getLedsPerHex() {
  if (AppState.displayMode === 'dense') return 1;
  const N = AppState.ledsPerPhase;
  if (AppState.cornerMode === 'shared') {
    // 6 phases with 1 common corner LED per vertex
    return 6 * Math.max(1, N - 1);
  }
  // Discrete edges without corner sharing
  return 6 * N;
}

function recomputeLeds() {
  AppState.cachedLeds = [];
  let globalLedIndex = 0;

  // Build map of hex by ID for quick lookup
  const hexMap = new Map();
  AppState.hexagons.forEach(h => hexMap.set(h.id, h));

  // Determine active chain sequence
  const activeChain = AppState.wiringChain
    .map(id => hexMap.get(id))
    .filter(Boolean);

  const isDense = AppState.displayMode === 'dense';
  const isShared = AppState.cornerMode === 'shared';
  const N = AppState.ledsPerPhase;
  const M = isShared ? Math.max(1, N - 1) : N;

  activeChain.forEach((hex, chainIdx) => {
    const center = HexMath.axialToPixel(hex.q, hex.r, AppState.hexRadius, AppState.orientation);
    const startCorner = hex.startCornerOverride !== undefined ? hex.startCornerOverride : AppState.defaultStartCorner;
    const dir = hex.dirOverride || AppState.defaultDirection;

    if (isDense) {
      // 1 LED at center
      AppState.cachedLeds.push({
        globalIndex: globalLedIndex++,
        hexId: hex.id,
        hexSeq: chainIdx + 1,
        x: center.x,
        y: center.y,
        r: 255, g: 255, b: 255
      });
    } else {
      // Phase / Perimeter Mode (6 phases with N LEDs each, with optional common corner LED)
      const corners = HexMath.getHexCorners(center.x, center.y, AppState.hexRadius, AppState.orientation);

      for (let phase = 0; phase < 6; phase++) {
        const edgeIdx = dir === 'cw' ? (startCorner + phase) % 6 : (startCorner - phase + 6) % 6;
        const nextEdgeIdx = dir === 'cw' ? (edgeIdx + 1) % 6 : (edgeIdx - 1 + 6) % 6;

        const p1 = corners[edgeIdx];
        const p2 = corners[nextEdgeIdx];

        for (let k = 0; k < M; k++) {
          const t = isShared ? (k / M) : ((k + 0.5) / M);
          const lx = p1.x + (p2.x - p1.x) * t;
          const ly = p1.y + (p2.y - p1.y) * t;
          const isCorner = isShared && (k === 0);

          AppState.cachedLeds.push({
            globalIndex: globalLedIndex++,
            hexId: hex.id,
            hexSeq: chainIdx + 1,
            phase: phase + 1,
            phaseStep: k + 1,
            isCorner: isCorner,
            cornerIdx: isCorner ? edgeIdx : null,
            x: lx,
            y: ly,
            r: 255, g: 255, b: 255
          });
        }
      }
    }
  });

  // Recompute 2D Bounding Matrix & Stats
  compute2DMatrix();
  updateUIStats();
}

function compute2DMatrix() {
  const leds = AppState.cachedLeds;
  if (leds.length === 0) {
    AppState.cachedMatrix = { width: 0, height: 0, map: [], bounds: null };
    return;
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  leds.forEach(l => {
    if (l.x < minX) minX = l.x;
    if (l.x > maxX) maxX = l.x;
    if (l.y < minY) minY = l.y;
    if (l.y > maxY) maxY = l.y;
  });

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // Determine matrix grid resolution
  let cols, rows;
  if (AppState.displayMode === 'dense') {
    // 1 LED = 1 Hexagon Pixel: Direct Hexagonal Offset Grid Mapping
    const hexes = AppState.hexagons;
    const isPointy = AppState.orientation === 'pointy';

    const offsetCoords = hexes.map(h => ({
      id: h.id,
      gx: isPointy ? (h.q + Math.floor(h.r / 2)) : h.q,
      gy: isPointy ? h.r : (h.r + Math.floor(h.q / 2))
    }));

    const minGX = Math.min(...offsetCoords.map(o => o.gx));
    const maxGX = Math.max(...offsetCoords.map(o => o.gx));
    const minGY = Math.min(...offsetCoords.map(o => o.gy));
    const maxGY = Math.max(...offsetCoords.map(o => o.gy));

    cols = Math.max(1, maxGX - minGX + 1);
    rows = Math.max(1, maxGY - minGY + 1);

    const grid = Array.from({ length: rows }, () => Array(cols).fill(-1));
    leds.forEach(led => {
      const coord = offsetCoords.find(o => o.id === led.hexId);
      if (coord) {
        const gx = coord.gx - minGX;
        const gy = coord.gy - minGY;
        grid[gy][gx] = led.globalIndex;
        led.gx = gx;
        led.gy = gy;
      }
    });

    const flatMap = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        flatMap.push(grid[y][x]);
      }
    }

    AppState.cachedMatrix = {
      width: cols,
      height: rows,
      grid: grid,
      map: flatMap,
      bounds: { minX, maxX, minY, maxY, spanX, spanY }
    };

    renderMiniMatrix();
    return;
  }

  // Modular / Phase Perimeter: scale based on LEDs per hex and span
  const ledsPerHex = getLedsPerHex();
  const ledSpacing = (AppState.hexRadius * 2 * Math.PI) / Math.max(1, ledsPerHex);
  cols = Math.max(2, Math.round(spanX / Math.max(1, ledSpacing)) + 2);
  rows = Math.max(2, Math.round(spanY / Math.max(1, ledSpacing)) + 2);

  // Ensure reasonable bounds
  cols = Math.min(128, Math.max(3, cols));
  rows = Math.min(128, Math.max(3, rows));

  // Initialize empty grid with -1 gaps
  const grid = Array.from({ length: rows }, () => Array(cols).fill(-1));
  const mappedCoords = [];

  // Project each LED to closest grid cell
  leds.forEach(led => {
    const normX = spanX > 0 ? (led.x - minX) / spanX : 0.5;
    const normY = spanY > 0 ? (led.y - minY) / spanY : 0.5;

    let gx = Math.round(normX * (cols - 1));
    let gy = Math.round(normY * (rows - 1));

    gx = Math.max(0, Math.min(cols - 1, gx));
    gy = Math.max(0, Math.min(rows - 1, gy));

    // Resolve collisions by finding nearest free cell
    if (grid[gy][gx] !== -1) {
      let found = false;
      for (let radius = 1; radius <= 3 && !found; radius++) {
        for (let dy = -radius; dy <= radius && !found; dy++) {
          for (let dx = -radius; dx <= radius && !found; dx++) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny][nx] === -1) {
              gx = nx;
              gy = ny;
              found = true;
            }
          }
        }
      }
    }

    grid[gy][gx] = led.globalIndex;
    led.gx = gx;
    led.gy = gy;
    mappedCoords.push({ gx, gy, id: led.globalIndex });
  });

  // Flatten into 1D row-major array for WLED ledmap.json
  const flatMap = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      flatMap.push(grid[y][x]);
    }
  }

  AppState.cachedMatrix = {
    width: cols,
    height: rows,
    grid: grid,
    map: flatMap,
    bounds: { minX, maxX, minY, maxY, spanX, spanY }
  };

  renderMiniMatrix();
}

// ==========================================================================
// 5. Auto-Wiring Route Solvers
// ==========================================================================
const WiringSolvers = {
  serpentine() {
    const hexes = [...AppState.hexagons];
    if (hexes.length === 0) return;

    // Sort primarily by row (r or Y coord), secondarily by X
    hexes.sort((a, b) => {
      const pa = HexMath.axialToPixel(a.q, a.r, AppState.hexRadius, AppState.orientation);
      const pb = HexMath.axialToPixel(b.q, b.r, AppState.hexRadius, AppState.orientation);
      if (Math.abs(pa.y - pb.y) > 10) return pa.y - pb.y;
      return pa.x - pb.x;
    });

    // Group into rows
    const rows = [];
    let currentRow = [hexes[0]];
    for (let i = 1; i < hexes.length; i++) {
      const pPrev = HexMath.axialToPixel(currentRow[0].q, currentRow[0].r, AppState.hexRadius, AppState.orientation);
      const pCur = HexMath.axialToPixel(hexes[i].q, hexes[i].r, AppState.hexRadius, AppState.orientation);
      if (Math.abs(pPrev.y - pCur.y) < 20) {
        currentRow.push(hexes[i]);
      } else {
        rows.push(currentRow);
        currentRow = [hexes[i]];
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    // Alternate row directions
    const chain = [];
    rows.forEach((row, idx) => {
      row.sort((a, b) => {
        const pa = HexMath.axialToPixel(a.q, a.r, AppState.hexRadius, AppState.orientation);
        const pb = HexMath.axialToPixel(b.q, b.r, AppState.hexRadius, AppState.orientation);
        return idx % 2 === 0 ? pa.x - pb.x : pb.x - pa.x;
      });
      row.forEach(h => chain.push(h.id));
    });

    AppState.wiringChain = chain;
    recomputeLeds();
  },

  spiral() {
    const hexes = [...AppState.hexagons];
    if (hexes.length === 0) return;

    // Sort by hex distance from center (0,0), then angle
    hexes.sort((a, b) => {
      const distA = HexMath.hexDistance(a, { q: 0, r: 0 });
      const distB = HexMath.hexDistance(b, { q: 0, r: 0 });
      if (distA !== distB) return distA - distB;
      const pa = HexMath.axialToPixel(a.q, a.r, AppState.hexRadius, AppState.orientation);
      const pb = HexMath.axialToPixel(b.q, b.r, AppState.hexRadius, AppState.orientation);
      return Math.atan2(pa.y, pa.x) - Math.atan2(pb.y, pb.x);
    });

    AppState.wiringChain = hexes.map(h => h.id);
    recomputeLeds();
  },

  radial() {
    const hexes = [...AppState.hexagons];
    if (hexes.length === 0) return;

    hexes.sort((a, b) => {
      const pa = HexMath.axialToPixel(a.q, a.r, AppState.hexRadius, AppState.orientation);
      const pb = HexMath.axialToPixel(b.q, b.r, AppState.hexRadius, AppState.orientation);
      const distA = Math.hypot(pa.x, pa.y);
      const distB = Math.hypot(pb.x, pb.y);
      return distA - distB;
    });

    AppState.wiringChain = hexes.map(h => h.id);
    recomputeLeds();
  }
};

// ==========================================================================
// 6. Palettes & Color Utilities
// ==========================================================================
const Palettes = {
  rainbow(t) {
    const hue = (t % 1) * 360;
    return hslToRgb(hue, 100, 50);
  },
  cyberpunk(t) {
    // Cyan -> Magenta -> Yellow -> Blue
    const cycle = (t * 4) % 4;
    if (cycle < 1) return lerpColor([0, 242, 254], [247, 37, 133], cycle);
    if (cycle < 2) return lerpColor([247, 37, 133], [255, 209, 102], cycle - 1);
    if (cycle < 3) return lerpColor([255, 209, 102], [79, 172, 254], cycle - 2);
    return lerpColor([79, 172, 254], [0, 242, 254], cycle - 3);
  },
  ocean(t) {
    const cycle = (t * 2) % 2;
    if (cycle < 1) return lerpColor([14, 165, 233], [45, 212, 191], cycle);
    return lerpColor([45, 212, 191], [14, 165, 233], cycle - 1);
  },
  fire(t) {
    const cycle = (t * 3) % 3;
    if (cycle < 1) return lerpColor([255, 0, 0], [255, 128, 0], cycle);
    if (cycle < 2) return lerpColor([255, 128, 0], [255, 255, 0], cycle - 1);
    return lerpColor([255, 255, 0], [255, 0, 0], cycle - 2);
  },
  forest(t) {
    const cycle = (t * 2) % 2;
    if (cycle < 1) return lerpColor([16, 185, 129], [52, 211, 153], cycle);
    return lerpColor([52, 211, 153], [16, 185, 129], cycle - 1);
  },
  sunset(t) {
    const cycle = (t * 2) % 2;
    if (cycle < 1) return lerpColor([157, 78, 221], [255, 158, 0], cycle);
    return lerpColor([255, 158, 0], [157, 78, 221], cycle - 1);
  }
};

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function recomputeLeds() {
  AppState.cachedLeds = [];
  AppState.hexMap = new Map();
  AppState.hexLedMap = new Map();
  AppState.wiringChainIndexMap = new Map();

  let globalLedIndex = 0;

  AppState.hexagons.forEach(h => AppState.hexMap.set(h.id, h));
  AppState.wiringChain.forEach((id, idx) => AppState.wiringChainIndexMap.set(id, idx));

  // Determine active chain sequence
  const activeChain = AppState.wiringChain
    .map(id => AppState.hexMap.get(id))
    .filter(Boolean);

  const isDense = AppState.displayMode === 'dense';
  const isShared = AppState.cornerMode === 'shared';
  const N = AppState.ledsPerPhase;
  const M = isShared ? Math.max(1, N - 1) : N;

  activeChain.forEach((hex, chainIdx) => {
    const center = HexMath.axialToPixel(hex.q, hex.r, AppState.hexRadius, AppState.orientation);
    const startCorner = hex.startCornerOverride !== undefined ? hex.startCornerOverride : AppState.defaultStartCorner;
    const dir = hex.dirOverride || AppState.defaultDirection;
    const ringDist = HexMath.hexDistance(hex, { q: 0, r: 0 });

    if (isDense) {
      // 1 LED at center
      const led = {
        globalIndex: globalLedIndex++,
        hexId: hex.id,
        hexSeq: chainIdx + 1,
        ring: ringDist,
        x: center.x,
        y: center.y,
        r: 255, g: 255, b: 255
      };
      AppState.cachedLeds.push(led);
      AppState.hexLedMap.set(hex.id, led);
    } else {
      // Phase / Perimeter Mode
      const corners = HexMath.getHexCorners(center.x, center.y, AppState.hexRadius, AppState.orientation);

      for (let phase = 0; phase < 6; phase++) {
        const edgeIdx = dir === 'cw' ? (startCorner + phase) % 6 : (startCorner - phase + 6) % 6;
        const nextEdgeIdx = dir === 'cw' ? (edgeIdx + 1) % 6 : (edgeIdx - 1 + 6) % 6;

        const p1 = corners[edgeIdx];
        const p2 = corners[nextEdgeIdx];

        for (let k = 0; k < M; k++) {
          const t = isShared ? (k / M) : ((k + 0.5) / M);
          const lx = p1.x + (p2.x - p1.x) * t;
          const ly = p1.y + (p2.y - p1.y) * t;
          const isCorner = isShared && (k === 0);

          const led = {
            globalIndex: globalLedIndex++,
            hexId: hex.id,
            hexSeq: chainIdx + 1,
            phase: phase + 1,
            phaseStep: k + 1,
            isCorner: isCorner,
            cornerIdx: isCorner ? edgeIdx : null,
            ring: ringDist,
            x: lx,
            y: ly,
            r: 255, g: 255, b: 255
          };
          AppState.cachedLeds.push(led);
          if (!AppState.hexLedMap.has(hex.id)) AppState.hexLedMap.set(hex.id, led);
        }
      }
    }
  });

  // Recompute 2D Bounding Matrix & Stats
  compute2DMatrix();
  updateUIStats();
}

function compute2DMatrix() {
  const leds = AppState.cachedLeds;
  if (leds.length === 0) {
    AppState.cachedMatrix = { width: 0, height: 0, map: [], bounds: null };
    return;
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  leds.forEach(l => {
    if (l.x < minX) minX = l.x;
    if (l.x > maxX) maxX = l.x;
    if (l.y < minY) minY = l.y;
    if (l.y > maxY) maxY = l.y;
  });

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // Determine matrix grid resolution
  let cols, rows;
  if (AppState.displayMode === 'dense') {
    // 1 LED = 1 Hexagon Pixel: Direct Hexagonal Offset Grid Mapping
    const hexes = AppState.hexagons;
    const isPointy = AppState.orientation === 'pointy';

    const offsetCoords = hexes.map(h => ({
      id: h.id,
      gx: isPointy ? (h.q + Math.floor(h.r / 2)) : h.q,
      gy: isPointy ? h.r : (h.r + Math.floor(h.q / 2))
    }));

    const minGX = Math.min(...offsetCoords.map(o => o.gx));
    const maxGX = Math.max(...offsetCoords.map(o => o.gx));
    const minGY = Math.min(...offsetCoords.map(o => o.gy));
    const maxGY = Math.max(...offsetCoords.map(o => o.gy));

    cols = Math.max(1, maxGX - minGX + 1);
    rows = Math.max(1, maxGY - minGY + 1);

    const grid = Array.from({ length: rows }, () => Array(cols).fill(-1));
    leds.forEach(led => {
      const coord = offsetCoords.find(o => o.id === led.hexId);
      if (coord) {
        const gx = coord.gx - minGX;
        const gy = coord.gy - minGY;
        grid[gy][gx] = led.globalIndex;
        led.gx = gx;
        led.gy = gy;
      }
    });

    const flatMap = grid.flat();
    AppState.cachedMatrix = { width: cols, height: rows, grid, map: flatMap, bounds: { minX, maxX, minY, maxY, spanX, spanY } };
  } else {
    // Continuous 2D Spatial Quantization
    const density = AppState.quantizationMode === 'high' ? 24 : 16;
    cols = Math.max(1, Math.round(spanX / density) + 1);
    rows = Math.max(1, Math.round(spanY / density) + 1);

    const grid = Array.from({ length: rows }, () => Array(cols).fill(-1));
    leds.forEach(led => {
      const gx = spanX > 0 ? Math.min(cols - 1, Math.floor(((led.x - minX) / spanX) * (cols - 1))) : 0;
      const gy = spanY > 0 ? Math.min(rows - 1, Math.floor(((led.y - minY) / spanY) * (rows - 1))) : 0;
      grid[gy][gx] = led.globalIndex;
      led.gx = gx;
      led.gy = gy;
    });

    const flatMap = grid.flat();
    AppState.cachedMatrix = { width: cols, height: rows, grid, map: flatMap, bounds: { minX, maxX, minY, maxY, spanX, spanY } };
  }

  renderMiniMatrix();
}

// ==========================================================================
// 7. Live FX Simulator Engine (Optimized O(1))
// ==========================================================================
function updateSimulator(dt) {
  if (!AppState.simulator.isRunning) return;

  const sim = AppState.simulator;
  sim.time += dt * sim.speed;
  const paletteFn = Palettes[sim.palette] || Palettes.cyberpunk;
  const totalLeds = AppState.cachedLeds.length;
  if (totalLeds === 0) return;

  const matrix = AppState.cachedMatrix;
  const bounds = matrix ? matrix.bounds : null;

  AppState.cachedLeds.forEach((led) => {
    let r = 0, g = 0, b = 0;

    switch (sim.effect) {
      case 'rainbow_runner': {
        const t = (led.globalIndex / totalLeds) + sim.time * 0.5;
        [r, g, b] = Palettes.rainbow(t);
        break;
      }
      case 'plasma_2d': {
        const nx = bounds && bounds.spanX > 0 ? (led.x - bounds.minX) / bounds.spanX : 0.5;
        const ny = bounds && bounds.spanY > 0 ? (led.y - bounds.minY) / bounds.spanY : 0.5;
        const v = Math.sin(nx * 5 + sim.time * 2) +
                  Math.sin(ny * 5 + sim.time * 1.5) +
                  Math.sin((nx + ny) * 4 + sim.time);
        const normV = (v + 3) / 6;
        [r, g, b] = paletteFn(normV);
        break;
      }
      case 'radial_ripple': {
        const dist = Math.hypot(led.x, led.y);
        const wave = Math.sin(dist * 0.05 - sim.time * 4);
        const norm = (wave + 1) / 2;
        [r, g, b] = paletteFn(norm);
        break;
      }
      case 'audio_reactive': {
        const ring = led.ring !== undefined ? led.ring : 0;
        const beat = Math.sin(sim.time * 6 + ring * 1.5);
        if (beat > 0.3) {
          [r, g, b] = paletteFn(ring * 0.2 + sim.time * 0.2);
        } else {
          [r, g, b] = [10, 20, 40];
        }
        break;
      }
      case 'fire_2d': {
        const ny = bounds && bounds.spanY > 0 ? 1 - (led.y - bounds.minY) / bounds.spanY : 0.5;
        const flicker = Math.sin(led.x * 0.2 + sim.time * 8) * 0.2 + 0.8;
        const heat = Math.max(0, Math.min(1, ny * flicker));
        [r, g, b] = Palettes.fire(heat);
        break;
      }
      case 'tracer_single': {
        const activeIdx = Math.floor(sim.time * 15) % totalLeds;
        const distFromTracer = (led.globalIndex - activeIdx + totalLeds) % totalLeds;
        if (distFromTracer === 0) {
          [r, g, b] = [255, 255, 255]; // Head
        } else if (distFromTracer < 6) {
          const fade = 1 - distFromTracer / 6;
          [r, g, b] = [Math.round(0 * fade), Math.round(242 * fade), Math.round(254 * fade)]; // Tail
        } else {
          [r, g, b] = [8, 12, 24]; // Dark background
        }
        break;
      }
      case 'solid_color': {
        [r, g, b] = paletteFn(0.5);
        break;
      }
    }

    // Apply global brightness scale
    led.r = Math.round(r * sim.brightness);
    led.g = Math.round(g * sim.brightness);
    led.b = Math.round(b * sim.brightness);
  });
}

// ==========================================================================
// 8. Main Canvas Rendering Viewport
// ==========================================================================
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
}

function screenToWorld(screenX, screenY) {
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  const wx = (screenX - (width / 2 + AppState.camera.x)) / AppState.camera.zoom;
  const wy = (screenY - (height / 2 + AppState.camera.y)) / AppState.camera.zoom;
  return { x: wx, y: wy };
}

function worldToScreen(worldX, worldY) {
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  const sx = width / 2 + AppState.camera.x + worldX * AppState.camera.zoom;
  const sy = height / 2 + AppState.camera.y + worldY * AppState.camera.zoom;
  return { x: sx, y: sy };
}

const nowFn = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
let lastRenderTime = nowFn();

function render(now = nowFn()) {
  const dt = Math.min(0.05, (now - lastRenderTime) / 1000);
  lastRenderTime = now;

  updateSimulator(dt);

  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Apply Camera Transform
  ctx.translate(width / 2 + AppState.camera.x, height / 2 + AppState.camera.y);
  ctx.scale(AppState.camera.zoom, AppState.camera.zoom);

  // 1. Draw subtle background hex guide grid
  drawGuideGrid(ctx);

  // 2. Draw Hexagon Module Bodies
  drawHexagons(ctx);

  // 3. Draw Inter-Panel Wiring Lines
  if (AppState.showWiringLines && AppState.wiringChain.length > 1) {
    drawWiringLines(ctx);
  }

  // 4. Draw Individual LEDs & Glows
  drawLeds(ctx);

  // 5. Draw Hover Snapping Ghost
  if (AppState.hoverAxial && (AppState.currentTool === 'add' || AppState.currentTool === 'wire')) {
    drawHoverGhost(ctx);
  }

  ctx.restore();

  requestAnimationFrame(render);
}

function drawGuideGrid(ctx) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;

  const R = AppState.hexRadius;
  const range = 6;

  ctx.beginPath();
  for (let q = -range; q <= range; q++) {
    for (let r = -range; r <= range; r++) {
      if (Math.abs(q + r) <= range) {
        const center = HexMath.axialToPixel(q, r, R, AppState.orientation);
        const corners = HexMath.getHexCorners(center.x, center.y, R, AppState.orientation);
        corners.forEach((c, idx) => {
          if (idx === 0) ctx.moveTo(c.x, c.y);
          else ctx.lineTo(c.x, c.y);
        });
      }
    }
  }
  ctx.stroke();
}

function drawHexagons(ctx) {
  const R = AppState.hexRadius;
  const isDense = AppState.displayMode === 'dense';
  const hexLedMap = AppState.hexLedMap;
  const wiringIndexMap = AppState.wiringChainIndexMap;

  AppState.hexagons.forEach(hex => {
    const center = HexMath.axialToPixel(hex.q, hex.r, R, AppState.orientation);
    const corners = HexMath.getHexCorners(center.x, center.y, R, AppState.orientation);
    const isSelected = hex.id === AppState.selectedHexId;
    const chainIdx = wiringIndexMap ? wiringIndexMap.get(hex.id) : -1;
    const led = isDense && hexLedMap ? hexLedMap.get(hex.id) : null;

    // Module Outer Polygon
    ctx.beginPath();
    corners.forEach((c, idx) => {
      if (idx === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();

    if (isDense && led) {
      // Fast Direct Pixel Tile Fill
      ctx.fillStyle = `rgb(${led.r}, ${led.g}, ${led.b})`;
    } else {
      ctx.fillStyle = isSelected ? 'rgba(0, 242, 254, 0.15)' : 'rgba(17, 24, 39, 0.7)';
    }
    ctx.fill();

    // Module Border
    ctx.strokeStyle = isSelected ? '#00f2fe' : (isDense && led ? `rgba(${led.r}, ${led.g}, ${led.b}, 0.8)` : 'rgba(255, 255, 255, 0.15)');
    ctx.lineWidth = isSelected ? 2.5 : 1.2;
    ctx.stroke();

    // Hexagon ID Badge & Text Labeling
    ctx.fillStyle = isDense ? '#ffffff' : '#e2e8f0';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const label = chainIdx !== undefined && chainIdx !== -1 ? `#${chainIdx + 1}` : `H${hex.id}`;
    ctx.fillText(label, center.x, center.y - (AppState.showCoords ? 6 : (isDense ? 8 : 0)));

    if (isDense && led) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '600 9px JetBrains Mono, monospace';
      ctx.fillText(`LED ${led.globalIndex}`, center.x, center.y + 8);
    } else if (AppState.showCoords) {
      ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
      ctx.font = '400 9px JetBrains Mono, monospace';
      ctx.fillText(`(${hex.q},${hex.r})`, center.x, center.y + 7);
    }

    // Start Vertex Marker Indicator (Perimeter mode only)
    if (!isDense) {
      const startCorner = hex.startCornerOverride !== undefined ? hex.startCornerOverride : AppState.defaultStartCorner;
      const startPt = corners[startCorner];
      ctx.beginPath();
      ctx.arc(startPt.x, startPt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

function drawWiringLines(ctx) {
  const hexMap = AppState.hexMap;
  if (!hexMap) return;

  ctx.strokeStyle = 'rgba(247, 37, 133, 0.7)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);

  ctx.beginPath();
  let first = true;
  AppState.wiringChain.forEach(id => {
    const hex = hexMap.get(id);
    if (!hex) return;
    const center = HexMath.axialToPixel(hex.q, hex.r, AppState.hexRadius, AppState.orientation);
    if (first) {
      ctx.moveTo(center.x, center.y);
      first = false;
    } else {
      ctx.lineTo(center.x, center.y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLeds(ctx) {
  const isDense = AppState.displayMode === 'dense';

  if (isDense) {
    // Single batched path for center diodes
    ctx.beginPath();
    AppState.cachedLeds.forEach(led => {
      ctx.moveTo(led.x + 3.5, led.y);
      ctx.arc(led.x, led.y, 3.5, 0, Math.PI * 2);
    });
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    return;
  }

  const ledRadius = 3.5;
  AppState.cachedLeds.forEach(led => {
    // Solid LED Core
    ctx.beginPath();
    ctx.arc(led.x, led.y, ledRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${led.r}, ${led.g}, ${led.b})`;
    ctx.fill();

    if (AppState.showLedLabels && AppState.camera.zoom >= 0.85) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 7px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(led.globalIndex, led.x, led.y - 7);
    }
  });
}

function drawHoverGhost(ctx) {
  const axial = AppState.hoverAxial;
  const existing = AppState.hexagons.find(h => h.q === axial.q && h.r === axial.r);
  if (existing && AppState.currentTool === 'add') return;

  const R = AppState.hexRadius;
  const center = HexMath.axialToPixel(axial.q, axial.r, R, AppState.orientation);
  const corners = HexMath.getHexCorners(center.x, center.y, R, AppState.orientation);

  ctx.save();
  ctx.beginPath();
  corners.forEach((c, idx) => {
    if (idx === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.closePath();

  ctx.strokeStyle = AppState.currentTool === 'add' ? 'rgba(0, 242, 254, 0.8)' : 'rgba(247, 37, 133, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.fillStyle = AppState.currentTool === 'add' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(247, 37, 133, 0.1)';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ==========================================================================
// 9. Mini 2D Matrix Preview Canvas
// ==========================================================================
const miniCanvas = document.getElementById('miniMatrixCanvas');
const miniCtx = miniCanvas.getContext('2d');

function renderMiniMatrix() {
  const matrix = AppState.cachedMatrix;
  if (!matrix || matrix.width === 0 || matrix.height === 0) return;

  const cw = miniCanvas.width;
  const ch = miniCanvas.height;
  miniCtx.clearRect(0, 0, cw, ch);

  const cellW = (cw - 20) / matrix.width;
  const cellH = (ch - 20) / matrix.height;
  const cellSize = Math.min(cellW, cellH);

  const offsetX = (cw - matrix.width * cellSize) / 2;
  const offsetY = (ch - matrix.height * cellSize) / 2;

  for (let y = 0; y < matrix.height; y++) {
    for (let x = 0; x < matrix.width; x++) {
      const ledIdx = matrix.grid[y][x];
      const px = offsetX + x * cellSize;
      const py = offsetY + y * cellSize;

      if (ledIdx === -1) {
        // Empty Gap Pixel
        miniCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        miniCtx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      } else {
        // Active Mapped LED
        miniCtx.fillStyle = '#00f2fe';
        miniCtx.shadowColor = '#00f2fe';
        miniCtx.shadowBlur = 4;
        miniCtx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
        miniCtx.shadowBlur = 0;
      }
    }
  }
}

// ==========================================================================
// 10. Exporter Generators (WLED ledmap.json, Segments, FastLED, xLights)
// ==========================================================================
const Exporters = {
  wledLedmap() {
    const matrix = AppState.cachedMatrix;
    if (!matrix) return '{}';

    const obj = {
      n: 'HexaMap WLED 2D Matrix',
      width: matrix.width,
      height: matrix.height,
      map: matrix.map
    };
    return JSON.stringify(obj, null, 2);
  },

  wledSegments() {
    const hexMap = new Map();
    AppState.hexagons.forEach(h => hexMap.set(h.id, h));
    const activeChain = AppState.wiringChain.map(id => hexMap.get(id)).filter(Boolean);

    const ledsPerHex = getLedsPerHex();
    const segs = activeChain.map((hex, idx) => ({
      id: idx,
      start: idx * ledsPerHex,
      stop: (idx + 1) * ledsPerHex,
      len: ledsPerHex,
      grp: 1,
      spc: 0,
      on: true,
      bri: 255,
      col: [[255, 160, 0], [0, 0, 0], [0, 0, 0]],
      fx: 0
    }));

    return JSON.stringify({ seg: segs }, null, 2);
  },

  fastLedCpp() {
    const matrix = AppState.cachedMatrix;
    const totalLeds = AppState.cachedLeds.length;
    if (!matrix) return '// No matrix generated';

    let code = `// ==========================================================================\n`;
    code += `// FastLED 2D Lookup Table for Honeycomb Hexagon Display\n`;
    code += `// Total LEDs: ${totalLeds} | Matrix Width: ${matrix.width} | Matrix Height: ${matrix.height}\n`;
    code += `// ==========================================================================\n\n`;
    code += `#include <FastLED.h>\n\n`;
    code += `#define MATRIX_WIDTH  ${matrix.width}\n`;
    code += `#define MATRIX_HEIGHT ${matrix.height}\n`;
    code += `#define NUM_LEDS      ${totalLeds}\n\n`;
    code += `CRGB leds[NUM_LEDS];\n\n`;
    code += `const int16_t PROGMEM HEX_LED_MAP[MATRIX_HEIGHT][MATRIX_WIDTH] = {\n`;

    for (let y = 0; y < matrix.height; y++) {
      code += `  { `;
      for (let x = 0; x < matrix.width; x++) {
        const val = matrix.grid[y][x];
        code += `${val.toString().padStart(4, ' ')}${x < matrix.width - 1 ? ',' : ''}`;
      }
      code += ` }${y < matrix.height - 1 ? ',' : ''}\n`;
    }
    code += `};\n\n`;
    code += `// Get LED index from (x, y) coordinates with boundary and gap check\n`;
    code += `int16_t XY(uint8_t x, uint8_t y) {\n`;
    code += `  if (x >= MATRIX_WIDTH || y >= MATRIX_HEIGHT) return -1;\n`;
    code += `  return pgm_read_word(&(HEX_LED_MAP[y][x]));\n`;
    code += `}\n`;

    return code;
  },

  xLightsXml() {
    const matrix = AppState.cachedMatrix;
    if (!matrix) return '<custommodel />';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<custommodel name="HexaMap_Display" parm1="${matrix.width}" parm2="${matrix.height}" Depth="1" StringType="RGB Nodes" Transparency="0" PixelSize="2" ModelBrightness="0">\n`;
    
    for (let y = 0; y < matrix.height; y++) {
      const row = matrix.grid[y].map(id => (id === -1 ? '' : (id + 1))).join(',');
      xml += `  <custommodelrow y="${y}">${row}</custommodelrow>\n`;
    }
    xml += `</custommodel>\n`;
    return xml;
  }
};

// ==========================================================================
// 11. High-Resolution Blueprint Renderer
// ==========================================================================
function renderBlueprintCanvas() {
  const bpCanvas = document.getElementById('blueprintCanvas');
  const bpCtx = bpCanvas.getContext('2d');
  const w = bpCanvas.width;
  const h = bpCanvas.height;

  bpCtx.fillStyle = '#0a1128';
  bpCtx.fillRect(0, 0, w, h);

  // Blueprint Grid
  bpCtx.strokeStyle = 'rgba(30, 58, 138, 0.4)';
  bpCtx.lineWidth = 1;
  const step = 20;
  for (let x = 0; x < w; x += step) {
    bpCtx.beginPath();
    bpCtx.moveTo(x, 0);
    bpCtx.lineTo(x, h);
    bpCtx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    bpCtx.beginPath();
    bpCtx.moveTo(0, y);
    bpCtx.lineTo(w, y);
    bpCtx.stroke();
  }

  // Draw Hex Panels & Wiring Arrows
  const hexMap = new Map();
  AppState.hexagons.forEach(hex => hexMap.set(hex.id, hex));

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  AppState.hexagons.forEach(hex => {
    const p = HexMath.axialToPixel(hex.q, hex.r, AppState.hexRadius, AppState.orientation);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const spanX = Math.max(100, maxX - minX);
  const spanY = Math.max(100, maxY - minY);
  const scale = Math.min((w - 120) / spanX, (h - 120) / spanY, 1.2);

  bpCtx.save();
  bpCtx.translate(w / 2 - ((minX + maxX) / 2) * scale, h / 2 - ((minY + maxY) / 2) * scale);
  bpCtx.scale(scale, scale);

  // Draw Hexagons
  AppState.hexagons.forEach(hex => {
    const center = HexMath.axialToPixel(hex.q, hex.r, AppState.hexRadius, AppState.orientation);
    const corners = HexMath.getHexCorners(center.x, center.y, AppState.hexRadius, AppState.orientation);
    const chainIdx = AppState.wiringChain.indexOf(hex.id);

    bpCtx.beginPath();
    corners.forEach((c, idx) => {
      if (idx === 0) bpCtx.moveTo(c.x, c.y);
      else bpCtx.lineTo(c.x, c.y);
    });
    bpCtx.closePath();
    bpCtx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    bpCtx.fill();
    bpCtx.strokeStyle = '#38bdf8';
    bpCtx.lineWidth = 2;
    bpCtx.stroke();

    // Module ID & Info
    bpCtx.fillStyle = '#f8fafc';
    bpCtx.font = '700 13px Inter, sans-serif';
    bpCtx.textAlign = 'center';
    bpCtx.textBaseline = 'middle';
    bpCtx.fillText(`HEX #${chainIdx + 1}`, center.x, center.y - 8);

    const ledsPerHex = getLedsPerHex();
    const startLed = chainIdx * ledsPerHex;
    const endLed = (chainIdx + 1) * ledsPerHex - 1;
    bpCtx.font = '500 10px JetBrains Mono, monospace';
    bpCtx.fillStyle = '#94a3b8';
    bpCtx.fillText(`LED ${startLed}–${endLed}`, center.x, center.y + 10);

    // Solder Point DI Marker
    const startCorner = hex.startCornerOverride !== undefined ? hex.startCornerOverride : AppState.defaultStartCorner;
    const sCorner = corners[startCorner];
    bpCtx.beginPath();
    bpCtx.arc(sCorner.x, sCorner.y, 6, 0, Math.PI * 2);
    bpCtx.fillStyle = '#10b981';
    bpCtx.fill();
    bpCtx.strokeStyle = '#ffffff';
    bpCtx.lineWidth = 1.5;
    bpCtx.stroke();
    bpCtx.fillStyle = '#ffffff';
    bpCtx.font = '700 7px Inter';
    bpCtx.fillText('DI', sCorner.x, sCorner.y);
  });

  // Draw Wiring Connection Arrows
  if (AppState.wiringChain.length > 1) {
    bpCtx.strokeStyle = '#f43f5e';
    bpCtx.lineWidth = 3;
    for (let i = 0; i < AppState.wiringChain.length - 1; i++) {
      const h1 = hexMap.get(AppState.wiringChain[i]);
      const h2 = hexMap.get(AppState.wiringChain[i + 1]);
      if (!h1 || !h2) continue;

      const p1 = HexMath.axialToPixel(h1.q, h1.r, AppState.hexRadius, AppState.orientation);
      const p2 = HexMath.axialToPixel(h2.q, h2.r, AppState.hexRadius, AppState.orientation);

      bpCtx.beginPath();
      bpCtx.moveTo(p1.x, p1.y);
      bpCtx.lineTo(p2.x, p2.y);
      bpCtx.stroke();

      // Arrow head
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      bpCtx.save();
      bpCtx.translate(midX, midY);
      bpCtx.rotate(angle);
      bpCtx.beginPath();
      bpCtx.moveTo(0, 0);
      bpCtx.lineTo(-10, -6);
      bpCtx.lineTo(-10, 6);
      bpCtx.closePath();
      bpCtx.fillStyle = '#f43f5e';
      bpCtx.fill();
      bpCtx.restore();
    }
  }

  bpCtx.restore();
}

// ==========================================================================
// 12. UI Telemetry & Event Handlers
// ==========================================================================
function updateUIStats() {
  const totalLeds = AppState.cachedLeds.length;
  const numHexes = AppState.hexagons.length;
  const matrix = AppState.cachedMatrix;

  // Header and Viewport badge
  document.getElementById('canvasStatsSummary').textContent = `${numHexes} Hexagons · ${totalLeds} LEDs`;
  document.getElementById('statTotalLeds').textContent = totalLeds;

  if (matrix) {
    const dimText = `${matrix.width} × ${matrix.height}`;
    document.getElementById('matrixDimensionsBadge').textContent = dimText;
    document.getElementById('statBoundingSize').textContent = dimText;

    const totalCells = matrix.width * matrix.height;
    const gaps = matrix.map.filter(x => x === -1).length;
    const efficiency = totalCells > 0 ? (((totalCells - gaps) / totalCells) * 100).toFixed(1) : 0;

    document.getElementById('statGapCount').textContent = gaps;
    document.getElementById('statEfficiency').textContent = `${efficiency}%`;
  }

  // Power Estimations
  const maxCurrentAmps = (totalLeds * 0.06).toFixed(2);
  const maxPowerWatts = (maxCurrentAmps * 5).toFixed(1);
  const typCurrentAmps = (totalLeds * 0.02).toFixed(2);
  const typPowerWatts = (typCurrentAmps * 5).toFixed(1);

  document.getElementById('hwPowerMax').textContent = `${maxCurrentAmps} A / ${maxPowerWatts} W`;
  document.getElementById('hwPowerTypical').textContent = `${typCurrentAmps} A / ${typPowerWatts} W`;
  
  if (totalLeds <= 60) {
    document.getElementById('hwPowerPSU').textContent = '5V 2A–3A (USB/Adapter)';
    document.getElementById('hwInjections').textContent = '1 Point (At Start)';
  } else if (totalLeds <= 180) {
    document.getElementById('hwPowerPSU').textContent = '5V 5A–8A or 12V with Buck';
    document.getElementById('hwInjections').textContent = '1–2 Points (Start + End)';
  } else {
    const injections = Math.ceil(totalLeds / 120);
    document.getElementById('hwPowerPSU').textContent = `5V 10A+ (or 12V WS2815)`;
    document.getElementById('hwInjections').textContent = `${injections} Points (Every 100 LEDs)`;
  }

  // Update Inspector if an item is selected
  updatePhaseDisplay();
  updateInspectorUI();
}

function updatePhaseDisplay() {
  const N = AppState.ledsPerPhase;
  const isShared = AppState.cornerMode === 'shared';
  const total = isShared ? 6 * Math.max(1, N - 1) : 6 * N;
  const valBadge = document.getElementById('valLedsPerHex');
  const valBreakdown = document.getElementById('valPhaseBreakdown');
  if (valBadge) valBadge.textContent = `${total} LEDs`;
  if (valBreakdown) {
    if (isShared) {
      valBreakdown.textContent = `6 Phases × ${N} LEDs with 1 common corner LED = ${total} LEDs`;
    } else {
      valBreakdown.textContent = `6 Phases × ${N} LEDs (discrete edges) = ${total} LEDs`;
    }
  }
}

function updateDenseGeneratorStats() {
  const phaseInput = document.getElementById('densePhaseLeds');
  const typeSelect = document.getElementById('denseStructureType');
  const cornerSelect = document.getElementById('denseCornerMode');
  const badgeVal = document.getElementById('valDenseTotalLeds');
  const badgeFormula = document.getElementById('valDenseFormula');
  
  if (!phaseInput || !typeSelect || !cornerSelect || !badgeVal || !badgeFormula) return;

  const N = Math.max(2, Math.min(30, parseInt(phaseInput.value) || 8));
  const type = typeSelect.value;
  const isShared = cornerSelect.value === 'shared';

  let count = 0;
  let desc = '';

  if (type === 'solid') {
    const R = N - 1;
    count = 3 * R * R + 3 * R + 1;
    desc = `Solid Honeycomb Matrix (Side ${N}) = ${count} Hexagons (1 LED each)`;
  } else if (type === 'nested') {
    const R1 = N - 1;
    const R2 = Math.max(1, N - 2);
    count = (6 * R1) + (N >= 3 ? 6 * R2 : 0);
    desc = `Nested Rings (Outer ${N}/phase + Inner) = ${count} Hexagons (1 LED each)`;
  } else {
    count = isShared ? 6 * Math.max(1, N - 1) : 6 * N;
    if (isShared) {
      desc = `6 Phases × ${N} LEDs with 1 common corner LED = ${count} Hexagons (42 LEDs for N=8)`;
    } else {
      desc = `6 Phases × ${N} LEDs (discrete edges) = ${count} Hexagons (1 LED each)`;
    }
  }

  badgeVal.textContent = `${count} LEDs`;
  badgeFormula.textContent = desc;
}

function fitCameraToGrid() {
  if (AppState.hexagons.length === 0) return;
  AppState.camera.x = 0;
  AppState.camera.y = 0;
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  AppState.hexagons.forEach(h => {
    const p = HexMath.axialToPixel(h.q, h.r, AppState.hexRadius, AppState.orientation);
    minX = Math.min(minX, p.x - AppState.hexRadius);
    maxX = Math.max(maxX, p.x + AppState.hexRadius);
    minY = Math.min(minY, p.y - AppState.hexRadius);
    maxY = Math.max(maxY, p.y + AppState.hexRadius);
  });
  
  const spanX = Math.max(100, maxX - minX);
  const spanY = Math.max(100, maxY - minY);
  const availW = Math.max(300, (canvas.width / (window.devicePixelRatio || 1)) - 100);
  const availH = Math.max(300, (canvas.height / (window.devicePixelRatio || 1)) - 100);
  
  const fitZoom = Math.min(2.0, Math.max(0.18, Math.min(availW / spanX, availH / spanY)));
  AppState.camera.zoom = fitZoom;
}

function autoGenerateDenseHexagon() {
  const phaseInput = document.getElementById('densePhaseLeds');
  const typeSelect = document.getElementById('denseStructureType');
  const cornerSelect = document.getElementById('denseCornerMode');
  const wiringSelect = document.getElementById('denseWiringPattern');

  const phaseLeds = Math.max(2, Math.min(30, parseInt(phaseInput ? phaseInput.value : 8) || 8));
  const structureType = typeSelect ? typeSelect.value : 'solid';
  const cornerMode = cornerSelect ? cornerSelect.value : 'shared';
  const wiringPattern = wiringSelect ? wiringSelect.value : 'serpentine';

  let rawCoords = [];
  if (structureType === 'solid') {
    rawCoords = HexGenerator.generateSolid(phaseLeds);
  } else if (structureType === 'nested') {
    rawCoords = HexGenerator.generateNested(phaseLeds, cornerMode);
  } else {
    rawCoords = HexGenerator.generateRing(phaseLeds, cornerMode);
  }

  const wiredCoords = HexGenerator.wireCoordinates(rawCoords, wiringPattern);
  
  AppState.displayMode = 'dense';
  AppState.hexagons = wiredCoords.map((c, idx) => ({ id: idx + 1, q: c.q, r: c.r }));
  AppState.wiringChain = AppState.hexagons.map(h => h.id);
  AppState.selectedHexId = null;

  fitCameraToGrid();
  recomputeLeds();

  const total = AppState.hexagons.length;
  showToast(`⚡ Generated Hexagon Display with ${total} LEDs (${phaseLeds} LEDs/phase)! 🚀`);
}

function updateInspectorUI() {
  const hex = AppState.hexagons.find(h => h.id === AppState.selectedHexId);
  const emptyState = document.getElementById('inspectorEmptyState');
  const details = document.getElementById('inspectorDetails');

  if (!hex) {
    emptyState.style.display = 'block';
    details.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  details.style.display = 'block';

  const chainIdx = AppState.wiringChain.indexOf(hex.id);
  const ledsPerHex = getLedsPerHex();
  const startLed = chainIdx >= 0 ? chainIdx * ledsPerHex : 0;
  const endLed = chainIdx >= 0 ? (chainIdx + 1) * ledsPerHex - 1 : 0;

  document.getElementById('inspId').textContent = `#${hex.id}`;
  document.getElementById('inspAxial').textContent = `(${hex.q}, ${hex.r})`;
  document.getElementById('inspChain').textContent = chainIdx >= 0 ? `${chainIdx + 1} of ${AppState.wiringChain.length}` : 'Not wired';
  document.getElementById('inspLedRange').textContent = `${startLed} – ${endLed}`;

  document.getElementById('inspStartCorner').value = hex.startCornerOverride !== undefined ? hex.startCornerOverride : 'inherit';
  document.getElementById('inspDirection').value = hex.dirOverride || 'inherit';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ==========================================================================
// 13. Canvas Mouse & Touch Interaction
// ==========================================================================
function setupCanvasInteractions() {
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (AppState.camera.isDragging) {
      AppState.camera.x += (mx - AppState.camera.dragStartX) / AppState.camera.zoom;
      AppState.camera.y += (my - AppState.camera.dragStartY) / AppState.camera.zoom;
      AppState.camera.dragStartX = mx;
      AppState.camera.dragStartY = my;
      return;
    }

    const world = screenToWorld(mx, my);
    AppState.hoverAxial = HexMath.pixelToAxial(world.x, world.y, AppState.hexRadius, AppState.orientation);
  });

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      // Pan Camera
      AppState.camera.isDragging = true;
      AppState.camera.dragStartX = mx;
      AppState.camera.dragStartY = my;
      return;
    }

    if (e.button === 0) {
      const world = screenToWorld(mx, my);
      const axial = HexMath.pixelToAxial(world.x, world.y, AppState.hexRadius, AppState.orientation);
      const existing = AppState.hexagons.find(h => h.q === axial.q && h.r === axial.r);

      if (AppState.currentTool === 'add') {
        if (!existing) {
          const nextId = AppState.hexagons.length > 0 ? Math.max(...AppState.hexagons.map(h => h.id)) + 1 : 1;
          AppState.hexagons.push({ id: nextId, q: axial.q, r: axial.r });
          AppState.wiringChain.push(nextId);
          AppState.selectedHexId = nextId;
          recomputeLeds();
          showToast(`Added Hexagon #${nextId}`);
        }
      } else if (AppState.currentTool === 'select') {
        AppState.selectedHexId = existing ? existing.id : null;
        updateInspectorUI();
      } else if (AppState.currentTool === 'wire') {
        if (existing) {
          // If not in chain, append; if already in chain, re-order
          const idx = AppState.wiringChain.indexOf(existing.id);
          if (idx !== -1) {
            AppState.wiringChain.splice(idx, 1);
          }
          AppState.wiringChain.push(existing.id);
          recomputeLeds();
          showToast(`Wired Hex #${existing.id} (Chain index: ${AppState.wiringChain.length})`);
        }
      } else if (AppState.currentTool === 'delete') {
        if (existing) {
          AppState.hexagons = AppState.hexagons.filter(h => h.id !== existing.id);
          AppState.wiringChain = AppState.wiringChain.filter(id => id !== existing.id);
          if (AppState.selectedHexId === existing.id) AppState.selectedHexId = null;
          recomputeLeds();
          showToast(`Deleted Hexagon #${existing.id}`);
        }
      }
    }
  });

  window.addEventListener('mouseup', () => {
    AppState.camera.isDragging = false;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(3.0, Math.max(0.3, AppState.camera.zoom * zoomFactor));
    AppState.camera.zoom = newZoom;
  }, { passive: false });
}

// ==========================================================================
// 14. Event Listeners & UI Binding
// ==========================================================================
function setupUIBindings() {
  // Template Selector
  document.getElementById('templateSelect').addEventListener('change', (e) => {
    const fn = Templates[e.target.value];
    if (fn) {
      const hexCoords = fn();
      AppState.hexagons = hexCoords.map((c, idx) => ({ id: idx + 1, q: c.q, r: c.r }));
      AppState.wiringChain = AppState.hexagons.map(h => h.id);
      AppState.selectedHexId = null;
      fitCameraToGrid();
      recomputeLeds();
      showToast(`Loaded Template: ${e.target.options[e.target.selectedIndex].text}`);
    }
  });

  // Orientation Toggle
  document.getElementById('btnPointy').addEventListener('click', () => {
    AppState.orientation = 'pointy';
    document.getElementById('btnPointy').classList.add('active');
    document.getElementById('btnFlat').classList.remove('active');
    recomputeLeds();
  });
  document.getElementById('btnFlat').addEventListener('click', () => {
    AppState.orientation = 'flat';
    document.getElementById('btnFlat').classList.add('active');
    document.getElementById('btnPointy').classList.remove('active');
    recomputeLeds();
  });

  // Tools Selection
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentTool = btn.dataset.tool;
    });
  });

  // Display Mode Radio
  document.getElementById('modeModular').addEventListener('change', () => {
    AppState.displayMode = 'modular';
    document.getElementById('modeModularLabel').classList.add('active');
    document.getElementById('modeDenseLabel').classList.remove('active');
    const denseSection = document.getElementById('denseGeneratorSection');
    if (denseSection) denseSection.style.display = 'none';
    document.getElementById('perimeterSettingsSection').style.display = 'block';
    updatePhaseDisplay();
    recomputeLeds();
  });
  document.getElementById('modeDense').addEventListener('change', () => {
    AppState.displayMode = 'dense';
    document.getElementById('modeDenseLabel').classList.add('active');
    document.getElementById('modeModularLabel').classList.remove('active');
    const denseSection = document.getElementById('denseGeneratorSection');
    if (denseSection) denseSection.style.display = 'block';
    document.getElementById('perimeterSettingsSection').style.display = 'none';
    updateDenseGeneratorStats();
    recomputeLeds();
  });

  // Dense Mode Hexagon Auto-Generator Bindings (1 LED = 1 Hexagon)
  const densePhaseInput = document.getElementById('densePhaseLeds');
  if (densePhaseInput) {
    document.getElementById('btnIncDensePhase').addEventListener('click', () => {
      densePhaseInput.value = Math.min(30, (parseInt(densePhaseInput.value) || 8) + 1);
      updateDenseGeneratorStats();
    });
    document.getElementById('btnDecDensePhase').addEventListener('click', () => {
      densePhaseInput.value = Math.max(2, (parseInt(densePhaseInput.value) || 8) - 1);
      updateDenseGeneratorStats();
    });
    densePhaseInput.addEventListener('change', () => {
      densePhaseInput.value = Math.max(2, Math.min(30, parseInt(densePhaseInput.value) || 8));
      updateDenseGeneratorStats();
    });
  }

  const denseStructureType = document.getElementById('denseStructureType');
  if (denseStructureType) {
    denseStructureType.addEventListener('change', () => updateDenseGeneratorStats());
  }

  const denseCornerMode = document.getElementById('denseCornerMode');
  if (denseCornerMode) {
    denseCornerMode.addEventListener('change', () => updateDenseGeneratorStats());
  }

  const btnAutoGenerateHex = document.getElementById('btnAutoGenerateHex');
  if (btnAutoGenerateHex) {
    btnAutoGenerateHex.addEventListener('click', () => {
      autoGenerateDenseHexagon();
    });
  }

  // Phase LED Inputs (Modular Mode)
  const phaseInput = document.getElementById('ledsPerPhase');
  if (phaseInput) {
    document.getElementById('btnIncPhase').addEventListener('click', () => {
      phaseInput.value = Math.min(64, (parseInt(phaseInput.value) || 8) + 1);
      AppState.ledsPerPhase = parseInt(phaseInput.value);
      updatePhaseDisplay();
      recomputeLeds();
    });
    document.getElementById('btnDecPhase').addEventListener('click', () => {
      phaseInput.value = Math.max(2, (parseInt(phaseInput.value) || 8) - 1);
      AppState.ledsPerPhase = parseInt(phaseInput.value);
      updatePhaseDisplay();
      recomputeLeds();
    });
    phaseInput.addEventListener('change', () => {
      AppState.ledsPerPhase = Math.max(2, Math.min(64, parseInt(phaseInput.value) || 8));
      updatePhaseDisplay();
      recomputeLeds();
    });
  }

  // Corner Sharing Select (Modular Mode)
  const cornerSelect = document.getElementById('cornerSharingSelect');
  if (cornerSelect) {
    cornerSelect.addEventListener('change', (e) => {
      AppState.cornerMode = e.target.value;
      updatePhaseDisplay();
      recomputeLeds();
    });
  }



  // Start Corner & Direction
  document.getElementById('defaultStartCorner').addEventListener('change', (e) => {
    AppState.defaultStartCorner = parseInt(e.target.value);
    recomputeLeds();
  });
  document.getElementById('btnDirCW').addEventListener('click', () => {
    AppState.defaultDirection = 'cw';
    document.getElementById('btnDirCW').classList.add('active');
    document.getElementById('btnDirCCW').classList.remove('active');
    recomputeLeds();
  });
  document.getElementById('btnDirCCW').addEventListener('click', () => {
    AppState.defaultDirection = 'ccw';
    document.getElementById('btnDirCCW').classList.add('active');
    document.getElementById('btnDirCW').classList.remove('active');
    recomputeLeds();
  });

  // Auto-Wiring Buttons
  document.getElementById('btnAutoWireSerpentine').addEventListener('click', () => WiringSolvers.serpentine());
  document.getElementById('btnAutoWireSpiral').addEventListener('click', () => WiringSolvers.spiral());
  document.getElementById('btnAutoWireRadial').addEventListener('click', () => WiringSolvers.radial());
  document.getElementById('btnClearWiring').addEventListener('click', () => {
    AppState.wiringChain = [];
    recomputeLeds();
    showToast('Cleared wiring route');
  });
  document.getElementById('btnReverseWiring').addEventListener('click', () => {
    AppState.wiringChain.reverse();
    recomputeLeds();
    showToast('Inverted wiring chain');
  });

  // Inspector Overrides
  document.getElementById('inspStartCorner').addEventListener('change', (e) => {
    const hex = AppState.hexagons.find(h => h.id === AppState.selectedHexId);
    if (hex) {
      hex.startCornerOverride = e.target.value === 'inherit' ? undefined : parseInt(e.target.value);
      recomputeLeds();
    }
  });
  document.getElementById('inspDirection').addEventListener('change', (e) => {
    const hex = AppState.hexagons.find(h => h.id === AppState.selectedHexId);
    if (hex) {
      hex.dirOverride = e.target.value === 'inherit' ? undefined : e.target.value;
      recomputeLeds();
    }
  });
  document.getElementById('btnDeleteSelected').addEventListener('click', () => {
    if (AppState.selectedHexId) {
      AppState.hexagons = AppState.hexagons.filter(h => h.id !== AppState.selectedHexId);
      AppState.wiringChain = AppState.wiringChain.filter(id => id !== AppState.selectedHexId);
      AppState.selectedHexId = null;
      recomputeLeds();
      showToast('Deleted selected hexagon');
    }
  });

  // Canvas View Controls
  document.getElementById('btnZoomIn').addEventListener('click', () => {
    AppState.camera.zoom = Math.min(3.0, AppState.camera.zoom * 1.2);
  });
  document.getElementById('btnZoomOut').addEventListener('click', () => {
    AppState.camera.zoom = Math.max(0.3, AppState.camera.zoom / 1.2);
  });
  document.getElementById('btnResetView').addEventListener('click', () => {
    AppState.camera.x = 0;
    AppState.camera.y = 0;
    AppState.camera.zoom = 1.0;
  });

  // Overlay Toggles
  const toggleBtn = (id, stateKey) => {
    const btn = document.getElementById(id);
    btn.addEventListener('click', () => {
      AppState[stateKey] = !AppState[stateKey];
      btn.classList.toggle('active', AppState[stateKey]);
    });
  };
  toggleBtn('toggleLedLabels', 'showLedLabels');
  toggleBtn('toggleWiringLines', 'showWiringLines');
  toggleBtn('toggleCoords', 'showCoords');

  // Simulator Controls
  const simPlayBtn = document.getElementById('btnSimPlay');
  simPlayBtn.addEventListener('click', () => {
    AppState.simulator.isRunning = !AppState.simulator.isRunning;
    simPlayBtn.classList.toggle('playing', AppState.simulator.isRunning);
    document.getElementById('simPlayText').textContent = AppState.simulator.isRunning ? 'Pause' : 'Simulate';
  });

  document.getElementById('fxSelector').addEventListener('change', (e) => {
    AppState.simulator.effect = e.target.value;
  });
  document.getElementById('fxPalette').addEventListener('change', (e) => {
    AppState.simulator.palette = e.target.value;
  });
  document.getElementById('fxSpeed').addEventListener('input', (e) => {
    AppState.simulator.speed = parseFloat(e.target.value);
    document.getElementById('valFxSpeed').textContent = `${AppState.simulator.speed.toFixed(1)}x`;
  });
  document.getElementById('fxBrightness').addEventListener('input', (e) => {
    AppState.simulator.brightness = parseInt(e.target.value) / 100;
    document.getElementById('valFxBrightness').textContent = `${e.target.value}%`;
  });

  // Export Modal & Tabs
  const exportModal = document.getElementById('exportModal');
  document.getElementById('btnExport').addEventListener('click', () => {
    populateExportCode();
    exportModal.style.display = 'flex';
  });
  document.getElementById('btnCloseExportModal').addEventListener('click', () => {
    exportModal.style.display = 'none';
  });

  const tabButtons = document.querySelectorAll('.modal-tabs .tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Copy Buttons
  const setupCopy = (btnId, codeId) => {
    document.getElementById(btnId).addEventListener('click', () => {
      const code = document.getElementById(codeId).textContent;
      navigator.clipboard.writeText(code);
      showToast('Copied to clipboard! 📋');
    });
  };
  setupCopy('btnCopyWledMap', 'codeWledMap');
  setupCopy('btnCopySegments', 'codeWledSegments');
  setupCopy('btnCopyFastLed', 'codeFastLed');
  setupCopy('btnCopyXLights', 'codeXLights');

  // File Download Helpers
  const downloadFile = (filename, content, type = 'application/json') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
  };

  document.getElementById('btnDownloadLedmap').addEventListener('click', () => {
    downloadFile('ledmap.json', Exporters.wledLedmap());
  });
  document.getElementById('btnDownloadSegments').addEventListener('click', () => {
    downloadFile('segments.json', Exporters.wledSegments());
  });
  document.getElementById('btnDownloadFastLed').addEventListener('click', () => {
    downloadFile('HexMatrix.h', Exporters.fastLedCpp(), 'text/x-c');
  });
  document.getElementById('btnDownloadXLights').addEventListener('click', () => {
    downloadFile('custom_hex.xmodel', Exporters.xLightsXml(), 'application/xml');
  });

  // Blueprint Modal
  const bpModal = document.getElementById('blueprintModal');
  document.getElementById('btnBlueprint').addEventListener('click', () => {
    renderBlueprintCanvas();
    document.getElementById('bpStartVertex').textContent = AppState.defaultStartCorner;
    bpModal.style.display = 'flex';
  });
  document.getElementById('btnCloseBlueprintModal').addEventListener('click', () => {
    bpModal.style.display = 'none';
  });
  document.getElementById('btnDownloadBlueprintPng').addEventListener('click', () => {
    const bpCanvas = document.getElementById('blueprintCanvas');
    const a = document.createElement('a');
    a.href = bpCanvas.toDataURL('image/png');
    a.download = 'hex_display_blueprint.png';
    a.click();
    showToast('Downloaded Blueprint PNG');
  });
  document.getElementById('btnPrintBlueprint').addEventListener('click', () => {
    window.print();
  });

  // Project Save & Load
  document.getElementById('btnProjectSave').addEventListener('click', () => {
    const project = {
      version: '2.1',
      orientation: AppState.orientation,
      displayMode: AppState.displayMode,
      ledsPerPhase: AppState.ledsPerPhase,
      cornerMode: AppState.cornerMode,
      defaultStartCorner: AppState.defaultStartCorner,
      defaultDirection: AppState.defaultDirection,
      hexagons: AppState.hexagons,
      wiringChain: AppState.wiringChain
    };
    downloadFile('hexamap_project.json', JSON.stringify(project, null, 2));
  });

  const fileInput = document.getElementById('fileInput');
  document.getElementById('btnProjectLoad').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const proj = JSON.parse(ev.target.result);
        if (proj.hexagons && proj.wiringChain) {
          AppState.orientation = proj.orientation || 'pointy';
          AppState.displayMode = proj.displayMode || 'dense';
          AppState.ledsPerPhase = proj.ledsPerPhase || proj.ledsPerEdge || 8;
          AppState.cornerMode = proj.cornerMode || 'shared';
          AppState.defaultStartCorner = proj.defaultStartCorner || 0;
          AppState.defaultDirection = proj.defaultDirection || 'cw';
          AppState.hexagons = proj.hexagons;
          AppState.wiringChain = proj.wiringChain;

          const phaseIn = document.getElementById('ledsPerPhase');
          if (phaseIn) phaseIn.value = AppState.ledsPerPhase;
          const cornerSel = document.getElementById('cornerSharingSelect');
          if (cornerSel) cornerSel.value = AppState.cornerMode;

          recomputeLeds();
          showToast('Project loaded successfully! 🚀');
        }
      } catch (err) {
        showToast('Invalid project JSON file', 'error');
      }
    };
    reader.readAsText(file);
  });
}

function populateExportCode() {
  document.getElementById('codeWledMap').textContent = Exporters.wledLedmap();
  document.getElementById('codeWledSegments').textContent = Exporters.wledSegments();
  document.getElementById('codeFastLed').textContent = Exporters.fastLedCpp();
  document.getElementById('codeXLights').textContent = Exporters.xLightsXml();
}

// ==========================================================================
// 15. Application Initialization
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Load default 7-Hex Flower Template
  const defaultCoords = Templates.flower7();
  AppState.hexagons = defaultCoords.map((c, idx) => ({ id: idx + 1, q: c.q, r: c.r }));
  AppState.wiringChain = AppState.hexagons.map(h => h.id);

  setupCanvasInteractions();
  setupUIBindings();
  updateDenseGeneratorStats();
  recomputeLeds();

  // Start Animation Render Loop
  requestAnimationFrame(render);
});
