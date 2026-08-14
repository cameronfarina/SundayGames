export type PlayerEvidenceSourceAdapterKey = "scored-local";

export interface LoadPlayerEvidenceSourceRowsOptions {
  path: string;
  adapter?: PlayerEvidenceSourceAdapterKey;
}
