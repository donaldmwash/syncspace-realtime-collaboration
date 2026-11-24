import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: jsonHeaders });
  }

  try {
    const suppliedSecret = req.headers.get("x-syncspace-cron-secret");
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) throw new Error("Supabase service environment is not configured.");

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: expectedSecret, error: secretError } = await admin.rpc("get_syncspace_cron_secret");
    if (secretError || !expectedSecret || suppliedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized cleanup request." }), { status: 401, headers: jsonHeaders });
    }

    const now = new Date().toISOString();
    const { data: expiredStatuses, error: statusQueryError } = await admin
      .from("user_statuses").select("id,media_path").lte("expires_at", now).limit(500);
    if (statusQueryError) throw statusQueryError;

    const statusPaths = (expiredStatuses ?? []).map((row) => row.media_path).filter((path): path is string => !!path);
    for (let i = 0; i < statusPaths.length; i += 100) {
      const { error } = await admin.storage.from("statuses").remove(statusPaths.slice(i, i + 100));
      if (error) throw error;
    }
    const statusIds = (expiredStatuses ?? []).map((row) => row.id);
    if (statusIds.length) {
      const { error } = await admin.from("user_statuses").delete().in("id", statusIds);
      if (error) throw error;
    }

    const { data: expiredMessages, error: messageQueryError } = await admin
      .from("messages").select("id").not("expires_at", "is", null).lte("expires_at", now).limit(500);
    if (messageQueryError) throw messageQueryError;

    const messageIds = (expiredMessages ?? []).map((row) => row.id);
    let messageFileCount = 0;
    if (messageIds.length) {
      const { data: attachments, error: attachmentQueryError } = await admin
        .from("attachments").select("object_path").in("message_id", messageIds);
      if (attachmentQueryError) throw attachmentQueryError;
      const paths = (attachments ?? []).map((row) => row.object_path).filter(Boolean);
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await admin.storage.from("conversation-files").remove(paths.slice(i, i + 100));
        if (error) throw error;
      }
      messageFileCount = paths.length;
      const { error } = await admin.from("messages").delete().in("id", messageIds);
      if (error) throw error;
    }

    return new Response(JSON.stringify({
      statuses_removed: statusIds.length,
      messages_removed: messageIds.length,
      media_files_removed: statusPaths.length + messageFileCount,
      processed_at: now,
    }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected cleanup error.";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
