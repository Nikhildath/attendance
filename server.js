// Real-time Location Tracking Server using Socket.io
// This server handles real-time location updates for field staff
// Deploy on Render, Railway, or any Node.js hosting platform

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Socket.io server is running' });
});

// Store connected users and their locations
const connectedUsers = new Map();
const locationCache = new Map();

// Authenticate socket connection
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  // Verify JWT token with Supabase
  supabase.auth.getUser(token)
    .then(({ data }) => {
      if (data.user) {
        socket.userId = data.user.id;
        next();
      } else {
        next(new Error('Invalid token'));
      }
    })
    .catch(err => next(new Error('Auth error')));
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);
  connectedUsers.set(socket.userId, socket.id);

  // Request all staff locations
  socket.on('request_staff_locations', async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, role');

      const { data: tracking } = await supabase
        .from('staff_tracking')
        .select('*');

      const locations = profiles?.map(p => {
        const t = tracking?.find(tr => tr.user_id === p.id);
        return {
          id: p.id,
          name: p.name,
          lat: Number(t?.lat || 12.9716),
          lng: Number(t?.lng || 77.5946),
          battery: t?.battery || 0,
          speed: Number(t?.speed_kmh || 0),
          task: t?.current_task || 'No active task',
          status: t?.status || 'offline',
          lastUpdate: t?.last_update || new Date().toISOString(),
          accuracy: t?.accuracy || 0,
        };
      }) || [];

      socket.emit('staff_locations', locations);
      locations.forEach(loc => locationCache.set(loc.id, loc));
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  });

  // Receive location update from field staff
  socket.on('location_update', async (data) => {
    try {
      const { userId, lat, lng, battery, speed, accuracy, task, status } = data;

      // Update location cache
      const existing = locationCache.get(userId) || {};
      const updated = {
        id: userId,
        ...existing,
        lat,
        lng,
        battery,
        speed: speed || 0,
        accuracy: accuracy || 0,
        task: task || existing.task || 'No active task',
        status: status || existing.status || 'active',
        lastUpdate: new Date().toISOString(),
      };
      locationCache.set(userId, updated);

      // Update Supabase
      await supabase
        .from('staff_tracking')
        .upsert(
          {
            user_id: userId,
            lat,
            lng,
            battery,
            speed_kmh: speed,
            accuracy,
            current_task: task,
            status: status || 'active',
            last_update: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      // Broadcast to all connected admins
      io.emit('staff_location_update', updated);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
    connectedUsers.delete(socket.userId);
    locationCache.delete(socket.userId);
  });

  // Handle status change
  socket.on('status_change', async (data) => {
    try {
      const { status } = data;
      
      // Update Supabase
      await supabase
        .from('staff_tracking')
        .update({ status })
        .eq('user_id', socket.userId);

      // Broadcast to all
      io.emit('staff_status_change', {
        userId: socket.userId,
        status,
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default httpServer;
