import {
  contraAnnounced,
  contraAnnouncedSchwarz,
  contraAnnouncedUnder30,
  contraAnnouncedUnder60,
  contraAnnouncedUnder90,
  contraDoppelkopf1,
  contraDoppelkopf2,
  contraDoppelkopf3,
  contraDoppelkopf4,
  contraFuchs1,
  contraFuchs2,
  reAnnounced,
  reAnnouncedSchwarz,
  reAnnouncedUnder30,
  reAnnouncedUnder60,
  reAnnouncedUnder90,
  reDoppelkopf1,
  reDoppelkopf2,
  reDoppelkopf3,
  reDoppelkopf4,
  reFuchs1,
  reFuchs2,
  schwarz,
  under30,
  under60,
  under90,
} from '@/domain/scoring/scoringRules';

/**
 * Klick-Counter, der durch Stufen 0..N zykliert und mit einem zweiten Counter
 * (Gegenseite) ein Gesamt-Limit teilt.
 */
export interface StackingCounterSpec {
  labelKey: 'addGame.flags.fuchsCaught' | 'addGame.flags.doppelkopf';
  /** Codes der Stufen 1..N fuer die Re-Seite (Index 0 = Stufe 1). */
  reCodes: ReadonlyArray<string>;
  /** Codes der Stufen 1..N fuer die Kontra-Seite (Index 0 = Stufe 1). */
  contraCodes: ReadonlyArray<string>;
  /** Maximaler Gesamtcount (Re + Kontra zusammen). */
  maxTotal: number;
}

export function stepsPerSide(spec: StackingCounterSpec): number {
  return spec.reCodes.length;
}

export const fuchsSpec: StackingCounterSpec = {
  labelKey: 'addGame.flags.fuchsCaught',
  reCodes: [reFuchs1.code, reFuchs2.code],
  contraCodes: [contraFuchs1.code, contraFuchs2.code],
  maxTotal: 2,
};

export const doppelkopfSpec: StackingCounterSpec = {
  labelKey: 'addGame.flags.doppelkopf',
  reCodes: [
    reDoppelkopf1.code,
    reDoppelkopf2.code,
    reDoppelkopf3.code,
    reDoppelkopf4.code,
  ],
  contraCodes: [
    contraDoppelkopf1.code,
    contraDoppelkopf2.code,
    contraDoppelkopf3.code,
    contraDoppelkopf4.code,
  ],
  maxTotal: 4,
};

/** Stufe-Kette: Unter 90 → Unter 60 → Unter 30 → Schwarz. */
export const levelCodes: ReadonlyArray<string> = [
  under90.code,
  under60.code,
  under30.code,
  schwarz.code,
];

export const reAnnouncementCodes: ReadonlyArray<string> = [
  reAnnounced.code,
  reAnnouncedUnder90.code,
  reAnnouncedUnder60.code,
  reAnnouncedUnder30.code,
  reAnnouncedSchwarz.code,
];

export const contraAnnouncementCodes: ReadonlyArray<string> = [
  contraAnnounced.code,
  contraAnnouncedUnder90.code,
  contraAnnouncedUnder60.code,
  contraAnnouncedUnder30.code,
  contraAnnouncedSchwarz.code,
];

export type AnnouncementSide = 're' | 'contra';

export interface AnnouncementLabelSpec {
  /** i18n key to feed into t(). */
  key: string;
  /** Cumulative game-value count used in the label, 0 when none. */
  count: number;
}

/**
 * Liefert i18n-Key und kumulierten Spielwert-Beitrag fuer den Zyklus-Chip
 * der Ansagen (0..5). 0 = keine Ansage, 1 = nur Re/Kontra angesagt (+2),
 * 2..5 = zusaetzlich Unter 90/60/30/Schwarz (+3..+6).
 */
export function announcementLabel(
  count: number,
  side: AnnouncementSide,
): AnnouncementLabelSpec {
  if (count <= 0) return { key: 'addGame.announcementChip.none', count: 0 };
  const cumulative = count + 1;
  switch (count) {
    case 1:
      return {
        key:
          side === 're'
            ? 'addGame.announcementChip.reBase'
            : 'addGame.announcementChip.contraBase',
        count: cumulative,
      };
    case 2:
      return { key: 'addGame.announcementChip.under90', count: cumulative };
    case 3:
      return { key: 'addGame.announcementChip.under60', count: cumulative };
    case 4:
      return { key: 'addGame.announcementChip.under30', count: cumulative };
    default:
      return { key: 'addGame.announcementChip.schwarz', count: cumulative };
  }
}
