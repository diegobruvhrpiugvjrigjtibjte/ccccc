export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");
      const fileName = `${Date.now()}-${file.name}`;
      await env.BUCKET.put(fileName, file.stream());

      return new Response("Uploaded", { headers: corsHeaders });
    }

    return new Response("OK", { headers: corsHeaders });
  },
};
