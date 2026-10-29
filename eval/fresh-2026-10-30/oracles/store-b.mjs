// Store B oracle. Catalog: desk-lamp 5900, monitor-arm 8900, cable-tray 1900,
// wrist-rest 2400; DESK15 = 15% off the cart. No bulk rule.
import { runScenarios } from './lib.mjs';
export const runOracle = (rootDir) => runScenarios(rootDir, [
  { name: 'three products', items: [['desk-lamp', 1], ['monitor-arm', 1], ['cable-tray', 1]], count: 3, totalMinor: 16700 },
  { name: 'all four products', items: [['desk-lamp', 1], ['monitor-arm', 1], ['cable-tray', 1], ['wrist-rest', 1]], count: 4, totalMinor: 19100 },
  { name: 'all four + DESK15', items: [['desk-lamp', 1], ['monitor-arm', 1], ['cable-tray', 1], ['wrist-rest', 1]], promo: 'DESK15', count: 4, totalMinor: 16235 },
  { name: '2x wrist-rest', items: [['wrist-rest', 2]], count: 2, totalMinor: 4800 },
]);
