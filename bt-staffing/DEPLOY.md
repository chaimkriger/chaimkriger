# Quick test deployment (Render, free tier)

For trying the app with the fake demo data, not for real applicant data.

1. Sign in at render.com with GitHub.
2. New > Blueprint > choose this repository and the branch you want to test.
3. Apply. Render reads `render.yaml`, creates a free Postgres database and the
   web service, builds the Docker image, applies migrations and loads the demo data.
4. Open the service URL and use the demo sign-in buttons.

Free tier limits: the app sleeps when idle (the first visit takes about a minute)
and the free database is deleted after about 30 days.
The blueprint has not been run yet; if Render rejects a field, the error names it.

# Deploying to Azure

Target: **App Service (Linux container)** + **Azure Container Registry** +
**Azure Database for PostgreSQL flexible server**. The container applies
database migrations every time it starts.

> Honest status: the Docker image and the app are tested. The Bicep template and
> the deploy workflow were written by hand and have **not** been run against a
> real Azure subscription. Run the what-if step and expect to fix small things.

## 1. Create the resources (once)

Needs the Azure CLI, logged in (`az login`), with rights to create resources.

```bash
az group create --name uc-bt-staffing --location eastus

cd bt-staffing
cp infra/main.parameters.example.json infra/main.parameters.json   # git-ignored
# edit infra/main.parameters.json: passwords and secrets
#   authSecret:  openssl rand -base64 48
#   the three webhook/cron secrets:  openssl rand -hex 24

az deployment group what-if --resource-group uc-bt-staffing \
  --template-file infra/main.bicep --parameters infra/main.parameters.json
az deployment group create  --resource-group uc-bt-staffing \
  --template-file infra/main.bicep --parameters infra/main.parameters.json
```

Note the outputs: `appName`, `acrName`, `appUrl`.

## 2. Build and ship the image

By hand:

```bash
az acr build --registry <acrName> --image bt-staffing:latest bt-staffing
az webapp restart --resource-group uc-bt-staffing --name <appName>
```

Or with the GitHub Actions workflow `.github/workflows/bt-staffing-deploy.yml`
(run it from the Actions tab). It needs:

- An Entra app registration with a federated credential for this repository
  (GitHub OIDC) and the Contributor role on the resource group.
- Repository **secrets**: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- Repository **variables**: `AZURE_RESOURCE_GROUP`, `AZURE_ACR_NAME`, `AZURE_WEBAPP_NAME`

## 3. First data

The production app starts with an empty database: no users, no people, no cases.

- To load the **fake demo data** (for a pilot or a demo): set the app setting
  `SEED_ON_START=true`, restart once, then set it back to `false`. It only seeds
  when there are no users.
- For real use you need real user accounts. There is no user screen yet;
  the quickest path is a small script like the user block at the top of
  `prisma/seed.ts`, run once with the production `DATABASE_URL`.

## 4. Scheduled sync

