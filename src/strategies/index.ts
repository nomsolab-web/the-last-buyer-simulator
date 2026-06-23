import fs from 'fs';
import path from 'path';
import { Strategy } from '../types';
import { composeStrategy, sellStrategies } from './sell-strategies';

const BUY_SIDE_EXPERIMENTS = new Set([
  'FOMO',
  'GAMBLER_2X',
  'KNIFE_CATCHER',
  'LOW_LP_MOONSHOT',
  'SMART_SHADOW',
  'TOP10_BREAKOUT',
]);

function loadBaseStrategies(): Strategy[] {
  const dir = __dirname;
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
    .filter((file) => !['index.ts', 'index.js', 'helpers.ts', 'helpers.js', 'sell-strategies.ts', 'sell-strategies.js'].includes(file))
    .map((file) => {
      const mod = require(path.join(dir, file));
      return (mod.default || mod.strategy || mod) as Strategy;
    })
    .filter((strategy) => strategy && typeof strategy.name === 'string' && typeof strategy.shouldBuy === 'function' && typeof strategy.shouldSell === 'function');
}

export function loadStrategies(): Strategy[] {
  const base = loadBaseStrategies();
  const buySide = base.filter((strategy) => BUY_SIDE_EXPERIMENTS.has(strategy.name));
  const matrix = buySide.flatMap((buyStrategy) => sellStrategies.map((sellStrategy) => composeStrategy(buyStrategy, sellStrategy)));
  return [...base, ...matrix].sort((a, b) => a.name.localeCompare(b.name));
}
