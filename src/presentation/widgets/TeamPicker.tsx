import { useState } from 'react';
import { View } from 'react-native';
import { Chip, Menu, Text } from 'react-native-paper';

import { playerDisplayName, type Player } from '@/domain/models/player';

export interface TeamPickerProps {
  players: ReadonlyArray<Player>;
  /** `null` bei 4-Spieler-Spielen. */
  sittingOutPlayerId: string | null;
  selectedRePlayerIds: ReadonlySet<string>;
  onChanged: (next: Set<string>) => void;
  /** `undefined` deaktiviert Aussetzer-Aenderung (Edit-Modus). */
  onSittingOutChanged?: (player: Player) => void;
}

const MAX_RE_COUNT = 2;

export function TeamPicker({
  players,
  sittingOutPlayerId,
  selectedRePlayerIds,
  onChanged,
  onSittingOutChanged,
}: TeamPickerProps) {
  const activePlayers = players.filter((p) => p.id !== sittingOutPlayerId);
  const reCount = selectedRePlayerIds.size;
  const hasPreview = reCount === 1 || reCount === 2;
  const hasAussetzer = sittingOutPlayerId !== null;

  function toggle(p: Player, isSelected: boolean) {
    const next = new Set(selectedRePlayerIds);
    if (isSelected) {
      next.add(p.id);
    } else {
      next.delete(p.id);
    }
    onChanged(next);
  }

  const contraNames = activePlayers
    .filter((p) => !selectedRePlayerIds.has(p.id))
    .map(playerDisplayName)
    .join(' & ');
  const modeLabel = reCount === 1 ? 'Solo-Spiel' : 'Normales Spiel';

  return (
    <View style={{ gap: 6 }}>
      <Text variant="titleSmall">Re-Partei (1 oder 2 Spieler)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {activePlayers.map((p) => {
          const isSelected = selectedRePlayerIds.has(p.id);
          const atCap = reCount >= MAX_RE_COUNT;
          const disabled = atCap && !isSelected;
          return (
            <Chip
              key={p.id}
              selected={isSelected}
              disabled={disabled}
              showSelectedCheck={false}
              onPress={() => toggle(p, !isSelected)}
            >
              {playerDisplayName(p)}
            </Chip>
          );
        })}
      </View>
      {(hasPreview || hasAussetzer) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {hasAussetzer && (
            <AussetzerChip
              players={players}
              sittingOutPlayerId={sittingOutPlayerId}
              onSittingOutChanged={onSittingOutChanged}
            />
          )}
          <View style={{ flex: 1 }}>
            {hasPreview && (
              <Text variant="bodySmall">
                {modeLabel} · Kontra: {contraNames}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

interface AussetzerChipProps {
  players: ReadonlyArray<Player>;
  sittingOutPlayerId: string;
  onSittingOutChanged?: (player: Player) => void;
}

function AussetzerChip({
  players,
  sittingOutPlayerId,
  onSittingOutChanged,
}: AussetzerChipProps) {
  const player = players.find((p) => p.id === sittingOutPlayerId);
  const [menuOpen, setMenuOpen] = useState(false);
  if (player === undefined) return null;
  const canChange = onSittingOutChanged !== undefined;

  const chip = (
    <Chip
      icon={canChange ? 'swap-horizontal' : undefined}
      onPress={canChange ? () => setMenuOpen(true) : undefined}
    >
      {playerDisplayName(player)}
    </Chip>
  );

  if (!canChange) return chip;

  return (
    <Menu visible={menuOpen} onDismiss={() => setMenuOpen(false)} anchor={chip}>
      {players
        .filter((p) => p.id !== sittingOutPlayerId)
        .map((candidate) => (
          <Menu.Item
            key={candidate.id}
            title={playerDisplayName(candidate)}
            onPress={() => {
              setMenuOpen(false);
              onSittingOutChanged?.(candidate);
            }}
          />
        ))}
    </Menu>
  );
}
