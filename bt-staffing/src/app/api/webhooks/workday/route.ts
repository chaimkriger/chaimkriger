import { NextResponse } from "next/server";
import { getWorkdayAdapter } from "@/lib/integrations/workday";
import { handleWorkdayPayload } from "@/lib/services/webhooks";

export const dynamic = "force-dynamic";

/** Workday calls this when someone is hired. See src/lib/integrations/workday.ts for the payload. */
export async function POST(req: Request) {
  if (!getWorkdayAdapter().verify(req.headers)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const result = await handleWorkdayPayload(body);
  return NextResponse.json(result.body, { status: result.status });
}
