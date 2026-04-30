import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useBranch } from "@/lib/branch-context";

const TRACKING_INTERVAL_MS = 30_000;

type BatteryManagerLike = {
  level: number;
};

export function LiveTracker() {
  const { profile } = useAuth();
  const { current: branch } = useBranch();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile?.id) return;

    let isActive = true;

    const getBatteryLevel = async () => {
      const batteryApi = (navigator as Navigator & {
        getBattery?: () => Promise<BatteryManagerLike>;
      }).getBattery;

      if (!batteryApi) return null;

      try {
        const battery = await batteryApi.call(navigator);
        return Math.round(battery.level * 100);
      } catch (error) {
        console.warn("Battery API unavailable:", error);
        return null;
      }
    };

    const sendLocationUpdate = async (coords?: GeolocationCoordinates) => {
      let lat = coords?.latitude;
      let lng = coords?.longitude;
      const hasGps = typeof lat === "number" && typeof lng === "number";
      const batteryLevel = await getBatteryLevel();

      if (!hasGps) {
        if (branch?.lat && branch?.lng) {
          lat = branch.lat;
          lng = branch.lng;
        } else {
          lat = 12.9716;
          lng = 77.5946;
        }
      }

      const payload = {
        p_id: profile.id,
        p_lat: lat,
        p_lng: lng,
        p_battery: batteryLevel,
        p_speed_kmh: coords?.speed ?? 0,
        p_accuracy: coords?.accuracy ?? 0,
        p_current_task: `${profile.role} - ${hasGps ? "GPS Active" : "Using Branch Location"}`,
        p_status: "active",
        p_email: profile.email,
        p_name: profile.name,
      };

      try {
        const { data: rpcSuccess, error: rpcError } = await supabase.rpc("upsert_staff_tracking", payload);

        if (!rpcError && rpcSuccess) {
          return;
        }

        const { error } = await supabase.from("staff_tracking").upsert({
          user_id: profile.id,
          lat,
          lng,
          battery: batteryLevel,
          speed_kmh: coords?.speed ?? 0,
          accuracy: coords?.accuracy ?? 0,
          current_task: `${profile.role} - ${hasGps ? "GPS Active" : "Using Branch Location"}`,
          status: "active",
          last_update: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (error) {
          console.error("Supabase tracking error:", error.message, rpcError?.message ? `RPC: ${rpcError.message}` : "");
        }
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
  }, [profile?.id, profile?.role, branch?.id, branch?.lat, branch?.lng, profile?.email, profile?.name]);

  return null; // Invisible component
}
