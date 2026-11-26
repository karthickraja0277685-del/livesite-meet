// Server-side AI helper with prompt-injection boundaries & graceful fallback

export async function generateMeetingAiResponse(params: {
  systemInstruction: string;
  userPrompt: string;
  fallbackText: string;
}): Promise<{ text: string; provider: "gemini" | "fallback" }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { text: params.fallbackText, provider: "fallback" };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: params.systemInstruction }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: params.userPrompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.3
          }
        })
      }
    );

    if (!res.ok) {
      return { text: params.fallbackText, provider: "fallback" };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { text: params.fallbackText, provider: "fallback" };
    }

    return { text: String(text).trim(), provider: "gemini" };
  } catch {
    return { text: params.fallbackText, provider: "fallback" };
  }
}
