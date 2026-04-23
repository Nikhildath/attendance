# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new account or sign in
2. Click "New Project"
3. Fill in your project details:
   - Name: `attendance-hub`
   - Database Password: Choose a strong password
   - Region: Select a region close to your users (e.g., Asia South for India)

## 2. Get Your Project Credentials

After your project is created, go to Settings > API and copy:
- Project URL
- Anon/Public Key

## 3. Configure Environment Variables

Create a `.env` file in your project root and add:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Set Up Database Schema

Run the following SQL in your Supabase SQL Editor:

```sql
-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Employee' CHECK (role IN ('Employee', 'Manager', 'Admin')),
  dept TEXT,
  face_registered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create attendance table
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  check_in TIMESTAMP WITH TIME ZONE,
  check_out TIMESTAMP WITH TIME ZONE,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  branch_id TEXT,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'leave', 'holiday')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create leaves table
CREATE TABLE leaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Casual', 'Sick', 'Annual', 'Unpaid')),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days DECIMAL(4,1) NOT NULL,
  half_day BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Approved', 'Pending', 'Rejected')),
  reason TEXT,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Attendance policies
CREATE POLICY "Users can view their own attendance" ON attendance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attendance" ON attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers and admins can view all attendance" ON attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('Manager', 'Admin')
    )
  );

-- Leaves policies
CREATE POLICY "Users can view their own leaves" ON leaves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leaves" ON leaves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers and admins can view all leaves" ON leaves
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('Manager', 'Admin')
    )
  );

CREATE POLICY "Managers and admins can update leaves" ON leaves
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('Manager', 'Admin')
    )
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, face_registered)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'Employee',
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profile changes
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 5. Configure Authentication

In your Supabase dashboard:

1. Go to Authentication > Settings
2. Configure your site URL: `http://localhost:3000` (for development)
3. Add redirect URLs if needed

## 6. Test the Setup

1. Start your development server: `npm run dev`
2. Try signing up a new user
3. Check that the profile is created automatically
4. Test admin functionality with an admin user

## 7. Production Deployment

When deploying to production:

1. Update the site URL in Supabase Auth settings
2. Add your production domain to redirect URLs
3. Consider enabling email confirmation for signups
4. Set up proper CORS policies if needed

## Database Tables Overview

- **profiles**: User profiles with roles and face registration status
- **attendance**: Attendance records with timestamps and location
- **leaves**: Leave requests and approvals

All tables have Row Level Security enabled to ensure proper access control.