import { getWorkdayAdapter } from "@/lib/integrations/workday";
import { logIntegration } from "@/lib/integrations/log";
import { applyHireEvent } from "./workday";

/** Shared by the /api/webhooks/workday route and the "simulate" button. */
export async function handleWorkdayPayload(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const adapter = getWorkdayAdapter();
  let event;
  try {
    event = adapter.parseHireEvent(body);
  } catch (e) {
    await logIntegration({
      system: "workday", direction: "in", action: "hired", status: "error",
      summary: `Rejected payload: ${(e as Error).message}`, payload: body,
    });
    return { status: 400, body: { ok: false, error: (e as Error).message } };
  }
  if (!event) return { status: 200, body: { ok: true, ignored: true } };
  const result = await applyHireEvent(event);
  // 200 even when nobody matched, so Workday does not retry forever; it is in the log.
  return { status: 200, body: { ok: true, ...result } };
}
