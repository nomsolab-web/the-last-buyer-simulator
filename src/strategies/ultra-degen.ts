import { makeThresholdStrategy, earlyStates } from './helpers';
export default makeThresholdStrategy({ name: 'ULTRA_DEGEN', discoveryMin: 40, trashMax: 85, liquidityMinUsd: 3000, sourceRankMax: 30, lifecycleStates: earlyStates, positionSizeSol: 0.1, maxOpenPositions: 25, allowArchived: false });
