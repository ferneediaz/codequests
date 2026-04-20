import { io, type Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
    if (socket?.connected) {
        return socket;
    }

    socket = io(`${WS_URL}/battles`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log('[WS] Connected to /battles namespace');
    });

    socket.on('disconnect', (reason) => {
        console.log('[WS] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('[WS] Connection error:', error.message);
    });

    socket.on('error', (data: { message: string }) => {
        console.error('[WS] Server error:', data.message);
    });

    return socket;
}

export function getSocket(): Socket | null {
    return socket;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
