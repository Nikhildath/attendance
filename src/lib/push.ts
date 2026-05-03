import { supabase } from "./supabase";

/**
 * Global helper to send push notifications to a user.
 * This should ideally be called from a server-side context or an Edge Function,
 * but for this project we'll simulate the trigger logic here.
 */
export async function sendPushNotification(userId: string, payload: { title: string; body: string; icon?: string; data?: any }) {
  console.log(`[Push] Queuing notification for user ${userId}:`, payload);
  
  // 1. Fetch user's subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) {
    console.warn(`[Push] No subscriptions found for user ${userId}`);
    return;
  }

  // Note: In a real production app, you would send this to a backend/Edge Function
  // that uses the 'web-push' library to encrypt and send the notification to FCM/Apple.
  // Since we are in a pure client environment, we'll log it and suggest the Edge Function pattern.
  
  // Simulated success for now (UI will show local toast/notification if app is open)
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png'
    });
  }
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}
