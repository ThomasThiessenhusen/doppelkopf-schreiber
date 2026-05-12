import {
  announcementLabel,
  reAnnouncementCodes,
  contraAnnouncementCodes,
} from '@/presentation/screens/addGame/flagSpecs';
import {
  reAnnounced,
  reAnnouncedSchwarz,
  reAnnouncedUnder30,
  reAnnouncedUnder60,
  reAnnouncedUnder90,
  contraAnnounced,
  contraAnnouncedSchwarz,
  contraAnnouncedUnder30,
  contraAnnouncedUnder60,
  contraAnnouncedUnder90,
} from '@/domain/scoring/scoringRules';

describe('flagSpecs announcement cycle', () => {
  test('reAnnouncementCodes startet mit reAnnounced gefolgt von den Stufen', () => {
    expect(reAnnouncementCodes).toEqual([
      reAnnounced.code,
      reAnnouncedUnder90.code,
      reAnnouncedUnder60.code,
      reAnnouncedUnder30.code,
      reAnnouncedSchwarz.code,
    ]);
  });

  test('contraAnnouncementCodes startet mit contraAnnounced gefolgt von den Stufen', () => {
    expect(contraAnnouncementCodes).toEqual([
      contraAnnounced.code,
      contraAnnouncedUnder90.code,
      contraAnnouncedUnder60.code,
      contraAnnouncedUnder30.code,
      contraAnnouncedSchwarz.code,
    ]);
  });
});

describe('announcementLabel', () => {
  test('count 0 -> none-Key, count 0', () => {
    expect(announcementLabel(0, 're')).toEqual({
      key: 'addGame.announcementChip.none',
      count: 0,
    });
    expect(announcementLabel(0, 'contra')).toEqual({
      key: 'addGame.announcementChip.none',
      count: 0,
    });
  });

  test('count 1 -> seitenspezifischer Basis-Key, count 2', () => {
    expect(announcementLabel(1, 're')).toEqual({
      key: 'addGame.announcementChip.reBase',
      count: 2,
    });
    expect(announcementLabel(1, 'contra')).toEqual({
      key: 'addGame.announcementChip.contraBase',
      count: 2,
    });
  });

  test('count 2 -> under90, count 3', () => {
    expect(announcementLabel(2, 're')).toEqual({
      key: 'addGame.announcementChip.under90',
      count: 3,
    });
    expect(announcementLabel(2, 'contra')).toEqual({
      key: 'addGame.announcementChip.under90',
      count: 3,
    });
  });

  test('count 3 -> under60, count 4', () => {
    expect(announcementLabel(3, 're')).toEqual({
      key: 'addGame.announcementChip.under60',
      count: 4,
    });
  });

  test('count 4 -> under30, count 5', () => {
    expect(announcementLabel(4, 're')).toEqual({
      key: 'addGame.announcementChip.under30',
      count: 5,
    });
  });

  test('count 5 -> schwarz, count 6', () => {
    expect(announcementLabel(5, 're')).toEqual({
      key: 'addGame.announcementChip.schwarz',
      count: 6,
    });
    expect(announcementLabel(5, 'contra')).toEqual({
      key: 'addGame.announcementChip.schwarz',
      count: 6,
    });
  });
});
