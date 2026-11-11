import { config } from "@/lib/config";

/**
 * Salesmsg adapter (SMS). Only a mock exists today: it "sends" by returning an
 * id, and the caller records the message in the Message table. Replies are
 * simulated from the Outreach screen, or posted to /api/webhooks/salesmsg.
 */
export interface OutboundText {
  to: string;
  body: string;
}

export interface InboundText {
  from: string;
  body: string;
  externalId: string | null;
}

export interface SalesmsgAdapter {
  readonly mode: "mock" | "live";
  sendText(msg: OutboundText): Promise<{ externalId: string }>;
  /** Turn a raw webhook body into a normalised inbound text, or null if it is not one. */
  parseInbound(body: unknown): InboundText | null;
}

export class MockSalesmsgAdapter implements SalesmsgAdapter {
  readonly mode = "mock" as const;
  private n = 0;
  async sendText(msg: OutboundText): Promise<{ externalId: string }> {
    if (!msg.to) throw new Error("No mobile number");
    return { externalId: `mock-sms-${Date.now()}-${++this.n}` };
  }
  parseInbound(body: unknown): InboundText | null {
    if (!body || typeof body !== "object") return null;
    const b = body as Record<string, unknown>;
    if (typeof b.from !== "string" || typeof b.body !== "string") return null;
    return { from: b.from, body: b.body, externalId: typeof b.id === "string" ? b.id : null };
  }
}

let mock: MockSalesmsgAdapter | null = null;
export function getSalesmsgAdapter(): SalesmsgAdapter {
  if (config.salesmsgMode === "live") {
    throw new Error("SALESMSG_MODE=live is set but no live Salesmsg adapter has been written yet.");
  }
  if (!mock) mock = new MockSalesmsgAdapter();
  return mock;
}

export type ReplyIntent = "YES" | "NO" | "OTHER";

/** Very small yes/no reader for outreach replies. Anything unclear is OTHER. */
export function classifyReply(text: string): ReplyIntent {
  const t = text.trim().toLowerCase().replace(/[.!,]+$/g, "");
  if (/^(y|yes|yea|yeah|yep|yup|sure|ok|okay|interested|i'?m interested|i am interested|yes please|count me in)\b/.test(t)) {
    return "YES";
  }
  if (/^(n|no|nope|nah|not interested|can'?t|cannot|pass|stop|unsubscribe)\b/.test(t)) return "NO";
  return "OTHER";
}
