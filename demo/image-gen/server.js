import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "data.json");

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const IMAGES_DIR = join(__dirname, "public", "images");
if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });

const ARC_API = process.env.ARC_API_BASE || "http://localhost:3000";
const COMPANY_ID = process.env.ARC_COMPANY_ID;
const PRODUCT_ID = process.env.ARC_PRODUCT_ID;

// ─── Persistence ───

function loadData() {
  if (!existsSync(DATA_FILE)) {
    return { sessions: {} };
  }
  return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
}

function saveData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getSession(userId) {
  const data = loadData();
  if (!data.sessions[userId]) {
    data.sessions[userId] = {
      tabId: null,
      totalUnits: 0,
      totalCents: 0,
      images: [],
      billedTabs: [],
    };
    saveData(data);
  }
  return data.sessions[userId];
}

function updateSession(userId, updates) {
  const data = loadData();
  data.sessions[userId] = { ...getSession(userId), ...updates };
  saveData(data);
  return data.sessions[userId];
}

// ─── Arc Counting usage helpers ───

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

// ─── API Routes ───

/**
 * GET /api/session?userId=...
 * Restore session state (images, tab, totals).
 */
app.get("/api/session", (req, res) => {
  const userId = req.query.userId || "anonymous-demo-user";
  const session = getSession(userId);
  res.json(session);
});

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

    const openaiUrl = image.data[0].url;
    const revisedPrompt = image.data[0].revised_prompt;

    // 2. Download and save image locally (OpenAI URLs expire after ~1h)
    const filename = `${randomBytes(8).toString("hex")}.png`;
    const filepath = join(IMAGES_DIR, filename);
    const imgRes = await fetch(openaiUrl);
    await pipeline(Readable.fromWeb(imgRes.body), createWriteStream(filepath));
    const imageUrl = `/images/${filename}`;

    // 3. Record usage on Arc Counting
    const usage = await recordUsage(
      customerIdentifier,
      1,
      `DALL-E 3: "${prompt.slice(0, 50)}${prompt.length > 50 ? "..." : ""}"`
    );

    console.log(
      `[usage] tab=${usage.tabId} total=${usage.totalUnits} units ($${(usage.totalCents / 100).toFixed(2)})`
    );

    // 4. Persist to session
    const session = getSession(customerIdentifier);
    session.tabId = usage.tabId;
    session.totalUnits = usage.totalUnits;
    session.totalCents = usage.totalCents;
    session.images.unshift({
      url: imageUrl,
      prompt,
      revisedPrompt,
      totalUnits: usage.totalUnits,
      totalCents: usage.totalCents,
      createdAt: Date.now(),
    });
    updateSession(customerIdentifier, session);

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
 * Body: { tabId, userId }
 */
app.post("/api/bill", async (req, res) => {
  const { tabId, userId } = req.body;
  if (!tabId) return res.status(400).json({ error: "Missing tabId" });

  const customerIdentifier = userId || "anonymous-demo-user";

  try {
    const billing = await billTab(tabId);
    console.log(
      `[bill] ${billing.amountCents} cents → ${billing.checkoutUrl}`
    );

    // Persist: archive the billed tab and reset
    const session = getSession(customerIdentifier);
    session.billedTabs.unshift({
      tabId,
      amountCents: billing.amountCents,
      checkoutUrl: billing.checkoutUrl,
      imageCount: session.totalUnits,
      billedAt: Date.now(),
    });
    session.tabId = null;
    session.totalUnits = 0;
    session.totalCents = 0;
    updateSession(customerIdentifier, session);

    res.json(billing);
  } catch (err) {
    console.error("[bill error]", err.message);
    res.status(500).json({ error: err.message });
  }
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
