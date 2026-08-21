import type {
  DraftRoomEventRow,
  DraftRoomExportContentRow,
  DraftRoomExportRow,
  DraftRoomRow,
  DraftRoomSaleRow,
  DraftRoomSnapshotRow,
  StoredAuthAccountRow,
  StoredAuthSessionRow,
} from "./postgresRows.js";

export const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

export const cloneDate = (date: Date | null): Date | null =>
  date === null ? null : new Date(date.getTime());

export const cloneJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

export const valueAt = (values: readonly unknown[], index: number): unknown => {
  if (index >= values.length) throw new Error(`Expected SQL value at index ${index}.`);
  return values[index];
};

export const stringValueAt = (values: readonly unknown[], index: number): string => {
  const value = valueAt(values, index);
  if (typeof value !== "string") throw new Error(`Expected string SQL value at index ${index}.`);
  return value;
};

export const numberValueAt = (values: readonly unknown[], index: number): number => {
  const value = valueAt(values, index);
  if (typeof value !== "number") throw new Error(`Expected number SQL value at index ${index}.`);
  return value;
};

export const nullableNumberValueAt = (
  values: readonly unknown[],
  index: number,
): number | null => {
  const value = valueAt(values, index);
  if (value === null) return null;
  if (typeof value !== "number") throw new Error(`Expected nullable number SQL value at index ${index}.`);
  return value;
};

export const dateValueAt = (values: readonly unknown[], index: number): Date => {
  const value = valueAt(values, index);
  if (!(value instanceof Date)) throw new Error(`Expected Date SQL value at index ${index}.`);
  return value;
};

export const nullableDateValueAt = (
  values: readonly unknown[],
  index: number,
): Date | null => {
  const value = valueAt(values, index);
  if (value === null) return null;
  if (!(value instanceof Date)) throw new Error(`Expected nullable Date SQL value at index ${index}.`);
  return value;
};

export const nullableStringValueAt = (
  values: readonly unknown[],
  index: number,
): string | null => {
  const value = valueAt(values, index);
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`Expected nullable string SQL value at index ${index}.`);
  return value;
};

export const optionalStringValueAt = (
  values: readonly unknown[],
  index: number,
): string | undefined => {
  const value = valueAt(values, index);
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`Expected optional string SQL value at index ${index}.`);
  return value;
};

export const jsonValue = (value: unknown): unknown => typeof value === "string"
  ? JSON.parse(value)
  : cloneJson(value);

export const cloneAuthAccountRow = (row: StoredAuthAccountRow): StoredAuthAccountRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
  updated_at: new Date(row.updated_at.getTime()),
});

export const cloneAuthSessionRow = (row: StoredAuthSessionRow): StoredAuthSessionRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
  expires_at: new Date(row.expires_at.getTime()),
  revoked_at: row.revoked_at === null ? null : new Date(row.revoked_at.getTime()),
});

export const cloneRoomRow = (row: DraftRoomRow): DraftRoomRow => ({
  ...row,
  current_projection_json: row.current_projection_json === null
    ? null
    : cloneJson(row.current_projection_json),
  starts_at: cloneDate(row.starts_at),
  started_at: cloneDate(row.started_at),
  ended_at: cloneDate(row.ended_at),
  created_at: new Date(row.created_at.getTime()),
  updated_at: new Date(row.updated_at.getTime()),
});

export const cloneEventRow = (row: DraftRoomEventRow): DraftRoomEventRow => ({
  ...row,
  payload_json: jsonValue(row.payload_json),
  occurred_at: new Date(row.occurred_at.getTime()),
});

export const cloneDraftRoomSnapshotRow = (row: DraftRoomSnapshotRow): DraftRoomSnapshotRow => ({
  ...row,
  snapshot_json: jsonValue(row.snapshot_json),
  created_at: new Date(row.created_at.getTime()),
});

export const cloneSaleRow = (row: DraftRoomSaleRow): DraftRoomSaleRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
});

export const cloneExportRow = (row: DraftRoomExportRow): DraftRoomExportRow => ({
  ...row,
  metadata_json: jsonValue(row.metadata_json),
  created_at: new Date(row.created_at.getTime()),
  completed_at: cloneDate(row.completed_at),
});

export const cloneContentRow = (row: DraftRoomExportContentRow): DraftRoomExportContentRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
});
