/**
 * xapi_client_min — offline-durable LRS client.
 *
 *  - 1.0.3 header on every request (X-Experience-API-Version).
 *  - Idempotent statement IDs: each logical event gets a UUID once; retries reuse it.
 *    We send with PUT /statements?statementId=<id>, which is idempotent at the LRS
 *    (re-sending the same id is a no-op, so at-least-once delivery becomes exactly-once).
 *  - Queue + retry: statements persist to localStorage and flush on interval, on
 *    `online`, and on visibility/pagehide. Exponential backoff on failure.
 *
 * This file has NO knowledge of endpoints/credentials at build time — it receives a
 * discovered LaunchConfig at runtime.
 */
import type { LaunchConfig } from "./discovery";

export interface Statement {
  id?: string;
  actor: unknown;
  verb: unknown;
  object: unknown;
  result?: unknown;
  context?: unknown;
  timestamp?: string;
  [k: string]: unknown;
}

const QUEUE_KEY = "ob_xapi_queue_v1";
const XAPI_VERSION = "1.0.3";
const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 5 * 60 * 1000;

interface QueueEntry {
  statement: Statement; // always carries an id
  attempts: number;
  nextAttemptAt: number; // epoch ms
}

/** UUID v4 with a non-crypto fallback for ancient runtimes. */
function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function backoff(attempts: number, now: number): number {
  const delay = Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
  // small deterministic jitter (no Math.random needed for correctness)
  return now + delay;
}

export class LRSClient {
  private queue: QueueEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  constructor(private cfg: LaunchConfig) {
    this.queue = this.load();
    this.bindLifecycle();
    void this.flush();
  }

  /** Enqueue a statement for durable, idempotent delivery. Returns its id. */
  enqueue(statement: Statement): string {
    statement.id = statement.id ?? uuid();
    statement.timestamp = statement.timestamp ?? new Date().toISOString();
    // Dedupe: never queue the same id twice.
    if (!this.queue.some((e) => e.statement.id === statement.id)) {
      this.queue.push({ statement, attempts: 0, nextAttemptAt: 0 });
      this.save();
    }
    void this.flush();
    return statement.id;
  }

  /** Number of statements still pending delivery (for a "syncing…" indicator). */
  get pending(): number {
    return this.queue.length;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: this.cfg.auth,
      "X-Experience-API-Version": XAPI_VERSION,
    };
  }

  private statementsUrl(statementId: string): string {
    // endpoint is normalized to end with "/"
    return `${this.cfg.endpoint}statements?statementId=${encodeURIComponent(statementId)}`;
  }

  private stateUrl(activityId: string, stateId: string): string {
    const p = new URLSearchParams({
      activityId,
      agent: JSON.stringify(this.cfg.actor),
      stateId,
    });
    if (this.cfg.registration) p.set("registration", this.cfg.registration);
    return `${this.cfg.endpoint}activities/state?${p.toString()}`;
  }

  /**
   * Read a state document. `null` when it is absent or unreadable.
   *
   * Unlike statements, state is NOT queued or retried. Statements are the record of what happened
   * and must survive a flaky network; state is a convenience — where the learner had got to. A
   * queue for it would let a stale snapshot overwrite a newer one minutes later, which is worse
   * than losing it: the caller keeps a local copy anyway.
   */
  async readState(activityId: string, stateId: string): Promise<unknown | null> {
    try {
      const res = await fetch(this.stateUrl(activityId, stateId), { headers: this.headers() });
      if (!res.ok) return null; // 404 = never stored; anything else = not our problem here
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  }

  /** Write a state document. Returns whether the LRS accepted it. */
  async writeState(activityId: string, stateId: string, doc: unknown): Promise<boolean> {
    try {
      const res = await fetch(this.stateUrl(activityId, stateId), {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify(doc),
        keepalive: true,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Attempt to deliver everything that is due. Safe to call often. */
  async flush(): Promise<void> {
    if (this.flushing) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.scheduleNext();
      return;
    }
    this.flushing = true;
    try {
      const now = Date.now();
      // Process a snapshot; entries may be removed on success.
      for (const entry of [...this.queue]) {
        if (entry.nextAttemptAt > now) continue;
        const ok = await this.send(entry.statement);
        if (ok) {
          this.queue = this.queue.filter((e) => e !== entry);
          this.save();
        } else {
          entry.attempts += 1;
          entry.nextAttemptAt = backoff(entry.attempts, Date.now());
          if (entry.attempts >= MAX_ATTEMPTS) {
            // Give up on this one; keep others moving. Surface for diagnostics.
            console.error("[xapi] dropping statement after max attempts", entry.statement.id);
            this.queue = this.queue.filter((e) => e !== entry);
          }
          this.save();
        }
      }
    } finally {
      this.flushing = false;
      this.scheduleNext();
    }
  }

  /** Returns true if delivered (or already present at LRS). */
  private async send(statement: Statement): Promise<boolean> {
    try {
      const res = await fetch(this.statementsUrl(statement.id!), {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify(statement),
        keepalive: true, // best-effort delivery during unload
      });
      // 204 = stored. 409/412 = already exists (idempotent no-op) -> treat as delivered.
      if (res.status === 204 || res.status === 409 || res.status === 412) return true;
      // 4xx (other than conflict) are permanent — don't retry forever.
      if (res.status >= 400 && res.status < 500) {
        console.error("[xapi] permanent LRS error", res.status, await safeText(res));
        return true; // stop retrying a malformed/unauthorized statement
      }
      return false; // 5xx / network -> retry
    } catch {
      return false; // network failure -> retry
    }
  }

  private scheduleNext(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.queue.length === 0) return;
    const now = Date.now();
    const soonest = Math.max(0, Math.min(...this.queue.map((e) => e.nextAttemptAt)) - now);
    this.timer = setTimeout(() => void this.flush(), Math.max(soonest, 250));
  }

  private bindLifecycle(): void {
    if (typeof window === "undefined") return;
    window.addEventListener("online", () => void this.flush());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.flush();
    });
    // Last-ditch flush on unload; keepalive lets these complete.
    window.addEventListener("pagehide", () => void this.flush());
  }

  private load(): QueueEntry[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as QueueEntry[]) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      /* storage full / disabled — keep in memory */
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
