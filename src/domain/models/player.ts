import { newId } from '@/core/id';

/**
 * Ein Spieler — im app-weiten Spielerpool oder als Snapshot im Spielbogen.
 * Die ID ist stabil und wird in `Game` referenziert.
 *
 * `playerName` ist Pflicht und wird in der UI als "Spielername" angezeigt.
 * `firstName` und `lastName` sind optional.
 */
export interface Player {
  readonly id: string;
  readonly playerName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
}

export interface CreatePlayerInput {
  playerName: string;
  firstName?: string | null;
  lastName?: string | null;
}

export function createPlayer(input: CreatePlayerInput): Player {
  return {
    id: newId(),
    playerName: input.playerName.trim(),
    firstName: emptyToNull(input.firstName),
    lastName: emptyToNull(input.lastName),
  };
}

/** Anzeigename — der Spielername. */
export function playerDisplayName(p: Player): string {
  return p.playerName;
}

/** Vor- und Nachname zusammengesetzt; leerer String falls beide fehlen. */
export function playerFullName(p: Player): string {
  const first = p.firstName?.trim() ?? '';
  const last = p.lastName?.trim() ?? '';
  if (first === '' && last === '') return '';
  if (first === '') return last;
  if (last === '') return first;
  return `${first} ${last}`;
}

/**
 * Aktualisiert ausgewaehlte Felder. `null` in `firstName` / `lastName`
 * loescht das Feld; Auslassen behaelt den bisherigen Wert. `playerName`
 * kann nur ueberschrieben, nicht geloescht werden.
 */
export interface PlayerPatch {
  playerName?: string;
  /** Auslassen = behalten; `null` = loeschen; String = setzen. */
  firstName?: string | null;
  /** Auslassen = behalten; `null` = loeschen; String = setzen. */
  lastName?: string | null;
}

export function copyPlayer(p: Player, patch: PlayerPatch): Player {
  return {
    id: p.id,
    playerName: patch.playerName ?? p.playerName,
    firstName: 'firstName' in patch ? (patch.firstName ?? null) : p.firstName,
    lastName: 'lastName' in patch ? (patch.lastName ?? null) : p.lastName,
  };
}

export function playerToJson(p: Player): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: p.id,
    playerName: p.playerName,
  };
  if (p.firstName !== null) out['firstName'] = p.firstName;
  if (p.lastName !== null) out['lastName'] = p.lastName;
  return out;
}

/**
 * Liest die aktuelle Form (`playerName` Pflicht). Defensives Lesen fuer
 * alte Daten: erst `nickname`-Key, dann Komposition aus firstName +
 * lastName, dann sehr alter Einzel-`name`-Key, sonst leerer String.
 */
export function playerFromJson(json: Record<string, unknown>): Player {
  const id = json['id'];
  if (typeof id !== 'string') {
    throw new Error('Player.id fehlt oder ist kein String');
  }
  const firstName =
    typeof json['firstName'] === 'string' ? (json['firstName'] as string) : null;
  const lastName =
    typeof json['lastName'] === 'string' ? (json['lastName'] as string) : null;
  const playerName = resolvePlayerName(json, firstName, lastName);
  return { id, playerName, firstName, lastName };
}

function resolvePlayerName(
  json: Record<string, unknown>,
  firstName: string | null,
  lastName: string | null,
): string {
  const direct = json['playerName'];
  if (typeof direct === 'string') return direct;
  const legacyNickname = json['nickname'];
  if (typeof legacyNickname === 'string') return legacyNickname;
  const parts = [firstName, lastName].filter(
    (s): s is string => s !== null && s !== '',
  );
  if (parts.length > 0) return parts.join(' ');
  const legacyName = json['name'];
  if (typeof legacyName === 'string') return legacyName;
  return '';
}

function emptyToNull(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t === '' ? null : t;
}
