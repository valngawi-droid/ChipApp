import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { I18nProvider } from './src/i18n';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import RootNavigator from './src/navigation';
import { useAppStore } from './src/state/useAppStore';
import { initializeSocket, socket, teardownSocket } from './src/api/socket';

/** Bridges socket lifecycle + inbound events into the Zustand store + persistent DB + realtime. */
const RealtimeBridge: React.FC = () => {
  const token = useAppStore((s) => s.token);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setConnection = useAppStore((s) => s.setConnection);
  const receiveMessage = useAppStore((s) => s.receiveMessage);
  const setMessagesFromHistory = useAppStore((s) => s.setMessagesFromHistory);
  const setTyping = useAppStore((s) => s.setTyping);

  useEffect(() => {
    if (!isAuthenticated) {
      teardownSocket();
      setConnection('offline');
      return;
    }

    setConnection('connecting');
    initializeSocket(token);

    const onConnect = () => setConnection('connected');
    const onDisconnect = () => setConnection('offline');
    const onError = () => setConnection('offline');

    const onReceive = (data: { room: string; id: string; text: string; timestamp: string; author?: string; authorName?: string; kind?: string }) => {
      receiveMessage(data.room, {
        id: data.id,
        text: data.text,
        isMe: false,
        timestamp: data.timestamp,
        status: 'delivered',
        kind: (data.kind as any) || 'text',
        authorName: data.authorName || data.author,
      });
    };

    const onHistory = (payload: { room: string; messages: any[] }) => {
      if (!payload || !payload.room || !Array.isArray(payload.messages)) return;
      const mapped = payload.messages.map((m: any) => ({
        id: m.id,
        text: m.text,
        isMe: false,
        timestamp: m.timestamp,
        status: 'delivered' as const,
        kind: (m.kind || 'text') as any,
        authorName: m.authorName || m.author,
      }));
      setMessagesFromHistory(payload.room, mapped);
    };

    const onPeerTyping = ({ room, typing }: { room: string; typing: boolean }) => setTyping(room, typing);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('receive_message', onReceive);
    socket.on('chat_history', onHistory);
    socket.on('peer_typing', onPeerTyping);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('receive_message', onReceive);
      socket.off('chat_history', onHistory);
      socket.off('peer_typing', onPeerTyping);
    };
  }, [isAuthenticated, token, setConnection, receiveMessage, setMessagesFromHistory, setTyping]);

  return null;
};

const Shell: React.FC = () => {
  const { scheme, colors } = useTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.systemBackground }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RealtimeBridge />
      <RootNavigator />
    </View>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <Shell />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
