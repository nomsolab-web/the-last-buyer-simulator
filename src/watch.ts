import { loadSimulatorConfig } from './data-provider';
import { runSimulationOnce } from './simulator';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const config = await loadSimulatorConfig();
  const intervalSeconds = Number(process.env.UPDATE_INTERVAL_SECONDS || config.updateIntervalSeconds || 180);
  const runOnce = String(process.env.WATCH_RUN_ONCE || '').toLowerCase() === 'true';

  while (true) {
    try {
      await runSimulationOnce();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
    if (runOnce) return;
    await sleep(Math.max(1, intervalSeconds) * 1000);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
