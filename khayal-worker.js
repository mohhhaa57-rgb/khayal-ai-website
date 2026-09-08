const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return json({
        ok: true,
        service: "Khayal AI",
        message: "Worker is running"
      });
    }

    if (url.pathname !== "/api/generate") {
      return json({
        error: "المسار غير موجود"
      }, 404);
    }

    if (request.method !== "POST") {
      return json({
        error: "يجب استخدام POST"
      }, 405);
    }

    if (!env.OPENAI_API_KEY) {
      return json({
        error: "OPENAI_API_KEY غير موجود في Cloudflare"
      }, 500);
    }

    try {
      const body = await request.json();
      const prompt = String(body.prompt || "").trim();

      if (!prompt) {
        return json({
          error: "اكتب وصفًا للصورة أولاً"
        }, 400);
      }

      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-image-2",
            prompt: prompt,
            size: "1024x1024",
            quality: "medium"
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return json({
          error: result?.error?.message || "فشل توليد الصورة"
        }, response.status);
      }

      const image = result?.data?.[0]?.b64_json;

      if (!image) {
        return json({
          error: "لم يتم استلام الصورة من OpenAI"
        }, 500);
      }

      return json({
        success: true,
        image: `data:image/png;base64,${image}`
      });

    } catch (error) {
      return json({
        error: "حدث خطأ في الخادم",
        details: error?.message || "Unknown error"
      }, 500);
    }
  }
};
