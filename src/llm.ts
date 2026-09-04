import type { BridgeJSON } from "./bridge";

const SYSTEM_PROMPT = `You are PHYSORA AI, an expert structural engineering architect.
Convert user prompts into distinct, diverse 3D bridge blueprints using modular parameters.

You can construct 4 major typologies:
1. CABLE-STAYED / SUSPENSION: Use cables.enabled=true, towerHeight 40-60, 2-3 towers, long central spans.
2. CONTINUOUS VIADUCT: cables.enabled=false, 5-9 evenly spaced thick pillars (radius 2.5-4), thick road deck (thickness 2.5-3.5).
3. CAUSEWAY / LOW OVERPASS: deckHeight 6-10, 6-12 slim pillars (radius 1-1.5), cables.enabled=false.
4. BALANCED CANTILEVER: 1 or 2 isolated central pillars with long unsupported deck segments on both sides (cables.enabled=false).

You must respond with ONLY valid, raw JSON matching this schema:
{
  "bridge": { "length": number, "width": number, "deckHeight": number },
  "deck": {
    "thickness": number,
    "jointPositions": number[],
    "jointGap": number,
    "massKgPerMeter": number
  },
  "joints": { "type": "fixed", "breakForceN": number, "breakTorqueNm": number },
  "pillars": { "positions": number[], "radius": number, "height": number },
  "cables": { "enabled": boolean, "towerHeight": number, "cableRadius": number, "hangers": number }
}

Rules:
1. pillars.positions MUST be included in deck.jointPositions so segments align with supports.
2. deck.jointPositions must start at 0 and end at bridge.length.
3. Adapt dimensions to the user's prompt (length: 60-260m, deckHeight: 6-40m).
4. Do NOT output markdown code blocks (no \`\`\`json). Output raw JSON only.`;

export async function generateBlueprint(userPrompt: string): Promise<BridgeJSON> {
  const apiKey = import.meta.env.VITE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_AI_API_KEY is missing in .env file.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!rawContent) {
    throw new Error("Empty response received from Gemini.");
  }

  const cleanJson = rawContent
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleanJson);
    if (!parsed.bridge || !parsed.deck || !parsed.pillars) {
      throw new Error("Missing required fields in generated structure JSON.");
    }
    return parsed as BridgeJSON;
  } catch (err: any) {
    throw new Error(`JSON Parse Error: ${err.message}. Raw output was: ${cleanJson.slice(0, 100)}...`);
  }
}