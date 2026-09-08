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

async function streamToBase64(stream) {
  const buffer = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunkSize)
    );
  }

  return btoa(binary);
}

function containsArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
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

    try {
      const body = await request.json();
      let prompt = String(body.prompt || "").trim();

      if (!prompt) {
        return json({
          error: "اكتب وصفًا للصورة أولاً"
        }, 400);
      }

      // ترجمة الوصف العربي إلى الإنجليزية تلقائيًا
      if (containsArabic(prompt)) {
        const translation = await env.AI.run(
          "@cf/meta/m2m100-1.2b",
          {
            text: prompt,
            source_lang: "ar",
            target_lang: "en"
          }
        );

        if (translation?.translated_text) {
          prompt = translation.translated_text;
        }
      }

      // توليد الصورة
      const result = await env.AI.run(
        "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        {
          prompt,
          negative_prompt:
            "blurry, low quality, distorted, deformed, ugly, text, watermark",
          width: 1024,
          height: 1024,
          num_steps: 20,
          guidance: 7.5
        }
      );

      const imageBase64 = await streamToBase64(result);

      return json({
        success: true,
        image: `data:image/png;base64,${imageBase64}`
      });

    } catch (error) {
      return json({
        error: "حدث خطأ أثناء إنشاء الصورة",
        details: error?.message || "Unknown error"
      }, 500);
    }
  }
};
