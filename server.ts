import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface ReviewInput {
  author?: string;
  rating?: number;
  text: string;
  relativeTime?: string;
}

interface AnalyzeRequestBody {
  placeId: string;
  name: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  reviews: ReviewInput[];
}

interface HeroDish {
  name: string;
  meatType: string;
  spiceLevel: "Mild" | "Medium" | "Spicy" | "Fiery";
  whyItsFamous: string;
}

interface RunnerUpDish {
  name: string;
  mentionsContext: string;
}

interface GeminiAnalysisResult {
  heroDish: HeroDish;
  runnerUpDishes: RunnerUpDish[];
  pros: string[];
  cons: string[];
  visitTip: string;
}

const serverAnalysisCache = new Map<string, GeminiAnalysisResult>();

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    heroDish: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "The #1 most praised non-vegetarian signature dish mentioned in the reviews.",
        },
        meatType: {
          type: Type.STRING,
          description: "Primary protein/cut (e.g., Chicken, Mutton/Lamb, Beef, Seafood, Pork, Mixed Grill).",
        },
        spiceLevel: {
          type: Type.STRING,
          enum: ["Mild", "Medium", "Spicy", "Fiery"],
          description: "Typical spice heat level inferred from the dish and reviews.",
        },
        whyItsFamous: {
          type: Type.STRING,
          description: "1–2 concise, appetizing sentences explaining why diners rave about this dish.",
        },
      },
      required: ["name", "meatType", "spiceLevel", "whyItsFamous"],
    },
    runnerUpDishes: {
      type: Type.ARRAY,
      description: "Up to 3 additional standout non-veg dishes mentioned in reviews.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          mentionsContext: {
            type: Type.STRING,
            description: "Brief context on what reviewers highlight about this dish.",
          },
        },
        required: ["name", "mentionsContext"],
      },
    },
    pros: {
      type: Type.ARRAY,
      description: "3 to 4 specific, honest strengths extracted directly from the reviews.",
      items: { type: Type.STRING },
    },
    cons: {
      type: Type.ARRAY,
      description: "2 to 3 honest drawbacks (e.g. wait times, parking, noise, spice baseline, pricing) from reviews.",
      items: { type: Type.STRING },
    },
    visitTip: {
      type: Type.STRING,
      description: "One actionable insider tip for ordering, seating, or timing based on reviews.",
    },
  },
  required: ["heroDish", "runnerUpDishes", "pros", "cons", "visitTip"],
};

async function runStructuredExtraction(
  ai: GoogleGenAI,
  payload: AnalyzeRequestBody,
  model: string
): Promise<GeminiAnalysisResult> {
  const reviewSnippets = payload.reviews
    .filter((r) => r.text && r.text.trim().length > 0)
    .slice(0, 15)
    .map(
      (r, idx) =>
        `Review ${idx + 1} (${r.rating ?? "?"}★, ${r.relativeTime ?? "recent"}): ${r.text.trim()}`
    )
    .join("\n\n");

  const prompt = [
    `Restaurant: ${payload.name}`,
    payload.formattedAddress ? `Address: ${payload.formattedAddress}` : "",
    payload.rating ? `Rating: ${payload.rating} (${payload.userRatingCount ?? 0} reviews)` : "",
    "",
    "Customer Reviews:",
    reviewSnippets || "No detailed text reviews provided; infer carefully from restaurant name and rating context while keeping pros/cons honest and grounded.",
    "",
    "Extract the standout non-vegetarian Hero Dish, up to 3 runner-up non-veg dishes, 3-4 honest pros, 2-3 honest cons, and 1 actionable visit tip. Keep every point concise, concrete, and grounded in the reviews.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction:
        "You are a culinary intelligence analyst specializing in non-vegetarian dining. Extract authentic signature meat/seafood dishes, honest strengths, and real drawbacks strictly from customer reviews. Never invent fake awards or marketing fluff.",
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA,
    },
  });

  const rawText = (response.text ?? "{}").trim();
  const parsed = JSON.parse(rawText) as GeminiAnalysisResult;

  return {
    heroDish: {
      name: parsed.heroDish?.name || "Chef's Signature Grill",
      meatType: parsed.heroDish?.meatType || "Mixed Grill",
      spiceLevel: (["Mild", "Medium", "Spicy", "Fiery"].includes(parsed.heroDish?.spiceLevel)
        ? parsed.heroDish.spiceLevel
        : "Medium") as HeroDish["spiceLevel"],
      whyItsFamous:
        parsed.heroDish?.whyItsFamous || "Frequently highlighted by diners for bold seasoning and tender cook.",
    },
    runnerUpDishes: Array.isArray(parsed.runnerUpDishes)
      ? parsed.runnerUpDishes.slice(0, 3)
      : [],
    pros: Array.isArray(parsed.pros) ? parsed.pros.slice(0, 4) : [],
    cons: Array.isArray(parsed.cons) ? parsed.cons.slice(0, 3) : [],
    visitTip:
      parsed.visitTip || "Arrive 20 minutes ahead of peak dinner hours for faster table seating.",
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/analyze-restaurant", async (req, res) => {
    try {
      const body = req.body as AnalyzeRequestBody;
      if (!body || !body.placeId || !body.name) {
        res.status(400).json({ error: "placeId and name are required." });
        return;
      }

      const cached = serverAnalysisCache.get(body.placeId);
      if (cached) {
        res.json({ analysis: cached, cached: true });
        return;
      }

      const ai = createGeminiClient();
      let analysis: GeminiAnalysisResult;

      try {
        analysis = await runStructuredExtraction(ai, body, "gemini-2.5-flash");
      } catch (primaryErr: unknown) {
        const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("not found")) {
          analysis = await runStructuredExtraction(ai, body, "gemini-4-hydrogen");
        } else {
          throw primaryErr;
        }
      }

      serverAnalysisCache.set(body.placeId, analysis);
      res.json({ analysis, cached: false });
    } catch (err: unknown) {
      console.error("Gemini review analysis error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to analyze restaurant reviews.";
      const status =
        message.includes("429") || message.includes("RESOURCE_EXHAUSTED")
          ? 429
          : message.includes("403") || message.includes("API_KEY_INVALID")
          ? 403
          : 500;
      res.status(status).json({ error: message });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CarnivoreRoute server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start CarnivoreRoute server:", err);
  process.exit(1);
});
