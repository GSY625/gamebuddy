import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '@gamebuddy/api-client';
import { WS_URL } from '../utils/runtimeEnv';

export function useSocket(enabled: boolean) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !getToken()) return;
    const socket = io(WS_URL, {
      auth: { token: getToken() },
    });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  return socketRef;
}
