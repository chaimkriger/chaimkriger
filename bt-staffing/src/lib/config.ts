// All environment switches in one place.

type Mode = "mock" | "live";

function mode(name: string): Mode {
  return (process.env[name] ?? "mock").toLowerCase() === "live" ? "live" : "mock";
}

export const config = {
  get appUrl() {
    // RENDER_EXTERNAL_URL is set automatically on Render.
    return (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get hubspotMode() {
    return mode("HUBSPOT_MODE");
  },
  get hubspotToken() {
    return process.env.HUBSPOT_PRIVATE_APP_TOKEN ?? "";
  },
  get hubspotCaseObject() {
    return process.env.HUBSPOT_CASE_OBJECT || "deals";
  },
  get apploiMode() {
    return mode("APPLOI_MODE");
  },
  get salesmsgMode() {
    return mode("SALESMSG_MODE");
  },
  get workdayMode() {
    return mode("WORKDAY_MODE");
  },
  get workdayWebhookSecret() {
    return process.env.WORKDAY_WEBHOOK_SECRET ?? "";
  },
  get salesmsgWebhookSecret() {
    return process.env.SALESMSG_WEBHOOK_SECRET ?? "";
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  get sendFormLinkOnIntake() {
    return (process.env.SEND_FORM_LINK_ON_INTAKE ?? "true") !== "false";
  },
  get requireWorkdayHire() {
    return (process.env.REQUIRE_WORKDAY_HIRE ?? "true") !== "false";
  },
};
