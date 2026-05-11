import { Chip } from 'react-native-paper';

import type { ScoreFlag } from '@/domain/models/scoreFlag';

export interface FlagChipProps {
  flag: ScoreFlag;
  selected: boolean;
  /** Ueberschreibt den Wert in der Anzeige (z. B. Vorzeichen je nach Sieger). */
  displayedValue?: number;
  /** false deaktiviert den Chip; selektierte Chips bleiben anklickbar zum Abwaehlen. */
  enabled?: boolean;
  onChanged: (selected: boolean) => void;
}

function formatValue(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

export function FlagChip({
  flag,
  selected,
  displayedValue,
  enabled = true,
  onChanged,
}: FlagChipProps) {
  const value = displayedValue ?? flag.value;
  const label = selected ? `${flag.label}  ${formatValue(value)}` : flag.label;
  const isDisabled = !enabled && !selected;
  return (
    <Chip
      selected={selected}
      disabled={isDisabled}
      showSelectedCheck={false}
      onPress={() => onChanged(!selected)}
    >
      {label}
    </Chip>
  );
}
