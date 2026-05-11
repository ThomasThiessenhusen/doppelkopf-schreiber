import { type Game, WinnerSide } from '@/domain/models/game';
import { allGames, gamesPerRound, type GameSheet } from '@/domain/models/gameSheet';
import { BockLevel } from '@/domain/scoring/bockLevel';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { contraAnnounced, reAnnounced } from '@/domain/scoring/scoringRules';

const RE_ANNOUNCED_CODE = reAnnounced.code;
const CONTRA_ANNOUNCED_CODE = contraAnnounced.code;

/**
 * Snapshot des aktuellen Bock-Zustands eines Spielbogens — bezogen auf das
 * *naechste* Spiel.
 */
export interface BockState {
  /** Welches Niveau das naechste Spiel zugewiesen bekaeme. */
  readonly level: BockLevel;
  /**
   * Spiele auf Niveau `double`, bevor der Doppelbock-Status endet und die
   * Bockrunde auf einfachen Bock zurueckfaellt. Im sequenziellen Modus immer 0.
   */
  readonly remainingDouble: number;
  /**
   * Spiele auf Niveau `single` *nach* der Doppelbock-Phase, bevor die
   * Bockrunde komplett endet. Gesamtdauer = `remainingDouble + remainingSingle`.
   */
  readonly remainingSingle: number;
}

export const bockStateEmpty: BockState = {
  level: BockLevel.none,
  remainingDouble: 0,
  remainingSingle: 0,
};

/**
 * Reine Funktion: ermittelt aus einer Spielreihe das `BockLevel` pro Spiel.
 *
 * Die Berechnung ist deterministisch und O(N) ueber die Anzahl Spiele.
 * Bock-Status wird *nicht* persistiert — Editieren/Loeschen einzelner Spiele
 * propagiert automatisch korrekt, weil die Folgespiele neu klassifiziert
 * werden. Reihenfolge der Schluessel entspricht der Iteration ueber
 * `allGames(sheet)`.
 */
export function resolveBock(
  sheet: GameSheet,
  mode: BockStackingMode,
): Map<string, BockLevel> {
  const result = new Map<string, BockLevel>();
  const remaining: number[] = [];
  const roundLength = gamesPerRound(sheet);

  for (const game of allGames(sheet)) {
    // Reihenfolge wichtig: Level zuerst aus den BEREITS laufenden Runden
    // ableiten, BEVOR der Slot dekrementiert oder ein neuer Trigger
    // angehaengt wird. So erhaelt das ausloesende Spiel selbst nicht das
    // Level seiner eigenen neuen Runde, und das aktuelle Spiel verbraucht
    // genau einen Slot der laufenden Runden.
    const active = remaining.reduce((n, r) => (r > 0 ? n + 1 : n), 0);
    result.set(game.id, levelFor(active, mode));

    // Restzaehler dekrementieren (das Spiel hat einen Slot verbraucht).
    for (let i = 0; i < remaining.length; i++) {
      remaining[i] = remaining[i]! - 1;
    }
    // remove all <= 0 (von hinten iterieren, damit Indizes stabil bleiben)
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i]! <= 0) remaining.splice(i, 1);
    }

    // Trigger? Neue Bockrunde an die Queue anhaengen — startet erst beim
    // naechsten Spiel.
    if (isTrigger(game)) {
      remaining.push(roundLength);
    }
  }

  return result;
}

function levelFor(activeRunden: number, mode: BockStackingMode): BockLevel {
  if (mode === BockStackingMode.sequential) {
    return activeRunden >= 1 ? BockLevel.single : BockLevel.none;
  }
  // doppelbock
  if (activeRunden >= 2) return BockLevel.double;
  if (activeRunden === 1) return BockLevel.single;
  return BockLevel.none;
}

function isTrigger(game: Game): boolean {
  if (game.triggersManualBock) return true;
  const hasReAnnounced = game.flagCodes.includes(RE_ANNOUNCED_CODE);
  const hasContraAnnounced = game.flagCodes.includes(CONTRA_ANNOUNCED_CODE);
  if (hasReAnnounced && game.winner === WinnerSide.contra) return true;
  if (hasContraAnnounced && game.winner === WinnerSide.re) return true;
  return false;
}

/**
 * Zustand des Spielbogens fuer den Header-Banner.
 *
 * Berechnet, was das *naechste* Spiel an Niveau bekommen wuerde, sowie die
 * Restanzahl Spiele bis das Niveau faellt. Implementiert ueber denselben
 * Algorithmus wie `resolveBock`, am Ende werden die Restzaehler ausgewertet.
 */
export function currentBockState(
  sheet: GameSheet,
  mode: BockStackingMode,
): BockState {
  const remaining: number[] = [];
  const roundLength = gamesPerRound(sheet);

  for (const game of allGames(sheet)) {
    for (let i = 0; i < remaining.length; i++) {
      remaining[i] = remaining[i]! - 1;
    }
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i]! <= 0) remaining.splice(i, 1);
    }
    if (isTrigger(game)) {
      remaining.push(roundLength);
    }
  }

  const active = remaining.length;
  const level = levelFor(active, mode);

  if (active === 0) {
    return bockStateEmpty;
  }
  if (mode === BockStackingMode.sequential) {
    const maxR = remaining.reduce((a, b) => (a > b ? a : b));
    return { level, remainingDouble: 0, remainingSingle: maxR };
  }
  // doppelbock
  if (active === 1) {
    return {
      level: BockLevel.single,
      remainingDouble: 0,
      remainingSingle: remaining[0]!,
    };
  }
  // active >= 2
  const sorted = [...remaining].sort((a, b) => a - b);
  const minR = sorted[0]!;
  const maxR = sorted[sorted.length - 1]!;
  return {
    level: BockLevel.double,
    remainingDouble: minR,
    remainingSingle: maxR - minR,
  };
}

/**
 * Liefert den effektiven Stapelmodus fuer einen Spielbogen.
 *
 * Verwendet `sheet.stackingModeOverride`, falls gesetzt — sonst den
 * App-Default. Lebt im Domain-Layer, weil er rein auf Domain-Modellen
 * arbeitet und keine Store-Abhaengigkeit braucht.
 */
export function effectiveStackingMode(
  sheet: GameSheet,
  defaultMode: BockStackingMode,
): BockStackingMode {
  return sheet.stackingModeOverride ?? defaultMode;
}
