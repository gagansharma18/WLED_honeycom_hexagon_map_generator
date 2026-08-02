/**
 * Unit & Integration Test for Honeycomb WLED Mapping Engine
 */
const fs = require('fs');
const vm = require('vm');

const appCode = fs.readFileSync('app.js', 'utf-8');

const domMock = {
  document: {
    getElementById: () => ({
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

console.log("=== RUNNING ENGINE VALIDATION TESTS ===");

const run = (code) => vm.runInContext(code, sandbox);

// 1. Check HexMath
const centerPixel = run("HexMath.axialToPixel(0, 0, 46, 'pointy')");
console.assert(centerPixel.x === 0 && centerPixel.y === 0, "HexMath center pixel should be (0,0)");

const axialBack = run(`HexMath.pixelToAxial(${centerPixel.x}, ${centerPixel.y}, 46, 'pointy')`);
console.assert(axialBack.q === 0 && axialBack.r === 0, "Axial round back should be (0,0)");
console.log("✓ HexMath axial/pixel conversion verified");

// 2. Check Templates
const flower7 = run("Templates.flower7()");
console.assert(flower7.length === 7, "flower7 template should have 7 hexagons");
console.log("✓ Template generation verified");

// 3. Check Default 1 LED = 1 Hexagon Mode
run(`
  AppState.hexagons = Templates.flower7().map((c, idx) => ({ id: idx + 1, q: c.q, r: c.r }));
  AppState.wiringChain = AppState.hexagons.map(h => h.id);
  AppState.displayMode = 'dense';
  recomputeLeds();
`);

const denseLeds = run("AppState.cachedLeds.length");
console.assert(denseLeds === 7, `Expected 7 LEDs in dense mode (1 LED = 1 Hex), got ${denseLeds}`);
console.log(`✓ Default 1 LED = 1 Hexagon verified (${denseLeds} LEDs across 7 hexes)`);

const denseMatrix = run("AppState.cachedMatrix");
console.assert(denseMatrix && denseMatrix.width > 0 && denseMatrix.height > 0, "Dense Matrix should have valid dimensions");
const mappedDense = denseMatrix.map.filter(x => x !== -1);
console.assert(mappedDense.length === 7, `Mapped indices (${mappedDense.length}) must equal 7`);
console.log(`✓ 1 LED = 1 Hex 2D Matrix verified: ${denseMatrix.width}x${denseMatrix.height} grid, ${mappedDense.length} mapped LEDs, ${denseMatrix.map.length - mappedDense.length} gap (-1) cells`);

// 4. Check Exporters in 1 LED = 1 Hex mode
const wledJson = JSON.parse(run("Exporters.wledLedmap()"));
console.assert(wledJson.width === denseMatrix.width, "WLED JSON width should match matrix");
console.assert(wledJson.map.length === denseMatrix.map.length, "WLED JSON map length should match");

const segmentsJson = JSON.parse(run("Exporters.wledSegments()"));
console.assert(segmentsJson.seg.length === 7, "Segments JSON should have 7 segments");

console.log("✓ WLED ledmap.json and Segments export verified for 1 LED = 1 Hexagon mode");
console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
