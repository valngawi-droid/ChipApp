import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Status: undefined;
  Calls: undefined;
  Communities: undefined;
  Chats: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ChatRoom: { chatId: string };
  NewChat: undefined;
  Profile: undefined;
  Call: { name: string; color: string; video: boolean; incoming: boolean };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
