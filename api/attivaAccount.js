import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Email mancante o non valida" });

  const { error } = await supabase
    .from("allowed_signup_emails")
    .update({ attivazione_confermata: true })
    .eq("email", email);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
