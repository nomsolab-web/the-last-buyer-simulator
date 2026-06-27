import fs from 'fs/promises';
import path from 'path';
import { loadCandidatesFromReportPath } from './data-provider';
import { loadStrategies } from './strategies';
import { Candidate, PaperPosition, Portfolio, SimulatorConfig, Strategy, Trade } from './types';

const DATA_DIR = process.env.LAST_BUYER_DATA_DIR || 'D:/last-buyer-data';
const OUT_DIR = path.join(DATA_DIR, 'simulator');
const INDEX_PATH = path.join(DATA_DIR, 'report-snapshot-index.jsonl');
const INITIAL_CASH = Number(process.env.REPLAY_INITIAL_CASH || 10);
const BUY_FEE_PCT = Number(process.env.REPLAY_BUY_FEE_PCT || 0.5);
const SELL_FEE_PCT = Number(process.env.REPLAY_SELL_FEE_PCT || 0.5);
const SLIPPAGE_PCT = Number(process.env.REPLAY_SLIPPAGE_PCT || 2);
const LIMIT = Number(process.env.REPLAY_LIMIT || 0);
const SINCE = process.env.REPLAY_SINCE ? Date.parse(process.env.REPLAY_SINCE) : null;
const UNTIL = process.env.REPLAY_UNTIL ? Date.parse(process.env.REPLAY_UNTIL) : null;

type RawItem = Record<string, unknown>;
type Seen = Record<string, { holderCount: number | null; top10: number | null; volume: number | null; liquidity: number | null }>;
type Entry = { checkedAt: string; path: string; candidates?: number; active?: number; allTokens?: number };
type State = { portfolio: Portfolio; trades: Trade[] };

function normalizeSnapshotTime(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+JST$/);
  return match ? `${match[1]}T${match[2]}+09:00` : value;
}

