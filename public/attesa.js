const tableLabels = {
  pubblicazioni_facebook:  'Facebook',
  pubblicazioni_instagram: 'Instagram',
  pubblicazioni_linkedin:  'LinkedIn',
  pubblicazioni_google:    'Google'
};

async function loadAllPending() {
  try {
    const res = await fetch('/api/loadAllPending');
    if (!res.ok) throw new Error(await res.text());
    const raw = await res.json();
    if (!Array.isArray(raw)) throw new Error('Formato dati non valido');

    const rows = raw.map(r => ({
      ...r,
      piattaforma: tableLabels[r.table] ?? r.table,
      emailGestore: r.email_gestore ?? r.emailGestore ?? ''
    }));
    renderTable(rows);
  } catch (e) {
    alert('Errore caricamento: ' + e.message);
  }
}

function renderTable(rows) {
  const tbody = document.querySelector('#posts-table tbody');
  tbody.innerHTML = '';

  rows.forEach(r => {
    const cliente   = r.nome_azienda ?? r.azienda ?? '-';
    const email     = r.emailGestore || '-';
    const rawText   = r.titolo || r.testo || r.link || '-';
    const contenuto = rawText.length > 100 ? rawText.slice(0, 97) + '...' : rawText;
    const data = r.creato_il ? new Date(r.creato_il).toLocaleString() : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.piattaforma}</td>
      <td>${cliente}</td>
      <td>${email}</td>
      <td>${contenuto}</td>
      <td>${data}</td>
      <td><button id="btn-${r.table}-${r.id}">Invia Mail</button></td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-${r.table}-${r.id}`)
      .addEventListener('click', () => sendEmail(r));
  });
}

async function sendEmail(row) {
  const btn = document.getElementById(`btn-${row.table}-${row.id}`);
  btn.disabled = true;
  btn.textContent = '…';

  const payload = {
    email: row.emailGestore,
    nome:  row.nome_azienda,
    piattaforma: row.piattaforma,
    cliente:     row.nome_azienda,
    titolo:      row.titolo  || '',
    data_pubblicazione: row.data_pubblicazione || '',
    testo:       row.testo   || '',
    link:        row.link    || ''
  };

  if (!payload.email) {
    alert('❌ Manca indirizzo email');
    btn.disabled = false;
    btn.textContent = 'Invia Mail';
    return;
  }

  try {
    const resp = await fetch('/api/notificaPost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error((await resp.json()).error || 'Errore invio mail');

    const upd = await fetch('/api/updateStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: row.table, id: row.id })
    });
    if (!upd.ok) console.warn('⚠️ updateStatus:', await upd.text());

    btn.textContent = '✅';
  } catch (err) {
    alert('Fallito: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Invia Mail';
  }
}

document.addEventListener('DOMContentLoaded', loadAllPending);
