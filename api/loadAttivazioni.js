// 📁 /api/loadAttivazioni.js
import { createClient } from "@supabase/supabase-js";

// ✅ Inizializzazione Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  // ✅ CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Risposta preflight per richieste CORS OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { data, error } = await supabase
      .from("allowed_signup_emails")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Errore Supabase:", error);
      return res.status(500).json({ error: "Errore recupero dati: " + error.message });
    }

    return res.status(200).json({ success: true, attivazioni: data });
  } catch (err) {
    console.error("❌ Errore server:", err);
    return res.status(500).json({ error: "Errore interno: " + err.message });
  }
}
