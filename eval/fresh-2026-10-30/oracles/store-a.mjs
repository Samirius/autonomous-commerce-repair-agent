// Store A oracle. Catalog: house-blend 1450, single-origin 2200, cold-brew-kit 3900;
// bulk 10% off at 4+ items in the cart; BREW10 = 10% after bulk.
import { runScenarios } from './lib.mjs';
export const runOracle = (rootDir) => runScenarios(rootDir, [
  { name: '3x house-blend (below bulk)', items: [['house-blend', 3]], count: 3, totalMinor: 4350 },
  { name: '4x house-blend (bulk threshold)', items: [['house-blend', 4]], count: 4, totalMinor: 5220 },
  { name: 'mixed 2+1+1 (bulk threshold)', items: [['house-blend', 2], ['single-origin', 1], ['cold-brew-kit', 1]], count: 4, totalMinor: 8100 },
  { name: '4x house-blend + BREW10', items: [['house-blend', 4]], promo: 'BREW10', count: 4, totalMinor: 4698 },
  { name: 'one of each', items: [['house-blend', 1], ['single-origin', 1], ['cold-brew-kit', 1]], count: 3, totalMinor: 7550 },
]);
