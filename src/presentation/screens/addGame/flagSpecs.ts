import {
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
  reAnnouncedUnder90.code,
  reAnnouncedUnder60.code,
  reAnnouncedUnder30.code,
  reAnnouncedSchwarz.code,
];

export const contraAnnouncementCodes: ReadonlyArray<string> = [
  contraAnnouncedUnder90.code,
  contraAnnouncedUnder60.code,
  contraAnnouncedUnder30.code,
  contraAnnouncedSchwarz.code,
];

/**
 * Stufenansage-Anzeige-Label.
 * 0 → "keine Stufe angesagt", 1..4 → "Unter 90/60/30 / Schwarz angesagt +N".
 */
export function announcementChipLabel(count: number): string {
  if (count <= 0) return 'keine Stufe angesagt';
  if (count === 1) return 'Unter 90 angesagt +1';
  if (count === 2) return 'Unter 60 angesagt +2';
  if (count === 3) return 'Unter 30 angesagt +3';
  return 'Schwarz angesagt +' + String(count);
}

/** Stufe-Chip-Label. 0 → "Stufe", 1..4 → "Unter 90/60/30 / Schwarz +N". */
export function levelChipLabel(count: number): string {
  if (count === 1) return 'Unter 90 +1';
  if (count === 2) return 'Unter 60 +2';
  if (count === 3) return 'Unter 30 +3';
  if (count === 4) return 'Schwarz +4';
  return 'Stufe';
}
