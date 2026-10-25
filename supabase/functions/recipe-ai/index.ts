import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Använd POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { question } = await req.json();
    if (typeof question !== "string" || !question.trim() || question.length > 3000) {
      return new Response(JSON.stringify({ error: "Skriv en fråga på högst 3000 tecken." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI-kocken saknar GEMINI_API_KEY i Supabase Secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "Du är Min Receptboks AI-kock. Svara alltid på enkel och tydlig svenska. Hjälp användaren laga billig, god och enkel vardagsmat. Använd helst ingredienser användaren redan har. Ge recept med portionsantal, ingredienser och numrerade steg. Håll instruktionerna korta och tydliga. Fråga om en viktig sak saknas. Tänk på livsmedelssäkerhet."
            }]
          },
          contents: [{ parts: [{ text: question.trim() }] }],
          generationConfig: { maxOutputTokens: 900 }
        }),
      },
    );

    const result = await response.json();
    if (!response.ok) {
      console.error("Gemini API-fel:", result);
      return new Response(JSON.stringify({
        error: "Google Gemini kunde inte svara. Kontrollera GEMINI_API_KEY och API-inställningarna."
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const answer = (result.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || "")
      .join("\n")
      .trim();

    if (!answer) {
      console.error("Gemini skickade inget textinnehåll:", result);
      return new Response(JSON.stringify({ error: "Gemini skickade inget svar. Försök igen." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("recipe-ai-fel:", error);
    return new Response(JSON.stringify({ error: "Något gick fel när AI-kocken skulle svara." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
