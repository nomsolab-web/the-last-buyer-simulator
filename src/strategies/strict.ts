import { makeThresholdStrategy, activeStates } from './helpers';
export default makeThresholdStrategy({ name: 'STRICT', discoveryMin: 85, trashMax: 30, liquidityMinUsd: 30000, top10MaxPct: 40, lifecycleStates: activeStates, positionSizeSol: 0.5, maxOpenPositions: 5, blockAlert: true, blockManipulation: true });
