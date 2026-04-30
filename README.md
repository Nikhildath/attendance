# 🌟 Attendly Pro

![Attendly Pro Banner](./public/banner.png)

**Attendly Pro** is a premium, high-performance attendance and field workforce management platform. Built with a cutting-edge tech stack, it provides real-time visibility, automated payroll preparation, and robust security for modern organizations.

---

## ✨ Key Features

### 📡 Real-Time Field Tracking
- **Live GPS Sync**: High-frequency location updates for field staff.
- **Identity Resolution**: Advanced RPC handling to prevent data loss even if auth sessions lag.
- **Battery & Status Monitoring**: Monitor device health and 'Active/Idle/Offline' status in real-time.

### 🛡️ Enterprise-Grade Security
- **Face Recognition**: Secure, admin-verified attendance marking using AI-powered face descriptors.
- **Custom Identity Engine**: Dual-mode authentication (Supabase Auth + Secure Custom Login) for flexible workforce onboarding.
- **Security Definer RPCs**: Database-level stability ensuring data integrity across all environments.

### 🌍 Global-Ready, India-Optimized
- **Localization**: Full support for Indian Timezones (Asia/Kolkata) and date formatting.
- **Holiday Management**: Built-in India-standard holiday calendars with branch-level customization.

### 📊 Administrative Command Center
- **Branch Management**: Geo-fencing and branch-specific configurations.
- **Team Insights**: Real-time dashboards for attendance patterns, leave trends, and field coverage.
- **Automated Payroll**: One-click exports and real-time payslip generation data.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, TanStack Router |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime) |
| **Styling** | Tailwind CSS, Framer Motion, shadcn/ui |
| **Logic** | Security Definer PL/pgSQL RPCs |
| **Hosting** | Render / Netlify (CI/CD Optimized) |

---

## 🚀 Quick Start

### 1. Installation
```bash
git clone <repository-url>
cd attendance-hub-pro-main
npm install --legacy-peer-deps
```

### 2. Environment Configuration
Create a `.env` file in the root:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Database Initialization
Apply the latest schema found in `supabase_schema.sql` to your Supabase project. This includes all essential tables, RLS policies, and RPC functions.

### 4. Development
```bash
npm run dev
```

---

## 🏗️ Project Structure

```text
src/
├── components/
│   ├── admin/           # Management modules (Holidays, Shifts)
│   ├── common/          # Shared UI & Live Tracking logic
│   ├── layout/          # Premium Sidebar & Navigation
│   └── ui/              # Base shadcn/ui components
├── lib/                 # Core logic (Supabase, Auth, Branch Context)
├── routes/              # Type-safe routing (TanStack Router)
└── styles/              # Global Design System
```

---

## 🔄 Recent Infrastructure Hardening
- **✅ Robust Field Sync**: Implemented just-in-time profile resolution to eliminate Foreign Key errors in production.
- **✅ Branch Contextualization**: Centralized branch-level geofencing and state management.
- **✅ Multi-Platform Deployment**: Optimized for Render/Netlify with standard build pipelines.
- **✅ Security Audit**: Enabled `Security Definer` on all critical RPCs with `search_path` protection.

---

## 📄 License
This project is licensed under the MIT License.

## 🆘 Support
For technical issues or configuration help, please refer to the [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) or contact the platform administrator.

---
*Built with ❤️ by the Attendly Team*