/**
 * Intake source interface. The pipeline (src/lib/intake/pipeline.ts) only
 * knows this shape. Today the source is Apploi > HubSpot. To move to a
 * career page later, implement IntakeSource in a new file and return it from
 * getIntakeSource(); the pipeline, form and everything downstream stay as is.
 */
export interface IntakeApplicant {
  /** Name of the source, stored on the profile. */
  source: string;
  /** Id of the record in the source system. */
  externalId: string;
  firstName: string;
  lastName: string;
  mobile: string | null;
  email: string | null;
  address: string | null;
  zip: string | null;
  appliedAt: Date | null;
  hubspotContactId?: string | null;
  apploiId?: string | null;
}

export interface IntakeSource {
  readonly name: string;
  fetchApplicants(since?: Date): Promise<IntakeApplicant[]>;
}