function parseSnapshotTime(value: string): number {
  const parsed = Date.parse(normalizeSnapshotTime(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

const round = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d;
const mins = (a: string, b: string) => round((Date.parse(b) - Date.parse(a)) / 60000, 2);
const n = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const maybe = (v: unknown): number | null => Number.isFinite(Number(v)) ? Number(v) : null;
const key = (v: { address: string; symbol: string }) => v.address || v.symbol;
const buyMul = () => 1 + (BUY_FEE_PCT + SLIPPAGE_PCT) / 100;
const sellMul = () => 1 - (SELL_FEE_PCT + SLIPPAGE_PCT) / 100;

function emptyPortfolio(t: string): Portfolio {
  return { cashSol: INITIAL_CASH, openPositions: [], realizedPnlSol: 0, unrealizedPnlSol: 0, totalEquitySol: INITIAL_CASH, updatedAt: t };
}

function rawArray(snapshot: unknown): RawItem[] {
  const root = snapshot as any;
  const data = root?.response?.data?.data?.data ?? root?.response?.data?.data ?? root?.data;
  const arr = data?.rank ?? data?.list ?? data;
  return Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object') as RawItem[] : [];
}

function scoreDiscovery(item: RawItem): number {
  const rank = n(item.rank, n(item.id, 100));
  const hot = n(item.hot_level);
  const smart = n(item.smart_degen_count) + n(item.renowned_count) * 2;
  const volume = Math.log10(Math.max(1, n(item.volume))) * 8;
  return Math.max(0, Math.min(100, round(80 - rank * 0.65 + hot * 6 + smart + volume, 0)));
}

function scoreTrash(item: RawItem): number {
  let score = 0;
  const liquidity = n(item.liquidity);
  const rug = n(item.rug_ratio);
  const bundler = n(item.bundler_rate);
  const sniper = n(item.sniper_count);
  const top10 = n(item.top_10_holder_rate);
  if (rug >= 0.95) score += 85; else score += rug * 50;
  if (liquidity < 3000) score += 45; else if (liquidity < 10000) score += 25; else if (liquidity < 15000) score += 10;
  if (bundler >= 0.35) score += 25; else if (bundler >= 0.25) score += 12;
  if (sniper >= 40) score += 15; else if (sniper >= 20) score += 7;
  if (top10 >= 0.8) score += 20;
  if (n(item.is_honeypot) > 0) score += 100;
  if (item.is_wash_trading === true) score += 25;
  return Math.max(0, Math.min(100, round(score, 0)));
}

function lifecycle(item: RawItem, trash: number): string {
  if (n(item.liquidity) < 3000 || n(item.is_honeypot) > 0) return 'ARCHIVED';
  if (trash >= 100) return 'DECLINING';
  if (n(item.price_change_percent5m) < -35) return 'DECLINING';
  if (n(item.rank, 999) <= 30) return 'WATCH';
  return 'DISCOVERY';
}

function toCandidate(item: RawItem, rank: number, seen: Seen): Candidate | null {
  const address = String(item.address || item.contractAddress || '');
  const symbol = String(item.symbol || item.name || '');
  if (!address || !symbol) return null;
  const prev = seen[address];
  const holderCount = maybe(item.holder_count);
  const top10 = maybe(item.top_10_holder_rate);
  const volume = maybe(item.volume);
  const liquidity = maybe(item.liquidity);
  const holderDeltaPct = prev?.holderCount && holderCount !== null ? ((holderCount - prev.holderCount) / Math.max(1, prev.holderCount)) * 100 : 0;
  const top10Delta = prev?.top10 !== null && prev?.top10 !== undefined && top10 !== null ? (top10 - prev.top10) * 100 : 0;
  const volumeDelta = prev?.volume && volume !== null ? ((volume - prev.volume) / Math.max(1, prev.volume)) * 100 : 0;
  const liquidityDelta = prev?.liquidity && liquidity !== null ? ((liquidity - prev.liquidity) / Math.max(1, prev.liquidity)) * 100 : 0;
  const trash = scoreTrash(item);
  const life = lifecycle(item, trash);
  const drain = liquidityDelta <= -70 || life === 'ARCHIVED';
  const preDrain = drain ? 'DRAIN' : liquidityDelta <= -35 ? 'ALERT' : 'NONE';
  return {
    symbol,
    address,
    priceUsd: maybe(item.price),
    discoveryScore: scoreDiscovery(item),
    trashScore: trash,
    lifecycleState: life,
    liquidityUsd: liquidity,
    top10HolderRate: top10,
    holderMomentum: holderDeltaPct,
    top10Trend: top10Delta < 0 ? 'DOWN' : top10Delta > 0 ? 'UP' : 'FLAT',
    preDrainLevel: preDrain,
    noBuyReason: null,
    isAnomaly: false,
    isLikelyManipulation: item.is_wash_trading === true,
    liquidityDrainDetected: drain,
    rugDetected: n(item.rug_ratio) >= 0.99 || n(item.is_honeypot) > 0,
    paperBuyCandidate: true,
    paperBuyReason: [],
    paperNoBuyReason: [],
    marketCap: maybe(item.market_cap),
    warnings: [],
    sourceRank: maybe(item.rank) ?? rank,
    candidateSource: 'raw_gmgn_replay',
    honeypotFree: n(item.is_honeypot) === 0,
    priceChange1h: maybe(item.price_change_percent1h ?? item.price_change_percent),
    volume1h: volume,
    volume24h: volume,
    volume5m: volume,
    volume15m: volume,
    volume1hDelta: volumeDelta,
    volume5mDelta: volumeDelta,
    volume15mDelta: volumeDelta,
    holderCount,
    holderDeltaPct,
    holderCountChange: prev?.holderCount && holderCount !== null ? holderCount - prev.holderCount : 0,
    liquidityUsdDeltaPct: liquidityDelta,
    top10HolderRateDelta: top10Delta,
    bundlerRate: maybe(item.bundler_rate),
    sniperCount: maybe(item.sniper_count),
    smartWalletSignal: n(item.smart_degen_count) > 0 || n(item.renowned_count) > 0 ? 'WATCH' : null,
  };
}

function remember(cands: Candidate[], seen: Seen): void {
  for (const c of cands) {
    seen[c.address] = { holderCount: c.holderCount ?? null, top10: c.top10HolderRate ?? null, volume: c.volume1h ?? null, liquidity: c.liquidityUsd ?? null };
  }
}

function deadCandidateReason(c: Candidate): string | null {
  if (!c.priceUsd || c.priceUsd <= 0) return 'dead_missing_price';
  if (c.lifecycleState === 'ARCHIVED') return 'dead_archived';
  if (c.rugDetected) return 'dead_rug';
  if (c.liquidityDrainDetected || c.preDrainLevel === 'DRAIN') return 'dead_liquidity_drain';
  if ((c.liquidityUsd ?? 0) < 10000) return 'dead_liquidity_below_10000';
  if ((c.trashScore ?? 0) >= 100) return 'dead_trash_100';
  return null;
}

function missingCandidate(p: PaperPosition): Candidate {
  return { symbol: p.symbol, address: p.address, priceUsd: p.currentPriceUsd, discoveryScore: p.currentDiscoveryScore, trashScore: p.currentTrashScore, lifecycleState: 'ARCHIVED', liquidityUsd: 0, top10HolderRate: p.entryTop10 ?? null, holderMomentum: p.entryHolderMomentum ?? null, top10Trend: 'UNKNOWN', preDrainLevel: 'DRAIN', noBuyReason: 'missing_from_feed', isAnomaly: true, isLikelyManipulation: false, liquidityDrainDetected: true, rugDetected: false, paperBuyCandidate: false, paperBuyReason: [], paperNoBuyReason: ['missing_from_feed'] };
}

function makePos(c: Candidate, t: string, size: number, reason: string): PaperPosition {
  const m = c.priceUsd as number;
  const e = m * buyMul();
  return { symbol: c.symbol, address: c.address, entryTime: t, entryPriceUsd: e, idealEntryPriceUsd: m, currentPriceUsd: m, realisticExitPriceUsd: m, solAmount: size, tokenAmount: round(size / e), entryDiscoveryScore: c.discoveryScore ?? 0, currentDiscoveryScore: c.discoveryScore ?? 0, entryTrashScore: c.trashScore ?? 0, currentTrashScore: c.trashScore ?? 0, lifecycleState: c.lifecycleState, unrealizedPnlPct: 0, unrealizedPnlSol: 0, idealPnlPct: 0, idealPnlSol: 0, realisticPnlPct: 0, realisticPnlSol: 0, decliningStreak: c.lifecycleState === 'DECLINING' ? 1 : 0, hit2xAt: null, maxPnlPct: 0, reason, entryRank: c.sourceRank ?? null, entryLiquidity: c.liquidityUsd ?? null, entryTop10: c.top10HolderRate ?? null, entryHolderCount: c.holderCount ?? null, entryHolderMomentum: c.holderMomentum ?? null, entryBundlerRate: c.bundlerRate ?? null, entrySniperCount: c.sniperCount ?? null };
}

function updatePos(p: PaperPosition, c: Candidate, t: string): PaperPosition {
  const m = c.priceUsd || p.currentPriceUsd;
  const ideal = p.idealEntryPriceUsd || p.entryPriceUsd;
  const exit = m * sellMul();
  const pct = round((exit / p.entryPriceUsd - 1) * 100, 4);
  const realSol = p.solAmount * (exit / p.entryPriceUsd) - p.solAmount;
  const hit = p.hit2xAt || (pct >= 100 ? t : null);
  return { ...p, currentPriceUsd: m, realisticExitPriceUsd: exit, currentDiscoveryScore: c.discoveryScore ?? p.currentDiscoveryScore, currentTrashScore: c.trashScore ?? p.currentTrashScore, lifecycleState: c.lifecycleState, unrealizedPnlPct: pct, unrealizedPnlSol: round(realSol), realisticPnlPct: pct, realisticPnlSol: round(realSol), idealPnlPct: round((m / ideal - 1) * 100, 4), idealPnlSol: round(p.solAmount * (m / ideal) - p.solAmount), decliningStreak: c.lifecycleState === 'DECLINING' ? (p.decliningStreak || 0) + 1 : 0, hit2xAt: hit, maxPnlPct: Math.max(p.maxPnlPct ?? -Infinity, pct) };
}

function exitLiquidityCheck(p: PaperPosition, c: Candidate) {
  const exitLiquidity = c.liquidityUsd ?? null;
  const exitPrice = p.realisticExitPriceUsd ?? p.currentPriceUsd;
  const sellUsd = p.tokenAmount * exitPrice;
  const ratio = exitLiquidity !== null && sellUsd > 0 ? round(exitLiquidity / sellUsd, 4) : null;
  let reason: string | null = null;
  if (exitLiquidity === null) reason = 'missing_exit_liquidity';
  else if (c.liquidityDrainDetected || c.preDrainLevel === 'DRAIN') reason = 'liquidity_drain';
  else if (exitLiquidity < 3000) reason = 'exit_liquidity_below_3000';
  else if (ratio !== null && ratio < 10) reason = 'exit_liquidity_ratio_below_10x';
  return { exitLiquidity, exitLiquidityToSellRatio: ratio, fillableExit: reason === null, unfillableReason: reason };
}

function buyTrade(t: string, c: Candidate, p: PaperPosition, name: string): Trade {
  return { timestamp: t, symbol: c.symbol, address: c.address, side: 'BUY', priceUsd: p.entryPriceUsd, idealPriceUsd: p.idealEntryPriceUsd, solAmount: p.solAmount, tokenAmount: p.tokenAmount, reason: `replay_${name.toLowerCase()}`, discoveryScore: c.discoveryScore ?? 0, trashScore: c.trashScore ?? 0, lifecycleState: c.lifecycleState, pnlPct: null, pnlSol: null, realisticPnlPct: null, realisticPnlSol: null, sellSignalReason: null, decliningStreakAtSell: null, cooldownUntil: null, holdMinutes: null, hit2x: false, timeTo2xMinutes: null, entryTime: t, entryRank: c.sourceRank ?? null, entryLiquidity: c.liquidityUsd ?? null, entryTop10: c.top10HolderRate ?? null, entryHolderCount: c.holderCount ?? null, entryHolderMomentum: c.holderMomentum ?? null, entryBundlerRate: c.bundlerRate ?? null, entrySniperCount: c.sniperCount ?? null };
}

function sellTrade(t: string, p: PaperPosition, c: Candidate, reason: string): Trade {
  const fill = exitLiquidityCheck(p, c);
  return { timestamp: t, symbol: p.symbol, address: p.address, side: 'SELL', priceUsd: p.realisticExitPriceUsd ?? p.currentPriceUsd, idealPriceUsd: p.currentPriceUsd, solAmount: round(p.solAmount + p.unrealizedPnlSol), tokenAmount: p.tokenAmount, reason, discoveryScore: c.discoveryScore ?? p.currentDiscoveryScore, trashScore: c.trashScore ?? p.currentTrashScore, lifecycleState: c.lifecycleState, pnlPct: p.unrealizedPnlPct, pnlSol: p.unrealizedPnlSol, idealPnlPct: p.idealPnlPct ?? p.unrealizedPnlPct, idealPnlSol: p.idealPnlSol ?? p.unrealizedPnlSol, realisticPnlPct: p.realisticPnlPct ?? p.unrealizedPnlPct, realisticPnlSol: p.realisticPnlSol ?? p.unrealizedPnlSol, sellSignalReason: reason, decliningStreakAtSell: p.decliningStreak || 0, cooldownUntil: null, holdMinutes: mins(p.entryTime, t), hit2x: Boolean(p.hit2xAt), timeTo2xMinutes: p.hit2xAt ? mins(p.entryTime, p.hit2xAt) : null, ...fill, entryTime: p.entryTime, entryRank: p.entryRank ?? null, entryLiquidity: p.entryLiquidity ?? null, entryTop10: p.entryTop10 ?? null, entryHolderCount: p.entryHolderCount ?? null, entryHolderMomentum: p.entryHolderMomentum ?? null, entryBundlerRate: p.entryBundlerRate ?? null, entrySniperCount: p.entrySniperCount ?? null };
}

function priority(a: Candidate, b: Candidate): number {
  return (b.discoveryScore ?? 0) - (a.discoveryScore ?? 0) || (a.sourceRank ?? 9999) - (b.sourceRank ?? 9999);
}

function step(strategy: Strategy, state: State, cands: Candidate[], t: string): void {
  const latest = new Map(cands.map((c) => [key(c), c]));
  const next: PaperPosition[] = [];
  for (const p of state.portfolio.openPositions) {
    const c = latest.get(key(p));
    const u = c ? updatePos(p, c, t) : p;
    const dead = c ? deadCandidateReason(c) : 'missing_from_feed';
    const decision = dead ? { shouldSell: true, reason: dead } : strategy.shouldSell(u, c as Candidate);
    if (decision.shouldSell) {
      const tr = sellTrade(t, u, c ?? missingCandidate(u), decision.reason || 'replay_sell');
      state.portfolio.cashSol += tr.solAmount;
      state.portfolio.realizedPnlSol += u.unrealizedPnlSol;
      state.trades.push(tr);
    } else next.push(u);
  }
  state.portfolio.openPositions = next;
  const held = new Set(next.map(key));
  for (const c of cands.slice().sort(priority)) {
    if (held.has(key(c))) continue;
    const size = strategy.config.positionSizeSol;
    if (state.portfolio.openPositions.length >= strategy.config.maxOpenPositions || state.portfolio.cashSol < size) continue;
    if (deadCandidateReason(c)) continue;
    const reasons = strategy.explainBuy ? strategy.explainBuy(c, state.portfolio) : (strategy.shouldBuy(c, state.portfolio) ? [] : ['rejected']);
    if (reasons.length) continue;
    const p = makePos(c, t, size, `replay_${strategy.name.toLowerCase()}`);
    state.portfolio.cashSol -= size;
    state.portfolio.openPositions.push(p);
    held.add(key(c));
    state.trades.push(buyTrade(t, c, p, strategy.name));
  }
  state.portfolio.unrealizedPnlSol = round(state.portfolio.openPositions.reduce((s, p) => s + p.unrealizedPnlSol, 0));
  state.portfolio.cashSol = round(state.portfolio.cashSol);
  state.portfolio.realizedPnlSol = round(state.portfolio.realizedPnlSol);
  state.portfolio.totalEquitySol = round(state.portfolio.cashSol + state.portfolio.openPositions.reduce((s, p) => s + p.solAmount + p.unrealizedPnlSol, 0));
  state.portfolio.updatedAt = t;
}

function perf(name: string, state: State) {
  const sells = state.trades.filter((t) => t.side === 'SELL');
  const buys = state.trades.filter((t) => t.side === 'BUY');
  const rawPnl = round(state.portfolio.realizedPnlSol + state.portfolio.unrealizedPnlSol);
  const realClosed = sells.reduce((sum, t) => { const pnl = t.pnlSol ?? 0; return sum + (pnl > 0 && t.fillableExit === false ? 0 : pnl); }, 0);
  const realPnl = round(realClosed + state.portfolio.unrealizedPnlSol);
  const rawEquity = round(state.portfolio.totalEquitySol);
  const realEquity = round(state.portfolio.totalEquitySol - rawPnl + realPnl);
  return { strategy: name, rawEquity, realEquity, rawPnL: rawPnl, realPnL: realPnl, trades: sells.length, buys: buys.length, open: state.portfolio.openPositions.length, winRate: sells.length ? round(sells.filter((t) => (t.pnlSol ?? 0) > 0 && t.fillableExit !== false).length / sells.length * 100, 2) : 0, fillableExitRate: sells.length ? round(sells.filter((t) => t.fillableExit !== false).length / sells.length * 100, 2) : 0, unfillableWinCount: sells.filter((t) => (t.pnlSol ?? 0) > 0 && t.fillableExit === false).length, liquidityDrainExitCount: sells.filter((t) => t.unfillableReason === 'liquidity_drain' || t.reason === 'dead_liquidity_drain' || t.reason === 'missing_from_feed').length, fillable2xCount: sells.filter((t) => t.hit2x && t.fillableExit !== false).length };
}

async function entries(): Promise<Entry[]> {
  const text = await fs.readFile(INDEX_PATH, 'utf8');
  const rows = text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Entry)
    .filter((e) => e.path && e.checkedAt && (!SINCE || parseSnapshotTime(e.checkedAt) >= SINCE) && (!UNTIL || parseSnapshotTime(e.checkedAt) <= UNTIL))
    .sort((a, b) => parseSnapshotTime(a.checkedAt) - parseSnapshotTime(b.checkedAt));
  return LIMIT > 0 ? rows.slice(-LIMIT) : rows;
}

const ROLLING_WINDOW_HOURS = Number(process.env.ROLLING_WINDOW_HOURS || 6);
const ROLLING_STEP = Math.max(1, Number(process.env.ROLLING_STEP || 1));
const ROLLING_MAX_WINDOWS = Math.max(0, Number(process.env.ROLLING_MAX_WINDOWS || 0));

type WindowResult = ReturnType<typeof perf> & { start: string; end: string; snapshots: number };

function percentile(values: number[], pct: number): number | null {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * pct;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return round(sorted[lo]);
  return round(sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo));
}

function average(values: number[]): number | null {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function summarizeWindows(strategy: string, rows: WindowResult[]) {
  const real = rows.map((row) => row.realPnL);
  const raw = rows.map((row) => row.rawPnL);
  const trades = rows.map((row) => row.trades);
  const drains = rows.map((row) => row.liquidityDrainExitCount);
  const unfillable = rows.map((row) => row.unfillableWinCount);
  const fillable = rows.map((row) => row.fillableExitRate);
  const best = rows.slice().sort((a, b) => b.realPnL - a.realPnL)[0] ?? null;
  const worst = rows.slice().sort((a, b) => a.realPnL - b.realPnL)[0] ?? null;
  return {
    strategy,
    windows: rows.length,
    positiveWindows: rows.filter((row) => row.realPnL > 0).length,
    positiveRate: rows.length ? round(rows.filter((row) => row.realPnL > 0).length / rows.length * 100, 2) : 0,
    medianRealPnL: percentile(real, 0.5),
    avgRealPnL: average(real),
    p25RealPnL: percentile(real, 0.25),
    p75RealPnL: percentile(real, 0.75),
    worstRealPnL: percentile(real, 0),
    bestRealPnL: percentile(real, 1),
    medianRawPnL: percentile(raw, 0.5),
    avgRawPnL: average(raw),
    avgTrades: average(trades),
    avgLiquidityDrainExits: average(drains),
    avgUnfillableWins: average(unfillable),
    avgFillableExitRate: average(fillable),
    bestStart: best?.start ?? null,
    bestEnd: best?.end ?? null,
    worstStart: worst?.start ?? null,
    worstEnd: worst?.end ?? null,
  };
}

type LoadedSnapshot = Entry & { timeMs: number; normalizedTime: string; cands: Candidate[] };

async function loadSnapshots(rows: Entry[]): Promise<LoadedSnapshot[]> {
  const loaded: LoadedSnapshot[] = [];
  let processed = 0;
  for (const row of rows) {
    try {
      loaded.push({
        ...row,
        timeMs: parseSnapshotTime(row.checkedAt),
        normalizedTime: normalizeSnapshotTime(row.checkedAt),
        cands: await loadCandidatesFromReportPath(row.path),
      });
    } catch {
      // Skip corrupt or missing snapshots; the manifest can still contain older paths.
    }
    processed++;
    if (processed % 100 === 0) console.log(`loaded snapshots ${processed}/${rows.length}`);
  }
  return loaded;
}

async function main() {
  const allRows = await entries();
  const snapshots = await loadSnapshots(allRows);
  const strategies = loadStrategies();
  const byStrategy = new Map<string, WindowResult[]>(strategies.map((strategy) => [strategy.name, []]));
  let starts = snapshots.filter((_, index) => index % ROLLING_STEP === 0);
  if (ROLLING_MAX_WINDOWS > 0) starts = starts.slice(-ROLLING_MAX_WINDOWS);
  let processed = 0;

  for (const start of starts) {
    const endMs = start.timeMs + ROLLING_WINDOW_HOURS * 60 * 60 * 1000;
    const windowRows = snapshots.filter((row) => row.timeMs >= start.timeMs && row.timeMs <= endMs);
    if (!windowRows.length) continue;

    const states = new Map<string, State>(strategies.map((strategy) => [
      strategy.name,
      { portfolio: emptyPortfolio(start.normalizedTime), trades: [] },
    ]));

    for (const row of windowRows) {
      for (const strategy of strategies) step(strategy, states.get(strategy.name) as State, row.cands, row.normalizedTime);
    }

    const end = windowRows[windowRows.length - 1]?.checkedAt ?? start.checkedAt;
    for (const strategy of strategies) {
      const result = perf(strategy.name, states.get(strategy.name) as State) as WindowResult;
      result.start = start.checkedAt;
      result.end = end;
      result.snapshots = windowRows.length;
      byStrategy.get(strategy.name)?.push(result);
    }

    processed++;
    if (processed % 25 === 0) console.log(`rolling report replay ${processed}/${starts.length}`);
  }

  const summaries = strategies.map((strategy) => summarizeWindows(strategy.name, byStrategy.get(strategy.name) ?? []));
  const ranked = summaries.slice().sort((a, b) =>
    (b.medianRealPnL ?? -Infinity) - (a.medianRealPnL ?? -Infinity)
    || (b.positiveRate ?? 0) - (a.positiveRate ?? 0)
    || (b.avgRealPnL ?? -Infinity) - (a.avgRealPnL ?? -Infinity)
  ).map((entry, index) => ({ rank: index + 1, ...entry }));

  const out = {
    replayMode: 'rolling_report_snapshot_exact',
    generatedAt: new Date().toISOString(),
    sourceIndex: INDEX_PATH,
    windowHours: ROLLING_WINDOW_HOURS,
    step: ROLLING_STEP,
    processedWindows: processed,
    sourceSnapshots: snapshots.length,
    firstSnapshot: snapshots[0]?.checkedAt ?? null,
    lastSnapshot: snapshots[snapshots.length - 1]?.checkedAt ?? null,
    strategies: ranked,
    windows: Object.fromEntries([...byStrategy.entries()].map(([strategy, rows]) => [strategy, rows])),
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'rolling-report-strategy-league.json');
  await fs.writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.table(ranked.map((row) => ({
    rank: row.rank,
    strategy: row.strategy,
    windows: row.windows,
    positivePct: row.positiveRate,
    median: row.medianRealPnL,
    avg: row.avgRealPnL,
    p25: row.p25RealPnL,
    p75: row.p75RealPnL,
    worst: row.worstRealPnL,
    best: row.bestRealPnL,
    trades: row.avgTrades,
    drain: row.avgLiquidityDrainExits,
  })));
  console.log(`wrote ${outPath}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exitCode = 1; });