import { Candidate, Portfolio, Strategy } from '../types';
import { baseSell, hardBlocked } from './helpers';
const strategy: Strategy = {
  name: 'KNIFE_CATCHER',
  config: { positionSizeSol: 0.05, maxOpenPositions: 20 },
  explainBuy(candidate: Candidate, portfolio: Portfolio) {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= this.config.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate, { allowManipulation: true })) reasons.push('hard_blocked');
    if (candidate.lifecycleState !== 'DECLINING') reasons.push('not_declining');
    return reasons;
  },
  shouldBuy(candidate, portfolio) { return this.explainBuy!(candidate, portfolio).length === 0; },
  shouldSell: (position, candidate) => baseSell(position, candidate, 50, -30),
};
export default strategy;
