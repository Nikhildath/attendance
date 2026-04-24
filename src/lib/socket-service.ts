import { io, Socket } from 'socket.io-client';

// Socket.io service for real-time location tracking
let socket: Socket | null = null;

export interface StaffLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  battery: number;
  speed: number;
  task: string;
  status: 'active' | 'idle' | 'offline';
  lastUpdate: string;
  accuracy: number;
}

export interface LocationUpdate {
  userId: string;
  lat: number;
  lng: number;
  battery: number;
  speed: number;
  accuracy: number;
  task?: string;
  status?: 'active' | 'idle' | 'offline';
}

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(url: string, token: string, userId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const socketUrl = url || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
        
        console.log('Attempting Socket connection to:', socketUrl);
        console.log('Token provided:', !!token);
        console.log('UserId provided:', !!userId);
        
        // Prepare auth object - include both token (for JWT) and userId (for custom sessions)
        const auth: any = { token: token };
        if (userId) {
          auth.userId = userId;
        }
        
        this.socket = io(socketUrl, {
          auth,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
          console.log('Socket connected successfully:', this.socket?.id);
          this.reconnectAttempts = 0;
          this.emit('connected', this.socket?.id);
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          this.emit('disconnected', reason);
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          this.emit('connection_error', error);
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        // Listen for staff location updates
        this.socket.on('staff_location_update', (data: StaffLocation) => {
          console.log('Received location update:', data);
          this.emit('staff_location', data);
        });

        // Listen for batch location updates
        this.socket.on('staff_locations', (data: StaffLocation[]) => {
          console.log('Received batch locations:', data.length);
          this.emit('staff_locations', data);
        });

        // Listen for online/offline status changes
        this.socket.on('staff_status_change', (data: { userId: string; status: 'active' | 'idle' | 'offline' }) => {
          console.log('Status change:', data);
          this.emit('status_change', data);
        });
      } catch (error) {
        console.error('Socket connection exception:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Emit location update to server
  updateLocation(location: LocationUpdate): void {
    if (this.socket?.connected) {
      this.socket.emit('location_update', location);
    }
  }

  // Request all staff locations
  requestStaffLocations(): void {
    if (this.socket?.connected) {
      this.socket.emit('request_staff_locations');
    }
  }

  // Subscribe to location updates
  onStaffLocationUpdate(callback: (data: StaffLocation) => void): () => void {
    this.on('staff_location', callback);
    return () => this.off('staff_location', callback);
  }

  // Subscribe to batch location updates
  onStaffLocations(callback: (data: StaffLocation[]) => void): () => void {
    this.on('staff_locations', callback);
    return () => this.off('staff_locations', callback);
  }

  // Subscribe to status changes
  onStatusChange(callback: (data: { userId: string; status: 'active' | 'idle' | 'offline' }) => void): () => void {
    this.on('status_change', callback);
    return () => this.off('status_change', callback);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  private on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  private off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
