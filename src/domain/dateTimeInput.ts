/**
 * Formatierung und Parsing von Datum/Uhrzeit fuer Texteingaben
 * (`TT.MM.JJJJ` und `HH:MM`, jeweils lokale Zeit).
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDate(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * Liest `TT.MM.JJJJ` + `HH:MM` als lokale Zeit. Liefert `null` bei ungueltiger
 * Eingabe (auch bei nicht existierenden Tagen wie 31.02.).
 */
export function parseDateTime(dateText: string, timeText: string): Date | null {
  const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dateText.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeText.trim());
  if (dm === null || tm === null) return null;
  const day = Number(dm[1]);
  const month = Number(dm[2]);
  const year = Number(dm[3]);
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (hour > 23 || minute > 59) return null;
  const d = new Date(year, month - 1, day, hour, minute);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}
