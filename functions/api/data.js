const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-OTB-Access",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

const key = "ss27";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  if (!env.OTB_APP_PASSWORD) {
    return json({ error: "Password app non configurata" }, 500);
  }

  if (request.headers.get("X-OTB-Access") !== env.OTB_APP_PASSWORD) {
    return json({ error: "Accesso non autorizzato" }, 401);
  }

  if (!env.OTB_DATA) {
    return json({ error: "Archivio dati Cloudflare KV non configurato" }, 500);
  }

  if (request.method === "GET") {
    const data = await env.OTB_DATA.get(key, "json");
    return json({ data: data || null });
  }

  if (request.method === "POST") {
    const payload = await request.json();
    await env.OTB_DATA.put(key, JSON.stringify(payload));
    return json({ ok: true, savedAt: new Date().toISOString() });
  }

  return json({ error: "Metodo non supportato" }, 405);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
