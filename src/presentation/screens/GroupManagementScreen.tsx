import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  FAB,
  IconButton,
  List,
  Menu,
  Portal,
  RadioButton,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';

import { GroupType, groupTypeLabelKey } from '@/domain/models/groupType';
import type { SheetGroup } from '@/domain/models/sheetGroup';
import { useSheetGroupListStore } from '@/application/stores/sheetGroupListStore';
import { useSheetListStore } from '@/application/stores/sheetListStore';
import { useTranslation } from '@/presentation/i18n/useTranslation';

interface EditorState {
  open: boolean;
  /** `null` = Neuanlage. */
  editing: SheetGroup | null;
  name: string;
  type: GroupType;
  /** Bei Rename: Typ nicht aenderbar; nur durch „Typ aendern" im Popup-Menu. */
  typeLocked: boolean;
}

const editorClosed: EditorState = {
  open: false,
  editing: null,
  name: '',
  type: GroupType.season,
  typeLocked: false,
};

export function GroupManagementScreen() {
  const { t } = useTranslation();
  const loading = useSheetGroupListStore((s) => s.loading);
  const groups = useSheetGroupListStore((s) => s.groups);
  const refresh = useSheetGroupListStore((s) => s.refresh);
  const createGroup = useSheetGroupListStore((s) => s.create);
  const renameGroup = useSheetGroupListStore((s) => s.rename);
  const setType = useSheetGroupListStore((s) => s.setType);
  const deleteWithSheetsDecoupled = useSheetGroupListStore(
    (s) => s.deleteWithSheetsDecoupled,
  );
  const deleteWithSheetsCascaded = useSheetGroupListStore(
    (s) => s.deleteWithSheetsCascaded,
  );

  const sheets = useSheetListStore((s) => s.sheets);
  const refreshSheets = useSheetListStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
    void refreshSheets();
  }, [refresh, refreshSheets]);

  const [editor, setEditor] = useState<EditorState>(editorClosed);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [typeDialog, setTypeDialog] = useState<SheetGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SheetGroup | null>(null);

  function openNew() {
    setEditor({
      open: true,
      editing: null,
      name: '',
      type: GroupType.season,
      typeLocked: false,
    });
  }

  function openRename(g: SheetGroup) {
    setEditor({ open: true, editing: g, name: g.name, type: g.type, typeLocked: true });
  }

  async function submitEditor() {
    const name = editor.name.trim();
    if (name === '') {
      setEditor({ ...editor, open: false });
      return;
    }
    if (editor.editing === null) {
      await createGroup({ name, type: editor.type });
    } else if (name !== editor.editing.name) {
      await renameGroup(editor.editing.id, name);
    }
    setEditor(editorClosed);
  }

  async function submitTypeChange(newType: GroupType) {
    if (typeDialog === null) return;
    if (newType !== typeDialog.type) {
      await setType(typeDialog.id, newType);
    }
    setTypeDialog(null);
  }

  const deleteSheetCount = (g: SheetGroup) =>
    sheets.filter((s) => s.groupId === g.id).length;

  return (
    <View style={{ flex: 1 }}>
      {loading && groups.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : groups.length === 0 ? (
        <EmptyView />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}
          data={groups}
          keyExtractor={(g) => g.id}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)' }} />
          )}
          renderItem={({ item: g }) => {
            const count = deleteSheetCount(g);
            return (
              <List.Item
                title={g.name}
                description={t('groups.descriptionLine', { type: t(groupTypeLabelKey(g.type)), count })}
                right={() => (
                  <Menu
                    visible={menuForId === g.id}
                    onDismiss={() => setMenuForId(null)}
                    anchor={
                      <IconButton icon="dots-vertical" onPress={() => setMenuForId(g.id)} />
                    }
                  >
                    <Menu.Item
                      title={t('groups.menuRename')}
                      onPress={() => {
                        setMenuForId(null);
                        openRename(g);
                      }}
                    />
                    <Menu.Item
                      title={t('groups.menuChangeType')}
                      onPress={() => {
                        setMenuForId(null);
                        setTypeDialog(g);
                      }}
                    />
                    <Menu.Item
                      title={t('groups.menuDelete')}
                      onPress={() => {
                        setMenuForId(null);
                        setDeleteTarget(g);
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
        icon="folder-plus"
        label={t('groups.fabNew')}
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        onPress={openNew}
      />

      <Portal>
        <Dialog visible={editor.open} onDismiss={() => setEditor(editorClosed)}>
          <Dialog.Title>
            {editor.editing === null ? t('groups.editorTitleNew') : t('groups.editorTitleRename')}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('groups.nameLabel')}
              mode="outlined"
              value={editor.name}
              autoFocus
              onChangeText={(v) => setEditor({ ...editor, name: v })}
            />
            {!editor.typeLocked && (
              <View style={{ marginTop: 12 }}>
                <SegmentedButtons
                  value={editor.type}
                  onValueChange={(v) => setEditor({ ...editor, type: v as GroupType })}
                  buttons={[
                    { value: GroupType.season, label: t('groups.typeSeason') },
                    { value: GroupType.tournament, label: t('groups.typeTournament') },
                  ]}
                />
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditor(editorClosed)}>{t('common.cancel')}</Button>
            <Button mode="contained" onPress={() => void submitEditor()}>
              {editor.editing === null ? t('groups.editorCreate') : t('groups.editorSave')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={typeDialog !== null} onDismiss={() => setTypeDialog(null)}>
          <Dialog.Title>{t('groups.changeTypeTitle')}</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={typeDialog?.type ?? GroupType.season}
              onValueChange={(v) => void submitTypeChange(v as GroupType)}
            >
              <RadioButton.Item label={t('groups.typeSeason')} value={GroupType.season} />
              <RadioButton.Item label={t('groups.typeTournament')} value={GroupType.tournament} />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTypeDialog(null)}>{t('common.cancel')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={deleteTarget !== null} onDismiss={() => setDeleteTarget(null)}>
          <Dialog.Title>
            {t('groups.deleteTitle', { name: deleteTarget?.name ?? '' })}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {deleteTarget !== null && deleteSheetCount(deleteTarget) === 0
                ? t('groups.deleteBodyEmpty')
                : t('groups.deleteBodyWithSheets', { count: deleteTarget !== null ? deleteSheetCount(deleteTarget) : 0 })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            {deleteTarget !== null && deleteSheetCount(deleteTarget) > 0 && (
              <Button
                mode="contained-tonal"
                onPress={async () => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  await deleteWithSheetsDecoupled(target.id);
                }}
              >
                {t('groups.deleteKeepSheets')}
              </Button>
            )}
            <Button
              mode="contained-tonal"
              onPress={async () => {
                const target = deleteTarget;
                if (target === null) return;
                setDeleteTarget(null);
                if (deleteSheetCount(target) > 0) {
                  await deleteWithSheetsCascaded(target.id);
                } else {
                  await deleteWithSheetsDecoupled(target.id);
                }
              }}
            >
              {deleteTarget !== null && deleteSheetCount(deleteTarget) > 0
                ? t('groups.deleteCascade')
                : t('common.delete')}
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
      style={{ flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 16 }}
    >
      <Text variant="headlineSmall">{t('groups.emptyTitle')}</Text>
      <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
        {t('groups.emptyHint')}
      </Text>
    </View>
  );
}
