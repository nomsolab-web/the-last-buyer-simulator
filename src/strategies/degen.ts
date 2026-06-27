import { makeThresholdStrategy, earlyStates } from './helpers';
export default makeThresholdStrategy({ name: 'DEGEN', discoveryMin: 35, trashMax: 85, liquidityMinUsd: 10000, sourceRankMax: 80, lifecycleStates: earlyStates, positionSizeSol: 0.25, maxOpenPositions: 20, blockManipulation: true });
