import { FlagGroup, FlagTarget, type ScoreFlag } from '@/domain/models/scoreFlag';

interface FlagInput {
  code: string;
  labelKey: string;
  value: number;
  target: FlagTarget;
  description?: string;
  group?: FlagGroup;
  isBaseFlag?: boolean;
}

function flag(input: FlagInput): ScoreFlag {
  const base: ScoreFlag = {
    code: input.code,
    labelKey: input.labelKey,
    value: input.value,
    target: input.target,
    group: input.group ?? FlagGroup.general,
    isBaseFlag: input.isBaseFlag ?? false,
  };
  return input.description !== undefined ? { ...base, description: input.description } : base;
}

export const reWon = flag({
  code: 'reWon',
  labelKey: 'scoringFlags.reWon',
  value: 1,
  target: FlagTarget.reSide,
  isBaseFlag: true,
});

export const contraWon = flag({
  code: 'contraWon',
  labelKey: 'scoringFlags.contraWon',
  value: 2,
  target: FlagTarget.contraSide,
  isBaseFlag: true,
});

export const reAnnounced = flag({
  code: 'reAnnounced',
  labelKey: 'scoringFlags.reAnnounced',
  value: 2,
  target: FlagTarget.winner,
  group: FlagGroup.reParty,
  description: 'Ansage Re — Punkt geht an die siegreiche Partei.',
});

export const reKarlchen = flag({
  code: 'reKarlchen',
  labelKey: 'scoringFlags.reKarlchen',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
  description:
    'Karlchen der Re-Partei — fester +1-Beitrag fuer Re. ' +
    'Erhoeht den Spielwert wenn Re gewinnt, reduziert ihn wenn Re verliert.',
});

export const reKarlchenGefangen = flag({
  code: 'reKarlchenGefangen',
  labelKey: 'scoringFlags.reKarlchenGefangen',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
  description:
    'Re hat das gegnerische Karlchen abgenommen — fester +1-Beitrag fuer Re. ' +
    'Wirkt positiv bei Re-Sieg, negativ bei Re-Niederlage.',
});

export const reDulleGefangen = flag({
  code: 'reDulleGefangen',
  labelKey: 'scoringFlags.reDulleGefangen',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
  description:
    'Re hat eine gegnerische Dulle abgenommen — fester +1-Beitrag fuer Re. ' +
    'Wirkt positiv bei Re-Sieg, negativ bei Re-Niederlage.',
});

export const reFuchsLetzterStich = flag({
  code: 'reFuchsLetzterStich',
  labelKey: 'scoringFlags.reFuchsLetzterStich',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
  description:
    'Re hat den letzten Stich mit einem Fuchs gemacht — fester +1-Beitrag fuer Re. ' +
    'Wirkt positiv bei Re-Sieg, negativ bei Re-Niederlage.',
});

export const reFuchs1 = flag({
  code: 'reFuchs1',
  labelKey: 'scoringFlags.reFuchs1',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
});

export const reFuchs2 = flag({
  code: 'reFuchs2',
  labelKey: 'scoringFlags.reFuchs2',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
});

export const reDoppelkopf1 = flag({
  code: 'reDoppelkopf1',
  labelKey: 'scoringFlags.reDoppelkopf1',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
});

export const reDoppelkopf2 = flag({
  code: 'reDoppelkopf2',
  labelKey: 'scoringFlags.reDoppelkopf2',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
});

export const reDoppelkopf3 = flag({
  code: 'reDoppelkopf3',
  labelKey: 'scoringFlags.reDoppelkopf3',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
});

export const reDoppelkopf4 = flag({
  code: 'reDoppelkopf4',
  labelKey: 'scoringFlags.reDoppelkopf4',
  value: 1,
  target: FlagTarget.reSide,
  group: FlagGroup.reParty,
});

export const reAnnouncedUnder90 = flag({
  code: 'reAnnouncedUnder90',
  labelKey: 'scoringFlags.reAnnouncedUnder90',
  value: 1,
  target: FlagTarget.winner,
  group: FlagGroup.reParty,
});

export const reAnnouncedUnder60 = flag({
  code: 'reAnnouncedUnder60',
  labelKey: 'scoringFlags.reAnnouncedUnder60',
  value: 1,
  target: FlagTarget.winner,
  group: FlagGroup.reParty,
});

export const reAnnouncedUnder30 = flag({
  code: 'reAnnouncedUnder30',
  labelKey: 'scoringFlags.reAnnouncedUnder30',
  value: 1,
  target: FlagTarget.winner,
  group: FlagGroup.reParty,
});

export const reAnnouncedSchwarz = flag({
  code: 'reAnnouncedSchwarz',
  labelKey: 'scoringFlags.reAnnouncedSchwarz',
  value: 1,
  target: FlagTarget.winner,
  group: FlagGroup.reParty,
});

export const contraAnnounced = flag({
  code: 'contraAnnounced',
  labelKey: 'scoringFlags.contraAnnounced',
  value: 2,
  target: FlagTarget.winner,
  group: FlagGroup.contraParty,
  description: 'Ansage Kontra — Punkt geht an die siegreiche Partei.',
});

export const contraKarlchen = flag({
  code: 'contraKarlchen',
  labelKey: 'scoringFlags.contraKarlchen',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
  description:
    'Karlchen der Kontra-Partei — fester +1-Beitrag fuer Kontra. ' +
    'Erhoeht den Spielwert wenn Kontra gewinnt, reduziert ihn wenn Kontra verliert.',
});

