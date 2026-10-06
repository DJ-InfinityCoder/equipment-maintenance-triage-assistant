import { ObjectId } from "mongodb";

/**
 * Strips internal MongoDB _id or converts ObjectIds to plain strings
 * so domain models and UI types stay clean and plain without leaking driver artifacts.
 */
export function stripMongoId<T extends { _id?: ObjectId }>(
  doc: T | null | undefined
): Omit<T, "_id"> | null {
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest as Omit<T, "_id">;
}

export function serializeMongoDoc<T extends Record<string, unknown>>(doc: T): T {
  if (!doc) return doc;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(doc)) {
    if (key === "_id") {
      // keep or omit: if _id is ObjectId, skip or convert
      continue;
    } else if (value instanceof ObjectId) {
      result[key] = value.toHexString();
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === "object" && !(item instanceof Date)
          ? serializeMongoDoc(item as Record<string, unknown>)
          : item
      );
    } else if (value && typeof value === "object" && !(value instanceof Date)) {
      result[key] = serializeMongoDoc(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
