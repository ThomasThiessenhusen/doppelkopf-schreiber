import { View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';

import type { Player } from '@/domain/models/player';
import { playerDisplayName } from '@/domain/models/player';

export interface ScoreboardProps {
  players: ReadonlyArray<Player>;
  /** Punkte pro Spieler aufsummiert ueber den ganzen Bogen. */
  totalsByPlayerId: ReadonlyMap<string, number>;
  /**
   * Punkte pro Spiel (Insertion-Order = chronologisch): innere Map ist
   * playerId → points fuer dieses Spiel. Spieler-IDs muessen mit `players`
   * konsistent sein; aussetzende Spieler haben Wert 0 mit Marker im
   * `sittingOutByGame`.
   */
  pointsByGame: ReadonlyArray<{
    gameId: string;
    pointsByPlayerId: ReadonlyMap<string, number>;
    sittingOutPlayerId: string | null;
  }>;
}

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

export function Scoreboard({ players, totalsByPlayerId, pointsByGame }: ScoreboardProps) {
  const theme = useTheme();

  let crossSum = 0;
  for (const v of totalsByPlayerId.values()) crossSum += v;
  const crossSumOk = crossSum === 0;

  function colorForPoints(points: number): string | undefined {
    if (points > 0) return theme.colors.primary;
    if (points < 0) return theme.colors.error;
    return undefined;
  }

  return (
    <Card style={{ marginHorizontal: 12, marginVertical: 8 }}>
      <Card.Content>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text variant="titleMedium" style={{ flex: 1 }}>
            Punktestand
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: crossSumOk
                ? theme.colors.primaryContainer
                : theme.colors.errorContainer,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              gap: 4,
            }}
          >
            <Icon
              source={crossSumOk ? 'check-circle-outline' : 'alert-outline'}
              size={16}
              color={
                crossSumOk ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer
              }
            />
            <Text
              style={{
                fontSize: 12,
                color: crossSumOk
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onErrorContainer,
              }}
            >
              Quersumme {crossSum}
            </Text>
          </View>
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
          <View style={{ width: 32 }} />
          {players.map((p) => (
            <View key={p.id} style={{ flex: 1 }}>
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={{ textAlign: 'center', fontWeight: '600' }}
              >
                {playerDisplayName(p)}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)' }} />

        {/* Game rows */}
        {pointsByGame.map((row, idx) => (
          <View
            key={row.gameId}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
          >
            <View style={{ width: 32 }}>
              <Text
                variant="bodySmall"
                style={{
                  textAlign: 'right',
                  color: theme.colors.onSurfaceVariant,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {idx + 1}
              </Text>
            </View>
            {players.map((p) => {
              const isSittingOut = p.id === row.sittingOutPlayerId;
              const points = row.pointsByPlayerId.get(p.id) ?? 0;
              return (
                <View key={p.id} style={{ flex: 1 }}>
                  <Text
                    variant="bodyMedium"
                    style={{
                      textAlign: 'center',
                      fontVariant: ['tabular-nums'],
                      color: isSittingOut
                        ? theme.colors.onSurfaceVariant
                        : colorForPoints(points),
                    }}
                  >
                    {isSittingOut ? '—' : formatPoints(points)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        {pointsByGame.length > 0 && (
          <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginTop: 4 }} />
        )}

        {/* Totals */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ width: 32 }}>
            <Text variant="titleMedium" style={{ textAlign: 'right' }}>
              Σ
            </Text>
          </View>
          {players.map((p) => {
            const total = totalsByPlayerId.get(p.id) ?? 0;
            return (
              <View key={p.id} style={{ flex: 1 }}>
                <Text
                  variant="titleMedium"
                  style={{
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontVariant: ['tabular-nums'],
                    color: colorForPoints(total),
                  }}
                >
                  {formatPoints(total)}
                </Text>
              </View>
            );
          })}
        </View>
      </Card.Content>
    </Card>
  );
}
