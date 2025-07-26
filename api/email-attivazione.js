export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST consentito" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email mancante" });
  }

  const data = {
    templateId: 8,
    to: [{ email, name: email.split("@")[0] }],
    params: {
      email,
      data_attivazione: new Date().toLocaleDateString("it-IT"),
    }
  };

  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify(data)
    });

    if (!resp.ok) throw new Error(await resp.text());
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Errore invio attivazione:", err);
    res.status(500).json({ error: "Errore durante l’invio dell’email" });
  }
}
