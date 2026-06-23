import { Candidate, PaperPosition, Portfolio, Strategy } from '../types';
import { earlyStates, hardBlocked, hoursHeld } from './helpers';
const strategy: Strategy = {
  name: 'GAMBLER_2X',
  config: { positionSizeSol: 0.1, maxOpenPositions: 15 },
  explainBuy(candidate: Candidate, portfolio: Portfolio) {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= this.config.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate, { allowManipulation: true })) reasons.push('hard_blocked');
    if ((candidate.sourceRank ?? Infinity) > 40) reasons.push('source_rank_above_threshold');
    if ((candidate.discoveryScore ?? 0) < 25) reasons.push('discovery_below_threshold');
    if ((candidate.trashScore ?? 100) > 90) reasons.push('trash_above_threshold');
    if ((candidate.liquidityUsd ?? 0) < 3000) reasons.push('liquidity_below_threshold');
    if (!earlyStates.includes(candidate.lifecycleState)) reasons.push('lifecycle_not_allowed');
    if ((candidate.volume24h ?? 0) <= 0) reasons.push('volume_24h_zero');
    return reasons;
  },
  shouldBuy(candidate, portfolio) { return this.explainBuy!(candidate, portfolio).length === 0; },
  shouldSell(position: PaperPosition, candidate: Candidate) {
    if (candidate.lifecycleState === 'ARCHIVED') return { shouldSell: true, reason: 'archived' };
    if (candidate.preDrainLevel === 'DRAIN' || candidate.liquidityDrainDetected) return { shouldSell: true, reason: 'liquidity_drain' };
    if (candidate.rugDetected) return { shouldSell: true, reason: 'rug_detected' };
    if (position.unrealizedPnlPct >= 100) return { shouldSell: true, reason: 'take_profit_100' };
    if (position.unrealizedPnlPct <= -40) return { shouldSell: true, reason: 'stop_loss_40' };
    if (hoursHeld(position) >= 24) return { shouldSell: true, reason: 'max_hold_24h' };
    return { shouldSell: false };
  },
};
export default strategy;
