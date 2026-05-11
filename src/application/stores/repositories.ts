import { createJsonFileStorage } from '@/data/local/jsonFileStorage';
import {
  createLocalGameSheetRepository,
  type GameSheetRepository,
} from '@/data/repositories/gameSheetRepository';
import {
  createLocalPlayerRepository,
  type PlayerRepository,
} from '@/data/repositories/playerRepository';
import {
  createLocalSettingsRepository,
  type SettingsRepository,
} from '@/data/repositories/settingsRepository';
import {
  createLocalSheetGroupRepository,
  type SheetGroupRepository,
} from '@/data/repositories/sheetGroupRepository';

/**
 * Repository-Singletons. Stores rufen `repositories.xyz()` auf, statt eine
 * Instanz zu halten — so kann der Setup zentral ausgetauscht werden (z. B.
 * fuer In-Memory-Storage-Probe-Skripte).
 */
const storage = createJsonFileStorage();

let _gameSheet = createLocalGameSheetRepository(storage);
let _player = createLocalPlayerRepository(storage);
let _settings = createLocalSettingsRepository(storage);
let _sheetGroup = createLocalSheetGroupRepository(storage);

export const repositories = {
  gameSheet: (): GameSheetRepository => _gameSheet,
  player: (): PlayerRepository => _player,
  settings: (): SettingsRepository => _settings,
  sheetGroup: (): SheetGroupRepository => _sheetGroup,
};

/**
 * Test-/Probe-Override: ersetzt die Repository-Instanzen. Nur fuer Tests
 * und manuelle Probe-Skripte — App-Code ruft dies nicht auf.
 */
export function _overrideRepositoriesForTest(
  overrides: Partial<{
    gameSheet: GameSheetRepository;
    player: PlayerRepository;
    settings: SettingsRepository;
    sheetGroup: SheetGroupRepository;
  }>,
): void {
  if (overrides.gameSheet) _gameSheet = overrides.gameSheet;
  if (overrides.player) _player = overrides.player;
  if (overrides.settings) _settings = overrides.settings;
  if (overrides.sheetGroup) _sheetGroup = overrides.sheetGroup;
}
