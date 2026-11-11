import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getSalesmsgAdapter } from "@/lib/integrations/salesmsg";
import { recordInboundText } from "@/lib/services/outreach";

export const dynamic = "force-dynamic";

/** Inbound SMS replies. Body (mock shape): { "from": "+17185550101", "body": "YES" } */
export async function POST(req: Request) {
  if (!config.salesmsgWebhookSecret || req.headers.get("x-webhook-secret") !== config.salesmsgWebhookSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const inbound = getSalesmsgAdapter().parseInbound(await req.json().catch(() => null));
  if (!inbound) return NextResponse.json({ ok: false, error: "Not an inbound text" }, { status: 400 });
  const result = await recordInboundText(inbound.from, inbound.body, inbound.externalId);
  return NextResponse.json({ ok: true, ...result });
}
