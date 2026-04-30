import { useEffect, useRef, useState } from "react";
import { exportToCSV } from "@/lib/csv-utils";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, CheckCircle2, Loader2, MapPin, Clock, ShieldCheck, AlertTriangle, ScanFace, PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useBranch } from "@/lib/branch-context";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Mark Attendance — Attendly" },
      { name: "description", content: "Face-recognition attendance with geo-fence verification and recent timeline." },
    ],
  }),
  component: AttendancePage,
});

type State = "idle" | "camera" | "scanning" | "success" | "error";
type GeoState = "unknown" | "checking" | "inside" | "outside" | "denied";

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);

// Haversine in meters
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sa));
}

function AttendancePage() {
  const { current, loading: branchLoading } = useBranch();
  const { profile, refreshProfile, user } = useAuth();
  const { settings } = useSettings();
  const [state, setState] = useState<State>("idle");
  const [now, setNow] = useState<string>("");
  const [markedAt, setMarkedAt] = useState<string>("");
  const [geo, setGeo] = useState<GeoState>("unknown");
  const [distance, setDistance] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [punchMode, setPunchMode] = useState<"web" | "mobile">("web");
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [isHoliday, setIsHoliday] = useState<any>(null);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadRecent = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (data) {
      setRecentRecords(data);
      // Find latest record for today (guard against null check_in)
      const today = new Date().toISOString().split('T')[0];
      const latestToday = data.find(r => r.check_in && r.check_in.startsWith(today));
      setTodayRecord(latestToday || null);
      
      if (latestToday) {
        setMarkedAt(fmtTime(new Date(latestToday.check_in)));
        setState("success");
      }
    }
  };

  useEffect(() => {
    const nowInIndia = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    setNow(fmtTime(nowInIndia));
    const id = setInterval(() => {
      const currentIndia = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      setNow(fmtTime(currentIndia));
    }, 30_000);
    loadRecent();
    return () => clearInterval(id);
  }, [profile]);

  useEffect(() => {
    if (!current?.id) return;
    async function checkHoliday() {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from("company_holidays")
        .select("*")
        .eq("date", today)
        .or(`branch_id.is.null,branch_id.eq.${current.id}`);
      
      if (data && data.length > 0) setIsHoliday(data[0]);
      else setIsHoliday(null);
    }
    checkHoliday();
  }, [current]);

  useEffect(() => {
    if (current?.id) {
        checkGeo();
    }
  }, [current?.id]);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function checkGeo(): Promise<boolean> {
    if (!current || !current.lat || !current.lng) return true; // Skip if no branch coords
    if (!navigator.geolocation) { setGeo("denied"); setErrorMsg("Geolocation not supported"); return false; }
    
    setGeo("checking");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const d = distanceMeters(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            { lat: Number(current.lat), lng: Number(current.lng) }
          );
          setDistance(Math.round(d));
          if (d <= (current.radius_meters || 150)) { setGeo("inside"); resolve(true); }
          else { setGeo("outside"); resolve(false); }
        },
        () => { setGeo("denied"); setErrorMsg("Location access denied."); resolve(false); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  const handleExportRecent = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    
    if (data) {
      exportToCSV(data, `attendance_history_${profile.name.replace(/\s+/g, '_')}`);
    }
  };

  async function startCamera() {
    setErrorMsg("");
    setState("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setErrorMsg("Camera permission denied. Simulating face scan...");
      setState("scanning");
      saveAttendance();
    }
  }

  const saveAttendance = async () => {
    setState("scanning");
    const timestamp = new Date();
    
    let lat = 0;
    let lng = 0;
    let saveError: any = null;

    // Try to get precise location for the record
    try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
    } catch (e) {
        console.warn("Could not get precise location for record, using 0,0");
    }

    let status = isHoliday ? "holiday" : "present"; 
    
    // Late status calculation
    if (!isHoliday && profile?.id) {
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayName = days[timestamp.getDay()];
      
      const { data: schedule } = await supabase
        .from('shift_schedule')
        .select(`*, ${dayName}(start_time, type)`)
        .eq('user_id', profile.id)
        .maybeSingle();

      const shift = (schedule as any)?.[dayName];
      if (shift && shift.start_time && shift.type !== 'open') {
        const [sHour, sMin] = shift.start_time.split(':').map(Number);
        const shiftStart = new Date(timestamp);
        shiftStart.setHours(sHour, sMin, 0, 0);
        
        const threshold = settings?.late_threshold_mins || 15;
        const lateTime = new Date(shiftStart.getTime() + threshold * 60000);
        
        if (timestamp > lateTime) {
          status = "late";
        }
      }
    }
    
    if (todayRecord) {
      // Perform Check-Out
      const { error } = await supabase
        .from("attendance")
        .update({
          check_out: timestamp.toISOString(),
          notes: (todayRecord.notes || "") + (geo === "outside" ? " Checked out outside geo-fence." : "")
        })
        .eq("id", todayRecord.id);
      saveError = error;
      if (error) {
        toast.error("Check-out failed: " + error.message);
      } else {
        toast.success("Checked out successfully!");
      }
    } else {
      // Perform Check-In
      const { error } = await supabase.from("attendance").insert([{
        user_id: profile?.id,
        branch_id: current?.id || null,
        status: status,
        check_in: timestamp.toISOString(),
        location_lat: lat,
        location_lng: lng,
        notes: (geo === "outside" ? "Marked outside geo-fence. " : "") + (isHoliday ? `Marked on ${isHoliday.name}` : "")
      }]);
      saveError = error;
      if (error) {
        toast.error("Check-in failed: " + error.message);
      } else {
        toast.success("Checked in successfully!");
      }
    }

    loadRecent();

    setTimeout(() => {
      stopCamera();
      if (saveError) {
        // Error already toasted above, just reset state
        setState("idle");
      } else {
        setMarkedAt(fmtTime(timestamp));
        setState("success");
        loadRecent();
      }
    }, 1500);
  };

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);

  useEffect(() => {
    import("@/lib/face-recognition").then((mod) => {
      mod.loadModels()
        .then(() => {
            console.log("Attendance: Models loaded");
            setModelsLoaded(true);
        })
        .catch(err => {
            console.error("Attendance: Models failed to load", err);
            toast.error("Face recognition failed to initialize. Please check your internet connection.");
        });
    });
  }, []);

  async function registerFace() {
    if (!modelsLoaded) return toast.info("Face recognition models are loading, please wait...");
    setErrorMsg("");
    setState("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      toast.info("Hold still... capturing face descriptor");
      
      // Give a moment for the user to align
      await new Promise(res => setTimeout(res, 2500));
      
      const { getFaceDescriptor } = await import("@/lib/face-recognition");
      const descriptor = await getFaceDescriptor(videoRef.current!);
      
      if (descriptor) {
        const targetId = profile?.id || user?.id;
        if (!targetId) throw new Error("User ID not found. Please re-login.");

        console.log("Saving face descriptor via RPC for user:", targetId);
        const { data: success, error } = await supabase
          .rpc('update_own_face', {
            p_id: targetId,
            p_descriptor: Array.from(descriptor)
          });
        
        if (error) throw error;
        if (!success) {
          throw new Error("RPC_FAILURE: Could not update profile for ID " + targetId);
        }

        toast.success("Face registered successfully!");
        await refreshProfile();
      } else {
        toast.error("Could not detect face. Try again in better lighting.");
      }
    } catch (err: any) {
      toast.error("Registration failed: " + err.message);
    } finally {
      stopCamera();
      setState("idle");
    }
  }

  async function verifyAndPunch() {
    setState("scanning");
    try {
      const { getFaceDescriptor, compareFaces } = await import("@/lib/face-recognition");
      const liveDescriptor = await getFaceDescriptor(videoRef.current!);
      
      if (!liveDescriptor) {
        toast.error("No face detected. Please position your face clearly.");
        setState("camera");
        return;
      }

      let storedDescriptorArray = (profile as any)?.face_descriptor;
      if (!storedDescriptorArray && profile?.id) {
        const { data: latestProfile, error: profileError } = await supabase
          .from("profiles")
          .select("face_descriptor, face_registered")
          .eq("id", profile.id)
          .maybeSingle();

        if (profileError) {
          console.error("Failed to reload face descriptor:", profileError);
        } else if (latestProfile?.face_descriptor) {
          storedDescriptorArray = latestProfile.face_descriptor;
          await refreshProfile();
        }
      }

      if (!storedDescriptorArray) {
          console.error("Profile says registered but descriptor is missing:", profile);
          toast.error("Face data is missing from your profile. Please re-register.");
          setState("idle");
          return;
      }

      const storedDescriptor = new Float32Array(storedDescriptorArray);
      const isMatch = compareFaces(liveDescriptor, storedDescriptor);

      if (isMatch) {
        saveAttendance();
      } else {
        toast.error("Face verification failed. Not recognized.");
        setState("camera");
      }
    } catch (err: any) {
      toast.error("Verification error: " + err.message);
      setState("camera");
    }
  }

  async function registerBiometrics() {
    if (!profile?.id) return;
    setState("scanning");
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("Biometric hardware not detected on this device.");
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Attendly Pro", id: window.location.hostname },
          user: {
            id: Uint8Array.from(profile.id.replace(/-/g, ''), c => c.charCodeAt(0)),
            name: profile.email,
            displayName: profile.name
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: { 
            userVerification: "required",
            residentKey: "preferred"
          },
          timeout: 60000
        }
      });

      if (credential) {
        const { error } = await supabase
          .from("profiles")
          .update({ 
            biometric_registered: true,
            biometric_credential_id: (credential as any).id
          })
          .eq("id", profile.id);

        if (error) throw error;
        
        toast.success("Biometrics registered successfully!");
        await refreshProfile();
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      toast.error(err.message || "Biometric registration failed.");
    } finally {
      setState("idle");
    }
  }

  async function mark() {
    if (!current) return toast.error("Please select a branch first");
    setErrorMsg("");
    
    const ok = await checkGeo();
    if (geo === "denied") return;
    if (!ok) {
       toast.warning(`Outside geo-fence (${distance}m). Record will be flagged.`);
    }

    if (punchMode === "mobile") {
      if (!(profile as any)?.biometric_registered) {
        toast.info("Please register your biometrics first.");
        return;
      }

      setState("scanning");
      try {
        if (window.PublicKeyCredential) {
          const credential = await navigator.credentials.get({
            publicKey: {
              challenge: Uint8Array.from("secure-punch", c => c.charCodeAt(0)),
              allowCredentials: [{
                id: Uint8Array.from((profile as any).biometric_credential_id || "", c => c.charCodeAt(0)),
                type: 'public-key'
              }],
              userVerification: "required"
            }
          });
          
          if (!credential) {
            throw new Error("Biometric verification failed.");
          }
        } else {
            throw new Error("Biometric hardware not detected.");
        }
        
        await new Promise(res => setTimeout(res, 800));
      } catch (e: any) {
        console.error("Biometric error:", e);
        toast.error(e.message || "Verification failed.");
        setState("idle");
        return;
      }
      await saveAttendance();
      return;
    }

    if (!modelsLoaded) return toast.info("Face recognition models are loading, please wait...");
    
    // Check if face is registered
    if (!profile?.face_registered) {
        setErrorMsg("Your face is not registered.");
        return;
    }

    await startCamera();
  }

  return (
    <div>
      <PageHeader
        title="Mark Attendance"
        subtitle="Real-time verification with geo-fence protection"
        actions={
          <div className="flex rounded-xl border border-border/50 bg-muted/30 p-1 shadow-sm">
            {(["web","mobile"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPunchMode(m)}
                className={cn("rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                  punchMode === m ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {m === "web" ? "Web" : "Mobile"}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-5 md:p-8 shadow-sm transition-all hover:shadow-elegant">
          {(!modelsLoaded && profile?.role === "Admin") && (
            <div className="mb-4 rounded-lg bg-warning/10 p-3 text-[11px] text-warning-foreground border border-warning/30 flex items-center justify-between">
              <span>⚠️ Models failing to load? You can bypass for testing.</span>
              <button onClick={saveAttendance} className="underline font-bold">Skip & Mark</button>
            </div>
          )}
          <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-xl border-2 border-dashed bg-gradient-to-br from-muted/40 to-muted/10">
            <video 
              ref={videoRef} 
              muted 
              playsInline 
              className={cn(
                "absolute inset-0 h-full w-full object-cover", 
                (state !== "camera" && state !== "scanning") && "hidden"
              )} 
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
              {state === "scanning" ? (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-background/80 px-6 py-4 backdrop-blur-md animate-in fade-in zoom-in duration-300">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div className="text-sm font-semibold">Processing...</div>
                </div>
              ) : state === "success" ? (
                <div className="animate-in fade-in zoom-in duration-300">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15">
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-success">
                    {todayRecord?.check_out ? "Check-Out Successful" : "Punch Successful"}
                  </div>
                  <div className="text-xs text-muted-foreground">Recorded at {markedAt}</div>
                </div>
              ) : punchMode === "mobile" ? (
                <div className="pointer-events-auto flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
                  <div className="relative group cursor-pointer" onClick={mark}>
                    <div className="absolute -inset-1 rounded-full bg-primary/20 animate-ping opacity-75" />
                    <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-tr from-primary to-info opacity-75 blur transition duration-500 group-hover:opacity-100" />
                    <div className="relative flex h-[20rem] w-[15rem] flex-col items-center justify-center rounded-[2.5rem] bg-card p-6 shadow-2xl overflow-hidden border border-border/50">
                        {/* Futuristic Scanning Line */}
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_var(--color-primary)] animate-scan-line z-20" />
                        
                        <div className="mb-8 relative z-10">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                            <div className="relative h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                                <ScanFace className="h-12 w-12 text-primary" />
                            </div>
                        </div>
                        <div className="text-center relative z-10">
                            <div className="text-sm font-black text-primary uppercase tracking-[0.25em]">Biometric ID</div>
                            <div className="mt-2 text-[11px] font-black text-foreground uppercase tracking-widest bg-muted/50 px-3 py-1 rounded-full border border-border/50">
                              {profile?.name?.split(' ')[0] || "USER"}-{profile?.id?.slice(0, 4).toUpperCase()}
                            </div>
                            <div className="mt-6 flex flex-col items-center gap-4">
                              {!(profile as any)?.biometric_registered ? (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); registerBiometrics(); }}
                                  className="pointer-events-auto rounded-full bg-primary px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground shadow-elegant hover:scale-105 active:scale-95 transition-all"
                                >
                                  Register Biometrics
                                </button>
                              ) : (
                                <>
                                  <div className="flex gap-1">
                                    {[1,2,3,4,5].map(i => <div key={i} className="h-1 w-4 rounded-full bg-primary/20 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
                                  </div>
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tap to verify identity</span>
                                </>
                              )}
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                  {state === "idle" && (
                    <>
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                        <ScanFace className="h-10 w-10 text-primary" />
                      </div>
                      <div className="text-sm font-medium">
                        {profile?.face_registered ? "Face Recognition Ready" : "Face Not Registered"}
                      </div>
                      <div className="max-w-xs text-xs text-muted-foreground text-center">
                        {profile?.face_registered 
                            ? "Position your face inside the frame." 
                            : "You need to register your face before marking attendance."}
                      </div>
                      {!profile?.face_registered && (
                        <button 
                          onClick={registerFace} 
                          className="mt-4 pointer-events-auto rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-elegant hover:opacity-90"
                        >
                          Register My Face Now
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {(state === "idle" || state === "camera") && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-68 -translate-x-1/2 -translate-y-1/2 rounded-[45%] border-2 border-primary/60 shadow-elegant" />
            )}
            {state === "camera" && (
              <button
                onClick={verifyAndPunch}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant pointer-events-auto"
              >
                Verify & Punch
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <GeoStatusCard geo={geo} branchName={current?.name || "..."} distance={distance} radius={current?.radius_meters || 150} current={current} />
            <div className="flex items-center gap-3 rounded-xl border bg-background/40 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Local time</div>
                <div className="text-sm font-semibold">{now || "—"}</div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div>{errorMsg}</div>
                {!profile?.face_registered && (
                    <button onClick={registerFace} className="mt-2 text-primary font-bold hover:underline">
                        Register Your Face Now
                    </button>
                )}
              </div>
            </div>
          )}

          {isHoliday && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-holiday/40 bg-holiday/10 p-3 text-xs text-holiday">
              <PartyPopper className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Today is a Holiday: {isHoliday.name}</div>
                <div className="opacity-80">Marking attendance today will be recorded as "Holiday" status.</div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {current?.name || "Select Branch"}</span>
            </div>
            <button
              onClick={mark}
              disabled={state === "scanning" || state === "camera" || (punchMode === "web" && !profile?.face_registered) || branchLoading || !!todayRecord?.check_out}
              className="inline-flex items-center gap-2 rounded-xl gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:grayscale"
            >
              <Camera className="h-4 w-4" />
              {todayRecord?.check_out ? "Shift Completed" : (todayRecord ? "Check Out" : "Check In")}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-5 md:p-8 shadow-sm transition-all hover:shadow-elegant">
          <h2 className="text-lg font-semibold">Today</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border bg-background/40 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Check In</div>
              <div className="mt-1 text-xl font-bold">{markedAt || "—"}</div>
            </div>
            <div className="rounded-xl border bg-background/40 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Check Out</div>
              <div className="mt-1 text-xl font-bold">
                {todayRecord?.check_out ? fmtTime(new Date(todayRecord.check_out)) : "—"}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Records</h3>
            <button onClick={handleExportRecent} className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline">
              Export All
            </button>
          </div>
          <ol className="mt-3 space-y-3">
            {recentRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No records found</p>
            ) : recentRecords.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border bg-background/40 p-3">
                <div>
                  <div className="text-sm font-medium">{new Date(r.created_at).toLocaleDateString()}</div>
                  <div className="text-xs text-muted-foreground">
                    In {r.check_in ? fmtTime(new Date(r.check_in)) : "—"} · Out {r.check_out ? fmtTime(new Date(r.check_out)) : "—"}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function GeoStatusCard({ geo, branchName, distance, radius, current }: { geo: GeoState; branchName: string; distance: number | null; radius: number; current: any }) {
  const hasCoords = current?.lat && current?.lng;
  
  const cfg = {
    unknown:  { tone: "bg-muted/40 border-border text-muted-foreground", label: "Waiting for check…", icon: MapPin },
    checking: { tone: "bg-info/10 border-info/30 text-info",            label: "Locating you…",          icon: Loader2 },
    inside:   { tone: "bg-success/10 border-success/30 text-success",   label: `Inside ${branchName}`,   icon: ShieldCheck },
    outside:  { tone: "bg-warning/15 border-warning/40 text-warning-foreground", label: "Outside geo-fence", icon: AlertTriangle },
    denied:   { tone: "bg-destructive/10 border-destructive/30 text-destructive", label: "Location denied", icon: AlertTriangle },
  }[geo];

  const Icon = cfg.icon;

  if (!hasCoords && geo !== "denied" && geo !== "checking") {
      return (
        <div className="flex items-center gap-3 rounded-xl border bg-warning/10 border-warning/30 p-3 text-warning-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/50">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider opacity-70">Geo-fence</div>
            <div className="text-sm font-semibold">No location set for branch</div>
          </div>
        </div>
      );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-3", cfg.tone)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/50">
        <Icon className={cn("h-5 w-5", geo === "checking" && "animate-spin")} />
      </div>
      <div className="flex-1">
        <div className="text-[11px] uppercase tracking-wider opacity-70">Geo-fence</div>
        <div className="text-sm font-semibold">{cfg.label}</div>
        {distance !== null && geo !== "denied" && (
          <div className="text-[11px] opacity-70">{distance}m from office · allowed {radius}m</div>
        )}
      </div>
    </div>
  );
}
