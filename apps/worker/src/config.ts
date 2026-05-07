export interface WorkerConfig {
  port: number;
}

const DEFAULT_PORT = 8787;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const raw = env.WORKER_WS_PORT;
  if (raw === undefined || raw === "") return { port: DEFAULT_PORT };

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid WORKER_WS_PORT: ${raw}`);
  }
  return { port: parsed };
}
