-- CREATE PROFILES TABLE
-- NOTE: id stores the MAIN APP's user ID (not chat anonymous auth ID)
-- This ensures the same account uses the same profile across all devices.
CREATE TABLE profiles (
  id UUID PRIMARY KEY, -- Main app user ID (stable across devices)
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  full_name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'offline', -- online, offline, busy
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CREATE ROOMS TABLE
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_private BOOLEAN DEFAULT FALSE
);

-- CREATE MESSAGES TABLE
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text', -- text, image, video, audio, file
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT FALSE,
  reply_to UUID REFERENCES messages(id) -- For threaded replies
);

-- CREATE ROOM_MEMBERS TABLE (For private rooms/group chats)
CREATE TABLE room_members (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Profiles: Anyone can view, only owner can update
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Rooms: Viewable if public or if member
CREATE POLICY "Public rooms are viewable by everyone." ON rooms FOR SELECT USING (NOT is_private OR EXISTS (SELECT 1 FROM room_members WHERE room_id = rooms.id AND user_id = auth.uid()));
CREATE POLICY "Users can create rooms." ON rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Messages: Viewable if you can see the room
CREATE POLICY "Messages are viewable by room members." ON messages FOR SELECT USING (EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_id AND (NOT r.is_private OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.user_id = auth.uid()))));

-- Messages: Insert if you are in the room
CREATE POLICY "Users can insert messages into rooms they belong to." ON messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_id AND (NOT r.is_private OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.user_id = auth.uid()))));

-- Messages: Delete own messages
CREATE POLICY "Users can delete own messages." ON messages FOR DELETE USING (auth.uid() = user_id);

-- REALTIME CONFIGURATION
-- Enable realtime for messages and profiles
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- AUTO-PURGE OLD MESSAGES CRON (Runs daily, deletes messages older than 30 days)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('delete_old_chat_messages', '0 0 * * *', $$
  DELETE FROM messages WHERE created_at < NOW() - INTERVAL '30 days';
$$);
