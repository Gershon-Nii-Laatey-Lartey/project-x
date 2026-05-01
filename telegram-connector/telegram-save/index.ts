// telegram-save: Save a Telegram message's media to a subject folder
// Copies media within Supabase Storage and creates a papers table entry

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { message_id, subject } = await req.json();

    if (!message_id || !subject) {
      return jsonResponse({ error: "message_id and subject are required" }, 400);
    }

    const supabase = getSupabase();

    // 1. Get the telegram message
    const { data: message, error: msgErr } = await supabase
      .from("telegram_messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (msgErr || !message) {
      return jsonResponse({ error: "Message not found" }, 404);
    }

    if (!message.media_url) {
      return jsonResponse({ error: "Message has no media to save" }, 400);
    }

    const savedFiles: string[] = [];
    const timestamp = Date.now();

    // Helper to upload a buffer to papers storage
    const uploadToSubject = async (buffer: ArrayBuffer, fileName: string) => {
      const newPath = `${subject}/${timestamp}_tg_${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from("papers")
        .upload(newPath, buffer, { upsert: false });

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage.from("papers").getPublicUrl(newPath);

      const { error: dbErr } = await supabase.from("papers").insert({
        subject: subject,
        url: urlData.publicUrl,
        name: `TG: ${fileName}`,
      });

      if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);
      savedFiles.push(urlData.publicUrl);
    };

    if (message.media_type === "photo_album") {
      // It's an array of URLs
      let urls: string[] = [];
      try {
        urls = JSON.parse(message.media_url);
      } catch (e) {
        return jsonResponse({ error: "Failed to parse photo album URLs" }, 500);
      }

      // Download each image from Telegram and upload to subject folder
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to download image ${i + 1}`);
        const buffer = await res.arrayBuffer();
        await uploadToSubject(buffer, `${message_id}_img${i + 1}.jpg`);
      }
    } else {
      // Single photo
      if (!message.media_file_id) {
        return jsonResponse({ error: "Message has no media file to save" }, 400);
      }
      
      // Download the file from current location in storage
      const { data: fileData, error: downloadErr } = await supabase.storage
        .from("papers")
        .download(message.media_file_id);

      if (downloadErr || !fileData) {
        return jsonResponse({ error: `Failed to download: ${downloadErr?.message}` }, 500);
      }
      
      const originalFileName = message.media_file_id.split("/").pop() ?? "file";
      const buffer = await fileData.arrayBuffer();
      await uploadToSubject(buffer, originalFileName);
    }

    // Mark the telegram message as saved
    await supabase
      .from("telegram_messages")
      .update({ saved_to_subject: subject })
      .eq("id", message_id);

    return jsonResponse({
      status: "saved",
      subject,
      files_saved: savedFiles.length,
      urls: savedFiles,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
