import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useBranch } from "@/lib/branch-context";

const TRACKING_INTERVAL_MS = 30_000;

export function LiveTracker() {
  const { profile } = useAuth();
  const { current: branch } = useBranch();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile?.id) return;

    let isActive = true;

    const sendLocationUpdate = async (coords?: GeolocationCoordinates) => {
      let lat = coords?.latitude;
      let lng = coords?.longitude;
      const hasGps = typeof lat === "number" && typeof lng === "number";

      if (!hasGps) {
        if (branch?.lat && branch?.lng) {
          lat = branch.lat;
          lng = branch.lng;
        } else {
          lat = 12.9716;
          lng = 77.5946;
        }
      }

      try {
        const { error } = await supabase.from("staff_tracking").upsert({
          user_id: profile.id,
          lat,
          lng,
          battery: 100,
          speed_kmh: coords?.speed ?? 0,
          accuracy: coords?.accuracy ?? 0,
          current_task: `${profile.role} - ${hasGps ? "GPS Active" : "Using Branch Location"}`,
          status: "active",
          last_update: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (error) console.error("Supabase tracking error:", error.message);
      } catch (err) {
        console.error("Tracking sync error:", err);
      }
    };

    const captureAndSyncLocation = () => {
      if (!("geolocation" in navigator)) {
        sendLocationUpdate();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isActive) return;
          sendLocationUpdate(pos.coords);
        },
        (err) => {
          console.warn("Location unavailable, using fallback location:", err.message);
          sendLocationUpdate();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    };

    captureAndSyncLocation();
    intervalRef.current = window.setInterval(captureAndSyncLocation, TRACKING_INTERVAL_MS);

    return () => {
      isActive = false;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [profile?.id, profile?.role, branch?.id, branch?.lat, branch?.lng]);

  return null; // Invisible component
}
