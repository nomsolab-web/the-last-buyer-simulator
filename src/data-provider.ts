import fs from 'fs/promises';
import path from 'path';
import { Candidate, LastBuyerReport, SimulatorConfig } from './types';

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), 'config.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toBool(value: unknown): boolean {
  return value === true;
}

function toBoolOrNull(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = toNumberOrNull(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

function nestedNumber(value: unknown, key: string): number | null {
  return isRecord(value) ? toNumberOrNull(value[key]) : null;
}
export function normalizeCandidate(value: unknown): Candidate | null {
  if (!isRecord(value)) return null;
  const symbol = typeof value.symbol === 'string' ? value.symbol : '';
  const address = typeof value.address === 'string'
    ? value.address
    : typeof value.contractAddress === 'string'
      ? value.contractAddress
      : '';
  if (!symbol || !address) return null;

  return {
    symbol,
    address,
    priceUsd: firstNumber(value.priceUsd, value.price, value.currentPriceUsd),
    discoveryScore: toNumberOrNull(value.discoveryScore),
    trashScore: toNumberOrNull(value.trashScore),
    lifecycleState: typeof value.lifecycleState === 'string' ? value.lifecycleState : typeof value.state === 'string' ? value.state : 'DISCOVERY',
    liquidityUsd: toNumberOrNull(value.liquidityUsd),
    top10HolderRate: toNumberOrNull(value.top10HolderRate ?? value.top10),
    holderMomentum: toNumberOrNull(value.holderMomentum),
    top10Trend: typeof value.top10Trend === 'string' ? value.top10Trend : 'UNKNOWN',
    preDrainLevel: typeof value.preDrainLevel === 'string' ? value.preDrainLevel : toBool(value.liquidityDrainDetected) ? 'DRAIN' : toBool(value.preDrainAlert) ? 'ALERT' : 'NONE',
    noBuyReason: typeof value.noBuyReason === 'string' ? value.noBuyReason : null,
    isAnomaly: toBool(value.isAnomaly),
    isLikelyManipulation: toBool(value.isLikelyManipulation),
    liquidityDrainDetected: toBool(value.liquidityDrainDetected),
    rugDetected: toBool(value.rugDetected),
    paperBuyCandidate: toBool(value.paperBuyCandidate),
    paperBuyReason: Array.isArray(value.paperBuyReason) ? value.paperBuyReason.map(String) : [],
    paperNoBuyReason: Array.isArray(value.paperNoBuyReason) ? value.paperNoBuyReason.map(String) : [],
    marketCap: firstNumber(value.marketCap, value.mc, value.marketCapUsd),
    sourceRank: firstNumber(value.sourceRank, value.rank, value.gmgnRank),
    candidateSource: typeof value.candidateSource === 'string' ? value.candidateSource : typeof value.source === 'string' ? value.source : null,
    honeypotFree: toBoolOrNull(value.honeypotFree ?? value.isHoneypotFree),
    priceChange1h: firstNumber(value.priceChange1h, value.priceChange1hPct, value.change1h, nestedNumber(value.priceChange, '1h')),
    volume1h: firstNumber(value.volume1h, value.volume1hUsd, value.volumeUsd1h),
    volume24h: firstNumber(value.volume24h, value.volume24hUsd, value.volume, value.volumeUsd24h),
    volume5m: firstNumber(value.volume5m, value.volume_5m, value.volume5mUsd, value.volume_5m_usd),
    volume15m: firstNumber(value.volume15m, value.volume_15m, value.volume15mUsd, value.volume_15m_usd),
    volume1hDelta: firstNumber(value.volume1hDelta, value.volume1hChange, value.volumeDelta1h),
    volume5mDelta: firstNumber(value.volume5mDelta, value.volume5mChange, value.volumeDelta5m),
    volume15mDelta: firstNumber(value.volume15mDelta, value.volume15mChange, value.volumeDelta15m),
    marketPhase: typeof value.marketPhase === 'string' ? value.marketPhase : null,
    pnlTrustLevel: isRecord(value.pnlTrust) && typeof value.pnlTrust.level === 'string' ? value.pnlTrust.level : null,
    dataHealthLevel: isRecord(value.dataHealth) && typeof value.dataHealth.level === 'string' ? value.dataHealth.level : null,
    devRiskScore: firstNumber(value.devRiskScore),
    devRiskLevel: typeof value.devRiskLevel === 'string' ? value.devRiskLevel : null,
    holderCount: firstNumber(value.holderCount, value.holders),
    holderDeltaPct: firstNumber(value.holderDeltaPct, value.holderMomentum),
    holderCountChange: firstNumber(value.holderCountChange, value.holderDelta),
    liquidityUsdDeltaPct: firstNumber(value.liquidityUsdDeltaPct),
    lpRetentionRate24h: firstNumber(value.lpRetentionRate24h),
    top10HolderRateDelta: firstNumber(value.top10HolderRateDelta, value.top10HolderRateChange),
    smartWalletFirstEntryCountChange: firstNumber(value.smartWalletFirstEntryCountChange, value.smartWalletEntryDelta),
    smartWalletNetFlow1h: firstNumber(value.smartWalletNetFlow1h),
    bundlerRate: firstNumber(value.bundlerRate, value.bundler),
    sniperCount: firstNumber(value.sniperCount, value.sniper),
    smartWalletSignal: typeof value.smartWalletSignal === 'string' ? value.smartWalletSignal : null,
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : [],
  };
}

export async function loadSimulatorConfig(configPath = DEFAULT_CONFIG_PATH): Promise<SimulatorConfig> {
  const raw = JSON.parse((await fs.readFile(configPath, 'utf8')).replace(/^\uFEFF/, ''));
  if (!isRecord(raw) || typeof raw.dataSource !== 'string' || raw.dataSource.trim() === '') {
    throw new Error(`Invalid simulator config: ${configPath}`);
  }
  return {
    dataSource: raw.dataSource,
    initialCashSol: toNumberOrNull(raw.initialCashSol) ?? 10,
    positionSizeSol: toNumberOrNull(raw.positionSizeSol) ?? 0.5,
    updateIntervalSeconds: toNumberOrNull(raw.updateIntervalSeconds) ?? 180,
    cooldownMinutes: toNumberOrNull(raw.cooldownMinutes) ?? 30,
    buyFeePct: toNumberOrNull(raw.buyFeePct) ?? 0.5,
    sellFeePct: toNumberOrNull(raw.sellFeePct) ?? 0.5,
    slippagePct: toNumberOrNull(raw.slippagePct) ?? 2.0,
  };
}

export function resolveDataSourcePath(dataSource: string, configPath = DEFAULT_CONFIG_PATH): string {
  return path.isAbsolute(dataSource)
    ? dataSource
    : path.resolve(path.dirname(configPath), dataSource);
}

export async function loadReportCandidates(configPath = DEFAULT_CONFIG_PATH): Promise<Candidate[]> {
  const config = await loadSimulatorConfig(configPath);
  const sourcePath = resolveDataSourcePath(config.dataSource, configPath);
  const report = JSON.parse((await fs.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '')) as LastBuyerReport;
  const source = Array.isArray(report.allTokens) && report.allTokens.length > 0
    ? report.allTokens
    : Array.isArray(report.candidates) && report.candidates.length > 0
      ? report.candidates
      : Array.isArray(report.active)
        ? report.active
        : [];

  return source
    .map(normalizeCandidate)
    .filter((candidate): candidate is Candidate => candidate !== null);
}
export async function loadCandidatesFromReportPath(sourcePath: string): Promise<Candidate[]> {
  const report = JSON.parse((await fs.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '')) as LastBuyerReport;
  const source = Array.isArray(report.allTokens) && report.allTokens.length > 0
    ? report.allTokens
    : Array.isArray(report.candidates) && report.candidates.length > 0
      ? report.candidates
      : Array.isArray(report.active)
        ? report.active
        : [];

  return source
    .map(normalizeCandidate)
    .filter((candidate): candidate is Candidate => candidate !== null);
}
