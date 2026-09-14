export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlRmMs01Ll7f_xQJ4obD5NfWQjXquAH8cYLgRfHXHcCUr0z7lSR1DbafsUIy8MfIea/exec';

  try {
    const bodyText = JSON.stringify(req.body || {});
    console.log('DEBUG - Mengirim ke Apps Script, body length:', bodyText.length);
    console.log('DEBUG - Body preview:', bodyText.substring(0, 200));

    let response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText,
      redirect: 'manual',
    });

    console.log('DEBUG - Status respons PERTAMA:', response.status);
    console.log('DEBUG - Location header:', response.headers.get('location'));

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        console.log('DEBUG - Mengikuti redirect manual ke:', location);
        response = await fetch(location, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyText,
        });
        console.log('DEBUG - Status respons SETELAH redirect:', response.status);
      }
    }

    const text = await response.text();
    console.log('DEBUG - Isi respons akhir (200 char pertama):', text.substring(0, 200));

    return res.status(200).send('OK');
  } catch (err) {
    console.error('DEBUG - Proxy error:', err.message, err.stack);
    return res.status(200).send('OK (logged error)');
  }
}
