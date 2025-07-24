import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from("allowed_signup_emails")
    .select("*")
    .eq("attivazione_confermata", false);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
}
