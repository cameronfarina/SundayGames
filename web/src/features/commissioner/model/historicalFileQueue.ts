export interface HistoricalFileItem {
  readonly file: File;
  readonly id: string;
  readonly message: string;
  readonly ownerMappings: Readonly<Record<string, string>>;
  readonly ownerNeeds: readonly string[];
  readonly seasonYear: number;
  readonly status: "ready" | "mapping" | "imported" | "error";
}

export type HistoricalQueueAction =
  | { readonly type: "add"; readonly files: readonly File[]; readonly currentYear: number }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "year"; readonly id: string; readonly seasonYear: number }
  | { readonly type: "mapping"; readonly id: string; readonly label: string; readonly teamId: string }
  | { readonly type: "result"; readonly id: string; readonly status: HistoricalFileItem["status"];
      readonly message: string; readonly ownerNeeds?: readonly string[] };

const fileId = (file: File): string =>
  `${file.name}:${String(file.size)}:${String(file.lastModified)}`;

const inferredYear = (file: File, currentYear: number, index: number): number => {
  const match = /20\d{2}/u.exec(file.name)?.[0];
  return match === undefined ? currentYear - index - 1 : Number(match);
};

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
  const pendingYears = items.filter(item => item.status !== "imported").map(item => item.seasonYear);
  return new Set(pendingYears).size !== pendingYears.length;
};
