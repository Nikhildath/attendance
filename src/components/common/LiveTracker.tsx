import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { socketService } from "@/lib/socket-service";
import { supabase } from "@/lib/supabase";

export function LiveTracker() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;

    let watchId: number;
    let isSocketConnected = false;

    const sendUpdate = async (coords?: GeolocationCoordinates) => {
        console.log("Sending update for user:", profile.id);
        const payload = {
            userId: profile.id,
            lat: coords?.latitude || 12.9716, // Default to Bangalore if no coords
            lng: coords?.longitude || 77.5946,
            battery: 100,
            speed: coords?.speed || 0,
            accuracy: coords?.accuracy || 0,
            status: 'active' as const
        };

        // 1. Try Socket
        if (isSocketConnected) {
            console.log("Sending location via Socket:", payload);
            socketService.updateLocation(payload);
        } else {
            console.warn("Socket not connected, skipping Socket update");
        }

        // 2. Sync to Supabase
        try {
            const { error } = await supabase.from('staff_tracking').upsert({
                user_id: profile.id,
                lat: payload.lat,
                lng: payload.lng,
                battery: 100,
                speed_kmh: payload.speed,
                accuracy: payload.accuracy,
                status: 'active',
                last_update: new Date().toISOString()
            }, { onConflict: 'user_id' });
            
            if (error) console.error("Supabase tracking upsert error:", error.message);
            else console.log("Supabase tracking updated successfully");
        } catch (err) {
            console.error("Tracking sync failed:", err);
        }
    };

    const startTracking = async () => {
      console.log("Starting live tracker for:", profile.id);

      // Send initial "active" status even without coordinates yet
      sendUpdate();

      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  console.log("Initial position captured:", pos.coords);
                  sendUpdate(pos.coords);
              },
              (err) => {
                  console.error("Initial position error:", err.message);
              },
              { enableHighAccuracy: true }
          );

          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              console.log("Position update via watch:", pos.coords);
              sendUpdate(pos.coords);
            },
            (err) => console.error("Watch error:", err.message),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
      } else {
          console.error("Geolocation not supported");
      }

      // 2. Connect Socket
      try {
        // Check if using custom session or Supabase Auth
        const customSession = localStorage.getItem("sb_custom_session");
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log("Auth status - Custom:", !!customSession, "Supabase:", !!session?.access_token);
        
        let token = session?.access_token || '';
        let userId = customSession ? profile.id : '';
        
        if (token || userId) {
          const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
          console.log("Connecting to Socket server at:", socketUrl);
          
          socketService.connect(socketUrl, token, userId)
            .then(() => {
              console.log("Socket connected successfully");
              isSocketConnected = true;
              socketService.requestStaffLocations();
            })
            .catch(err => {
              console.error("Socket connection failed:", err);
              isSocketConnected = false;
            });
        } else {
          console.warn("No valid auth method available for Socket connection");
        }
      } catch (err) {
        console.error("Auth check error:", err);
      }
    };

    startTracking();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (isSocketConnected) socketService.disconnect();
    };
  }, [profile?.id]);

  return null; // Invisible component
}
