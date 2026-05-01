import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from 'react';
import { createClient, User } from '@supabase/supabase-js';
import { 
  Send, Plus, Hash, Search, MoreVertical, Image as ImageIcon, 
  Paperclip, Smile, Settings, LogOut, User as UserIcon,
  Check, CheckCheck, ChevronLeft, Mic, Square, Play, Pause,
  Download, FileJson, Trash2, Shield, X, FileText, Film, Volume2,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useAuth } from "@/lib/auth";

// --- CONFIGURATION ---
const CHAT_SUPABASE_URL = import.meta.env.VITE_CHAT_SUPABASE_URL;
const CHAT_SUPABASE_ANON_KEY = import.meta.env.VITE_CHAT_SUPABASE_ANON_KEY;
const STORAGE_BUCKET = import.meta.env.VITE_CHAT_STORAGE_BUCKET || 'chat-media';
const chatSupabase = createClient(CHAT_SUPABASE_URL, CHAT_SUPABASE_ANON_KEY);

// --- TYPES ---
interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  full_name: string; // Used for role
  is_admin?: boolean; // Keep for fallback logic
}

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  file_url?: string;
  created_at: string;
  profiles: Profile;
}

interface Room {
  id: string;
  name: string;
  description: string;
}

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { user: mainUser, profile: mainProfile, loading: mainAuthLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      } else if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  useEffect(() => {
    if (mainAuthLoading) return;

    const initChat = async () => {
      console.log("Chat Init - Main Profile:", mainProfile?.id);
      if (!CHAT_SUPABASE_URL || !CHAT_SUPABASE_ANON_KEY) {
        setAuthErrorMsg("Environment variables VITE_CHAT_SUPABASE_URL or VITE_CHAT_SUPABASE_ANON_KEY are missing in the main .env file.");
        setLoading(false);
        return;
      }
      try {
        const { data: { session } } = await chatSupabase.auth.getSession();
        
        let activeUser = session?.user;

        if (!activeUser && (mainUser || mainProfile)) {
          console.log("Attempting automatic anonymous sign-in...");
          const { data: authData, error: authError } = await chatSupabase.auth.signInAnonymously();
          if (authError) {
            console.error("Chat anonymous sign-in failed:", authError.message);
            setAuthErrorMsg(authError.message);
          } else {
            activeUser = authData.user;
          }
        }

        if (activeUser) {
          setUser(activeUser);
          
          // Extract a reasonable username from available info
          const rawName = mainProfile?.name || mainProfile?.email || mainUser?.email || 'User';
          const username = rawName.split('@')[0];
          const finalAvatarUrl = mainProfile?.avatar_url || `https://ui-avatars.com/api/?name=${username}&background=random`;

          // Always upsert profile on load to ensure it exists and is synced
          const { error: profileError } = await chatSupabase.from('profiles').upsert({
            id: activeUser.id,
            username: username,
            avatar_url: finalAvatarUrl,
            full_name: mainProfile?.role || 'Employee', // Store role in full_name for now
          });
          
          if (profileError) {
            console.error("Profile sync error:", profileError);
            alert("Failed to sync profile: " + profileError.message);
          } else {
            fetchProfile(activeUser.id);
          }
        } else if (!session) {
          console.warn("No main application user found. Automatic chat login skipped.");
          setAuthErrorMsg("Main application session not found. Please log in to the main website first.");
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initChat();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const { data: { subscription } } = chatSupabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [mainUser, mainProfile, mainAuthLoading]);

  const fetchProfile = async (userId: string) => {
    const { data } = await chatSupabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  useEffect(() => {
    if (user) fetchRooms();
  }, [user]);

  useEffect(() => {
    if (activeRoom) {
      fetchMessages(activeRoom.id);
      const channel = chatSupabase
        .channel(`room:${activeRoom.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `room_id=eq.${activeRoom.id}` 
        }, payload => {
          if (payload.new.user_id !== user?.id && 'Notification' in window && Notification.permission === 'granted') {
             new Notification('New message', { body: `You have a new message in ${activeRoom.name}`, icon: '/icon-192.png' });
          }
          fetchMessageWithProfile(payload.new.id);
        })
        .subscribe();

      return () => { chatSupabase.removeChannel(channel); };
    }
  }, [activeRoom]);

  const fetchRooms = async () => {
    const { data, error } = await chatSupabase.from('rooms').select('*').order('name');
    if (!error && data) setRooms(data);
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const { data, error } = await chatSupabase.from('rooms').insert([{
      name: newRoomName.toLowerCase().replace(/\s+/g, '-'),
      description: newRoomDesc
    }]).select().single();
    
    if (error) {
      console.error("Error creating room:", error);
      alert("Failed to create channel: " + error.message);
    } else if (data) {
      setRooms([...rooms, data]);
      setActiveRoom(data);
      setIsCreateRoomOpen(false);
      setNewRoomName('');
      setNewRoomDesc('');
    }
  };

  const fetchMessages = async (roomId: string) => {
    const { data, error } = await chatSupabase
      .from('messages')
      .select('*, profiles(id, username, avatar_url, full_name)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    
    if (error) console.error("Error fetching messages:", error);
    if (!error && data) setMessages(data);
    scrollToBottom();
  };

  const fetchMessageWithProfile = async (messageId: string) => {
    const { data, error } = await chatSupabase
      .from('messages')
      .select('*, profiles(id, username, avatar_url, full_name)')
      .eq('id', messageId)
      .single();
    
    if (error) console.error("Error fetching single message:", error);
    if (!error && data) {
      setMessages(prev => [...prev, data]);
      scrollToBottom();
    }
  };

  const sendMessage = async (content: string, type: Message['type'] = 'text', fileUrl?: string) => {
    if (!user || !activeRoom) return;

    const { error } = await chatSupabase.from('messages').insert([{
      room_id: activeRoom.id,
      user_id: user.id,
      content,
      type,
      file_url: fileUrl
    }]);

    if (error) {
      console.error("Error sending message:", error);
      alert("Failed to send: " + error.message);
    } else {
      setInput('');
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large for Base64 storage. Please keep it under 5MB.");
      return;
    }

    let type: Message['type'] = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    if (file.type.startsWith('video/')) type = 'video';
    if (file.type.startsWith('audio/')) type = 'audio';

    setUploadProgress(10);
    const reader = new FileReader();
    reader.onload = async () => {
      setUploadProgress(100);
      await sendMessage(file.name, type, reader.result as string);
      setTimeout(() => setUploadProgress(0), 1000);
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          sendMessage('Voice Note', 'audio', reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };


  const exportRoomJSON = () => {
    if (!activeRoom) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${activeRoom.name}_backup_${format(new Date(), 'yyyyMMdd')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const downloadAllMedia = () => {
    const mediaMessages = messages.filter(m => m.file_url);
    if (mediaMessages.length === 0) return alert('No media to download');
    mediaMessages.forEach((m, i) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = m.file_url!;
        link.download = m.content || 'file';
        link.target = '_blank';
        link.click();
      }, i * 500);
    });
  };


  if (loading) return <div className="flex h-[calc(100vh-10rem)] items-center justify-center"><Hash size={48} className="animate-pulse text-primary" /></div>;
  if (!user) return (
    <div className="flex h-[calc(100vh-10rem)] flex-col items-center justify-center gap-6 text-center animate-in fade-in duration-500">
      <div className="relative">
        <MessageSquare size={80} className="text-primary/20" />
        <Shield size={32} className="absolute -bottom-2 -right-2 text-rose-500 animate-pulse" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-black tracking-tight">Chat Authorization Required</h1>
        <p className="text-muted-foreground text-sm">
          The chat system is isolated for security. If automatic sign-in failed, please ensure 
          <span className="font-bold text-primary"> Anonymous Auth </span> 
          is enabled in your Chat Supabase project settings.
        </p>
        {authErrorMsg && (
          <div className="mt-4 rounded-xl bg-rose-500/10 p-3 text-[10px] font-mono text-rose-500 border border-rose-500/20">
            Error: {authErrorMsg}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button 
          onClick={() => window.location.reload()} 
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-primary/30 active:scale-95 transition-all"
        >
          Retry Connection
        </button>
        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
          Check Console for Errors
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-12rem)] font-outfit overflow-hidden gap-4 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Premium Gradient Background Elements */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/10 dark:bg-primary/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/10 dark:bg-indigo-500/20 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* Sidebar Channels */}
      <aside className="hidden w-80 flex-col gap-4 relative z-10 lg:flex">
        {/* User Profile Summary */}
        <div className="flex items-center gap-4 rounded-3xl border border-zinc-200/50 dark:border-white/5 bg-white/40 dark:bg-zinc-950/50 p-6 backdrop-blur-xl shadow-sm">
          <div className="relative">
            {profile?.avatar_url ? (
               <img src={profile.avatar_url} className="h-12 w-12 rounded-2xl object-cover shadow-lg border border-zinc-200 dark:border-white/10" />
            ) : (
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white shadow-lg">
                 {profile?.username?.[0]?.toUpperCase()}
               </div>
            )}
            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-zinc-950 bg-emerald-500 shadow-sm" />
          </div>
          <div className="flex-1 overflow-hidden">
            <h2 className="truncate font-black text-zinc-900 dark:text-white leading-tight">{profile?.username}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Online</p>
            </div>
          </div>
        </div>

        {/* Room List */}
        <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200/50 dark:border-white/5 bg-white/40 dark:bg-zinc-950/50 p-6 backdrop-blur-xl shadow-sm flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Channels</h3>
            <button onClick={() => setIsCreateRoomOpen(true)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary hover:text-white transition-colors">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[40vh] scrollbar-none -mx-2 px-2">
            {rooms.filter(r => r.name.includes(searchQuery.toLowerCase())).map(room => (
              <button 
                key={room.id} 
                onClick={() => setActiveRoom(room)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeRoom?.id === room.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                <Hash size={16} />
                <span>{room.name}</span>
              </button>
            ))}
          </div>
          {profile?.is_admin && (
            <div className="mt-auto pt-4 border-t border-zinc-200/50 dark:border-white/5">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-3">Admin Tools</h3>
               <button onClick={() => setIsAdminPanelOpen(true)} className="flex w-full items-center gap-3 rounded-xl bg-rose-500/10 px-3 py-2.5 text-sm font-bold text-rose-600 dark:text-rose-500 hover:bg-rose-500 hover:text-white transition-all">
                 <Shield size={16} />
                 <span>Management</span>
               </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-200/50 dark:border-white/5 bg-white/40 dark:bg-zinc-950/50 backdrop-blur-xl shadow-sm relative z-10">
        {activeRoom ? (
          <>
            <header className="flex items-center justify-between border-b border-zinc-200/50 dark:border-white/5 p-6 bg-white/20 dark:bg-white/5 backdrop-blur-md relative z-50">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary">
                  <Hash size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-white">{activeRoom.name}</h2>
                  <p className="text-xs text-zinc-500">{activeRoom.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSearchOpen && (
                  <input 
                    type="text" 
                    placeholder="Search messages..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none w-48 text-zinc-900 dark:text-white"
                  />
                )}
                <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors text-zinc-500 dark:text-zinc-400"><Search size={20} /></button>
                <div className="relative">
                  <button onClick={() => setIsRoomMenuOpen(!isRoomMenuOpen)} className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isRoomMenuOpen ? 'bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white' : 'hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400'}`}>
                    <MoreVertical size={20} />
                  </button>
                  {isRoomMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsRoomMenuOpen(false)} />
                      <div className="absolute right-0 top-12 w-56 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => { downloadAllMedia(); setIsRoomMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-primary/10 hover:text-primary transition-colors">
                          <Download size={16} /> Download Media
                        </button>
                        <button onClick={() => { exportRoomJSON(); setIsRoomMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-primary/10 hover:text-primary transition-colors">
                          <FileJson size={16} /> Export Chat JSON
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </header>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 scrollbar-none space-y-6">
              {messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())).map((msg, i, arr) => {
                const isOwn = msg.user_id === user.id;
                const showAvatar = i === 0 || arr[i-1].user_id !== msg.user_id;
                const canDelete = isOwn || profile?.is_admin || mainProfile?.role === 'Admin';
                
                return (
                  <div key={msg.id} className={`flex gap-4 group ${isOwn ? 'flex-row-reverse' : ''}`}>
                    {showAvatar ? (
                      <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-black text-xs overflow-hidden border border-zinc-300 dark:border-white/10 shadow-sm">
                        {msg.profiles?.avatar_url ? (
                          <img src={msg.profiles.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-zinc-500 dark:text-zinc-400">{msg.profiles?.username?.[0].toUpperCase() || '?'}</span>
                        )}
                      </div>
                    ) : (
                      <div className="w-10 shrink-0" />
                    )}
                    <div className={`flex max-w-[70%] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                      {showAvatar && (
                        <div className={`flex items-center gap-2 px-1 mb-1 text-[10px] font-black uppercase tracking-wider ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <span className="text-primary">{msg.profiles?.username || 'User'}</span>
                          {msg.profiles?.full_name && (
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 text-[8px]">
                              {msg.profiles.full_name}
                            </span>
                          )}
                          <span className="text-zinc-400 dark:text-zinc-600">{format(new Date(msg.created_at), 'h:mm a')}</span>
                        </div>
                      )}
                      <div className={`flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {canDelete && (
                          <button onClick={async () => {
                            await chatSupabase.from('messages').delete().eq('id', msg.id);
                            setMessages(prev => prev.filter(m => m.id !== msg.id));
                          }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        )}
                        <div className={`rounded-2xl px-4 py-3 text-sm font-medium shadow-sm backdrop-blur-md ${isOwn ? 'bg-primary text-white rounded-tr-sm' : 'bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-zinc-200 rounded-tl-sm'} ${msg.type !== 'text' ? 'p-1.5' : ''}`}>
                           {msg.type === 'text' && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                           {msg.type === 'image' && (
                             <div className="relative group/media inline-block">
                               <img src={msg.file_url} className="rounded-xl max-w-sm w-full shadow-sm" />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center rounded-xl backdrop-blur-sm pointer-events-none">
                                  <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = msg.file_url!; a.download = msg.content || 'image'; a.target='_blank'; a.click(); }} className="p-3 bg-white/20 hover:bg-white/40 text-white rounded-full pointer-events-auto transition-colors shadow-xl backdrop-blur-md">
                                    <Download size={24} />
                                  </button>
                               </div>
                             </div>
                           )}
                           {msg.type === 'video' && (
                             <div className="relative group/media inline-block">
                               <video controls src={msg.file_url} className="rounded-xl max-w-sm w-full shadow-sm" />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-start justify-end p-2 rounded-xl pointer-events-none">
                                  <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = msg.file_url!; a.download = msg.content || 'video'; a.target='_blank'; a.click(); }} className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-lg pointer-events-auto transition-colors shadow-xl backdrop-blur-md">
                                    <Download size={16} />
                                  </button>
                               </div>
                             </div>
                           )}
                           {msg.type === 'audio' && (
                             <div className={`rounded-2xl p-1 pr-2 flex items-center gap-2 ${isOwn ? 'bg-black/10 shadow-inner border border-black/5' : 'bg-zinc-100 dark:bg-black/20 shadow-inner border border-zinc-200/50 dark:border-white/5'}`}>
                               <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isOwn ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                 <Mic size={14} />
                               </div>
                               <audio controls src={msg.file_url} className={`h-8 w-48 ${isOwn ? 'opacity-90 contrast-125' : 'opacity-80 dark:opacity-60 grayscale'}`} />
                             </div>
                           )}
                           {msg.type === 'file' && (
                             <a href={msg.file_url} target="_blank" className={`flex items-center gap-3 p-3 rounded-xl no-underline transition-colors ${isOwn ? 'bg-black/20 text-white hover:bg-black/30' : 'bg-zinc-100 dark:bg-black/20 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-black/40'}`}>
                               <div className="bg-white/50 dark:bg-white/10 p-2 rounded-lg"><FileText size={16} /></div>
                               <span className="truncate max-w-[150px] font-bold">{msg.content}</span>
                               <Download size={14} className="opacity-50" />
                             </a>
                           )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <footer className="border-t border-zinc-200/50 dark:border-white/5 p-6 bg-white/20 dark:bg-white/5 backdrop-blur-md">
              <div className="flex items-center gap-4 bg-white dark:bg-white/5 rounded-2xl p-2 border border-zinc-200 dark:border-white/5 focus-within:border-primary/50 transition-colors shadow-sm">
                <div className="flex items-center gap-1">
                  <label className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-zinc-500 dark:text-zinc-400 relative">
                    <ImageIcon size={20} />
                    <input type="file" hidden accept="image/*,video/*,audio/*,.pdf" onChange={handleFileUpload} />
                    {uploadProgress > 0 && <div className="absolute inset-0 bg-primary/20 rounded-xl animate-pulse" />}
                  </label>
                  <button onClick={isRecording ? stopRecording : startRecording} className={`flex h-10 w-10 items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors relative ${isRecording ? 'text-rose-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {isRecording && <div className="absolute inset-0 rounded-xl border-2 border-rose-500 animate-ping opacity-50" />}
                    {isRecording && <div className="absolute inset-2 rounded-xl bg-rose-500 animate-pulse opacity-20" />}
                    {isRecording ? <Square size={20} className="relative z-10" /> : <Mic size={20} />}
                  </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if(input.trim()) sendMessage(input); }} className="flex flex-1 items-center gap-4">
                  {isRecording ? (
                    <div className="flex-1 px-4 py-2 text-rose-500 font-bold text-sm animate-pulse flex items-center gap-2">
                       <Mic size={14} /> Recording Audio... Click square to stop and send.
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      placeholder={`Message #${activeRoom.name}`}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                    />
                  )}
                  <button type="submit" disabled={!input.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all">
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-12 text-center relative z-10">
             <div className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-primary/10 text-primary border border-primary/20 shadow-xl shadow-primary/5">
               <MessageSquare size={48} />
             </div>
             <div className="max-w-md">
               <h1 className="text-3xl font-black tracking-tight mb-3 text-zinc-900 dark:text-white">Premium Communication Hub</h1>
               <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                 Secure, real-time workspace for your team. All history is purged every 30 days. 
                 Select a channel from the left or create a new one to begin.
               </p>
             </div>
             <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-4">
               <div className="flex items-center justify-center gap-2 p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-zinc-200/50 dark:border-white/5 text-xs font-bold text-zinc-600 dark:text-zinc-400 shadow-sm">
                 <Film size={16} /> Video Support
               </div>
               <div className="flex items-center justify-center gap-2 p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-zinc-200/50 dark:border-white/5 text-xs font-bold text-zinc-600 dark:text-zinc-400 shadow-sm">
                 <Mic size={16} /> Voice Notes
               </div>
             </div>
          </div>
        )}
      </div>

      {/* Admin Modal */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Shield className="text-rose-500" />
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">Workspace Controls</h2>
              </div>
              <button onClick={() => setIsAdminPanelOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500"><X /></button>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 p-6">
                <h3 className="font-bold mb-1 text-zinc-900 dark:text-white">Backup History</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Export all messages from current room to a JSON file.</p>
                <button onClick={exportRoomJSON} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20"><FileJson size={16} /> Export JSON</button>
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 p-6">
                <h3 className="font-bold mb-1 text-zinc-900 dark:text-white">Media Archive</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Download all images, videos, and audio files shared here.</p>
                <button onClick={downloadAllMedia} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20"><Download size={16} /> Download Media</button>
              </div>
              <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/5 p-6">
                 <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Security Notice</p>
                 <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">Retention policy is active: 30 days. No data can be recovered after the purge cycle.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {isCreateRoomOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white">Create Channel</h2>
              <button onClick={() => setIsCreateRoomOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500"><X /></button>
            </div>
            <form onSubmit={createRoom} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 block">Channel Name</label>
                <input 
                  type="text" 
                  required
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-primary transition-colors shadow-sm"
                  placeholder="e.g. general, announcements"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 block">Description (Optional)</label>
                <input 
                  type="text" 
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-primary transition-colors shadow-sm"
                  placeholder="What is this channel about?"
                />
              </div>
              <button type="submit" disabled={!newRoomName.trim()} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 disabled:opacity-50 mt-4 transition-transform active:scale-95">
                Create Channel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

