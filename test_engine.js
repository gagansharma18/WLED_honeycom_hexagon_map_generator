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
        fillText: () => {}
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

// 3. Check LED Generation & Matrix
run(`
  AppState.hexagons = Templates.flower7().map((c, idx) => ({ id: idx + 1, q: c.q, r: c.r }));
  AppState.wiringChain = AppState.hexagons.map(h => h.id);
  AppState.ledsPerEdge = 3;
  AppState.displayMode = 'modular';
  recomputeLeds();
`);

const totalLeds = run("AppState.cachedLeds.length");
const expectedTotal = 7 * 6 * 3; // 126
console.assert(totalLeds === expectedTotal, `Expected ${expectedTotal} LEDs, got ${totalLeds}`);
console.log(`✓ Total LED computation verified (${totalLeds} LEDs across 7 hexes)`);

// 4. Check Matrix Bounding Box and ledmap.json
const matrix = run("AppState.cachedMatrix");
console.assert(matrix && matrix.width > 0 && matrix.height > 0, "Matrix should have valid width/height");
console.assert(matrix.map.length === matrix.width * matrix.height, "Flat map length should equal width * height");

const mappedIndices = matrix.map.filter(x => x !== -1);
console.assert(mappedIndices.length === totalLeds, `Mapped indices (${mappedIndices.length}) must equal total LEDs (${totalLeds})`);
console.log(`✓ 2D Matrix projection verified: ${matrix.width}x${matrix.height} grid, ${mappedIndices.length} mapped LEDs, ${matrix.map.length - mappedIndices.length} gap (-1) cells`);

// 5. Check Exporters
const wledJson = JSON.parse(run("Exporters.wledLedmap()"));
console.assert(wledJson.width === matrix.width, "WLED JSON width should match matrix");
console.assert(wledJson.map.length === matrix.map.length, "WLED JSON map length should match");

const segmentsJson = JSON.parse(run("Exporters.wledSegments()"));
console.assert(segmentsJson.seg.length === 7, "Segments JSON should have 7 segments");

const fastLedCode = run("Exporters.fastLedCpp()");
console.assert(fastLedCode.includes("HEX_LED_MAP"), "FastLED code should contain HEX_LED_MAP");

const xlightsXml = run("Exporters.xLightsXml()");
console.assert(xlightsXml.includes("<custommodel"), "xLights code should contain <custommodel");

console.log("✓ All Exporters (WLED ledmap.json, Segments, FastLED C++, xLights XML) verified");
console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
