// Shared data layer: one Supabase table that every family device reads/writes,
// with realtime sync so a spend logged on one phone appears on all the others.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anon);
const supabase = isConfigured ? createClient(url, anon) : null;

// DB row  <->  app shape
const toClient = (r) => ({
  id: r.id,
  spender: r.spender,
  method: r.method,
  room: r.room,
  category: r.category,
  notes: r.notes || "",
  amountCents: r.amount_cents,
  tipCents: r.tip_cents,
  ts: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});
const toRow = (t) => ({
  spender: t.spender,
  method: t.method,
  room: t.room ?? null,
  category: t.category,
  notes: t.notes || "",
  amount_cents: t.amountCents,
  tip_cents: t.tipCents,
});

export const db = {
  async fetchAll() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("transactions").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toClient);
  },

  subscribe(onChange) {
    if (!supabase) return () => {};
    const ch = supabase
      .channel("tx-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, (p) => {
        if (p.eventType === "INSERT") onChange({ type: "INSERT", row: toClient(p.new) });
        else if (p.eventType === "UPDATE") onChange({ type: "UPDATE", row: toClient(p.new) });
        else if (p.eventType === "DELETE") onChange({ type: "DELETE", id: p.old.id });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  },

  async add(tx) {
    if (!supabase) return null;
    const { data, error } = await supabase.from("transactions").insert(toRow(tx)).select().single();
    if (error) throw error;
    return toClient(data);
  },

  async update(id, patch) {
    if (!supabase) return;
    const { error } = await supabase.from("transactions").update(toRow(patch)).eq("id", id);
    if (error) throw error;
  },

  async remove(id) {
    if (!supabase) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) throw error;
  },

  async saveSubscription(sub, label) {
    if (!supabase) return;
    const k = sub.toJSON();
    try { localStorage.setItem("push_endpoint", k.endpoint); } catch (e) {}
    await supabase.from("push_subscriptions").upsert({
      endpoint: k.endpoint, p256dh: k.keys.p256dh, auth: k.keys.auth, label: label || null,
    });
  },

  // Best-effort: ask the Netlify function to push everyone else's phone.
  async notify(title, body) {
    let excludeEndpoint = null;
    try { excludeEndpoint = localStorage.getItem("push_endpoint"); } catch (e) {}
    try {
      await fetch("/.netlify/functions/send-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, excludeEndpoint }),
      });
    } catch (e) { /* alerts are best-effort; never block the save */ }
  },
};
