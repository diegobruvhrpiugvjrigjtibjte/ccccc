export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Expose-Headers": "Content-Disposition, Content-Type",
    };

    const url = new URL(request.url);
    const INDEX_KEY = "__uploads_index.json";

    const configuredStaffEmail = env.STAFF_EMAIL || "giulia.lanzara@gmail.com";
    const configuredStaffPassword = env.STAFF_PASSWORD || "Picchiolino1";
    const configuredStaffToken = env.STAFF_ACCESS_TOKEN;
    if (!configuredStaffToken) {
      return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    const unauthorized = () => json({ error: "Unauthorized" }, 401);

    function isAuthorized(req) {
      const auth = req.headers.get("Authorization") || "";
      return auth === `Bearer ${configuredStaffToken}`;
    }

    async function readIndex() {
      const indexObject = await env.BUCKET.get(INDEX_KEY);
      if (!indexObject) return [];
      try {
        const text = await indexObject.text();
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    async function writeIndex(index) {
      await env.BUCKET.put(INDEX_KEY, JSON.stringify(index), {
        httpMetadata: { contentType: "application/json" },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "POST" && url.pathname === "/login") {
      const body = await request.json().catch(() => ({}));
      const email = String(body.email || "").trim();
      const password = String(body.password || "");

      if (email !== configuredStaffEmail || password !== configuredStaffPassword) {
        return unauthorized();
      }

      return json({ token: configuredStaffToken });
    }

    if (request.method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || typeof file.name !== "string") {
        return new Response("Missing file", { status: 400, headers: corsHeaders });
      }

      const uploadedAt = new Date().toISOString();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `${Date.now()}-${safeName}`;

      const presenter = String(formData.get("presenter") || "").trim();
      const title = String(formData.get("title") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const summary = String(formData.get("summary") || "").trim();

      await env.BUCKET.put(fileKey, file.stream(), {
        httpMetadata: {
          contentType: file.type || "application/pdf",
        },
      });

      const index = await readIndex();
      index.unshift({
        key: fileKey,
        uploaded: uploadedAt,
        fileName: file.name,
        contentType: file.type || "application/pdf",
        size: file.size || 0,
        presenter,
        title,
        email,
        summary,
      });
      await writeIndex(index);

      return json({ key: fileKey });
    }

    if (request.method === "GET" && url.pathname === "/files") {
      if (!isAuthorized(request)) return unauthorized();
      const index = await readIndex();
      return json(index);
    }

    if (request.method === "GET" && url.pathname === "/download") {
      if (!isAuthorized(request)) return unauthorized();

      const key = url.searchParams.get("key");
      if (!key) {
        return new Response("Missing key", { status: 400, headers: corsHeaders });
      }

      const object = await env.BUCKET.get(key);
      if (!object) {
        return new Response("Not found", { status: 404, headers: corsHeaders });
      }

      const index = await readIndex();
      const metadata = index.find((item) => item.key === key);
      const fileName = metadata?.fileName || key;

      const headers = new Headers(corsHeaders);
      object.writeHttpMetadata(headers);
      headers.set("Content-Type", object.httpMetadata?.contentType || metadata?.contentType || "application/pdf");
      headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
      return new Response(object.body, { headers });
    }

    return new Response("OK", { headers: corsHeaders });
  },
};
