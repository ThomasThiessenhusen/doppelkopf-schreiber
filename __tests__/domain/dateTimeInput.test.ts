import { formatDate, formatTime, parseDateTime } from '@/domain/dateTimeInput';

describe('dateTimeInput', () => {
  test('formatDate / formatTime nutzen lokale Zeit mit fuehrenden Nullen', () => {
    const d = new Date(2026, 0, 5, 7, 3);
    expect(formatDate(d)).toBe('05.01.2026');
    expect(formatTime(d)).toBe('07:03');
  });

  test('parseDateTime liest gueltige Eingabe in lokaler Zeit', () => {
    const d = parseDateTime('20.05.2026', '19:45');
    expect(d).toEqual(new Date(2026, 4, 20, 19, 45));
  });

  test('parseDateTime toleriert Leerzeichen und einstellige Werte', () => {
    expect(parseDateTime(' 5.1.2026 ', ' 7:03 ')).toEqual(new Date(2026, 0, 5, 7, 3));
  });

  test.each([
    ['31.02.2026', '12:00'],
    ['32.01.2026', '12:00'],
    ['01.13.2026', '12:00'],
    ['01.01.26', '12:00'],
    ['2026-01-01', '12:00'],
    ['', '12:00'],
    ['01.01.2026', '24:00'],
    ['01.01.2026', '12:60'],
    ['01.01.2026', '1200'],
    ['01.01.2026', ''],
  ])('parseDateTime lehnt %s %s ab', (date, time) => {
    expect(parseDateTime(date, time)).toBeNull();
  });
});
