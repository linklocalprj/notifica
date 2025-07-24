// /api/loadAttivazioni.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from("allowed_signup_emails")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore Supabase:", error);
      return res.status(500).json({ error: "Errore Supabase: " + error.message });
    }

    return res.status(200).json({ dati: data });
  } catch (err) {
    console.error("Errore server:", err.message);
    return res.status(500).json({ error: "Errore interno: " + err.message });
  }
}
