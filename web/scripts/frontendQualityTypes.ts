export type FrontendQualityRule =
  | "direct-fetch"
  | "feature-main"
  | "layer-import"
  | "missing-test"
  | "native-select"
  | "suppression"
  | "type-escape";

export interface FrontendQualityViolation {
  file: string;
  line: number;
  rule: FrontendQualityRule;
  detail: string;
}

export interface FrontendSourceModule {
  content: string;
  file: string;
  relativeFile: string;
}
