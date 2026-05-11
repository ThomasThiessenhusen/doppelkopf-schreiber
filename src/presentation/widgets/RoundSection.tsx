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
import { useTranslation } from '@/presentation/i18n/useTranslation';

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
  const { t } = useTranslation();
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
      .map((f) => t(f.labelKey))
      .join(' · ');
  }

  return (
    <Card style={{ marginHorizontal: 12, marginVertical: 6 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text variant="titleMedium">{t('sheet.roundTitle', { n: round.index + 1 })}</Text>
      </View>
      <Divider />
      {round.games.map((game, i) => {
        const score = scoresByGame.get(game.id) ?? { rePerPlayer: 0, contraPerPlayer: 0 };
        const level = bockLevelByGame.get(game.id) ?? BockLevel.none;
        const reLabel = game.isSolo ? t('sheet.soloLabel') : t('sheet.reLabel');
        const winnerText =
          game.winner === WinnerSide.re
            ? (game.isSolo ? t('sheet.soloWinner') : t('sheet.reLabel'))
            : t('sheet.kontraWinner');
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
                    {`${t('sheet.kontraLabel')}: `}
                  </Text>
                  {names(game.contraPlayerIds)}
                </Text>
                {sittingOut !== undefined && sittingOut !== null && (
                  <Text variant="bodySmall">{t('sheet.sittingOut', { name: playerDisplayName(sittingOut) })}</Text>
                )}
                <Text variant="bodySmall" style={{ marginTop: 2 }}>
                  {t('sheet.winnerWins', { side: winnerText })}
                  {flags !== '' ? ` · ${flags}` : ''}
                  {level === BockLevel.single ? ` · ${t('sheet.bockSingleSuffix')}` : ''}
                  {level === BockLevel.double ? ` · ${t('sheet.bockDoubleSuffix')}` : ''}
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
                    {t('sheet.contraPerPlayer', { points: formatPoints(score.contraPerPlayer) })}
                  </Text>
                )}
              </View>
            </View>
          </TouchableRipple>
        );
      })}

      <Portal>
        <Dialog visible={deleteTarget !== null} onDismiss={() => setDeleteTarget(null)}>
          <Dialog.Title>{t('sheet.deleteGameTitle')}</Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button
              mode="contained-tonal"
              onPress={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (target !== null) onDeleteGame(target);
              }}
            >
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Card>
  );
}
