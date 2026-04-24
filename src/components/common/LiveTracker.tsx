import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { socketService } from "@/lib/socket-service";
import { supabase } from "@/lib/supabase";

export function LiveTracker() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user || !profile) return;

    let watchId: number;
    let isSocketConnected = false;

    const sendUpdate = async (coords: GeolocationCoordinates) => {
        console.log("Sending update for user:", user.id, coords.latitude, coords.longitude);
        const payload = {
            userId: user.id,
            lat: coords.latitude,
            lng: coords.longitude,
            battery: 100,
            speed: coords.speed || 0,
            accuracy: coords.accuracy,
            status: 'active' as const
        };

        // 1. Try Socket
        if (isSocketConnected) {
            socketService.updateLocation(payload);
        }

        // 2. Sync to Supabase
        try {
            const { error } = await supabase.from('staff_tracking').upsert({
                user_id: user.id,
                lat: coords.latitude,
                lng: coords.longitude,
                battery: 100,
                speed_kmh: coords.speed || 0,
                accuracy: coords.accuracy,
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
      console.log("Starting live tracker for:", user.id);

      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  console.log("Initial position captured");
                  sendUpdate(pos.coords);
              },
              (err) => {
                  console.error("Initial position error:", err.message);
                  if (err.code === 1) alert("Location access is blocked. Please enable it in your browser settings to see your marker on the map.");
              },
              { enableHighAccuracy: true }
          );

          watchId = navigator.geolocation.watchPosition(
            (pos) => sendUpdate(pos.coords),
            (err) => console.error("Watch error:", err.message),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
      } else {
          console.error("Geolocation not supported");
      }

      // 2. Connect Socket
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
          socketService.connect(socketUrl, session.access_token)
            .then(() => {
              isSocketConnected = true;
              socketService.requestStaffLocations();
            })
            .catch(err => console.error("Socket error:", err));
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };

    startTracking();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (isSocketConnected) socketService.disconnect();
    };
  }, [user?.id, profile?.id]);

  return null; // Invisible component
}
