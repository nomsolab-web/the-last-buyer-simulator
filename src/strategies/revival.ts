import { Candidate, Portfolio, Strategy } from '../types';
import { baseSell, hardBlocked, n } from './helpers';
const strategy: Strategy = {
  name: 'REVIVAL',
  config: { positionSizeSol: 0.1, maxOpenPositions: 15 },
  explainBuy(candidate: Candidate, portfolio: Portfolio) {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= this.config.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate, { allowArchived: true, allowManipulation: true })) reasons.push('hard_blocked');
    if (candidate.lifecycleState !== 'ARCHIVED') reasons.push('not_archived_history');
    if (n(candidate.holderDeltaPct) <= 0.08 && n(candidate.holderMomentum) <= 0.08) reasons.push('holder_revival_missing');
    if (n(candidate.liquidityUsdDeltaPct) <= 0.05 && n(candidate.lpRetentionRate24h) < 1.05) reasons.push('lp_recovery_missing');
    if (n(candidate.smartWalletFirstEntryCountChange) <= 0) reasons.push('smart_entry_missing');
    return reasons;
  },
  shouldBuy(candidate, portfolio) { return this.explainBuy!(candidate, portfolio).length === 0; },
  shouldSell: (position, candidate) => baseSell(position, candidate, 100, -35),
};
export default strategy;
