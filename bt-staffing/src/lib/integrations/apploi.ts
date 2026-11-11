import { config } from "@/lib/config";

/**
 * Apploi adapter. Apploi pushes applicants into HubSpot on its own, so this
 * app only asks Apploi for extra detail about one application.
 * Only a mock exists today.
 */
export interface ApploiApplication {
  id: string;
  jobTitle: string;
  appliedAt: Date | null;
  resumeUrl: string | null;
}

export interface ApploiAdapter {
  readonly mode: "mock" | "live";
  getApplication(apploiId: string): Promise<ApploiApplication | null>;
}

export class MockApploiAdapter implements ApploiAdapter {
  readonly mode = "mock" as const;
  async getApplication(apploiId: string): Promise<ApploiApplication | null> {
    if (!apploiId) return null;
    return { id: apploiId, jobTitle: "Behavior Technician", appliedAt: null, resumeUrl: null };
  }
}

export function getApploiAdapter(): ApploiAdapter {
  if (config.apploiMode === "live") {
    throw new Error("APPLOI_MODE=live is set but no live Apploi adapter has been written yet.");
  }
  return new MockApploiAdapter();
}
