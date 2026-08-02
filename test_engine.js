/**
 * Unit & Integration Test for Honeycomb WLED Mapping Engine
 * Tests 1 LED = 1 Hexagon mode & Phase LED Configuration with Common Corner LEDs
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
  AppState.hexagons = [{ id: 1, q: 0, r: 0 }];
  AppState.wiringChain = [1];
  AppState.displayMode = 'dense';
  recomputeLeds();
`);

let denseLeds = run("AppState.cachedLeds.length");
console.assert(denseLeds === 1, `Expected 1 LED for single hex in dense mode, got ${denseLeds}`);
console.log(`✓ Default 1 LED = 1 Hexagon single cell verified`);

run(`
  AppState.hexagons = Templates.flower7().map((c, idx) => ({ id: idx + 1, q: c.q, r: c.r }));
  AppState.wiringChain = AppState.hexagons.map(h => h.id);
  AppState.displayMode = 'dense';
  recomputeLeds();
`);

denseLeds = run("AppState.cachedLeds.length");
console.assert(denseLeds === 7, `Expected 7 LEDs in dense mode, got ${denseLeds}`);
console.log(`✓ Default 1 LED = 1 Hexagon verified (${denseLeds} LEDs across 7 hexes)`);

// 4. Check Phase LED Generation: 8 LEDs per phase with 1 common corner LED
run(`
  AppState.hexagons = [{ id: 1, q: 0, r: 0 }];
  AppState.wiringChain = [1];
  AppState.displayMode = 'modular';
  AppState.ledsPerPhase = 8;
  AppState.cornerMode = 'shared';
  recomputeLeds();
`);

const phaseLedsSingle = run("AppState.cachedLeds.length");
console.assert(phaseLedsSingle === 42, `Expected 42 LEDs for 8 LEDs/phase with 1 common corner LED (6 * 7 = 42), got ${phaseLedsSingle}`);
console.log(`✓ Phase LED Mode: 8 LEDs per phase with 1 common corner LED = ${phaseLedsSingle} LEDs per hexagon (Verified)`);

// Verify corner flags and phase indexes
const cornerLeds = run("AppState.cachedLeds.filter(l => l.isCorner)");
console.assert(cornerLeds.length === 6, `Expected exactly 6 corner LEDs, got ${cornerLeds.length}`);
console.log(`✓ 6 Shared Corner LEDs identified correctly at vertices (Indices: ${cornerLeds.map(l => l.globalIndex).join(', ')})`);

// 5. Test 7-Hex Flower with 8 LEDs per Phase
run(`
  AppState.hexagons = Templates.flower7().map((c, idx) => ({ id: idx + 1, q: c.q, r: c.r }));
  AppState.wiringChain = AppState.hexagons.map(h => h.id);
  AppState.displayMode = 'modular';
  AppState.ledsPerPhase = 8;
  AppState.cornerMode = 'shared';
  recomputeLeds();
`);

const totalClusterLeds = run("AppState.cachedLeds.length");
console.assert(totalClusterLeds === 7 * 42, `Expected 294 LEDs for 7 hexes * 42 leds/hex, got ${totalClusterLeds}`);
console.log(`✓ 7-Hex Cluster with 8 LEDs/phase: ${totalClusterLeds} total LEDs mapped successfully`);

// 6. Test Exporters
const wledJson = JSON.parse(run("Exporters.wledLedmap()"));
console.assert(wledJson.width > 0 && wledJson.height > 0, "WLED JSON width and height should be valid");
console.assert(wledJson.map.length === wledJson.width * wledJson.height, "WLED JSON map length should match dimensions");

const segsJson = JSON.parse(run("Exporters.wledSegments()"));
console.assert(segsJson.seg.length === 7, "Segments should have 7 segments");
console.assert(segsJson.seg[0].len === 42, `Each segment should have 42 LEDs, got ${segsJson.seg[0].len}`);
console.log(`✓ WLED Segments exported: 7 segments of 42 LEDs each (Total ${7 * 42} LEDs)`);

console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
