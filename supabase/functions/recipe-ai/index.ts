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

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI-kocken saknar OPENAI_API_KEY i Supabase Secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: "Du är Min Receptboks AI-kock. Svara alltid på enkel och tydlig svenska. Hjälp användaren laga billig, god och enkel vardagsmat. Använd helst ingredienser användaren redan har. Ge recept med portionsantal, ingredienser och numrerade steg. Håll instruktionerna korta och tydliga. Fråga om en viktig sak saknas. Tänk på livsmedelssäkerhet.",
        input: question.trim(),
        max_output_tokens: 900,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI API-fel:", result);
      return new Response(JSON.stringify({ error: "AI-tjänsten kunde inte svara just nu. Kontrollera API-inställningarna." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const answer = result.output_text || (result.output || [])
      .flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
      .map((item: { text?: string }) => item.text || "")
      .join("\n")
      .trim();

    if (!answer) {
      return new Response(JSON.stringify({ error: "AI-kocken skickade inget svar." }), {
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
