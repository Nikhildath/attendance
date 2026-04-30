# 🌟 Attendly Pro: The Ultimate Workforce Management Ecosystem

![Attendly Pro Banner](./public/banner.png)

**Attendly Pro** is an enterprise-grade, high-performance attendance and field workforce management platform. Engineered for the modern distributed workforce, it combines AI-powered face recognition, real-time geospatial tracking, and a robust PostgreSQL-backed infrastructure to deliver a seamless management experience.

---

## 📖 Table of Contents
- [✨ Core Feature Deep-Dive](#-core-feature-deep-dive)
  - [📡 Real-Time Field Tracking & Geospatial Intelligence](#-real-time-field-tracking--geospatial-intelligence)
  - [🛡️ Biometric & Secure Authentication](#-biometric--secure-authentication)
  - [🌍 Regional Optimization (India Focus)](#-regional-optimization-india-focus)
- [🛠️ Technical Architecture](#-technical-architecture)
  - [⚡ Frontend Mastery](#-frontend-mastery)
  - [🗄️ Database & Security Layer](#-database--security-layer)
- [⚙️ System Configuration](#-system-configuration)
- [🚀 Deployment Strategy](#-deployment-strategy)
- [🔄 Infrastructure Hardening (Recent Updates)](#-infrastructure-hardening-recent-updates)

---

## ✨ Core Feature Deep-Dive

### 📡 Real-Time Field Tracking & Geospatial Intelligence
Attendly Pro doesn't just record timestamps; it maps the movement of your organization.
- **High-Frequency Synchronization**: Using the specialized `LiveTracker` component, the system captures GPS coordinates every 30 seconds. This data is piped through a robust `upsert_staff_tracking` RPC function.
- **Identity Resolution Logic**: Our custom-built database logic solves the "First-Sync Conflict." Even if a user's local session hasn't fully hydrated, the database uses "Just-In-Time" profile resolution to ensure tracking data is never lost due to Foreign Key violations.
- **Geofencing & Branch Context**: Admins can define specific branch radii. The system intelligently switches between high-accuracy GPS and branch-fallback location depending on signal strength and user activity.
- **Device Health Monitoring**: Every location ping carries battery level telemetry, allowing managers to understand why a user might have gone "Offline" (e.g., dead battery vs. inactive app).

### 🛡️ Biometric & Secure Authentication
Security is at the heart of the Attendly ecosystem.
- **AI-Powered Face Recognition**: Integrated with `face-api.js`, the system requires users to register a unique face descriptor. Attendance can only be marked if the live camera feed matches the stored mathematical representation of the user's face.
- **Dual-Mode Authentication**: 
  - **Standard Mode**: Full Supabase Auth integration using JWTs.
  - **Custom Login (Staff Mode)**: A high-speed login bypass using our `check_credentials` RPC, allowing staff to log in with simple credentials without complex OAuth handshakes, perfect for on-field utility.
- **Role-Based Access Control (RBAC)**: Distinct views for **Employees** (Self-tracking), **Managers** (Team visibility), and **Admins** (Full system control).

### 🌍 Regional Optimization (India Focus)
Designed specifically for the Indian workforce landscape.
- **IST Timezone Locking**: All timestamps are normalized to `Asia/Kolkata` at the database level, preventing "TimeZone Drift" when users travel or use VPNs.
- **Indian Holiday Engine**: A dedicated `HolidayManager` module allows admins to configure Gazetted and Restricted holidays specific to Indian states.
- **Localization**: Date formats, currency symbols (₹), and calendar layouts are hard-coded to Indian standards for maximum user familiarity.

---

## 🛠️ Technical Architecture

### ⚡ Frontend Mastery
Built on **React 18** and **TanStack Router**, the frontend is designed for speed and type safety.
- **State Management**: Uses React Context (Auth, Branch, Settings) to provide a single source of truth across the application.
- **Responsive UI**: A "Glassmorphism" aesthetic built with **Tailwind CSS**, featuring vibrant gradients, smooth transitions with **Framer Motion**, and a high-end dark mode experience.
- **Leaflet Integration**: High-performance interactive maps in the Admin console for real-time staff visualization.

### 🗄️ Database & Security Layer
The backend is a hardened **Supabase (PostgreSQL)** instance.
- **Security Definer Functions**: All critical operations (like user creation or tracking updates) use `SECURITY DEFINER` functions. This allows unauthorized flows (like custom login) to interact with the database under strict, pre-defined rules, bypassing traditional RLS when necessary but maintaining 100% auditability.
- **Schema Protection**: We use `search_path = public` on all RPCs to prevent search-path hijacking attacks.
- **Atomic Operations**: Profile creation and tracking updates are bundled into single atomic transactions to ensure the database remains in a consistent state.

---

## ⚙️ System Configuration

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Supabase**: A project with the `pg_crypto` and `pg_vector` (optional) extensions enabled.

### Environment Variables
```env
VITE_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
```

### Installation
```bash
npm install --legacy-peer-deps
```
*Note: We use `--legacy-peer-deps` to ensure compatibility with specific face-recognition and mapping libraries.*

---

## 🚀 Deployment Strategy

Attendly Pro is optimized for **Render** and **Netlify** deployment.
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Routing**: Ensure your hosting provider is configured to redirect all 404s to `index.html` (Standard SPA routing).

---

## 🔄 Infrastructure Hardening (Recent Updates)

In the latest v2.4 update, we significantly hardened the platform's stability:
- **✅ Robust Identity Resolution**: The `upsert_staff_tracking` RPC was rebuilt from the ground up to handle "Email/ID Mismatches." It now resolves identities by email if the provided ID is not found, effectively eliminating the `409 Conflict` errors seen in production.
- **✅ Security Definer Audit**: All administrative functions (`admin_insert_profile`, `admin_update_profile`) were audited for security, ensuring only users with the `Admin` role can execute them.
- **✅ Realtime Engine**: Optimized the Supabase Realtime channel usage in `FieldTrackingPage` to reduce overhead while maintaining <1s latency for location markers.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support & Documentation
For detailed database setup, refer to [SUPABASE_SETUP.md](./SUPABASE_SETUP.md). For troubleshooting foreign key or authentication issues, check the [LIVE_TRACKING_FIX.md](./LIVE_TRACKING_FIX.md).

---
*Built with ❤️ by the Attendly Pro Engineering Team. Empowering the future of work.*