import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Email non valida" });
  }

  try {
    // ✅ Aggiorna in Supabase
    const { error } = await supabase
      .from("allowed_signup_emails")
      .update({ attivazione_confermata: true })
      .eq("email", email);

    if (error) {
      console.error("❌ Errore aggiornamento:", error);
      return res.status(500).json({ error: "Errore aggiornamento: " + error.message });
    }

    // ✅ Invia email di attivazione tramite Brevo (templateId: 8)
    const activationEmail = {
      templateId: 8,
      to: [{ email, name: email.split("@")[0] }],
      params: {
        email,
        data_attivazione: new Date().toLocaleDateString("it-IT")
      }
    };

    const mailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify(activationEmail)
    });

    if (!mailRes.ok) {
      const msg = await mailRes.text();
      console.warn("⚠️ Email non inviata:", msg);
      // Non blocchiamo l'attivazione anche se l'email fallisce
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ Errore server:", err);
    return res.status(500).json({ error: "Errore interno: " + err.message });
  }
}
