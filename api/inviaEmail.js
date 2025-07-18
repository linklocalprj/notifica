export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    return res.status(500).json({ error: 'Chiave Brevo mancante' });
  }

  try {
    const mailData = req.body;

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mailData)
    });

    const brevoJson = await brevoRes.json();
    if (!brevoRes.ok) throw brevoJson;

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error("Errore Brevo:", err);
    res.status(500).json({ error: 'Errore invio email', detail: err });
  }
}
