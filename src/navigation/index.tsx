import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore } from '../state/useAppStore';
import { haptics } from '../utils/haptics';

import LoginScreen from '../screens/LoginScreen';
import ChatsScreen from '../screens/ChatsScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import NewChatScreen from '../screens/NewChatScreen';
import StatusScreen from '../screens/StatusScreen';
import CallsScreen from '../screens/CallsScreen';
import CommunitiesScreen from '../screens/CommunitiesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CallScreen from '../screens/CallScreen';
import type { RootStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TabBadge: React.FC<{ count: number }> = ({ count }) => {
  const { colors, typography } = useTheme();
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
      <Text style={[typography.caption2, styles.badgeText]}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

const Tabs: React.FC = () => {
  const { colors, typography } = useTheme();
  const { t } = useLocalization();
  const totalUnread = useAppStore((s) => s.chats.reduce((sum, c) => sum + c.unreadCount, 0));

  return (
    <Tab.Navigator
      // WhatsApp for iOS opens on Chats, which sits fourth in the tab order.
      initialRouteName="Chats"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.placeholder,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...Platform.select({ ios: { position: 'absolute' }, default: {} }),
        },
        tabBarLabelStyle: typography.tabLabel,
      }}
      screenListeners={{ tabPress: () => haptics.selection() }}
    >
      <Tab.Screen
        name="Status"
        component={StatusScreen}
        options={{
          title: t('status'),
          tabBarIcon: ({ color, size }) => <Ionicons name="radio-button-on-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Calls"
        component={CallsScreen}
        options={{
          title: t('calls'),
          tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Communities"
        component={CommunitiesScreen}
        options={{
          title: t('communities'),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          title: t('chats'),
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
              <TabBadge count={totalUnread} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  const { scheme, colors } = useTheme();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  const navTheme: Theme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      primary: colors.brand,
      background: colors.systemBackground,
      card: colors.secondarySystemBackground,
      text: colors.label,
      border: colors.separator,
      notification: colors.destructive,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Tabs" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen
              name="ChatRoom"
              component={ChatRoomScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="NewChat"
              component={NewChatScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Call"
              component={CallScreen}
              options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 10 },
});

export default RootNavigator;
