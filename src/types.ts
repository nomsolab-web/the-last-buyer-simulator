export type LifecycleState = 'DISCOVERY' | 'WATCH' | 'DECLINING' | 'ARCHIVED' | string;
export type PreDrainLevel = 'NONE' | 'WARN' | 'ALERT' | 'DRAIN' | string;

export interface SimulatorConfig {
  dataSource: string;
  initialCashSol: number;
  positionSizeSol: number;
  updateIntervalSeconds: number;
  cooldownMinutes: number;
  buyFeePct: number;
  sellFeePct: number;
  slippagePct: number;
}

export interface Candidate {
  symbol: string;
  address: string;
  priceUsd: number | null;
  discoveryScore: number | null;
  trashScore: number | null;
  lifecycleState: LifecycleState;
  liquidityUsd: number | null;
  top10HolderRate: number | null;
  holderMomentum: number | null;
  top10Trend: string;
  preDrainLevel: PreDrainLevel;
  noBuyReason: string | null;
  isAnomaly: boolean;
  isLikelyManipulation: boolean;
  liquidityDrainDetected: boolean;
  rugDetected: boolean;
  paperBuyCandidate: boolean;
  paperBuyReason: string[];
  paperNoBuyReason: string[];
  marketCap?: number | null;
  warnings?: string[];
  sourceRank?: number | null;
  candidateSource?: string | null;
  honeypotFree?: boolean | null;
  priceChange1h?: number | null;
  volume24h?: number | null;
  marketPhase?: string | null;
  pnlTrustLevel?: string | null;
  dataHealthLevel?: string | null;
  devRiskScore?: number | null;
  devRiskLevel?: string | null;
}

export interface LastBuyerReport {
  schemaVersion?: string;
  generatedBy?: string;
  generatedAt?: string;
  watchStatus?: string;
  candidates?: unknown[];
  active?: unknown[];
  allTokens?: unknown[];
}

export interface PaperPosition {
  symbol: string;
  address: string;
  entryTime: string;
  entryPriceUsd: number;
  idealEntryPriceUsd?: number;
  currentPriceUsd: number;
  realisticExitPriceUsd?: number;
  solAmount: number;
  tokenAmount: number;
  entryDiscoveryScore: number;
  currentDiscoveryScore: number;
  entryTrashScore: number;
  currentTrashScore: number;
  lifecycleState: string;
  unrealizedPnlPct: number;
  unrealizedPnlSol: number;
  idealPnlPct?: number;
  idealPnlSol?: number;
  realisticPnlPct?: number;
  realisticPnlSol?: number;
  reason: string;
  decliningStreak?: number;
  hit2xAt?: string | null;
  maxPnlPct?: number;
}

export interface Portfolio {
  cashSol: number;
  openPositions: PaperPosition[];
  realizedPnlSol: number;
  unrealizedPnlSol: number;
  totalEquitySol: number;
  updatedAt: string;
}

export interface Trade {
  timestamp: string;
  symbol: string;
  address: string;
  side: 'BUY' | 'SELL';
  priceUsd: number;
  idealPriceUsd?: number;
  solAmount: number;
  tokenAmount: number;
  reason: string;
  discoveryScore: number;
  trashScore: number;
  lifecycleState: string;
  pnlPct: number | null;
  pnlSol: number | null;
  idealPnlPct?: number | null;
  idealPnlSol?: number | null;
  realisticPnlPct?: number | null;
  realisticPnlSol?: number | null;
  sellSignalReason?: string | null;
  decliningStreakAtSell?: number | null;
  cooldownUntil?: string | null;
  holdMinutes?: number | null;
  hit2x?: boolean;
  timeTo2xMinutes?: number | null;
}

export interface PerformanceReport {
  updatedAt: string;
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  realizedPnlSol: number;
  unrealizedPnlSol: number;
  totalEquitySol: number;
  maxDrawdownPct: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  averageWinPct: number | null;
  averageLossPct: number | null;
}

export interface ExitSimulationEntry {
  symbol: string;
  address: string;
  entryTime: string;
  entryPriceUsd: number;
  rule: string;
  exitTime: string | null;
  exitPriceUsd: number | null;
  pnlPct: number | null;
  pnlSol: number | null;
  sellSignalReason?: string | null;
  decliningStreakAtSell?: number | null;
  cooldownUntil?: string | null;
}

export interface ReviewLogEntry {
  timestamp: string;
  reviewer: 'human' | 'gemini' | 'system';
  symbol: string;
  address: string;
  action: 'WATCH' | 'SKIP' | 'PAPER_BUY' | 'PAPER_SELL';
  confidence: number | null;
  bullishReasons: string[];
  bearishReasons: string[];
  anomalyDetected: string | null;
}

export interface BuyRejectionEntry {
  symbol: string;
  address: string;
  discoveryScore: number | null;
  trashScore: number | null;
  lifecycleState: string;
  paperBuyCandidate: boolean;
  rejectionReasons: string[];
}

export interface BuyRejectionReport {
  updatedAt: string;
  totalCandidates: number;
  paperBuyCandidates: number;
  rejectionSummary: Record<string, number>;
  candidates: BuyRejectionEntry[];
}

export type StrategyName = 'STRICT' | 'BALANCED' | 'AGGRESSIVE' | 'DEGEN' | 'ULTRA_DEGEN' | 'GAMBLER_2X';

export interface StrategyRuleSet {
  name: StrategyName;
  discoveryMin: number;
  trashMax: number;
  liquidityMinUsd: number;
  top10MaxPct?: number;
  sourceRankMax?: number;
  lifecycleStates: string[];
  positionSizeSol?: number;
  maxHoldHours?: number;
  requirePositive1h?: boolean;
  requireVolume?: boolean;
  blockNoBuyReason?: boolean;
  blockAlert?: boolean;
  blockManipulation?: boolean;
  manipulationSizeSol?: number;
  sellMode: 'CURRENT' | 'GAMBLER_2X';
}

export interface StrategyStateEntry {
  portfolio: Portfolio;
  trades: Trade[];
  oldPortfolio?: Portfolio;
  oldTrades?: Trade[];
  cooldowns?: Record<string, string>;
}

export type StrategyState = Record<StrategyName, StrategyStateEntry>;

export interface StrategyRuleResult {
  cashSol: number;
  openPositions: number;
  closedTrades: number;
  totalEquitySol: number;
  realizedPnlSol: number;
  unrealizedPnlSol: number;
  winRate: number;
  maxDrawdown: number;
  buyCount: number;
}

export interface StrategyPerformanceEntry {
  name: StrategyName;
  cashSol: number;
  openPositions: number;
  closedTrades: number;
  tradeCount: number;
  totalEquitySol: number;
  realizedPnlSol: number;
  unrealizedPnlSol: number;
  realisticPnlSol: number;
  winRate: number;
  maxDrawdown: number;
  buyCount: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  averageHoldMinutes: number | null;
  hit2xCount: number;
  hit2xRate: number;
  avgTimeTo2xMinutes: number | null;
  oldRuleResult: StrategyRuleResult;
  newRuleResult: StrategyRuleResult;
  preventedEarlySellCount: number;
  cooldownBlockedBuyCount: number;
  rejectionSummary: Record<string, number>;
}

export interface StrategyPerformanceReport {
  updatedAt: string;
  strategies: StrategyPerformanceEntry[];
}

export interface SimulatorLogEntry {
  timestamp: string;
  buys: number;
  sells: number;
  openPositions: number;
  skipped: Array<{ symbol: string; address: string; reasons: string[] }>;
}