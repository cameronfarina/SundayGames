export interface HistoricalFileItem {
  readonly file: File;
  readonly id: string;
  readonly message: string;
  readonly ownerMappings: Readonly<Record<string, string>>;
  readonly ownerNeeds: readonly string[];
  readonly seasonYear: string;
  readonly status: "ready" | "mapping" | "imported" | "error";
}

export type HistoricalQueueAction =
  | { readonly type: "add"; readonly files: readonly File[]; readonly currentYear: number }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "year"; readonly id: string; readonly seasonYear: string }
  | { readonly type: "mapping"; readonly id: string; readonly label: string; readonly teamId: string }
  | { readonly type: "result"; readonly id: string; readonly status: HistoricalFileItem["status"];
      readonly message: string; readonly ownerNeeds?: readonly string[] };

const fileId = (file: File): string =>
  `${file.name}:${String(file.size)}:${String(file.lastModified)}`;

const inferredYear = (file: File, currentYear: number, index: number): string => {
  const match = /20\d{2}/u.exec(file.name)?.[0];
  return match ?? String(currentYear - index - 1);
};

const YEAR_ERROR = "Enter a whole year from 2000 to 2100.";

export const historicalYear = (value: string): number | undefined => {
  if (!/^\d{4}$/u.test(value)) return undefined;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : undefined;
};

export const historicalYearError = (value: string): string | undefined =>
  historicalYear(value) === undefined ? YEAR_ERROR : undefined;

export const acceptedHistoricalFiles = (files: readonly File[]): readonly File[] =>
  files.filter(file => {
    const extension = file.name.toLowerCase().split(".").at(-1);
    return (extension === "csv" || extension === "tsv" || extension === "xlsx")
      && file.size <= 5 * 1024 * 1024;
  });

export const historicalQueueReducer = (
  state: readonly HistoricalFileItem[],
  action: HistoricalQueueAction,
): readonly HistoricalFileItem[] => {
  if (action.type === "add") {
    const existing = new Set(state.map(item => item.id));
    const additions = acceptedHistoricalFiles(action.files).flatMap<HistoricalFileItem>((file, index) => {
      const id = fileId(file);
      if (existing.has(id)) return [];
      existing.add(id);
      return [{
        file,
        id,
        message: "Ready to import",
        ownerMappings: {},
        ownerNeeds: [],
        seasonYear: inferredYear(file, action.currentYear, state.length + index),
        status: "ready",
      }];
    });
    return [...state, ...additions];
  }
  if (action.type === "remove") return state.filter(item => item.id !== action.id);
  return state.map(item => {
    if (item.id !== action.id) return item;
    if (action.type === "year") return { ...item, seasonYear: action.seasonYear, status: "ready", message: "Ready to import" };
    if (action.type === "mapping") {
      return { ...item, ownerMappings: { ...item.ownerMappings, [action.label]: action.teamId }, status: "mapping" };
    }
    return {
      ...item,
      message: action.message,
      status: action.status,
      ownerNeeds: action.ownerNeeds ?? item.ownerNeeds,
    };
  });
};

export const duplicateHistoricalYears = (items: readonly HistoricalFileItem[]): boolean => {
  const pendingYears = items.filter(item => item.status !== "imported").flatMap(item => {
    const year = historicalYear(item.seasonYear);
    return year === undefined ? [] : [year];
  });
  return new Set(pendingYears).size !== pendingYears.length;
};

export const hasInvalidHistoricalYears = (items: readonly HistoricalFileItem[]): boolean =>
  items.some(item => item.status !== "imported" && historicalYear(item.seasonYear) === undefined);
