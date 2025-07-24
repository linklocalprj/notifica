// 📁 /api/loadAttivazioni.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL, // ✅ uso corretto
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { data, error } = await supabase
      .from("allowed_signup_emails")
      .select("*");

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

