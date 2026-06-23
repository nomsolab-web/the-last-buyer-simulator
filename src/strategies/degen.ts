import { makeThresholdStrategy, earlyStates } from './helpers';
export default makeThresholdStrategy({ name: 'DEGEN', discoveryMin: 50, trashMax: 75, liquidityMinUsd: 5000, sourceRankMax: 50, lifecycleStates: earlyStates, positionSizeSol: 0.25, maxOpenPositions: 20, blockManipulation: true });
