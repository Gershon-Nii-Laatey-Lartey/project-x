// telegram-manage: CRUD for tracked Telegram channels
// Validates channels by fetching t.me/s/username — no auth needed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

// Clean username from various input formats
function cleanUsername(input: string): string {
  let u = input.trim();
  if (u.startsWith("https://t.me/")) u = u.replace("https://t.me/", "");
  if (u.startsWith("http://t.me/")) u = u.replace("http://t.me/", "");
  if (u.startsWith("t.me/")) u = u.replace("t.me/", "");
  if (u.startsWith("@")) u = u.substring(1);
  // Remove trailing slashes or paths
  u = u.split("/")[0].split("?")[0];
  return u;
}

// Validate channel exists and extract title from the public page
async function validateChannel(username: string): Promise<{ valid: boolean; title: string; photoUrl: string | null }> {
  try {
    const res = await fetch(`https://t.me/s/${username}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });

    if (!res.ok) return { valid: false, title: "", photoUrl: null };

    const html = await res.text();

    // Extract channel title from page
    const titleMatch = html.match(/<div class="tgme_channel_info_header_title[^"]*"[^>]*><span[^>]*>([^<]+)<\/span>/);
    const title = titleMatch ? titleMatch[1].trim() : username;

    // Extract channel photo
    const photoMatch = html.match(/<img class="tgme_page_photo_image"[^>]*src="([^"]+)"/);
    const photoUrl = photoMatch ? photoMatch[1] : null;

    // Check if it's actually a channel (has messages or channel info)
    const isChannel = html.includes("tgme_channel_info") || html.includes("tgme_widget_message");

    return { valid: isChannel, title, photoUrl };
  } catch {
    return { valid: false, title: "", photoUrl: null };
  }
}

// ─── Add a channel ───
async function handleAdd(body: { username: string }) {
  const { username } = body;
  if (!username) return jsonResponse({ error: "Channel username is required" }, 400);

  const cleanName = cleanUsername(username);
  if (!cleanName) return jsonResponse({ error: "Invalid username" }, 400);

  const supabase = getSupabase();

  // Check if already tracked
  const { data: existing } = await supabase
    .from("telegram_channels")
    .select("id")
    .eq("channel_username", cleanName)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ error: "Channel is already being tracked" }, 409);
  }

  // Validate channel exists
  const { valid, title, photoUrl } = await validateChannel(cleanName);
  if (!valid) {
    return jsonResponse({ error: `Channel @${cleanName} not found or is not public` }, 404);
  }

  // Store channel photo in Supabase if available
  let storedPhotoUrl = photoUrl;
  if (photoUrl) {
    try {
      const photoRes = await fetch(photoUrl);
      if (photoRes.ok) {
        const buf = await photoRes.arrayBuffer();
        const photoPath = `telegram/_avatars/${cleanName}.jpg`;
        await supabase.storage
          .from("papers")
          .upload(photoPath, new Uint8Array(buf), { upsert: true, contentType: "image/jpeg" });
        const { data: urlData } = supabase.storage.from("papers").getPublicUrl(photoPath);
        storedPhotoUrl = urlData.publicUrl;
      }
    } catch { /* non-fatal */ }
  }

  // Insert channel
  const channelId = cleanName; // Use username as ID for public channels
  const { data: inserted, error: insertErr } = await supabase
    .from("telegram_channels")
    .insert({
      channel_id: channelId,
      channel_name: title,
      channel_username: cleanName,
      channel_photo_url: storedPhotoUrl,
      is_active: true,
      last_message_id: 0,
      message_count: 0,
    })
    .select()
    .single();

  if (insertErr) return jsonResponse({ error: insertErr.message }, 500);
  return jsonResponse({ status: "added", channel: inserted });
}

// ─── Remove a channel ───
async function handleRemove(body: { channel_id: string }) {
  if (!body.channel_id) return jsonResponse({ error: "channel_id is required" }, 400);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("telegram_channels")
    .delete()
    .eq("id", body.channel_id);

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ status: "removed" });
}

// ─── List all channels ───
async function handleList() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("telegram_channels")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ channels: data });
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      return await handleList();
    }

    if (req.method === "POST") {
      const body = await req.json();
      const action = body.action;

      switch (action) {
        case "add":
          return await handleAdd(body);
        case "remove":
          return await handleRemove(body);
        default:
          return jsonResponse({ error: `Unknown action: ${action}` }, 400);
      }
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
