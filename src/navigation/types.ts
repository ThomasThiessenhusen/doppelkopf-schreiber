export type RootStackParamList = {
  Home: undefined;
  NewSheet: { groupId?: string } | undefined;
  Sheet: { sheetId: string };
  AddGame: { sheetId: string; gameId?: string };
  Groups: undefined;
  GroupRankings: { groupId: string };
  Players: undefined;
  Settings: undefined;
  ImportReview: { fileUri: string };
};
