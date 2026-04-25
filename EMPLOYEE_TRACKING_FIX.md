# Employee Location Tracking Fix - Complete Setup

## Problem (FIXED)
- **Before**: Only admin could see their own location. Employees saw nothing.
- **Reason**: LiveTracker was defaulting to hardcoded Bangalore coordinates for all employees instead of using real GPS data.
- **Result**: All employees appeared at the same location with no meaningful tracking.

## Solution Implemented

### 1. **LiveTracker Component** (`src/components/common/LiveTracker.tsx`)
✅ Now runs for **ALL users** (employees, managers, admins)
✅ **Better GPS error handling** - logs detailed permission/connection issues
✅ **Intelligent fallbacks**:
   - Primary: Real GPS coordinates (if permission granted)
   - Secondary: Branch location (from branch_context)
   - Tertiary: Default Bangalore (only if nothing else available)
✅ **Includes user role in task field** - helps identify who is sending update
✅ **Periodic updates** (every 60 seconds) even if GPS unavailable
✅ **Continuous Supabase sync** regardless of socket connection

### 2. **Field Tracking Access Control** (Already Correct)
✅ **Employees**: Cannot see Field Tracking page - redirected to home
✅ **Managers & Admins**: Can see all employees' locations in real-time
✅ **Live updates**: Via socket.io + Supabase fallback

### 3. **Socket Server** (server.js)
✅ Accepts all authenticated users (employees can connect)
✅ Broadcasts employee locations to managers/admins
✅ Updates Supabase `staff_tracking` table
✅ No role restrictions on socket connection

## How It Works Now

```
EMPLOYEE Side:
1. Employee logs in
2. LiveTracker starts (runs for ALL users)
3. Requests geolocation permission
4. If granted: Sends real GPS coordinates
5. If denied: Uses branch location or falls back to default
6. Syncs to Supabase every location update
7. Sends updates via Socket (if connected)

MANAGER/ADMIN Side:
1. Opens "Field Tracking" page
2. See all employees' locations
3. Real-time updates via socket
4. Can see: Name, Status, Battery, Speed, Last Update
```

## Testing Checklist

### Local Development
```bash
# Terminal 1: Socket Server
cd socket-server
npm run dev  # Runs on localhost:3001

# Terminal 2: Frontend
npm run dev  # Runs on localhost:5173
```

### Test Steps
1. ✅ **Create/Login as Employee**
   - Browser console should show: "🎯 LiveTracker initialized for user: [ID]"
   - Check geolocation prompt - grant/deny it
   
2. ✅ **Monitor Console**
   - Should see "GPS position captured" (if granted) OR "Using branch location" (if denied)
   - Should see "Location synced to Supabase" every update
   - Should see socket connection status

3. ✅ **Login as Manager/Admin**
   - Go to "Field Tracking" (visible in sidebar)
   - Should see ALL employees listed with their current locations
   - Locations should update in real-time

4. ✅ **Check Supabase**
   - Query `staff_tracking` table
   - Should have rows for each employee with latest location + timestamp

### Browser Console Messages to Expect

**✅ Success Flow:**
```
🎯 LiveTracker initialized for user: abc123 Role: Employee
📍 Starting geolocation tracking...
✅ GPS position captured: {lat: ..., lng: ..., accuracy: ...}
📡 Sending location via Socket: {userId: ..., lat: ..., lng: ...}
✅ Location synced to Supabase
🔌 Attempting socket connection to: http://localhost:3001
✅ Socket connected! Broadcasting will be enabled.
```

**⚠️ Fallback Flow (No GPS):**
```
🎯 LiveTracker initialized for user: abc123 Role: Employee
❌ GPS error: {code: 1, message: "User denied permission"}
📍 Using branch location: {lat: ..., lng: ...}
✅ Location synced to Supabase
   Location tracking will continue via Supabase
```

## Troubleshooting

### Issue: "Employee not showing on map"
**Check:**
1. Employee's browser console for GPS errors
2. Supabase `staff_tracking` table - is the row there?
3. Is the employee's role "Employee" (not "Manager")?
4. Refresh the manager's page to see latest data

### Issue: "Permission denied for geolocation"
**Solution:**
- This is NORMAL - user can click "Block" on geolocation prompt
- Fallback to branch location works fine
- Can manually enable geolocation in browser settings later

### Issue: "Socket connection refused"
**Check:**
1. Socket server is running on correct port (3001)
2. `VITE_SOCKET_URL` environment variable is set correctly
3. Frontend can reach socket URL (CORS configured)
4. Check socket-server logs for connection errors

### Issue: "All employees show same location"
**Solution:**
- Clear browser cache and localStorage
- Hard refresh (Ctrl+Shift+R)
- Check if GPS is working for each employee
- Verify branch locations are different if using fallback

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=https://rrooywngvlmssikmzgse.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SOCKET_URL=http://localhost:3001  # Local
# Or for production:
# VITE_SOCKET_URL=https://ssatendance.onrender.com
```

### Socket Server (.env)
```
VITE_SUPABASE_URL=https://rrooywngvlmssikmzgse.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
PORT=3001
FRONTEND_URL=http://localhost:5173  # Local
# Or for production:
# FRONTEND_URL=https://attendance-wil0.onrender.com
```

## Database: staff_tracking Table

Required columns:
- `user_id` (uuid) - Primary key, references profiles.id
- `lat` (numeric) - Latitude
- `lng` (numeric) - Longitude
- `battery` (integer) - Battery % (0-100)
- `speed_kmh` (numeric) - Speed in km/h
- `accuracy` (numeric) - GPS accuracy in meters
- `current_task` (text) - Current task or role info
- `status` (text) - 'active', 'idle', 'offline'
- `last_update` (timestamptz) - Last update timestamp

## Key Features

✅ **Works for ALL users** - Not just admins
✅ **GPS-first approach** - Real coordinates when available
✅ **Intelligent fallbacks** - Uses branch location if GPS denied
✅ **Dual sync** - Both socket (realtime) and Supabase (persistent)
✅ **Error resilient** - Works even if socket/GPS fails
✅ **Role-based access** - Employees can't see field tracking page
✅ **Detailed logging** - Know exactly what's happening

## Summary of Changes

1. **LiveTracker.tsx** - Now tracks ALL users with smart fallbacks
2. **Socket Auth** - Accepts employee connections (already was)
3. **No database changes** - Uses existing `staff_tracking` table
4. **No permissions changes** - RLS policies remain unchanged

This should fix the issue where employees weren't showing up on the field tracking map!
