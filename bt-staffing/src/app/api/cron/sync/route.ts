import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { runFullSync } from "@/lib/services/sync";

export const dynamic = "force-dynamic";

/**
 * Scheduled sync: pulls applicants and cases, expires old backups.
 * Call with header  Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: Request) {
  if (!config.cronSecret || req.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runFullSync()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
