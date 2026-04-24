-- Fix RLS policies for branches table
-- Run this SQL in Supabase SQL Editor

-- 1. First, ensure branches table exists with proper structure
CREATE TABLE IF NOT EXISTS branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  radius_meters INTEGER,
  employees_count INTEGER,
  currency TEXT,
  timezone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Enable RLS on branches table
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- 3. DROP existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Everyone can view branches" ON branches;
DROP POLICY IF EXISTS "Admins can insert branches" ON branches;
DROP POLICY IF EXISTS "Admins can update branches" ON branches;
DROP POLICY IF EXISTS "Admins can delete branches" ON branches;
DROP POLICY IF EXISTS "Users can view branches" ON branches;

-- 4. CREATE new RLS policies for branches table

-- Allow everyone to view branches (needed for branch selector)
CREATE POLICY "Everyone can view branches" ON branches
  FOR SELECT USING (true);

-- Allow only admins to insert branches
CREATE POLICY "Admins can insert branches" ON branches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Allow only admins to update branches
CREATE POLICY "Admins can update branches" ON branches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Allow only admins to delete branches
CREATE POLICY "Admins can delete branches" ON branches
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- 5. Also add policies for staff_tracking table if not exists
CREATE TABLE IF NOT EXISTS staff_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  battery INTEGER DEFAULT 100,
  speed_kmh DECIMAL(5, 2),
  accuracy DECIMAL(5, 2),
  current_task TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('active', 'idle', 'offline')),
  last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE staff_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tracking" ON staff_tracking;
DROP POLICY IF EXISTS "Admins can view all tracking" ON staff_tracking;
DROP POLICY IF EXISTS "Users can update own tracking" ON staff_tracking;
DROP POLICY IF EXISTS "Admins can update tracking" ON staff_tracking;

-- Allow users to see their own tracking data
CREATE POLICY "Users can view own tracking" ON staff_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Allow admins to see all tracking
CREATE POLICY "Admins can view all tracking" ON staff_tracking
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

-- Allow users to update their own tracking
CREATE POLICY "Users can update own tracking" ON staff_tracking
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow admins to update any tracking
CREATE POLICY "Admins can update tracking" ON staff_tracking
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

-- Allow users to insert their own tracking
CREATE POLICY "Users can insert own tracking" ON staff_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Add policies for company_holidays table if needed
CREATE TABLE IF NOT EXISTS company_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE company_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view holidays" ON company_holidays;
DROP POLICY IF EXISTS "Admins can manage holidays" ON company_holidays;

CREATE POLICY "Everyone can view holidays" ON company_holidays
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert holidays" ON company_holidays
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "Admins can update holidays" ON company_holidays
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "Admins can delete holidays" ON company_holidays
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

-- 7. Add policies for organisation_settings if needed
CREATE TABLE IF NOT EXISTS organisation_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT,
  default_currency TEXT DEFAULT 'INR',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  late_threshold_mins INTEGER DEFAULT 15,
  working_hours_per_day DECIMAL(3, 1) DEFAULT 8,
  fiscal_year_start DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE organisation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view settings" ON organisation_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON organisation_settings;

CREATE POLICY "Everyone can view settings" ON organisation_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update settings" ON organisation_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

-- Verify the setup
SELECT 'Policies configured successfully' as status;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('branches', 'staff_tracking', 'company_holidays', 'organisation_settings')
ORDER BY tablename, policyname;
