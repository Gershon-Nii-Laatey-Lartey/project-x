// telegram-poll: Scrapes public Telegram channels via t.me/s/ web view
// No MTProto or bot token needed — works for any public channel
// Triggered manually or by pg_cron every 60s

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

interface ScrapedMessage {
  telegram_message_id: number;
  message_text: string | null;
  media_url: string | null;
  media_type: string | null;
  sent_at: string | null;
}

async function scrapeChannel(username: string): Promise<ScrapedMessage[]> {
  const url = `https://t.me/s/${username}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    console.error(`Failed to fetch ${url}: ${res.status}`);
    return [];
  }

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];

  const messages: ScrapedMessage[] = [];
  const messageEls = doc.querySelectorAll(".tgme_widget_message_wrap");

  for (const wrap of messageEls) {
    try {
      const msgEl = wrap.querySelector(".tgme_widget_message");
      if (!msgEl) continue;

      // Extract message ID from data-post attribute (e.g., "channelname/12345")
      const dataPost = msgEl.getAttribute("data-post") || "";
      const msgIdStr = dataPost.split("/").pop() || "0";
      const msgId = parseInt(msgIdStr);
      if (!msgId) continue;

      // Extract text
      const textEl = wrap.querySelector(".tgme_widget_message_text");
      const messageText = textEl?.textContent?.trim() || null;

      // Extract media (photos - handles both single and grouped/album messages)
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      // Find ALL photo wraps (grouped albums have multiple)
      const allPhotoWraps = wrap.querySelectorAll(".tgme_widget_message_photo_wrap");
      const photoUrls: string[] = [];

      for (const pw of allPhotoWraps) {
        const style = pw.getAttribute("style") || "";
        const bgMatch = style.match(/background-image:\s*url\('([^']+)'\)/);
        if (bgMatch) {
          photoUrls.push(bgMatch[1]);
        }
        // Also check child .tgme_widget_message_photo for background-image
        const photoChild = pw.querySelector(".tgme_widget_message_photo");
        if (photoChild) {
          const childStyle = photoChild.getAttribute("style") || "";
          const childMatch = childStyle.match(/background-image:\s*url\('([^']+)'\)/);
          if (childMatch && !photoUrls.includes(childMatch[1])) {
            photoUrls.push(childMatch[1]);
          }
        }
      }

      if (photoUrls.length > 1) {
        // Multiple images - store as JSON array
        mediaUrl = JSON.stringify(photoUrls);
        mediaType = "photo_album";
      } else if (photoUrls.length === 1) {
        mediaUrl = photoUrls[0];
        mediaType = "photo";
      }

      // Check for video
      if (!mediaUrl) {
        const videoEl = wrap.querySelector("video");
        if (videoEl) {
          mediaUrl = videoEl.getAttribute("src") || null;
          mediaType = "video";
        }
      }

      // Check for document/file link
      if (!mediaUrl) {
        const docLink = wrap.querySelector(".tgme_widget_message_document_wrap");
        if (docLink) {
          mediaType = "document";
        }
      }

      // Extract date
      const timeEl = wrap.querySelector("time");
      const datetime = timeEl?.getAttribute("datetime") || null;

      messages.push({
        telegram_message_id: msgId,
        message_text: messageText,
        media_url: mediaUrl,
        media_type: mediaType,
        sent_at: datetime,
      });
    } catch (err) {
      console.error("Error parsing message:", err);
    }
  }

  return messages;
}

async function downloadAndStore(
  mediaUrl: string,
  channelName: string,
  msgId: number,
  supabase: ReturnType<typeof getSupabase>
): Promise<{ storedUrl: string | null; storagePath: string | null }> {
  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) return { storedUrl: null, storagePath: null };

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";

    const safeName = channelName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const storagePath = `telegram/${safeName}/${msgId}.${ext}`;

    const { error } = await supabase.storage
      .from("papers")
      .upload(storagePath, new Uint8Array(buffer), {
        upsert: true,
        contentType,
      });

    if (error) {
      console.error("Upload error:", error);
      return { storedUrl: null, storagePath: null };
    }

    const { data: urlData } = supabase.storage
      .from("papers")
      .getPublicUrl(storagePath);

    return { storedUrl: urlData.publicUrl, storagePath };
  } catch (err) {
    console.error("Download/store error:", err);
    return { storedUrl: null, storagePath: null };
  }
}

async function pollChannels() {
  const supabase = getSupabase();

  // Load active channels
  const { data: channels, error: chanErr } = await supabase
    .from("telegram_channels")
    .select("*")
    .eq("is_active", true);

  if (chanErr || !channels || channels.length === 0) {
    return jsonResponse({ message: "No active channels to poll", channels: 0 });
  }

  let totalNew = 0;

  for (const channel of channels) {
    try {
      const messages = await scrapeChannel(channel.channel_username);

      for (const msg of messages) {
        // Skip already-seen messages
        if (msg.telegram_message_id <= (channel.last_message_id ?? 0)) continue;

        // Download and store media if present
        let finalMediaUrl = msg.media_url;
        let mediaFileId: string | null = null;

        if (msg.media_url && msg.media_type === "photo") {
          const { storedUrl, storagePath } = await downloadAndStore(
            msg.media_url,
            channel.channel_name,
            msg.telegram_message_id,
            supabase
          );
          if (storedUrl) {
            finalMediaUrl = storedUrl;
            mediaFileId = storagePath;
          }
        }

        // Upsert message
        const { error: insertErr } = await supabase
          .from("telegram_messages")
          .upsert({
            channel_id: channel.channel_id,
            telegram_message_id: msg.telegram_message_id,
            message_text: msg.message_text,
            media_type: msg.media_type,
            media_url: finalMediaUrl,
            media_file_id: mediaFileId,
            thumbnail_url: finalMediaUrl,
            sent_at: msg.sent_at,
          }, {
            onConflict: "channel_id,telegram_message_id",
          });

        if (!insertErr) totalNew++;
      }

      // Update last_message_id
      const maxId = messages.reduce((max, m) => Math.max(max, m.telegram_message_id), channel.last_message_id ?? 0);
      if (maxId > (channel.last_message_id ?? 0)) {
        await supabase
          .from("telegram_channels")
          .update({
            last_message_id: maxId,
            message_count: (channel.message_count ?? 0) + totalNew,
          })
          .eq("id", channel.id);
      }
    } catch (err) {
      console.error(`Error polling ${channel.channel_username}:`, err);
    }
  }

  return jsonResponse({
    status: "ok",
    channels_polled: channels.length,
    new_messages: totalNew,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    return await pollChannels();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
