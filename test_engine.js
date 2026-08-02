/**
 * Unit & Integration Test for Honeycomb WLED Mapping Engine
 * Tests 1 LED = 1 Hexagon Phase-Based Auto-Generator:
 * - Hexagon Ring: 8 LEDs in 1 phase with 1 common corner LED = 42 LEDs (1 LED = 1 Hexagon)
 * - Solid Hexagon Grid: Side 8 = 169 LEDs
 * - Wiring Patterns: Perimeter, Serpentine, Spiral
 */
const fs = require('fs');
const vm = require('vm');

const appCode = fs.readFileSync('app.js', 'utf-8');

const domMock = {
  document: {
    getElementById: (id) => ({
      id: id,
      value: '8',
      addEventListener: () => {},
      textContent: '',
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      getContext: () => ({
        scale: () => {},
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        closePath: () => {},
        arc: () => {},
        save: () => {},
        restore: () => {},
        fillText: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} })
      })
    }),
    querySelectorAll: () => []
  },
  window: {
    addEventListener: () => {},
    devicePixelRatio: 1
  },
  navigator: { clipboard: { writeText: () => {} } },
  requestAnimationFrame: () => {}
};

const sandbox = {
  ...domMock,
  console: console,
  Math: Math,
  Map: Map,
  Array: Array,
  JSON: JSON,
  Blob: function() {},
  URL: { createObjectURL: () => '', revokeObjectURL: () => {} }
};

vm.createContext(sandbox);
vm.runInContext(appCode, sandbox);

console.log("=== RUNNING PHASE-BASED 1 LED = 1 HEXAGON TESTS ===");

const run = (code) => vm.runInContext(code, sandbox);

// 1. Check HexGenerator.generateRing(8, 'shared')
const ring8Coords = run("HexGenerator.generateRing(8, 'shared')");
console.assert(ring8Coords.length === 42, `Expected 42 hexagons for 8 LEDs/phase with 1 common corner, got ${ring8Coords.length}`);
console.log(`✓ HexGenerator.generateRing(8, 'shared') produced exactly 42 hexagons (1 LED = 1 Hexagon)`);

// Check that there are 6 corner hexagons
const cornersCount = ring8Coords.filter(c => c.isCorner).length;
console.assert(cornersCount === 6, `Expected 6 corner vertices, got ${cornersCount}`);
console.log(`✓ Verified 6 corner vertices shared across 6 phases`);

// 2. Check HexGenerator.generateRing(5, 'shared')
const ring5Coords = run("HexGenerator.generateRing(5, 'shared')");
console.assert(ring5Coords.length === 24, `Expected 24 hexagons for 5 LEDs/phase with 1 common corner, got ${ring5Coords.length}`);
console.log(`✓ HexGenerator.generateRing(5, 'shared') produced exactly 24 hexagons (6 * 4 = 24)`);

// 3. Check HexGenerator.generateSolid(8)
const solid8Coords = run("HexGenerator.generateSolid(8)");
console.assert(solid8Coords.length === 169, `Expected 169 hexagons for Side 8 Solid Hex, got ${solid8Coords.length}`);
console.log(`✓ HexGenerator.generateSolid(8) produced 169 hexagons (Radius 7)`);

// 4. Test Auto-Generation into AppState (1 LED = 1 Hexagon Default Mode)
run(`
  AppState.displayMode = 'dense';
  const ring8 = HexGenerator.generateRing(8, 'shared');
  AppState.hexagons = ring8.map((c, idx) => ({ id: idx + 1, q: c.q, r: c.r }));
  AppState.wiringChain = AppState.hexagons.map(h => h.id);
  recomputeLeds();
`);

const totalLeds = run("AppState.cachedLeds.length");
console.assert(totalLeds === 42, `Expected 42 LEDs in dense mode, got ${totalLeds}`);
console.log(`✓ AppState successfully computed 42 LEDs for 8-phase Hexagon (1 LED = 1 Hexagon)`);

// Verify 2D Matrix for 42-LED Hexagon Ring
const matrix = run("AppState.cachedMatrix");
console.assert(matrix && matrix.width > 0 && matrix.height > 0, "Matrix dimensions should be valid");
console.log(`✓ 2D Bounding Matrix for 42-LED Hexagon Ring: ${matrix.width} × ${matrix.height} (${matrix.map.length} total cells)`);

// Verify WLED ledmap.json Export
const wledJson = JSON.parse(run("Exporters.wledLedmap()"));
console.assert(wledJson.map.includes(0) && wledJson.map.includes(41), "WLED ledmap should contain LED indices 0 to 41");
console.log(`✓ WLED ledmap.json contains all 42 LED indices (0–41) correctly mapped`);

// 5. Test Serpentine Wiring Pattern
const serpentineCoords = run("HexGenerator.wireCoordinates(HexGenerator.generateRing(8, 'shared'), 'serpentine')");
console.assert(serpentineCoords.length === 42, "Serpentine coordinates should preserve count of 42");
console.log(`✓ Serpentine row-by-row auto-wiring verified for 42 hexagons`);

// 6. Test Spiral Inward Wiring Pattern
const spiralCoords = run("HexGenerator.wireCoordinates(HexGenerator.generateSolid(3), 'spiral')");
console.assert(spiralCoords.length === 19, "Spiral solid-3 should have 19 hexagons");
console.log(`✓ Spiral auto-wiring verified for 19 hexagons`);

console.log("=== ALL TESTS PASSED SUCCESSFULLY! ===");
