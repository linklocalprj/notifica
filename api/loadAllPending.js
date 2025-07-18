// loadAllPending.js
import {
  SUPABASE_URL,
  SUPABASE_KEY,
  BREVO_API_KEY,
} from './env.js';

// etichette di fallback
const tableLabels = {
  pubblicazioni_facebook:  'Facebook',
  pubblicazioni_instagram: 'Instagram',
  pubblicazioni_linkedin:  'LinkedIn',
  pubblicazioni_google:    'Google'
};

// carica e renderizza i post
async function loadAllPending() {
  console.log('▶️ loadAllPending avviato');
  const response = await fetch('/api/loadAllPending');
  if (!response.ok) {
    const err = await response.text();
    console.error('Errore loadAllPending:', err);
    alert('Errore caricamento post: ' + err);
    return;
  }
  const rawData = await response.json();
  const rows = rawData.map(r => ({
    ...r,
    piattaforma: r.piattaforma || tableLabels[r.table] || r.table
  }));
  renderTable(rows);
}

function renderTable(rows) {
  const tbody = document.querySelector('#posts-table tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const cliente   = r.nome_azienda ?? r.azienda ?? '-';
    const email     = r.emailGestore    || '-';
    const contenuto = r.titolo          || r.testo || r.link || '-';
    const data      = r.creato_il
                      ? new Date(r.creato_il).toLocaleString()
                      : '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.piattaforma}</td>
      <td>${cliente}</td>
      <td>${email}</td>
      <td>${contenuto}</td>
      <td>${data}</td>
      <td><button id="btn-${r.table}-${r.id}">Invia Mail</button></td>
    `;
    tbody.appendChild(tr);
    document
      .getElementById(`btn-${r.table}-${r.id}`)
      .addEventListener('click', () => sendEmail(r));
  });
}

async function sendEmail(row) {
  const btn = document.getElementById(`btn-${row.table}-${row.id}`);
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        to: [{ email: row.emailGestore, name: row.nome_azienda }],
        templateId: 5,
        params: {
          piattaforma: row.piattaforma,
          cliente:     row.nome_azienda,
          titolo:      row.titolo  || '',
          data_pubblicazione: row.data_pubblicazione || '',
          testo:       row.testo   || '',
          link:        row.link    || ''
        }
      })
    });
    if (!resp.ok) throw new Error(await resp.text());
  } catch (err) {
    console.error('Errore invio Brevo:', err);
    alert('Invio mail fallito: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Invia Mail';
    return;
  }

  try {
    const updateResp = await fetch('/api/updateStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: row.table, id: row.id })
    });
    if (!updateResp.ok) throw new Error(await updateResp.text());
    btn.textContent = '✅';
  } catch (upErr) {
    console.error('Errore update stato:', upErr);
    alert('Non ho potuto aggiornare lo stato_invio.');
    btn.disabled = false;
    btn.textContent = 'Invia Mail';
  }
}

// quando il DOM è pronto
document.addEventListener('DOMContentLoaded', loadAllPending);
