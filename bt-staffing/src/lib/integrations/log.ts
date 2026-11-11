import { prisma } from "@/lib/db";

export async function logIntegration(entry: {
  system: "hubspot" | "apploi" | "salesmsg" | "workday" | "intake";
  direction: "in" | "out";
  action: string;
  status: "ok" | "error" | "skipped";
  summary: string;
  payload?: unknown;
}) {
  try {
    await prisma.integrationLog.create({
      data: {
        system: entry.system,
        direction: entry.direction,
        action: entry.action,
        status: entry.status,
        summary: entry.summary.slice(0, 500),
        payload: entry.payload === undefined ? undefined : JSON.parse(JSON.stringify(entry.payload)),
      },
    });
  } catch (e) {
    console.error("Failed to write integration log", e);
  }
}
