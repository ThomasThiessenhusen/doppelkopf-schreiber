import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Menu, Text } from 'react-native-paper';

import type { GameSheet } from '@/domain/models/gameSheet';
import { playerDisplayName, type Player } from '@/domain/models/player';
import type { Substitution } from '@/domain/models/substitution';
import { useTranslation } from '@/presentation/i18n/useTranslation';

/**
 * Erfasst pro Mitspieler des Bogens optional einen Stammspieler, den er
 * vertritt. Auswahl: Pool ohne Bogen-Spieler und ohne bereits gewaehlte
 * Stammspieler — so entstehen nur gueltige Listen.
 */
export function SubstitutionsDialog({
  visible,
  sheet,
  sheetPlayers,
  pool,
  onDismiss,
  onSave,
}: {
  visible: boolean;
  sheet: GameSheet;
  sheetPlayers: readonly Player[];
  pool: readonly Player[];
  onDismiss: () => void;
  onSave: (subs: readonly Substitution[]) => void;
}) {
  const { t } = useTranslation();
  const [mainBySubstitute, setMainBySubstitute] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setMainBySubstitute(
        new Map(sheet.substitutions.map((s) => [s.substituteId, s.mainPlayerId])),
      );
      setOpenMenuFor(null);
    }
  }, [visible, sheet.substitutions]);

  const nameOf = (id: string): string => {
    const p = pool.find((x) => x.id === id);
    return p !== undefined ? playerDisplayName(p) : id;
  };

  function choose(substituteId: string, mainPlayerId: string | null) {
    const next = new Map(mainBySubstitute);
    if (mainPlayerId === null) next.delete(substituteId);
    else next.set(substituteId, mainPlayerId);
    setMainBySubstitute(next);
    setOpenMenuFor(null);
  }

  function save() {
    const subs: Substitution[] = sheetPlayers
      .filter((p) => mainBySubstitute.has(p.id))
      .map((p) => ({ substituteId: p.id, mainPlayerId: mainBySubstitute.get(p.id)! }));
    onSave(subs);
  }

  return (
    <Dialog visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>{t('sheet.substitutionsTitle')}</Dialog.Title>
      <Dialog.Content style={{ gap: 12 }}>
        <Text variant="bodySmall">{t('sheet.substitutionsHint')}</Text>
        {sheetPlayers.map((p) => {
          const chosen = mainBySubstitute.get(p.id) ?? null;
          const takenElsewhere = new Set(
            [...mainBySubstitute.entries()].filter(([k]) => k !== p.id).map(([, v]) => v),
          );
          const options = pool.filter(
            (c) => !sheet.playerIds.includes(c.id) && !takenElsewhere.has(c.id),
          );
          return (
            <View
              key={p.id}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ flexShrink: 1 }}>
                {`${playerDisplayName(p)} ${t('sheet.substitutesForLabel')}`}
              </Text>
              <Menu
                visible={openMenuFor === p.id}
                onDismiss={() => setOpenMenuFor(null)}
                anchor={
                  <Button mode="outlined" compact onPress={() => setOpenMenuFor(p.id)}>
                    {chosen === null ? t('sheet.substitutesNone') : nameOf(chosen)}
                  </Button>
                }
              >
                <Menu.Item title={t('sheet.substitutesNone')} onPress={() => choose(p.id, null)} />
                {options.map((c) => (
                  <Menu.Item
                    key={c.id}
                    title={playerDisplayName(c)}
                    onPress={() => choose(p.id, c.id)}
                  />
                ))}
              </Menu>
            </View>
          );
        })}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>{t('common.cancel')}</Button>
        <Button mode="contained" onPress={save}>
          {t('common.save')}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}
