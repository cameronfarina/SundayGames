export type MockDraftFormat = "auction" | "snake";

export type MockDraftMetadataValue =
  | null
  | boolean
  | number
  | string
  | readonly MockDraftMetadataValue[]
  | { readonly [key: string]: MockDraftMetadataValue };

export interface MockDraftModeMetadata {
  format: MockDraftFormat;
  mockCount: number;
  label?: string;
  settings?: { readonly [key: string]: MockDraftMetadataValue };
}

export interface MockDraftResultReference {
  id: string;
  kind: "mock-result" | "simulation-result";
  label?: string;
}
