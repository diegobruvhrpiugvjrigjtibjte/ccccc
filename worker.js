export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || typeof file.name !== "string") {
        return new Response("Missing file", { status: 400, headers: corsHeaders });
      }

      const fileName = `${Date.now()}-${file.name}`;
      const metadata = {
        email: formData.get("email") || "",
        presenter: formData.get("presenter") || "",
        title: formData.get("title") || "",
        summary: formData.get("summary") || "",
        originalName: file.name,
      };

      await env.BUCKET.put(fileName, file.stream(), {
        customMetadata: metadata,
      });

      return new Response(JSON.stringify({ key: fileName }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (request.method === "GET" && url.pathname === "/files") {
      const list = await env.BUCKET.list({
        include: ["customMetadata", "httpMetadata"],
      });
      const baseUrl = url.origin;
      const files = list.objects.map((object) => ({
        key: object.key,
        uploaded: object.uploaded,
        metadata: object.customMetadata || {},
        contentType: object.httpMetadata?.contentType || "",
        size: object.size,
        downloadUrl: `${baseUrl}/download?key=${encodeURIComponent(object.key)}`,
      }));
      return new Response(JSON.stringify(files), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (request.method === "GET" && url.pathname === "/download") {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response("Missing key", { status: 400, headers: corsHeaders });
      }
      const object = await env.BUCKET.get(key);
      if (!object) {
        return new Response("Not found", { status: 404, headers: corsHeaders });
      }

      const headers = new Headers(corsHeaders);
      object.writeHttpMetadata(headers);
      const originalName = object.customMetadata?.originalName || object.key;
      headers.set("Content-Disposition", `attachment; filename="${originalName}"`);
      return new Response(object.body, { headers });
    }

    return new Response("OK", { headers: corsHeaders });
  },
};
