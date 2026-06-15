import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const SYSTEM_PROMPT = `You are a circuit schematic recognition engine. You will receive geometric data describing hand-drawn strokes on a canvas. Each stroke has been simplified and normalized to a 0-100 coordinate space. Analyze the geometry of each stroke and the spatial relationships between strokes to identify electronic circuit components and their connections.

Use these rules to identify components:

- A stroke with 5+ direction changes and wide aspect ratio is likely a RESISTOR (zigzag pattern)
- Two short parallel vertical lines close together with horizontal lines on each side is likely a CAPACITOR
- A stroke with 3-4 smooth bumps is likely an INDUCTOR
- A series of alternating long and short vertical lines is likely a BATTERY
- A single straight horizontal or vertical line connecting two points is likely a WIRE
- A downward pointing triangle shape with decreasing horizontal lines is likely a GROUND
- A triangle shape with a vertical line at one end is likely a DIODE or LED
- A short angled line between two dots is likely a SWITCH
- A circle with lines extending left and right is likely a VOLTAGE SOURCE

For each identified component, estimate its position as the center of its bounding box in the normalized 0-100 space. Identify wires as connections between component terminals.

Return ONLY valid JSON with no explanation, no markdown, no code blocks:

{
  "components": [
    {
      "id": "R1",
      "type": "resistor",
      "value": "10k",
      "position": { "x": 25, "y": 50 },
      "rotation": 0,
      "strokeIndices": [0]
    }
  ],
  "wires": [
    {
      "from": { "componentId": "R1", "terminal": "right" },
      "to": { "componentId": "BAT1", "terminal": "positive" },
      "strokeIndices": [1]
    }
  ],
  "unrecognized": [2]
}

Supported types: resistor, capacitor, inductor, battery, ground, led, diode, switch, voltage_source, current_source, wire. Use unknown for anything you cannot identify. Always return valid JSON.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!OPENROUTER_API_KEY) {
    return json({ error: 'OPENROUTER_API_KEY not configured', components: [], wires: [], unrecognized: [] });
  }

  try {
    const { strokesText } = await req.json();
    if (!strokesText) {
      return json({ error: 'Missing strokesText field', components: [], wires: [], unrecognized: [] });
    }

    const body = {
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this circuit sketch data and identify the components:\n\n${strokesText}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenRouter error:', res.status, errText);
      return json({ error: `OpenRouter API error: ${res.status}`, components: [], wires: [], unrecognized: [] });
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content ?? '{}';
    let parsed: { components?: unknown; wires?: unknown; unrecognized?: unknown };

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { components: [], wires: [], unrecognized: [] };
    }

    return json({
      components: Array.isArray(parsed.components) ? parsed.components : [],
      wires: Array.isArray(parsed.wires) ? parsed.wires : [],
      unrecognized: Array.isArray(parsed.unrecognized) ? parsed.unrecognized : [],
      raw: rawContent,
    });
  } catch (err) {
    console.error('parse-circuit error:', err);
    return json({ error: String(err), components: [], wires: [], unrecognized: [] });
  }
});
