import fs from 'fs';
import path from 'path';
import { Strategy } from '../types';
import { composeStrategy, sellStrategies } from './sell-strategies';

const INCLUDE_RESEARCH_STRATEGIES = ['1', 'true', 'yes'].includes(
  String(process.env.LAST_BUYER_INCLUDE_RESEARCH_STRATEGIES || process.env.INCLUDE_RESEARCH_STRATEGIES || '').toLowerCase(),
);
const INCLUDE_BASE_STRATEGIES = ['1', 'true', 'yes'].includes(
  String(process.env.LAST_BUYER_INCLUDE_BASE_STRATEGIES || process.env.INCLUDE_BASE_STRATEGIES || '').toLowerCase(),
);

const ACTIVE_BASE_STRATEGIES = new Set(INCLUDE_RESEARCH_STRATEGIES
  ? ['DEGEN', 'FOMO', 'TOP10_BREAKOUT']
  : ['FOMO']);

const BUY_SIDE_EXPERIMENTS = new Set(INCLUDE_RESEARCH_STRATEGIES
  ? ['DEGEN', 'FOMO', 'TOP10_BREAKOUT']
  : ['FOMO']);

const ACTIVE_SELL_STRATEGIES = new Set(INCLUDE_RESEARCH_STRATEGIES
  ? sellStrategies.map((strategy) => strategy.name)
  : ['TP50_SL30']);

function loadBaseStrategies(): Strategy[] {
  const dir = __dirname;
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
    .filter((file) => !['index.ts', 'index.js', 'helpers.ts', 'helpers.js', 'sell-strategies.ts', 'sell-strategies.js'].includes(file))
    .map((file) => {
      const mod = require(path.join(dir, file));
      return (mod.default || mod.strategy || mod) as Strategy;
    })
    .filter((strategy) => strategy && typeof strategy.name === 'string' && typeof strategy.shouldBuy === 'function' && typeof strategy.shouldSell === 'function')
    .filter((strategy) => ACTIVE_BASE_STRATEGIES.has(strategy.name));
}

export function loadStrategies(): Strategy[] {
  const base = loadBaseStrategies();
  const buySide = base.filter((strategy) => BUY_SIDE_EXPERIMENTS.has(strategy.name));
  const activeSellStrategies = sellStrategies.filter((strategy) => ACTIVE_SELL_STRATEGIES.has(strategy.name));
  const matrix = buySide.flatMap((buyStrategy) => activeSellStrategies.map((sellStrategy) => composeStrategy(buyStrategy, sellStrategy)));
  const visibleBase = INCLUDE_BASE_STRATEGIES ? base : [];
  return [...visibleBase, ...matrix].sort((a, b) => a.name.localeCompare(b.name));
}