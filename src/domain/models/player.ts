import { newId } from '@/core/id';

/**
 * Ein Spieler — im app-weiten Spielerpool oder als Snapshot im Spielbogen.
 * Die ID ist stabil und wird in `Game` referenziert.
 *
 * `firstName` ist Pflicht; `lastName` und `nickname` optional. Die
 * Spielerverwaltung erzwingt zusaetzlich Nachname; das Modell erlaubt
 * `null`, damit aeltere Spielboegen mit nur einem Namen (Legacy-Schema)
 * weiterhin gelesen werden koennen.
 */
export interface Player {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly nickname: string | null;
}

export interface CreatePlayerInput {
  firstName: string;
  lastName?: string | null;
  nickname?: string | null;
}

export function createPlayer(input: CreatePlayerInput): Player {
  return {
    id: newId(),
    firstName: input.firstName.trim(),
    lastName: emptyToNull(input.lastName),
    nickname: emptyToNull(input.nickname),
  };
}

/** Anzeigename — Spitzname falls vorhanden, sonst „Vorname Nachname". */
export function playerDisplayName(p: Player): string {
  const nick = p.nickname?.trim();
  if (nick !== undefined && nick !== '') return nick;
  return playerFullName(p);
}

/** Vollstaendiger Name ohne Spitzname. */
export function playerFullName(p: Player): string {
  const last = p.lastName?.trim();
  if (last === undefined || last === '') return p.firstName;
  return `${p.firstName} ${last}`;
}

/**
 * Aktualisiert ausgewaehlte Felder. `null` in `lastName` / `nickname` loescht
 * das Feld; Auslassen behaelt den bisherigen Wert. Spiegelt das Sentinel-
 * Pattern aus dem Dart-Original wider.
 */
export interface PlayerPatch {
  firstName?: string;
  /** Auslassen = behalten; `null` = loeschen; String = setzen. */
  lastName?: string | null;
  /** Auslassen = behalten; `null` = loeschen; String = setzen. */
  nickname?: string | null;
}

export function copyPlayer(p: Player, patch: PlayerPatch): Player {
  return {
    id: p.id,
    firstName: patch.firstName ?? p.firstName,
    lastName: 'lastName' in patch ? (patch.lastName ?? null) : p.lastName,
    nickname: 'nickname' in patch ? (patch.nickname ?? null) : p.nickname,
  };
}

export function playerToJson(p: Player): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: p.id,
    firstName: p.firstName,
  };
  if (p.lastName !== null) out['lastName'] = p.lastName;
  if (p.nickname !== null) out['nickname'] = p.nickname;
  return out;
}

/**
 * Liest sowohl das neue Schema (firstName/lastName/nickname) als auch das
 * alte (nur `name`) — wichtig fuer bereits gespeicherte Spielboegen.
 */
export function playerFromJson(json: Record<string, unknown>): Player {
  const id = json['id'];
  if (typeof id !== 'string') {
    throw new Error('Player.id fehlt oder ist kein String');
  }
  const firstName = json['firstName'];
  if (typeof firstName !== 'string') {
    const legacyName = json['name'];
    return {
      id,
      firstName: typeof legacyName === 'string' ? legacyName : '',
      lastName: null,
      nickname: null,
    };
  }
  return {
    id,
    firstName,
    lastName: typeof json['lastName'] === 'string' ? (json['lastName'] as string) : null,
    nickname: typeof json['nickname'] === 'string' ? (json['nickname'] as string) : null,
  };
}

function emptyToNull(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t === '' ? null : t;
}
