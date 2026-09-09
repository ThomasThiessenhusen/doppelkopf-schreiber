/**
 * Die Implementierung ist nach `src/data/local/memoryStorage.ts` gewandert,
 * weil sie im Web als letzte Rueckfallebene auch im Produktivcode gebraucht
 * wird. Dieser Re-Export bleibt, damit die bestehenden Repository-Tests
 * unveraendert weiterlaufen.
 */
export { createMemoryStorage as createInMemoryStorage } from '@/data/local/memoryStorage';
