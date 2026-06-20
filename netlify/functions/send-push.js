// Serverless alert-sender: pushes a notification to every registered family device.
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const {
    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 200, body: JSON.stringify({ sent: 0, note: "push not configured" }) };
  }

  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:family@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}
  const message = JSON.stringify({
    title: body.title || "CUNCash",
    body: body.body || "New spend logged",
  });

  const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
  if (error) return { statusCode: 500, body: error.message };

  let sent = 0;
  await Promise.all((subs || [])
    .filter((s) => s.endpoint !== body.excludeEndpoint)
    .map(async (s) => {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try { await webpush.sendNotification(sub, message); sent++; }
      catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }));

  return { statusCode: 200, body: JSON.stringify({ sent }) };
};
