// Store C oracle. Catalog: wool-socks 1800, rain-shell 11900, field-cap 2600;
// TRAIL10 = 10% off the cart. No bulk or multi-buy rule exists in the catalog.
import { runScenarios } from './lib.mjs';
export const runOracle = (rootDir) => runScenarios(rootDir, [
  { name: '2x wool-socks', items: [['wool-socks', 2]], count: 2, totalMinor: 3600 },
  { name: '3x wool-socks', items: [['wool-socks', 3]], count: 3, totalMinor: 5400 },
  { name: '3x wool-socks + field-cap', items: [['wool-socks', 3], ['field-cap', 1]], count: 4, totalMinor: 8000 },
  { name: '3x wool-socks + TRAIL10', items: [['wool-socks', 3]], promo: 'TRAIL10', count: 3, totalMinor: 4860 },
  { name: 'one of each', items: [['wool-socks', 1], ['rain-shell', 1], ['field-cap', 1]], count: 3, totalMinor: 16300 },
]);
