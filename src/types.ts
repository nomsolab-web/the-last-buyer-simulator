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
  volume1h?: number | null;
  volume24h?: number | null;
  volume5m?: number | null;
  volume15m?: number | null;
  volume1hDelta?: number | null;
  volume5mDelta?: number | null;
  volume15mDelta?: number | null;
  marketPhase?: string | null;
  pnlTrustLevel?: string | null;
  dataHealthLevel?: string | null;
  devRiskScore?: number | null;
  devRiskLevel?: string | null;
  holderCount?: number | null;
  holderDeltaPct?: number | null;
  holderCountChange?: number | null;
  liquidityUsdDeltaPct?: number | null;
  lpRetentionRate24h?: number | null;
  bundlerRate?: number | null;
  sniperCount?: number | null;
  smartWalletSignal?: string | null;
  smartWalletFirstEntryCountChange?: number | null;
  smartWalletNetFlow1h?: number | null;
  top10HolderRateDelta?: number | null;
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
  entryRank?: number | null;
  entryLiquidity?: number | null;
  entryTop10?: number | null;
  entryHolderCount?: number | null;
  entryHolderMomentum?: number | null;
  entryBundlerRate?: number | null;
  entrySniperCount?: number | null;
}

export type Position = PaperPosition;

export interface Portfolio {
  cashSol: number;
  openPositions: PaperPosition[];
  realizedPnlSol: number;
  unrealizedPnlSol: number;
  totalEquitySol: number;
  updatedAt: string;
}

export interface SellDecision {
  shouldSell: boolean;
  reason?: string;
}

export interface Strategy {
  name: string;
  shouldBuy(candidate: Candidate, portfolio: Portfolio): boolean;
  shouldSell(position: Position, candidate: Candidate): SellDecision;
  explainBuy?(candidate: Candidate, portfolio: Portfolio): string[];
  config: {
    positionSizeSol: number;
    maxOpenPositions: number;
  };
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
  exitLiquidity?: number | null;
  exitLiquidityToSellRatio?: number | null;
  fillableExit?: boolean | null;
  unfillableReason?: string | null;
  entryTime?: string | null;
  entryRank?: number | null;
  entryLiquidity?: number | null;
  entryTop10?: number | null;
  entryHolderCount?: number | null;
  entryHolderMomentum?: number | null;
  entryBundlerRate?: number | null;
  entrySniperCount?: number | null;
}

export interface PerformanceReport {
  updatedAt: string;
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  realizedPnlSol: number;
  unrealizedPnlSol: number;
  totalEquitySol: number;
  rawEquitySol: number;
  realEquitySol: number;
  maxDrawdownPct: number;
  profitFactor: number | null;
  averageWinPct: number | null;
  averageLossPct: number | null;
  averageHoldMinutes: number | null;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  rawPnlSol: number;
  realPnlSol: number;
  fillablePnlSol: number;
  fillableExitRate: number;
  unfillableWinCount: number;
  liquidityDrainExitCount: number;
  unfillableWins: number;
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

export interface StrategyStateEntry {
  portfolio: Portfolio;
  trades: Trade[];
  cooldowns?: Record<string, string>;
}

export type StrategyState = Record<string, StrategyStateEntry>;

export interface StrategyRuleResult {
  cashSol: number;
  openPositions: number;
  closedTrades: number;
  totalEquitySol: number;
  rawEquitySol: number;
  realEquitySol: number;
  realizedPnlSol: number;
  unrealizedPnlSol: number;
  winRate: number;
  maxDrawdown: number;
  buyCount: number;
}

export interface StrategyPerformanceEntry {
  name: string;
  cashSol: number;
  openPositions: number;
  closedTrades: number;
  tradeCount: number;
  totalEquitySol: number;
  rawEquitySol: number;
  realEquitySol: number;
  realizedPnlSol: number;
  unrealizedPnlSol: number;
  realisticPnlSol: number;
  rawPnlSol: number;
  realPnlSol: number;
  fillablePnlSol: number;
  fillableExitRate: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number | null;
  averageWinPct: number | null;
  averageLossPct: number | null;
  averageHoldMinutes: number | null;
  buyCount: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  hit2xCount: number;
  fillable2xCount: number;
  hit2xRate: number;
  avgTimeTo2xMinutes: number | null;
  oldRuleResult: StrategyRuleResult;
  newRuleResult: StrategyRuleResult;
  preventedEarlySellCount: number;
  cooldownBlockedBuyCount: number;
  unfillableWinCount: number;
  liquidityDrainExitCount: number;
  unfillableWins: number;
  fillableWinRate: number;
  rejectionSummary: Record<string, number>;
}

export interface StrategyPerformanceReport {
  updatedAt: string;
  strategies: StrategyPerformanceEntry[];
}

export interface StrategyLeagueEntry {
  rank: number;
  rawRank: number;
  realRank: number;
  rankDelta: number;
  strategy: string;
  strategyName: string;
  rawEquity: number;
  realEquity: number;
  rawEquitySol: number;
  realEquitySol: number;
  totalEquitySol: number;
  rawPnL: number;
  realPnL: number;
  realisticPnlSol: number;
  rawPnlSol: number;
  realPnlSol: number;
  fillablePnlSol: number;
  tradeCount: number;
  winRate: number;
  fillableExitRate: number;
  profitFactor: number | null;
  fillable2xCount: number;
  unfillableWinCount: number;
  liquidityDrainExitCount: number;
  unfillableWins: number;
}

export interface StrategyLeagueReport {
  updatedAt: string;
  strategies: StrategyLeagueEntry[];
}

export interface Top10BreakoutFocusEntry {
  strategyName: string;
  rawPnL: number;
  fillablePnL: number;
  realPnL: number;
  unfillableWinCount: number;
  liquidityDrainExitCount: number;
  buyCount: number;
  tradeCount: number;
  hit2xCount: number;
  avgTimeTo2xMinutes: number | null;
  fillable2xCount: number;
  suspiciousLiquidityDrainWinCount: number;
}

export interface Top10BreakoutReport {
  updatedAt: string;
  candidateCount: number;
  actualBuyCount: number;
  hit2xCount: number;
  avgTimeTo2xMinutes: number | null;
  fillable2xCount: number;
  suspiciousLiquidityDrainWinCount: number;
  focusedExits: Top10BreakoutFocusEntry[];
}

export interface AnalysisEntry {
  symbol: string;
  address: string;
  entryTime: string;
  entryDiscovery: number | null;
  entryTrash: number | null;
  entryRank: number | null;
  entryLiquidity: number | null;
  entryTop10: number | null;
  entryHolderCount: number | null;
  entryHolderMomentum: number | null;
  entryBundlerRate: number | null;
  entrySniperCount: number | null;
  entryLifecycle: string;
  timeTo2xMinutes: number | null;
  maxGainPct: number;
  exitLiquidity: number | null;
  exitLiquidityToSellRatio: number | null;
  fillableWin: boolean | null;
  unfillableReason: string | null;
}

export interface MoonshotReport {
  updatedAt: string;
  totalMoonshots: number;
  avgDiscovery: number | null;
  avgTrash: number | null;
  avgLiquidity: number | null;
  avgHolderMomentum: number | null;
  avgTop10: number | null;
  avgBundlerRate: number | null;
  avgSniperCount: number | null;
  avgSourceRank: number | null;
  lifecycleDistribution: Record<string, number>;
}

export interface SimulatorLogEntry {
  timestamp: string;
  buys: number;
  sells: number;
  openPositions: number;
  skipped: Array<{ symbol: string; address: string; reasons: string[] }>;
}
