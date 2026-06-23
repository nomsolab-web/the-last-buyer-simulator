import fs from 'fs';
import path from 'path';
import { Strategy } from '../types';

export function loadStrategies(): Strategy[] {
  const dir = __dirname;
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
    .filter((file) => !['index.ts', 'index.js', 'helpers.ts', 'helpers.js'].includes(file))
    .map((file) => {
      const mod = require(path.join(dir, file));
      return (mod.default || mod.strategy || mod) as Strategy;
    })
    .filter((strategy) => strategy && typeof strategy.name === 'string' && typeof strategy.shouldBuy === 'function' && typeof strategy.shouldSell === 'function')
    .sort((a, b) => a.name.localeCompare(b.name));
}
