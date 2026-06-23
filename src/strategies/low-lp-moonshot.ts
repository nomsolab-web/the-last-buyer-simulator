import { makeThresholdStrategy, earlyStates } from './helpers';
export default makeThresholdStrategy({ name: 'LOW_LP_MOONSHOT', discoveryMin: 0, trashMax: 95, liquidityMinUsd: 3000, lifecycleStates: earlyStates, positionSizeSol: 0.05, maxOpenPositions: 30, allowArchived: false, takeProfitPct: 200, stopLossPct: -40 });
