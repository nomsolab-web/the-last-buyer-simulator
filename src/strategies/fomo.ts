import { Candidate, PaperPosition, Portfolio, Strategy } from '../types';
import { hardBlocked, n } from './helpers';
const strategy: Strategy = {
  name: 'FOMO',
  config: { positionSizeSol: 0.1, maxOpenPositions: 25 },
  explainBuy(candidate: Candidate, portfolio: Portfolio) {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= this.config.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate, { allowManipulation: true })) reasons.push('hard_blocked');
    if (n(candidate.holderMomentum) < 0.12 && n(candidate.holderDeltaPct) < 0.12) reasons.push('momentum_below_threshold');
    if (n(candidate.volume1h) <= 0 && n(candidate.volume24h) <= 0) reasons.push('volume_spike_missing');
    return reasons;
  },
  shouldBuy(candidate, portfolio) { return this.explainBuy!(candidate, portfolio).length === 0; },
  shouldSell(position: PaperPosition, candidate: Candidate) {
    if (candidate.liquidityDrainDetected || candidate.rugDetected || candidate.preDrainLevel === 'DRAIN') return { shouldSell: true, reason: 'hard_exit' };
    if (position.unrealizedPnlPct >= 80) return { shouldSell: true, reason: 'take_profit_80' };
    if (position.unrealizedPnlPct <= -35) return { shouldSell: true, reason: 'stop_loss_35' };
    if (n(candidate.holderMomentum) <= 0 && n(candidate.holderDeltaPct) <= 0) return { shouldSell: true, reason: 'momentum_lost' };
    return { shouldSell: false };
  },
};
export default strategy;
