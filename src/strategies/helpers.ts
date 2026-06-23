import { Candidate, PaperPosition, Portfolio, SellDecision, Strategy } from '../types';

export const activeStates = ['DISCOVERY', 'WATCH'];
export const earlyStates = ['DISCOVERY', 'WATCH', 'DECLINING'];

export function n(value: number | null | undefined, fallback = 0): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function top10Pct(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(value) <= 1 ? Number(value) * 100 : Number(value);
}

export function hoursHeld(position: PaperPosition): number {
  return (Date.now() - Date.parse(position.entryTime)) / 3600000;
}

export function hardBlocked(candidate: Candidate, options: { allowManipulation?: boolean; allowArchived?: boolean; blockAlert?: boolean } = {}): boolean {
  if (candidate.rugDetected || candidate.liquidityDrainDetected || candidate.preDrainLevel === 'DRAIN') return true;
  if (candidate.honeypotFree === false) return true;
  if (!options.allowArchived && candidate.lifecycleState === 'ARCHIVED') return true;
  if (!options.allowManipulation && candidate.isLikelyManipulation) return true;
  if (options.blockAlert && candidate.preDrainLevel === 'ALERT') return true;
  if (!candidate.priceUsd || candidate.priceUsd <= 0) return true;
  return false;
}

export function baseSell(position: PaperPosition, candidate: Candidate, takeProfitPct = 50, stopLossPct = -30): SellDecision {
  if (candidate.lifecycleState === 'ARCHIVED') return { shouldSell: true, reason: 'archived' };
  if (candidate.preDrainLevel === 'DRAIN' || candidate.liquidityDrainDetected) return { shouldSell: true, reason: 'liquidity_drain' };
  if (candidate.rugDetected) return { shouldSell: true, reason: 'rug_detected' };
  if (position.unrealizedPnlPct >= takeProfitPct) return { shouldSell: true, reason: 'take_profit' };
  if (position.unrealizedPnlPct <= stopLossPct) return { shouldSell: true, reason: 'stop_loss' };
  if (candidate.lifecycleState === 'DECLINING' && (position.decliningStreak || 0) >= 2) return { shouldSell: true, reason: 'declining_streak_2' };
  return { shouldSell: false };
}

export function makeThresholdStrategy(params: {
  name: string;
  discoveryMin: number;
  trashMax: number;
  liquidityMinUsd: number;
  top10MaxPct?: number;
  sourceRankMax?: number;
  lifecycleStates: string[];
  positionSizeSol: number;
  maxOpenPositions: number;
  blockAlert?: boolean;
  blockManipulation?: boolean;
  allowArchived?: boolean;
  takeProfitPct?: number;
  stopLossPct?: number;
}): Strategy {
  const explainBuy = (candidate: Candidate, portfolio: Portfolio): string[] => {
    const reasons: string[] = [];
    if (portfolio.openPositions.length >= params.maxOpenPositions) reasons.push('max_positions_reached');
    if (hardBlocked(candidate, { allowArchived: params.allowArchived, allowManipulation: !params.blockManipulation, blockAlert: params.blockAlert })) reasons.push('hard_blocked');
    if ((candidate.discoveryScore ?? 0) < params.discoveryMin) reasons.push('discovery_below_threshold');
    if ((candidate.trashScore ?? 100) > params.trashMax) reasons.push('trash_above_threshold');
    if ((candidate.liquidityUsd ?? 0) < params.liquidityMinUsd) reasons.push('liquidity_below_threshold');
    if (params.sourceRankMax !== undefined && (candidate.sourceRank ?? Infinity) > params.sourceRankMax) reasons.push('source_rank_above_threshold');
    if (params.top10MaxPct !== undefined) {
      const top10 = top10Pct(candidate.top10HolderRate);
      if (top10 === null || top10 > params.top10MaxPct) reasons.push('top10_above_threshold');
    }
    if (!params.lifecycleStates.includes(candidate.lifecycleState)) reasons.push('lifecycle_not_allowed');
    return [...new Set(reasons)];
  };
  return {
    name: params.name,
    config: { positionSizeSol: params.positionSizeSol, maxOpenPositions: params.maxOpenPositions },
    explainBuy,
    shouldBuy(candidate, portfolio) {
      return explainBuy(candidate, portfolio).length === 0;
    },
    shouldSell(position, candidate) {
      return baseSell(position, candidate, params.takeProfitPct ?? 50, params.stopLossPct ?? -30);
    },
  };
}
