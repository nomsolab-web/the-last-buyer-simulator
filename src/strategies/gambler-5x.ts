import { Candidate, PaperPosition, Portfolio, Strategy } from '../types';
import { hardBlocked, hoursHeld } from './helpers';
const strategy: Strategy = {
  name: 'GAMBLER_5X',
  config: { positionSizeSol: 0.05, maxOpenPositions: 20 },
  explainBuy(candidate: Candidate, portfolio: Portfolio) {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= this.config.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate, { allowManipulation: true, allowArchived: true })) reasons.push('hard_blocked');
    if ((candidate.sourceRank ?? Infinity) > 50) reasons.push('source_rank_above_threshold');
    if ((candidate.liquidityUsd ?? 0) < 3000) reasons.push('liquidity_below_threshold');
    return reasons;
  },
  shouldBuy(candidate, portfolio) { return this.explainBuy!(candidate, portfolio).length === 0; },
  shouldSell(position: PaperPosition, candidate: Candidate) {
    if (candidate.preDrainLevel === 'DRAIN' || candidate.liquidityDrainDetected || candidate.rugDetected) return { shouldSell: true, reason: 'hard_exit' };
    if (position.unrealizedPnlPct >= 500) return { shouldSell: true, reason: 'take_profit_500' };
    if (position.unrealizedPnlPct <= -50) return { shouldSell: true, reason: 'stop_loss_50' };
    if (hoursHeld(position) >= 72) return { shouldSell: true, reason: 'max_hold_72h' };
    return { shouldSell: false };
  },
};
export default strategy;
