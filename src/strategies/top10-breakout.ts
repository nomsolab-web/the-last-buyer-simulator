import { Candidate, Portfolio, Strategy } from '../types';
import { baseSell, hardBlocked, n } from './helpers';
const strategy: Strategy = {
  name: 'TOP10_BREAKOUT',
  config: { positionSizeSol: 0.15, maxOpenPositions: 20 },
  explainBuy(candidate: Candidate, portfolio: Portfolio) {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= this.config.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate)) reasons.push('hard_blocked');
    if (!(n(candidate.top10HolderRateDelta) < 0 || candidate.top10Trend === 'DOWN')) reasons.push('top10_not_decreasing');
    if (n(candidate.holderDeltaPct) <= 0 && n(candidate.holderMomentum) <= 0) reasons.push('holders_not_increasing');
    return reasons;
  },
  shouldBuy(candidate, portfolio) { return this.explainBuy!(candidate, portfolio).length === 0; },
  shouldSell: (position, candidate) => baseSell(position, candidate, 100, -30),
};
export default strategy;