`.github/workflows/bt-staffing-sync.yml` calls `/api/cron/sync` hourly once you set
the repository variable `BT_STAFFING_URL` (the app URL) and the secret
`BT_STAFFING_CRON_SECRET` (same value as the app's `CRON_SECRET`). An Azure Logic
App or any scheduler that can send an HTTP POST works just as well.

## App settings reference

| Setting | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (`sslmode=require` on Azure) |
| `AUTH_SECRET` | Signs login sessions; 32+ characters |
| `APP_URL` | Public URL; used in the form link that is texted |
| `HUBSPOT_MODE` | `mock` or `live` |
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot private app token (live only) |
| `HUBSPOT_CASE_OBJECT` | `deals`, `tickets`, or a custom object type id |
| `APPLOI_MODE`, `SALESMSG_MODE`, `WORKDAY_MODE` | `mock` (no live adapters yet) |
| `WORKDAY_WEBHOOK_SECRET`, `SALESMSG_WEBHOOK_SECRET`, `CRON_SECRET` | Shared secrets for the machine endpoints |
| `SEND_FORM_LINK_ON_INTAKE` | `false` if Salesmsg already texts the form link itself |
| `REQUIRE_WORKDAY_HIRE` | `false` to let people be Ready without the Workday event |
| `SEED_ON_START` | `true` loads fake demo data into an empty database |
| `SHOW_DEMO_LOGINS` | `false` hides the one-click demo account buttons on the login page (the Bicep template sets it to `false`) |

---

# What is stubbed, what is real, what you need to supply

## Real (works today)

- Login with three roles and per-role permissions
- Public applicant form; create-or-update matched on mobile, then email
- Applicants, staff, cases, pipeline stages, paperwork checklist, Ready / Not ready with missing items
- Matching and ranking with score breakdown
- Primary + up to 4 backups, 30-day backup expiry, release when placed elsewhere, restaffing shows backups first
- Map with filters, the three work queues, dashboard
- Outreach flow: shortlist, send, log replies, first yes proposed as primary, recruiter confirms
- HubSpot write-back end to end **against the mock**
- Webhook endpoints for Workday "hired" and inbound texts; scheduled sync endpoint
- Integration log
- Tests for matching, readiness and the HubSpot write-back
- Docker image and Docker Compose

## Written but never run against the real thing

- **Live HubSpot adapter** (`src/lib/integrations/hubspot/live.ts`): CRM v3 search +
  PATCH with a private app token. Unit-tested against a fake `fetch` only.
- **Bicep template** and the **deploy workflow**.

## Stubbed (mock only)

| Thing | What the stub does | To make it real |
|---|---|---|
| Salesmsg | Records the text in the database; nothing is sent. Replies are simulated in the UI | Write a live `SalesmsgAdapter` (`sendText`, `parseInbound`) against the Salesmsg API, point Salesmsg's inbound webhook at `/api/webhooks/salesmsg` |
| Apploi | Returns a placeholder application | Only needed if you want Apploi details beyond what HubSpot holds |
| Workday | Accepts a simple JSON "hired" payload with a shared secret | Your Workday team builds the outbound notification; adjust `parseHireEvent` / `verify` to its real shape |
| Geocoding | Knows about 85 seeded ZIP codes; anything else is "not located" | Implement `Geocoder` with Azure Maps or Google |
| Drive time | Straight-line estimate | Implement `DriveTimeProvider` with a route-matrix API |
| Career-page intake | Empty placeholder class | Implement `IntakeSource` when the career page exists |

## What you need to supply to go live

**Azure**
- A subscription and a resource group; someone with rights to create App Service, Container Registry and PostgreSQL
- Values for the Bicep parameters: Postgres admin password, `AUTH_SECRET`, three shared secrets
- For the GitHub deploy: an Entra app registration with OIDC federated credential, plus the secrets / variables listed above
- A custom domain and certificate if you do not want `*.azurewebsites.net`

**HubSpot**
- A private app token with scopes `crm.objects.contacts.read` and read + write on
  the object that holds cases (deals, tickets or a custom object)
- Tell the app which object holds cases (`HUBSPOT_CASE_OBJECT`)
- The property names. The adapter expects the names in `HUBSPOT_PROPS`
  (`src/lib/integrations/hubspot/types.ts`), for example `bt_schedule`,
  `rbt_required`, `bt_primary_name`, `bt_backups`, `bt_staffing_status`. Either
  create those properties in HubSpot or edit the map to your existing names.
  `bt_schedule` must hold values like `MON_PM;WED_EVE` (a multi-checkbox with
  the 21 day/time options works)
- How to tell an applicant contact from any other contact. The adapter assumes
  "has an `apploi_id` property"; confirm what Apploi actually writes
- Then set `HUBSPOT_MODE=live` and test on a few records first

**Salesmsg**: API credentials, the sending number, and confirmation of whether
Salesmsg itself already texts the form link (if so set `SEND_FORM_LINK_ON_INTAKE=false`).

**Workday**: someone to build the outbound "hired" notification, the payload it
will send, and how it authenticates.

**Maps**: an Azure Maps (or Google Maps) key for real geocoding and drive times.

**From the business**
- The real paperwork checklist and in-service list
- Real user accounts (names, emails, roles)
- A review of what is stored. The app holds applicant contact details and
  addresses, and case locations with a non-identifying label only. It has not had a
  HIPAA or security review, has no audit trail of who viewed what, no password
  reset, no SSO, and no rate limiting on the public form or login.
