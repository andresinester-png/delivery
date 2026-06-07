export default async function handler(req, res) {
  const { input } = req.query;
  if (!input) return res.status(400).json({ error: 'input requerido' });

  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.VITE_GOOGLE_PLACES_API_KEY,
    },
    body: JSON.stringify({ input, languageCode: 'es', regionCode: 'ar' }),
  });

  const data = await response.json();
  res.status(200).json(data);
}
