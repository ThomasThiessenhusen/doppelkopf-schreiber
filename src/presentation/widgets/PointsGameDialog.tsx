import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';

import { parseCellInput, sumOfInputs } from '@/application/paper/paperGrid';
import type { Game } from '@/domain/models/game';
import { playerDisplayName, type Player } from '@/domain/models/player';
import { useTranslation } from '@/presentation/i18n/useTranslation';

export interface PointsGameDialogProps {
  visible: boolean;
  game: Game | null;
  players: readonly Player[];
  onDismiss: () => void;
  onSubmit: (pointsByPlayerId: Record<string, number>) => void;
}

/** Bearbeitet die Punkte eines Punkte-Spiels (Papier-Import); Summe muss 0 sein. */
export function PointsGameDialog({
  visible,
  game,
  players,
  onDismiss,
  onSubmit,
}: PointsGameDialogProps) {
  const { t } = useTranslation();
  const activePlayers = players.filter(
    (p) => game?.pointsByPlayerId !== undefined && p.id in game.pointsByPlayerId,
  );
  const [texts, setTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible || game?.pointsByPlayerId === undefined) return;
    const next: Record<string, string> = {};
    for (const [id, pts] of Object.entries(game.pointsByPlayerId)) next[id] = String(pts);
    setTexts(next);
  }, [visible, game]);

  const sum = sumOfInputs(activePlayers.map((p) => texts[p.id] ?? ''));
  const valid = sum === 0;

  function submit() {
    if (!valid) return;
    const out: Record<string, number> = {};
    for (const p of activePlayers) {
      const v = parseCellInput(texts[p.id] ?? '');
      if (typeof v === 'number') out[p.id] = v;
    }
    onSubmit(out);
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t('pointsGame.editTitle')}</Dialog.Title>
        <Dialog.Content>
          <View style={{ gap: 8 }}>
            {activePlayers.map((p) => (
              <TextInput
                key={p.id}
                mode="outlined"
                label={playerDisplayName(p)}
                keyboardType="numbers-and-punctuation"
                value={texts[p.id] ?? ''}
                onChangeText={(text) => setTexts((prev) => ({ ...prev, [p.id]: text }))}
              />
            ))}
            <Text variant="bodyMedium">
              {t('pointsGame.sumLabel', { sum: sum === 'invalid' ? '–' : sum })}
            </Text>
            {!valid && <HelperText type="error">{t('pointsGame.sumError')}</HelperText>}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('common.cancel')}</Button>
          <Button mode="contained-tonal" disabled={!valid} onPress={submit}>
            {t('common.save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
