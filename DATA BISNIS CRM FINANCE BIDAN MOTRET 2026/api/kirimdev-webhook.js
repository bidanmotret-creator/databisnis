export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlRmMs01Ll7f_xQJ4obD5NfWQjXquAH8cYLgRfHXHcCUr0z7lSR1DbafsUIy8Mflea/exec';

  try {
    // Teruskan body mentah dari Kirimdev ke Apps Script.
    // fetch() di Node otomatis mengikuti redirect 302 Apps Script.
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      redirect: 'follow', // eksplisit, walau ini sudah default
    });

    const text = await response.text();

    // Log untuk debugging (lihat di Vercel > Deployments > Logs)
    console.log('Apps Script response:', text.substring(0, 200));

    // Kirimdev cuma butuh 200 OK untuk menganggap webhook berhasil
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Proxy error:', err);
    // Tetap return 200 supaya Kirimdev tidak retry terus-menerus untuk error di sisi kita,
    // tapi log errornya supaya kita tahu ada masalah.
    return res.status(200).send('OK (logged error)');
  }
}
