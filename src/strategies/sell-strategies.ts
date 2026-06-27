import { Candidate, PaperPosition, SellDecision, Strategy } from '../types';
import { antiStuckExit, baseSell, hoursHeld, n } from './helpers';

export interface SellStrategy {
  name: string;
  shouldSell(position: PaperPosition, candidate: Candidate): SellDecision;
}

function hardExit(candidate: Candidate): SellDecision | null {
  if (candidate.lifecycleState === 'ARCHIVED') return { shouldSell: true, reason: 'archived' };
  if (candidate.preDrainLevel === 'DRAIN' || candidate.liquidityDrainDetected) return { shouldSell: true, reason: 'liquidity_drain' };
  if (candidate.rugDetected) return { shouldSell: true, reason: 'rug_detected' };
  return null;
}

export const sellStrategies: SellStrategy[] = [
  {
    name: 'TP50_SL30',
    shouldSell(position, candidate) {
      return baseSell(position, candidate, 50, -30);
    },
  },
  {
    name: 'MOMENTUM_EXIT',
    shouldSell(position, candidate) {
      const hard = hardExit(candidate);
      if (hard) return hard;
      const stuck = antiStuckExit(position, { profitTakePct: 75, maxHoldHours: 6, staleProfitHours: 2, trailingStartPct: 35, trailingGivebackPct: 18 });
      if (stuck) return stuck;
      if (position.unrealizedPnlPct >= 100) return { shouldSell: true, reason: 'take_profit_100' };
      if (position.unrealizedPnlPct <= -35) return { shouldSell: true, reason: 'stop_loss_35' };
      if (n(candidate.holderMomentum) <= 0 && n(candidate.holderDeltaPct) <= 0) return { shouldSell: true, reason: 'momentum_lost' };
      if (hoursHeld(position) >= 3) return { shouldSell: true, reason: 'max_hold_3h' };
      return { shouldSell: false };
    },
  },
  {
    name: 'FAST_15M',
    shouldSell(position, candidate) {
      const hard = hardExit(candidate);
      if (hard) return hard;
      if (position.unrealizedPnlPct >= 40) return { shouldSell: true, reason: 'take_profit_40' };
      if (position.unrealizedPnlPct <= -25) return { shouldSell: true, reason: 'stop_loss_25' };
      if (hoursHeld(position) >= 0.25) return { shouldSell: true, reason: 'max_hold_15m' };
      return { shouldSell: false };
    },
  },
];

export function composeStrategy(buyStrategy: Strategy, sellStrategy: SellStrategy): Strategy {
  return {
    name: `${buyStrategy.name}__SELL_${sellStrategy.name}`,
    config: { ...buyStrategy.config },
    explainBuy(candidate, portfolio) {
      return buyStrategy.explainBuy
        ? buyStrategy.explainBuy(candidate, portfolio)
        : buyStrategy.shouldBuy(candidate, portfolio)
          ? []
          : ['buy_strategy_rejected'];
    },
    shouldBuy(candidate, portfolio) {
      return buyStrategy.shouldBuy(candidate, portfolio);
    },
    shouldSell(position, candidate) {
      return sellStrategy.shouldSell(position, candidate);
    },
  };
}
