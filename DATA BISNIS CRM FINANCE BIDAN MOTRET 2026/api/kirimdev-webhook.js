export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlRmMs01Ll7f_xQJ4obD5NfWQjXquAH8cYLgRfHXHcCUr0z7lSR1DbafsUIy8Mflea/exec';

  try {
    const bodyText = JSON.stringify(req.body);

    // Request PERTAMA: redirect 'manual' supaya kita bisa tangani sendiri, bukan diikuti otomatis (yang mengubah POST jadi GET)
    let response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText,
      redirect: 'manual',
    });

    // Kalau Apps Script memang redirect (302), ambil URL tujuannya dan POST ULANG ke situ secara manual
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        response = await fetch(location, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyText,
        });
      }
    }

    const text = await response.text();
    console.log('Apps Script response:', text.substring(0, 300));

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(200).send('OK (logged error)');
  }
}
