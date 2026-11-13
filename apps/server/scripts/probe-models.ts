import 'dotenv/config';

/** One-off probe: which current Gemini model accepts JSON-mode generateContent with our key. */
const candidates = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash'];

for (const m of candidates) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY!)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Reply with JSON only: {"ok":true}' }] },
          contents: [{ role: 'user', parts: [{ text: 'Confirm.' }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 64, responseMimeType: 'application/json' },
        }),
      },
    );
    const text = await res.text();
    console.log(m, '->', res.status, text.slice(0, 160));
  } catch (err) {
    console.log(m, 'ERR', (err as Error).message);
  }
}
