/**
 * `memoryStorage` gegen dieselbe Vertrags-Suite wie die anderen
 * Implementierungen. Der Code selbst ist unveraendert aus dem bisherigen
 * Test-Helfer uebernommen; neu ist, dass er den Vertrag nachweislich erfuellt
 * und nicht nur beilaeufig in Repository-Tests benutzt wird.
 */
import { createMemoryStorage } from '@/data/local/memoryStorage';

import { runLocalStorageContract } from './localStorageContract';

runLocalStorageContract('memoryStorage', () => createMemoryStorage());
