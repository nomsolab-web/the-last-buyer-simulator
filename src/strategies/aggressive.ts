import { makeThresholdStrategy, activeStates } from './helpers';
export default makeThresholdStrategy({ name: 'AGGRESSIVE', discoveryMin: 65, trashMax: 60, liquidityMinUsd: 10000, top10MaxPct: 60, lifecycleStates: activeStates, positionSizeSol: 0.5, maxOpenPositions: 15, blockAlert: true, blockManipulation: true });
