import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  Button,
  Dialog,
  FAB,
  HelperText,
  IconButton,
  List,
  Menu,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  copyPlayer,
  playerDisplayName,
  playerFullName,
  type Player,
} from '@/domain/models/player';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { useTranslation } from '@/presentation/i18n/useTranslation';

interface FormState {
  playerName: string;
  firstName: string;
  lastName: string;
  playerNameError: string | null;
}

const emptyForm: FormState = {
  playerName: '',
  firstName: '',
  lastName: '',
  playerNameError: null,
};

export function PlayerManagementScreen() {
  const { t } = useTranslation();
  const loading = usePlayerListStore((s) => s.loading);
  const players = usePlayerListStore((s) => s.players);
  const error = usePlayerListStore((s) => s.error);
  const refresh = usePlayerListStore((s) => s.refresh);
  const add = usePlayerListStore((s) => s.add);
  const update = usePlayerListStore((s) => s.update);
  const remove = usePlayerListStore((s) => s.remove);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);

  const [menuForId, setMenuForId] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
  }

  function openEdit(p: Player) {
    setEditing(p);
    setForm({
      playerName: p.playerName,
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      playerNameError: null,
    });
    setEditorOpen(true);
  }

  async function submit() {
    const playerName = form.playerName.trim();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const playerNameError =
      playerName === '' ? t('players.errorPlayerNameRequired') : null;
    if (playerNameError !== null) {
      setForm({ ...form, playerNameError });
      return;
    }
    const patch = {
      playerName,
      firstName: firstName === '' ? null : firstName,
      lastName: lastName === '' ? null : lastName,
    };
    if (editing === null) {
      await add(patch);
    } else {
      await update(copyPlayer(editing, patch));
    }
    setEditorOpen(false);
  }

  async function confirmDelete() {
    if (deleteTarget === null) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <View style={{ flex: 1 }}>
      {loading && players.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="bodyMedium">{t('common.loading')}</Text>
        </View>
      ) : error !== null && players.length === 0 ? (
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <Text variant="bodyMedium">
            {t('common.errorLoading')}: {error.message}
          </Text>
        </View>
      ) : players.length === 0 ? (
        <EmptyView />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}
          data={players}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)' }} />
          )}
          renderItem={({ item: p }) => {
            const fullName = playerFullName(p);
            return (
              <List.Item
                title={playerDisplayName(p)}
                description={fullName !== '' ? fullName : undefined}
                left={(props) => <List.Icon {...props} icon="account-outline" />}
                onPress={() => openEdit(p)}
                right={() => (
                  <Menu
                    visible={menuForId === p.id}
                    onDismiss={() => setMenuForId(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        onPress={() => setMenuForId(p.id)}
                      />
                    }
                  >
                    <Menu.Item
                      title={t('players.editMenu')}
                      onPress={() => {
                        setMenuForId(null);
                        openEdit(p);
                      }}
                    />
                    <Menu.Item
                      title={t('players.deleteMenu')}
                      onPress={() => {
                        setMenuForId(null);
                        setDeleteTarget(p);
                      }}
                    />
                  </Menu>
                )}
              />
            );
          }}
        />
      )}

      <FAB
        icon="account-plus"
        label={t('players.addFab')}
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        onPress={openNew}
      />

      <Portal>
        <Dialog visible={editorOpen} onDismiss={() => setEditorOpen(false)}>
          <Dialog.Title>
            {editing === null ? t('players.newTitle') : t('players.editTitle')}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('players.playerNameLabel')}
              value={form.playerName}
              onChangeText={(v) =>
                setForm({ ...form, playerName: v, playerNameError: null })
              }
              mode="outlined"
              autoFocus
              error={form.playerNameError !== null}
            />
            <HelperText type="error" visible={form.playerNameError !== null}>
              {form.playerNameError ?? ''}
            </HelperText>
            <TextInput
              label={t('players.firstNameLabel')}
              value={form.firstName}
              onChangeText={(v) => setForm({ ...form, firstName: v })}
              mode="outlined"
            />
            <TextInput
              label={t('players.lastNameLabel')}
              value={form.lastName}
              onChangeText={(v) => setForm({ ...form, lastName: v })}
              mode="outlined"
              onSubmitEditing={() => void submit()}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditorOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button mode="contained" onPress={() => void submit()}>
              {editing === null
                ? t('players.createButton')
                : t('players.saveButton')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={deleteTarget !== null}
          onDismiss={() => setDeleteTarget(null)}
        >
          <Dialog.Title>{t('players.deleteTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t('players.deleteBody', {
                name: deleteTarget !== null ? playerDisplayName(deleteTarget) : '',
              })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button mode="contained-tonal" onPress={() => void confirmDelete()}>
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function EmptyView() {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flex: 1,
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <List.Icon icon="account-group-outline" />
      <Text variant="headlineSmall">{t('players.emptyTitle')}</Text>
      <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
        {t('players.emptyHint')}
      </Text>
    </View>
  );
}
