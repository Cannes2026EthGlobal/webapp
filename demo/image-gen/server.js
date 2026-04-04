import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ARC_API = process.env.ARC_API_BASE || "http://localhost:3000";
const COMPANY_ID = process.env.ARC_COMPANY_ID;
const PRODUCT_ID = process.env.ARC_PRODUCT_ID;

// ─── Arc Counting usage helper ───

async function recordUsage(customerIdentifier, units, description) {
  const res = await fetch(`${ARC_API}/api/usage/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      customerIdentifier,
      units,
      description,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Usage recording failed: ${res.status}`);
  }
  return res.json();
}

async function billTab(tabId) {
  const res = await fetch(`${ARC_API}/api/usage/bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tabId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Billing failed: ${res.status}`);
  }
  return res.json();
}

async function getTab(tabId) {
  const res = await fetch(`${ARC_API}/api/usage/tab?tabId=${tabId}`);
  if (!res.ok) return null;
  return res.json();
}

// ─── API Routes ───

/**
 * POST /api/generate
 * Generate an image and record the usage on Arc Counting.
 * Body: { prompt, userId }
 */
app.post("/api/generate", async (req, res) => {
  const { prompt, userId } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const customerIdentifier = userId || "anonymous-demo-user";

  try {
    console.log(`[generate] prompt="${prompt}" user=${customerIdentifier}`);

    // 1. Generate image with OpenAI DALL-E
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = image.data[0].url;
    const revisedPrompt = image.data[0].revised_prompt;

    // 2. Record usage on Arc Counting (1 image generation = 1 unit)
    const usage = await recordUsage(
      customerIdentifier,
      1,
      `DALL-E 3: "${prompt.slice(0, 50)}${prompt.length > 50 ? "..." : ""}"`
    );

    console.log(
      `[usage] tab=${usage.tabId} total=${usage.totalUnits} units ($${(usage.totalCents / 100).toFixed(2)})`
    );

    res.json({
      imageUrl,
      revisedPrompt,
      usage: {
        tabId: usage.tabId,
        totalUnits: usage.totalUnits,
        totalCents: usage.totalCents,
      },
    });
  } catch (err) {
    console.error("[error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bill
 * Close the usage tab and get a WC Pay checkout link.
 * Body: { tabId }
 */
app.post("/api/bill", async (req, res) => {
  const { tabId } = req.body;
  if (!tabId) return res.status(400).json({ error: "Missing tabId" });

  try {
    const billing = await billTab(tabId);
    console.log(
      `[bill] ${billing.amountCents} cents → ${billing.checkoutUrl}`
    );
    res.json(billing);
  } catch (err) {
    console.error("[bill error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tab?tabId=...
 * Get current tab status.
 */
app.get("/api/tab", async (req, res) => {
  const { tabId } = req.query;
  if (!tabId) return res.status(400).json({ error: "Missing tabId" });
  const data = await getTab(tabId);
  res.json(data || { error: "Tab not found" });
});

// ─── Start ───

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n  Arc Counting Image Gen Demo`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  Company: ${COMPANY_ID}`);
  console.log(`  Product: ${PRODUCT_ID}`);
  console.log(`  Arc API: ${ARC_API}\n`);
});
