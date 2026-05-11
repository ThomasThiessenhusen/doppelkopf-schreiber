/**
 * Abstraktion ueber den lokalen Persistenz-Layer.
 *
 * Aktuelle Implementierung: `jsonFileStorage`. Eine Migration auf MMKV /
 * sqlite / Realm laesst sich realisieren, indem eine neue Implementierung
 * dieser Schnittstelle bereitgestellt und im Repository-Konstruktor
 * (`create...Repository`) ausgetauscht wird.
 */
export interface LocalStorage {
  readAll(collection: string): Promise<ReadonlyArray<Record<string, unknown>>>;
  readOne(collection: string, id: string): Promise<Record<string, unknown> | null>;
  write(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
}
