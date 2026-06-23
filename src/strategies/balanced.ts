import { makeThresholdStrategy, activeStates } from './helpers';
export default makeThresholdStrategy({ name: 'BALANCED', discoveryMin: 75, trashMax: 45, liquidityMinUsd: 20000, top10MaxPct: 50, lifecycleStates: activeStates, positionSizeSol: 0.5, maxOpenPositions: 10, blockAlert: true, blockManipulation: true });
