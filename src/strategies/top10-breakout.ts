import { Candidate, Portfolio, Strategy } from '../types';
import { baseSell, hardBlocked, n } from './helpers';

function warningIncludes(candidate: Candidate, text: string): boolean {
  return (candidate.warnings || []).some((warning) => warning.toLowerCase().includes(text));
}

function shortVolumeIncreasing(candidate: Candidate): boolean {
  if (n(candidate.volume5mDelta) > 0 || n(candidate.volume15mDelta) > 0 || n(candidate.volume1hDelta) > 0) return true;
  if (n(candidate.volume5m) > 0 || n(candidate.volume15m) > 0) return true;
  return n(candidate.volume1h) > 0;
}

const strategy: Strategy = {
  name: 'TOP10_BREAKOUT',
  config: { positionSizeSol: 0.15, maxOpenPositions: 20 },
  explainBuy(candidate: Candidate, portfolio: Portfolio) {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= this.config.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate, { allowManipulation: true })) reasons.push('hard_blocked');
    if (candidate.lifecycleState === 'ARCHIVED') reasons.push('archived');
    const holdersUp = n(candidate.holderCountChange) > 0 || n(candidate.holderDeltaPct) > 0 || n(candidate.holderMomentum) > 0;
    const volumeUp = shortVolumeIncreasing(candidate);
    const top10 = n(candidate.top10HolderRate);
    const top10Down = n(candidate.top10HolderRateDelta) < 0 || candidate.top10Trend === 'DOWN';
    const top10Healthy = top10 > 0 && top10 <= 25 && holdersUp && volumeUp;
    if (!top10Down && !top10Healthy) reasons.push('top10_not_decreasing');
    if (!holdersUp) reasons.push('holders_not_increasing');
    if (!volumeUp) reasons.push('short_volume_not_increasing');
    if ((candidate.liquidityUsd ?? 0) < 10000) reasons.push('liquidity_below_10000');
    if ((candidate.sourceRank ?? Infinity) > 80) reasons.push('source_rank_above_80');
    if ((candidate.trashScore ?? 100) > 85) reasons.push('trash_above_85');
    if (candidate.liquidityDrainDetected || candidate.preDrainLevel === 'DRAIN') reasons.push('liquidity_drain');
    if (warningIncludes(candidate, 'top holder concentration is increasing')) reasons.push('top_holder_concentration_increasing');
    if (warningIncludes(candidate, 'volume/liquidity ratio looks distorted')) reasons.push('volume_liquidity_distorted');
    return [...new Set(reasons)];
  },
  shouldBuy(candidate, portfolio) { return this.explainBuy!(candidate, portfolio).length === 0; },
  shouldSell: (position, candidate) => baseSell(position, candidate, 100, -30),
};
export default strategy;
