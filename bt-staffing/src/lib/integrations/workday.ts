import { config } from "@/lib/config";

/**
 * Workday adapter. Workday tells us when someone is hired by calling
 * POST /api/webhooks/workday. The adapter's job is to check the caller and
 * turn the payload into a HireEvent. Only a mock payload shape exists today;
 * the real shape depends on how your Workday team builds the outbound
 * integration (Studio / EIB / an iPaaS in between).
 */
export interface HireEvent {
  employeeId: string;
  email: string | null;
  mobile: string | null;
  hireDate: Date;
}

export interface WorkdayAdapter {
  readonly mode: "mock" | "live";
  verify(headers: Headers): boolean;
  /** Returns null when the payload is not a "hired" event. Throws on a malformed one. */
  parseHireEvent(body: unknown): HireEvent | null;
}

/**
 * Mock payload:
 *   { "event": "hired", "employeeId": "W-1001", "email": "a@b.com",
 *     "mobile": "+17185550101", "hireDate": "2026-01-15" }
 * with header  x-webhook-secret: <WORKDAY_WEBHOOK_SECRET>
 */
export class MockWorkdayAdapter implements WorkdayAdapter {
  readonly mode = "mock" as const;
  constructor(private secret: string) {}

  verify(headers: Headers): boolean {
    return !!this.secret && headers.get("x-webhook-secret") === this.secret;
  }

  parseHireEvent(body: unknown): HireEvent | null {
    if (!body || typeof body !== "object") throw new Error("Body must be a JSON object");
    const b = body as Record<string, unknown>;
    if (String(b.event ?? "").toLowerCase() !== "hired") return null;
    const employeeId = typeof b.employeeId === "string" ? b.employeeId.trim() : "";
    const email = typeof b.email === "string" && b.email.trim() ? b.email.trim() : null;
    const mobile = typeof b.mobile === "string" && b.mobile.trim() ? b.mobile.trim() : null;
    if (!employeeId) throw new Error("employeeId is required");
    if (!email && !mobile) throw new Error("email or mobile is required to match the applicant");
    const hireDate = b.hireDate ? new Date(String(b.hireDate)) : new Date();
    if (isNaN(hireDate.getTime())) throw new Error("hireDate is not a valid date");
    return { employeeId, email, mobile, hireDate };
  }
}

export function getWorkdayAdapter(): WorkdayAdapter {
  if (config.workdayMode === "live") {
    throw new Error("WORKDAY_MODE=live is set but no live Workday adapter has been written yet.");
  }
  return new MockWorkdayAdapter(config.workdayWebhookSecret);
}
