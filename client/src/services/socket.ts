import { io, type Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;
let chatSocket: Socket | null = null;

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

    // Also connect chat namespace
    connectChatSocket(token);

    return socket;
}

export function connectChatSocket(token: string): Socket {
    if (chatSocket?.connected) {
        return chatSocket;
    }

    chatSocket = io(`${WS_URL}/chat`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    chatSocket.on('connect', () => {
        console.log('[WS] Connected to /chat namespace');
    });

    chatSocket.on('disconnect', (reason) => {
        console.log('[WS/chat] Disconnected:', reason);
    });

    chatSocket.on('connect_error', (error) => {
        console.error('[WS/chat] Connection error:', error.message);
    });

    return chatSocket;
}

export function getSocket(): Socket | null {
    return socket;
}

export function getChatSocket(): Socket | null {
    return chatSocket;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    if (chatSocket) {
        chatSocket.disconnect();
        chatSocket = null;
    }
}
