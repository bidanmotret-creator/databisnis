export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlRmMs01Ll7f_xQJ4obD5NfWQjXquAH8cYLgRfHXHcCUr0z7lSR1DbafsUIy8MfIea/exec';

  try {
    const bodyText = JSON.stringify(req.body || {});

    let response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText,
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        // PENTING: follow-up pakai GET, bukan POST — doPost sudah dieksekusi
        // di request pertama, ini cuma ambil hasilnya.
        response = await fetch(location, { method: 'GET' });
      }
    }

    const text = await response.text();
    console.log('DEBUG - Isi respons akhir:', text.substring(0, 300));

    return res.status(200).send('OK');
  } catch (err) {
    console.error('DEBUG - Proxy error:', err.message);
    return res.status(200).send('OK (logged error)');
  }
}
