import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  try {
    const { data, error } = await supabase
      .from("allowed_signup_emails")
      .select("email, created_at, attivazione_confermata");

    if (error) {
      console.error("❌ Errore Supabase:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, attivazioni: data });
  } catch (err) {
    console.error("❌ Errore generico:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
