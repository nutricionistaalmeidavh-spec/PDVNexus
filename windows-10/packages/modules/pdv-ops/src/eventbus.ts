export const REPOUTEIS_PDV_MODULES = {
  p0: [
    "artisys-eventbus",
    "artisys-printing",
    "artisys-audit-log",
    "artisys-backup",
    "artisys-importer",
    "artisys-alerts"
  ],
  p1: [
    "artisys-reporting",
    "artisys-pricing",
    "artisys-settings",
    "artisys-auth-rbac",
    "artisys-inventory"
  ]
} as const;

export type PdvOpsModuleId = (typeof REPOUTEIS_PDV_MODULES)[keyof typeof REPOUTEIS_PDV_MODULES][number];

export interface PdvOpsEvent<T = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  source: "pdv-nexus";
  payload: T;
}

export type PdvOpsEventListener<T = unknown> = (event: PdvOpsEvent<T>) => void | Promise<void>;

export interface PdvEventBus {
  publish<T>(type: string, payload: T): PdvOpsEvent<T>;
  subscribe<T = unknown>(type: string, listener: PdvOpsEventListener<T>): () => void;
  clear(): void;
}

export function createPdvEventBus(now: () => string = () => new Date().toISOString()): PdvEventBus {
  const listeners = new Map<string, Set<PdvOpsEventListener>>();
  let sequence = 0;

  return {
    publish<T>(type: string, payload: T) {
      const event: PdvOpsEvent<T> = {
        id: `pdv-event-${now()}-${++sequence}`,
        type,
        occurredAt: now(),
        source: "pdv-nexus",
        payload
      };
      const targets = [...(listeners.get(type) ?? []), ...(listeners.get("*") ?? [])];
      for (const listener of targets) void listener(event as PdvOpsEvent);
      return event;
    },
    subscribe<T = unknown>(type: string, listener: PdvOpsEventListener<T>) {
      const bucket = listeners.get(type) ?? new Set<PdvOpsEventListener>();
      bucket.add(listener as PdvOpsEventListener);
      listeners.set(type, bucket);
      return () => {
        bucket.delete(listener as PdvOpsEventListener);
        if (bucket.size === 0) listeners.delete(type);
      };
    },
    clear() {
      listeners.clear();
    }
  };
}

export type PdvPrintJobStatus = "pending" | "printing" | "printed" | "error";

export interface PdvPrintJob<TPayload> {
  id: string;
  payload: TPayload;
  status: PdvPrintJobStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  failureReason: string;
}

export interface PdvPrintResult {
  success: boolean;
  failureReason?: string;
}

export function createPdvPrintQueue<TPayload>(options: {
  print: (payload: TPayload) => Promise<PdvPrintResult>;
  maxAttempts?: number;
  now?: () => string;
  bus?: PdvEventBus;
}) {
  const jobs: PdvPrintJob<TPayload>[] = [];
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const now = options.now ?? (() => new Date().toISOString());
  let sequence = 0;

  const process = async (job: PdvPrintJob<TPayload>) => {
    job.status = "printing";
    job.updatedAt = now();
    options.bus?.publish("pdv.print.started", { jobId: job.id });

    while (job.attempts < maxAttempts) {
      job.attempts += 1;
      try {
        const result = await options.print(job.payload);
        if (result.success) {
          job.status = "printed";
          job.failureReason = "";
          job.updatedAt = now();
          options.bus?.publish("pdv.print.completed", { jobId: job.id, attempts: job.attempts });
          return job;
        }
        job.failureReason = result.failureReason || "Falha de impressão";
      } catch (error) {
        job.failureReason = error instanceof Error ? error.message : String(error);
      }
    }

    job.status = "error";
    job.updatedAt = now();
    options.bus?.publish("pdv.print.failed", { jobId: job.id, attempts: job.attempts, failureReason: job.failureReason });
    return job;
  };

  return {
    async enqueue(payload: TPayload) {
      const createdAt = now();
      const job: PdvPrintJob<TPayload> = {
        id: `print-${createdAt}-${++sequence}`,
        payload,
        status: "pending",
        attempts: 0,
        createdAt,
        updatedAt: createdAt,
        failureReason: ""
      };
      jobs.unshift(job);
      options.bus?.publish("pdv.print.queued", { jobId: job.id });
      return process(job);
    },
    async retry(jobId: string) {
      const job = jobs.find((item) => item.id === jobId);
      if (!job) throw new Error(`Print job não encontrado: ${jobId}`);
      job.status = "pending";
      job.attempts = 0;
      job.failureReason = "";
      return process(job);
    },
    list() {
      return jobs.map((job) => ({ ...job }));
    }
  };
}

export interface PdvAuditEntry {
  id: string;
  action: string;
  operatorId: string;
  operatorName: string;
  authorizedById?: string;
  authorizedByName?: string;
  reason: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function createPdvAuditEntry(input: Omit<PdvAuditEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }): PdvAuditEntry {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    ...input,
    id: input.id ?? `audit-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt
  };
}

export interface PdvBackupRecord {
  id: string;
  createdAt: string;
  reason: string;
  snapshotJson: string;
}

export function rotatePdvBackups(options: {
  backups: PdvBackupRecord[];
  snapshotJson: string;
  reason: string;
  retention: number;
  createdAt?: string;
}): PdvBackupRecord[] {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const retention = Math.max(1, Math.floor(options.retention || 1));
  const next: PdvBackupRecord = {
    id: `backup-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    reason: options.reason,
    snapshotJson: options.snapshotJson
  };
  return [next, ...options.backups].slice(0, retention);
}
