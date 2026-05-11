import {
  contraDoppelkopf1,
  contraDoppelkopf2,
  contraDoppelkopf3,
  contraDoppelkopf4,
  contraFuchs1,
  contraFuchs2,
  contraFuchsLetzterStich,
  contraKarlchen,
  contraKarlchenGefangen,
  reDoppelkopf1,
  reDoppelkopf2,
  reDoppelkopf3,
  reDoppelkopf4,
  reFuchs1,
  reFuchs2,
  reFuchsLetzterStich,
  reKarlchen,
  reKarlchenGefangen,
  schwarz,
  under30,
  under60,
  under90,
} from '@/domain/scoring/scoringRules';
import type { ScoreFlag } from '@/domain/models/scoreFlag';

/**
 * Stichgebundene Sonderpunkte: Re- und Kontra-Variante schliessen sich
 * gegenseitig aus, weil der zugrunde liegende Stich nur an eine Seite gehen
 * kann.
 */
export const mutuallyExclusiveCounterparts: ReadonlyMap<string, string> = new Map([
  [reKarlchen.code, contraKarlchen.code],
  [contraKarlchen.code, reKarlchen.code],
  [reKarlchenGefangen.code, contraKarlchenGefangen.code],
  [contraKarlchenGefangen.code, reKarlchenGefangen.code],
  [reFuchsLetzterStich.code, contraFuchsLetzterStich.code],
  [contraFuchsLetzterStich.code, reFuchsLetzterStich.code],
]);

/**
 * Semantische Implikationen zwischen Score-Flags. Wenn der Schluessel-Flag
 * gesetzt wird, sind die Werte zwingend mitselektiert (und umgekehrt: wird
 * einer der Werte abgewaehlt, faellt der Schluessel mit weg).
 */
export const flagImplications: ReadonlyMap<string, ReadonlyArray<string>> = new Map([
  [schwarz.code, [under30.code, under60.code, under90.code]],
  [under30.code, [under60.code, under90.code]],
  [under60.code, [under90.code]],
  [reFuchs2.code, [reFuchs1.code]],
  [contraFuchs2.code, [contraFuchs1.code]],
  [reDoppelkopf2.code, [reDoppelkopf1.code]],
  [reDoppelkopf3.code, [reDoppelkopf2.code, reDoppelkopf1.code]],
  [
    reDoppelkopf4.code,
    [reDoppelkopf3.code, reDoppelkopf2.code, reDoppelkopf1.code],
  ],
  [contraDoppelkopf2.code, [contraDoppelkopf1.code]],
  [contraDoppelkopf3.code, [contraDoppelkopf2.code, contraDoppelkopf1.code]],
  [
    contraDoppelkopf4.code,
    [contraDoppelkopf3.code, contraDoppelkopf2.code, contraDoppelkopf1.code],
  ],
]);

/**
 * Karlchen-Sonderpunkte rund um den letzten Stich. Diese sind mit der Regel
 * "Fuchs macht den letzten Stich" wechselseitig ausgeschlossen, weil der
 * letzte Stich nur ein einziges Karten-Highlight transportieren kann.
 * "Dulle gefangen" gehoert bewusst nicht hierher: eine Dulle kann in jedem
 * beliebigen Stich gefangen werden, nicht nur im letzten.
 */
const karlchenCodes: ReadonlySet<string> = new Set([
  reKarlchen.code,
  reKarlchenGefangen.code,
  contraKarlchen.code,
  contraKarlchenGefangen.code,
]);

const fuchsLetzterStichCodes: ReadonlySet<string> = new Set([
  reFuchsLetzterStich.code,
  contraFuchsLetzterStich.code,
]);

/**
 * Sperrt Flags, die wegen einer Konflikt-Regel gerade nicht zusaetzlich
 * gesetzt werden duerfen. Ein bereits selektierter, jetzt gesperrter Chip
 * bleibt anklickbar (zum Abwaehlen).
 */
export function isFlagBlockedByConflict(
  f: ScoreFlag,
  selected: ReadonlySet<string>,
): boolean {
  if (fuchsLetzterStichCodes.has(f.code)) {
    for (const c of karlchenCodes) {
      if (selected.has(c)) return true;
    }
    return false;
  }
  if (karlchenCodes.has(f.code)) {
    for (const c of fuchsLetzterStichCodes) {
      if (selected.has(c)) return true;
    }
    return false;
  }
  return false;
}
