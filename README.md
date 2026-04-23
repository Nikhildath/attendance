# Attendance Hub Pro

A modern attendance management system built with React 19, TypeScript, TanStack Router, and Supabase. Features face recognition, India localization, and comprehensive admin controls.

## 🚀 Features

- **Authentication System**: Secure login with role-based access (Employee, Manager, Admin)
- **Face Recognition**: Admin-controlled face registration for secure attendance marking
- **India Localization**: Calendar and time formatting set to Indian standards
- **Real-time Attendance**: GPS location tracking and timestamp recording
- **Leave Management**: Request and approve leave with different types
- **Admin Dashboard**: Full CRUD operations for user management
- **Responsive Design**: Mobile-first UI with Tailwind CSS
- **Row Level Security**: Database-level access control with Supabase

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, TanStack Router
- **Backend**: Supabase (Auth, Database, RLS)
- **Styling**: Tailwind CSS, shadcn/ui components
- **Build Tool**: Vite
- **Deployment**: Cloudflare Workers (configured)

## 📋 Prerequisites

- Node.js 18+
- npm or bun
- Supabase account

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd attendance-hub-pro-main
npm install --legacy-peer-deps
```

### 2. Set up Supabase

Follow the detailed setup guide in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

### 3. Configure Environment

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Start Development Server

```bash
npm run dev
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📁 Project Structure

```
src/
├── components/
│   ├── calendar/          # Calendar components
│   ├── charts/           # Data visualization
│   ├── common/           # Shared components
│   ├── layout/           # Layout components
│   └── ui/              # shadcn/ui components
├── hooks/               # Custom React hooks
├── lib/                # Utilities and configurations
├── routes/             # TanStack Router pages
└── styles.css         # Global styles
```

## 🔐 Authentication Flow

1. **Login Required**: All routes require authentication
2. **Role-Based Access**: Different permissions for Employee/Manager/Admin
3. **Face Registration**: Employees must be registered by admin before marking attendance
4. **Admin Controls**: Admins can manage users, roles, and face registrations

## 🌍 India Localization

- Calendar defaults to India (country="IN")
- Timezone: Asia/Kolkata
- Date formatting follows Indian standards
- Holiday integration with Indian holidays

## 🗄️ Database Schema

### Tables

- **profiles**: User profiles with roles and face registration status
- **attendance**: Attendance records with timestamps and location
- **leaves**: Leave requests and approvals

All tables use Row Level Security (RLS) for data protection.

## 🔒 Security Features

- **Row Level Security**: Database-level access control
- **Face Verification**: Prevents unauthorized attendance marking
- **Role-Based Permissions**: Granular access control
- **Secure Authentication**: Supabase Auth with JWT tokens

## 📱 Mobile Support

- Responsive design for all screen sizes
- Mobile-optimized attendance marking
- Touch-friendly interface

## 🚀 Deployment

### Cloudflare Workers

The project is configured for Cloudflare Workers deployment:

```bash
npm run build
npx wrangler deploy
```

### Environment Variables for Production

Update your Supabase project settings:
- Site URL: Your production domain
- Redirect URLs: Include your production URLs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for common setup issues
2. Review the database schema and RLS policies
3. Ensure environment variables are correctly set

## 🔄 Recent Updates

- ✅ Replaced mock data with Supabase integration
- ✅ Implemented secure authentication system
- ✅ Added India localization for calendar and time
- ✅ Enforced face registration requirement for attendance
- ✅ Created admin login instead of direct dashboard access
- ✅ Enabled full admin CRUD operations for user management
- ✅ Added Row Level Security policies
- ✅ Configured responsive UI with role-based navigation
- ✅ Fixed DOM manipulation error by downgrading to React 18 for library compatibility