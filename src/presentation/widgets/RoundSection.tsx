import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  Dialog,
  Divider,
  Portal,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import { type Game, WinnerSide } from '@/domain/models/game';
import { playerDisplayName, type Player } from '@/domain/models/player';
import type { Round } from '@/domain/models/round';
import { BockLevel } from '@/domain/scoring/bockLevel';
import type { GameScore } from '@/domain/scoring/scoreCalculator';
import { flagByCode } from '@/domain/scoring/scoringRules';

export interface RoundSectionProps {
  round: Round;
  players: ReadonlyArray<Player>;
  scoresByGame: ReadonlyMap<string, GameScore>;
  bockLevelByGame: ReadonlyMap<string, BockLevel>;
  onEditGame: (game: Game) => void;
  onDeleteGame: (game: Game) => void;
}

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

export function RoundSection({
  round,
  players,
  scoresByGame,
  bockLevelByGame,
  onEditGame,
  onDeleteGame,
}: RoundSectionProps) {
  const theme = useTheme();
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);

  function byId(id: string): Player | undefined {
    return players.find((p) => p.id === id);
  }

  function names(ids: ReadonlyArray<string>): string {
    return ids
      .map((id) => byId(id))
      .filter((p): p is Player => p !== undefined)
      .map(playerDisplayName)
      .join(' & ');
  }

  function flagsLabel(codes: ReadonlyArray<string>): string {
    return codes
      .map((c) => flagByCode(c))
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map((f) => f.label)
      .join(' · ');
  }

  return (
    <Card style={{ marginHorizontal: 12, marginVertical: 6 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text variant="titleMedium">Runde {round.index + 1}</Text>
      </View>
      <Divider />
      {round.games.map((game, i) => {
        const score = scoresByGame.get(game.id) ?? { rePerPlayer: 0, contraPerPlayer: 0 };
        const level = bockLevelByGame.get(game.id) ?? BockLevel.none;
        const reLabel = game.isSolo ? 'Solo' : 'Re';
        const winnerText =
          game.winner === WinnerSide.re ? (game.isSolo ? 'Solist' : 'Re') : 'Kontra';
        const scoreColor = score.rePerPlayer >= 0 ? theme.colors.primary : theme.colors.error;
        const flags = flagsLabel(game.flagCodes);
        const sittingOut = game.sittingOutPlayerId !== null ? byId(game.sittingOutPlayerId) : null;

        return (
          <TouchableRipple
            key={game.id}
            onPress={() => onEditGame(game)}
            onLongPress={() => setDeleteTarget(game)}
          >
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 }}>
              <View style={{ width: 28 }}>
                <Text variant="bodyLarge">{i + 1}.</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.primary, fontWeight: 'bold' }}
                  >
                    {reLabel}:{' '}
                  </Text>
                  {names(game.rePlayerIds)}
                </Text>
                <Text variant="bodyMedium">
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.error, fontWeight: 'bold' }}
                  >
                    Kontra:{' '}
                  </Text>
                  {names(game.contraPlayerIds)}
                </Text>
                {sittingOut !== undefined && sittingOut !== null && (
                  <Text variant="bodySmall">Aussetzer: {playerDisplayName(sittingOut)}</Text>
                )}
                <Text variant="bodySmall" style={{ marginTop: 2 }}>
                  {winnerText} gewinnt
                  {flags !== '' ? ` · ${flags}` : ''}
                  {level === BockLevel.single ? ' · Bock' : ''}
                  {level === BockLevel.double ? ' · Doppelbock' : ''}
                </Text>
              </View>
              <View style={{ marginLeft: 8, alignItems: 'flex-end' }}>
                <Text
                  variant="titleMedium"
                  style={{ color: scoreColor, fontVariant: ['tabular-nums'] }}
                >
                  {formatPoints(score.rePerPlayer)}
                </Text>
                {game.isSolo && (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    je Kontra: {formatPoints(score.contraPerPlayer)}
                  </Text>
                )}
              </View>
            </View>
          </TouchableRipple>
        );
      })}

      <Portal>
        <Dialog visible={deleteTarget !== null} onDismiss={() => setDeleteTarget(null)}>
          <Dialog.Title>Spiel loeschen?</Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)}>Abbrechen</Button>
            <Button
              mode="contained-tonal"
              onPress={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (target !== null) onDeleteGame(target);
              }}
            >
              Loeschen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Card>
  );
}
