import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { I18nProvider } from './src/i18n';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import RootNavigator from './src/navigation';
import { useAppStore } from './src/state/useAppStore';
import { listUsers } from './src/api/client';
import {
  emitReadReceipt,
  initializeSocket,
  socket,
  teardownSocket,
} from './src/api/socket';
import type { Message } from './src/state/useAppStore';

/** Bridges socket lifecycle + inbound events into the Zustand store. */
const RealtimeBridge: React.FC = () => {
  const token = useAppStore((s) => s.token);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const user = useAppStore((s) => s.user);
  const setConnection = useAppStore((s) => s.setConnection);
  const receiveMessage = useAppStore((s) => s.receiveMessage);
  const setTyping = useAppStore((s) => s.setTyping);
  const setPeers = useAppStore((s) => s.setPeers);
  const applyMessageAck = useAppStore((s) => s.applyMessageAck);
  const applyReaction = useAppStore((s) => s.applyReaction);
  const activeChatId = useAppStore((s) => s.activeChatId);
  const ensureChatForPeer = useAppStore((s) => s.ensureChatForPeer);

  // Refresh the user directory periodically while signed in.
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await listUsers(token);
        if (!cancelled) {
          const others = (res.users ?? []).filter((u) => u.id !== user?.id);
          setPeers(others);
        }
      } catch {
        // Offline / tunnel cold start — the socket presence event will fill this in.
      }
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAuthenticated, token, user?.id, setPeers]);

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

    const onReceive = (data: {
      room: string;
      id: string;
      text: string;
      timestamp: string;
      kind?: string;
      author?: string;
      authorName?: string;
      authorPicture?: string | null;
    }) => {
      const message: Omit<Message, 'chatId'> = {
        id: data.id,
        text: data.text,
        isMe: data.author === user?.id,
        timestamp: data.timestamp,
        status: data.author === user?.id ? 'read' : 'delivered',
        kind: (data.kind as Message['kind']) ?? 'text',
        authorId: data.author,
        authorName: data.authorName,
        authorPicture: data.authorPicture ?? null,
      };
      receiveMessage(data.room, message);
      // Send a read receipt for messages arriving in the open chat.
      if (activeChatId === data.room) emitReadReceipt(data.room, data.id);
    };

    const onPeerTyping = ({ room }: { room: string; typing: boolean }) => setTyping(room, true);

    const onAck = (ack: { id: string; serverId?: string; timestamp?: string; status?: string }) => {
      applyMessageAck(ack.id, {
        serverId: ack.serverId,
        timestamp: ack.timestamp,
        status: (ack.status as Message['status']) ?? 'delivered',
      });
    };

    const onPresence = ({ users: peers }: { users: { id: string; online: boolean }[] }) => {
      // Reflect online flags; full peer list refresh follows via REST.
      setPeers(
        useAppStore
          .getState()
          .peers.map((p) => {
            const match = peers.find((x) => x.id === p.id);
            return match ? { ...p, online: match.online } : p;
          })
      );
    };

    const onReaction = (payload: {
      room: string;
      messageId: string;
      emoji: string;
      userId: string;
      userName: string;
    }) => {
      applyReaction(payload.room, payload.messageId, payload.emoji, payload.userId, payload.userName);
    };

    const onJoined = ({ room }: { room: string; history?: unknown[] }) => {
      // If this is a new direct room for a known peer, make sure it exists.
      if (room.includes('::')) {
        const [a, b] = room.split('::');
        const peerId = a === user?.id ? b : b === user?.id ? a : null;
        if (peerId) ensureChatForPeer(peerId);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('receive_message', onReceive);
    socket.on('peer_typing', onPeerTyping);
    socket.on('message_ack', onAck);
    socket.on('presence', onPresence);
    socket.on('reaction', onReaction);
    socket.on('joined', onJoined);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('receive_message', onReceive);
      socket.off('peer_typing', onPeerTyping);
      socket.off('message_ack', onAck);
      socket.off('presence', onPresence);
      socket.off('reaction', onReaction);
      socket.off('joined', onJoined);
    };
  }, [
    isAuthenticated,
    token,
    user?.id,
    activeChatId,
    setConnection,
    receiveMessage,
    setTyping,
    setPeers,
    applyMessageAck,
    applyReaction,
    ensureChatForPeer,
  ]);

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
