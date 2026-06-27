import { Candidate, PaperPosition, Portfolio, Strategy } from '../types';
import { hardBlocked, n } from './helpers';

function warningIncludes(candidate: Candidate, text: string): boolean {
  return (candidate.warnings || []).some((warning) => warning.toLowerCase().includes(text));
}

function hasMomentum(candidate: Candidate): boolean {
  return n(candidate.holderMomentum) >= 0.05
    || n(candidate.holderDeltaPct) >= 0.05
    || n(candidate.holderCountChange) >= 3;
}

function hasVolume(candidate: Candidate): boolean {
  return n(candidate.volume5m) > 0
    || n(candidate.volume15m) > 0
    || n(candidate.volume1h) > 0
    || n(candidate.volume24h) > 0;
}

const strategy: Strategy = {
  name: 'FOMO',
  config: { positionSizeSol: 0.1, maxOpenPositions: 8 },
  explainBuy(candidate: Candidate, portfolio: Portfolio) {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= this.config.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate, { blockAlert: true })) reasons.push('hard_blocked');
    if (!['DISCOVERY', 'WATCH'].includes(candidate.lifecycleState)) reasons.push('lifecycle_not_active');
    if ((candidate.liquidityUsd ?? 0) < 30000) reasons.push('liquidity_below_30000');
    if ((candidate.sourceRank ?? Infinity) > 60) reasons.push('source_rank_above_60');
    if ((candidate.trashScore ?? 100) > 70) reasons.push('trash_above_70');
    if (!hasMomentum(candidate)) reasons.push('momentum_below_threshold');
    if (!hasVolume(candidate)) reasons.push('volume_spike_missing');
    if (warningIncludes(candidate, 'volume/liquidity ratio looks distorted')) reasons.push('volume_liquidity_distorted');
    if (warningIncludes(candidate, 'top holder concentration is increasing')) reasons.push('top_holder_concentration_increasing');
    if (warningIncludes(candidate, 'liquidity is too thin')) reasons.push('liquidity_too_thin');
    if (warningIncludes(candidate, 'high bundler')) reasons.push('high_bundler');
    return [...new Set(reasons)];
  },
  shouldBuy(candidate, portfolio) { return this.explainBuy!(candidate, portfolio).length === 0; },
  shouldSell(position: PaperPosition, candidate: Candidate) {
    if (candidate.liquidityDrainDetected || candidate.rugDetected || candidate.preDrainLevel === 'DRAIN') return { shouldSell: true, reason: 'hard_exit' };
    if (position.unrealizedPnlPct >= 80) return { shouldSell: true, reason: 'take_profit_80' };
    if (position.unrealizedPnlPct <= -30) return { shouldSell: true, reason: 'stop_loss_30' };
    if (n(candidate.holderMomentum) <= 0 && n(candidate.holderDeltaPct) <= 0) return { shouldSell: true, reason: 'momentum_lost' };
    return { shouldSell: false };
  },
};
export default strategy;