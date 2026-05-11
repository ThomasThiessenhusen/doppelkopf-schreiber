import { Chip } from 'react-native-paper';

import type { ScoreFlag } from '@/domain/models/scoreFlag';
import { useTranslation } from '@/presentation/i18n/useTranslation';

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
  const { t } = useTranslation();
  const value = displayedValue ?? flag.value;
  const flagLabel = t(flag.labelKey);
  const label = selected ? `${flagLabel}  ${formatValue(value)}` : flagLabel;
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
