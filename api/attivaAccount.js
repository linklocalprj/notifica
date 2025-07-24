// /api/attivaAccount.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email non valida' });
  }

  const { error } = await supabase
    .from('allowed_signup_emails')
    .update({ attivazione_confermata: true })
    .eq('email', email);

  if (error) {
    console.error("Errore aggiornamento:", error);
    return res.status(500).json({ error: "Errore aggiornamento: " + error.message });
  }

  return res.status(200).json({ success: true });
}