export const contraKarlchenGefangen = flag({
  code: 'contraKarlchenGefangen',
  labelKey: 'scoringFlags.contraKarlchenGefangen',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
  description:
    'Kontra hat das gegnerische Karlchen abgenommen — fester +1-Beitrag fuer Kontra. ' +
    'Wirkt positiv bei Kontra-Sieg, negativ bei Kontra-Niederlage.',
});

export const contraDulleGefangen = flag({
  code: 'contraDulleGefangen',
  labelKey: 'scoringFlags.contraDulleGefangen',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
  description:
    'Kontra hat eine gegnerische Dulle abgenommen — fester +1-Beitrag fuer Kontra. ' +
    'Wirkt positiv bei Kontra-Sieg, negativ bei Kontra-Niederlage.',
});

export const contraFuchsLetzterStich = flag({
  code: 'contraFuchsLetzterStich',
  labelKey: 'scoringFlags.contraFuchsLetzterStich',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
  description:
    'Kontra hat den letzten Stich mit einem Fuchs gemacht — fester +1-Beitrag fuer Kontra. ' +
    'Wirkt positiv bei Kontra-Sieg, negativ bei Kontra-Niederlage.',
});

export const contraFuchs1 = flag({
  code: 'contraFuchs1',
  labelKey: 'scoringFlags.contraFuchs1',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
});

export const contraFuchs2 = flag({
  code: 'contraFuchs2',
  labelKey: 'scoringFlags.contraFuchs2',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
});

export const contraDoppelkopf1 = flag({
  code: 'contraDoppelkopf1',
  labelKey: 'scoringFlags.contraDoppelkopf1',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
});

export const contraDoppelkopf2 = flag({
  code: 'contraDoppelkopf2',
  labelKey: 'scoringFlags.contraDoppelkopf2',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
});

export const contraDoppelkopf3 = flag({
  code: 'contraDoppelkopf3',
  labelKey: 'scoringFlags.contraDoppelkopf3',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
});

export const contraDoppelkopf4 = flag({
  code: 'contraDoppelkopf4',
  labelKey: 'scoringFlags.contraDoppelkopf4',
  value: 1,
  target: FlagTarget.contraSide,
  group: FlagGroup.contraParty,
});

export const contraAnnouncedUnder90 = flag({
  code: 'contraAnnouncedUnder90',
  labelKey: 'scoringFlags.contraAnnouncedUnder90',
  value: 1,
  target: FlagTarget.winner,
  group: FlagGroup.contraParty,
});

export const contraAnnouncedUnder60 = flag({
  code: 'contraAnnouncedUnder60',
  labelKey: 'scoringFlags.contraAnnouncedUnder60',
  value: 1,
  target: FlagTarget.winner,
  group: FlagGroup.contraParty,
});

export const contraAnnouncedUnder30 = flag({
  code: 'contraAnnouncedUnder30',
  labelKey: 'scoringFlags.contraAnnouncedUnder30',
  value: 1,
  target: FlagTarget.winner,
  group: FlagGroup.contraParty,
});

export const contraAnnouncedSchwarz = flag({
  code: 'contraAnnouncedSchwarz',
  labelKey: 'scoringFlags.contraAnnouncedSchwarz',
  value: 1,
  target: FlagTarget.winner,
  group: FlagGroup.contraParty,
});

export const under90 = flag({
  code: 'under90',
  labelKey: 'scoringFlags.under90',
  value: 1,
  target: FlagTarget.winner,
});

export const under60 = flag({
  code: 'under60',
  labelKey: 'scoringFlags.under60',
  value: 1,
  target: FlagTarget.winner,
});

export const under30 = flag({
  code: 'under30',
  labelKey: 'scoringFlags.under30',
  value: 1,
  target: FlagTarget.winner,
});

export const schwarz = flag({
  code: 'schwarz',
  labelKey: 'scoringFlags.schwarz',
  value: 1,
  target: FlagTarget.winner,
});

/** Katalog aller in der App bekannten Punkte-Flags. */
export const ALL_FLAGS: ReadonlyArray<ScoreFlag> = [
  reWon,
  contraWon,
  reAnnounced,
  reKarlchen,
  reKarlchenGefangen,
  reDulleGefangen,
  reFuchsLetzterStich,
  reFuchs1,
  reFuchs2,
  reDoppelkopf1,
  reDoppelkopf2,
  reDoppelkopf3,
  reDoppelkopf4,
  reAnnouncedUnder90,
  reAnnouncedUnder60,
  reAnnouncedUnder30,
  reAnnouncedSchwarz,
  contraAnnounced,
  contraKarlchen,
  contraKarlchenGefangen,
  contraDulleGefangen,
  contraFuchsLetzterStich,
  contraFuchs1,
  contraFuchs2,
  contraDoppelkopf1,
  contraDoppelkopf2,
  contraDoppelkopf3,
  contraDoppelkopf4,
  contraAnnouncedUnder90,
  contraAnnouncedUnder60,
  contraAnnouncedUnder30,
  contraAnnouncedSchwarz,
  under90,
  under60,
  under30,
  schwarz,
];

const BY_CODE: ReadonlyMap<string, ScoreFlag> = new Map(ALL_FLAGS.map((f) => [f.code, f]));

export function flagByCode(code: string): ScoreFlag | null {
  return BY_CODE.get(code) ?? null;
}

/** In der UI auswaehlbare Flags (ohne die automatisch gesetzten Basis-Flags). */
export function selectableFlags(): ReadonlyArray<ScoreFlag> {
  return ALL_FLAGS.filter((f) => !f.isBaseFlag);
}
