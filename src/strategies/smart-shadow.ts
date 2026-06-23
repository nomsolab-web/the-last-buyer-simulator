import { Candidate, PaperPosition, Portfolio, Strategy } from '../types';
import { hardBlocked, n } from './helpers';
const strategy: Strategy = {
  name: 'SMART_SHADOW',
  config: { positionSizeSol: 0.15, maxOpenPositions: 20 },
  explainBuy(candidate: Candidate, portfolio: Portfolio) {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= this.config.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate, { allowManipulation: true })) reasons.push('hard_blocked');
    if (n(candidate.smartWalletFirstEntryCountChange) <= 0 && !String(candidate.smartWalletSignal || '').includes('SMART')) reasons.push('smart_entry_delta_missing');
    return reasons;
  },
  shouldBuy(candidate, portfolio) { return this.explainBuy!(candidate, portfolio).length === 0; },
  shouldSell(position: PaperPosition, candidate: Candidate) {
    if (candidate.liquidityDrainDetected || candidate.rugDetected || candidate.preDrainLevel === 'DRAIN') return { shouldSell: true, reason: 'hard_exit' };
    if (position.unrealizedPnlPct >= 100) return { shouldSell: true, reason: 'take_profit_100' };
    if (position.unrealizedPnlPct <= -35) return { shouldSell: true, reason: 'stop_loss_35' };
    if (n(candidate.smartWalletFirstEntryCountChange) < 0 || n(candidate.smartWalletNetFlow1h) < 0) return { shouldSell: true, reason: 'smart_wallet_exit' };
    return { shouldSell: false };
  },
};
export default strategy;
