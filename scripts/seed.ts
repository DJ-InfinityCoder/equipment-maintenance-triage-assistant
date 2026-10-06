import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import "./load-env";
import { getDb } from "../lib/db/client";
import { getKbChunksCollection } from "../lib/db/collections";
import { ensureIndexes } from "../lib/db/indexes";
import { EquipmentType, EquipmentTypeSchema } from "../lib/schemas/equipment";
import { createEmbedding, getEmbeddingSettings } from "../lib/rag/embeddings";

// Ensure resilient SRV resolution on Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore in restricted environments
}

interface ManualFrontMatter {
  equipmentType: EquipmentType;
  manualId: string;
  revision: string;
}

interface ParsedChunk {
  chunkId: string;
  equipmentType: EquipmentType;
  title: string;
  section: string;
  content: string;
  tags: string[];
  wordCount: number;
  embedding?: number[];
}

function parseFrontMatter(raw: string): { meta: ManualFrontMatter; content: string } {
  const frontMatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!frontMatterMatch) {
    throw new Error("Invalid Markdown file: missing front matter block");
  }

  const yamlBlock = frontMatterMatch[1];
  const markdownBody = frontMatterMatch[2];

  const meta: Record<string, string> = {};
  yamlBlock.split(/\r?\n/).forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      meta[key] = value;
    }
  });

  const parsedType = EquipmentTypeSchema.parse(meta.equipmentType);

  return {
    meta: {
      equipmentType: parsedType,
      manualId: meta.manualId || "manual",
      revision: meta.revision || "1.0",
    },
    content: markdownBody,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractTags(text: string, title: string, equipmentType: string): string[] {
  const tags = new Set<string>();
  tags.add(equipmentType);

  const keywords = [
    "bearing",
    "vibration",
    "temperature",
    "pressure",
    "current",
    "seal",
    "lubrication",
    "overheating",
    "cavitation",
    "misalignment",
    "unbalance",
    "loto",
    "lockout",
    "safety",
    "alarm",
    "filter",
    "motor",
    "compressor",
    "chiller",
    "pump",
    "conveyor",
    "inspection",
    "maintenance",
    "leakage",
  ];

  const combined = `${title} ${text}`.toLowerCase();
  for (const kw of keywords) {
    if (combined.includes(kw)) {
      tags.add(kw);
    }
  }

  // Extract explicit or implicit sensor key mentions
  const sensorMappings: Record<string, string> = {
    "suction pressure": "suction_pressure_psi",
    "discharge pressure": "discharge_pressure_psi",
    "bearing temperature": "bearing_temp_c",
    "discharge temperature": "discharge_temp_c",
    "oil pressure": "oil_pressure_psi",
    "oil temperature": "oil_temp_c",
    "winding temperature": "winding_temp_c",
    "drive pulley": "drive_pulley_temp_c",
    "tail pulley": "tail_pulley_temp_c",
    "belt speed": "belt_speed_mps",
    "misalignment": "belt_misalignment_mm",
    "seal leakage": "seal_leakage_flow_mlpm",
    "evaporator pressure": "evaporator_pressure_psi",
    "condenser pressure": "condenser_pressure_psi",
  };

  for (const [phrase, sensorKey] of Object.entries(sensorMappings)) {
    if (combined.includes(phrase)) {
      tags.add(sensorKey);
    }
  }

  // Extract literal snake_case sensor key mentions
  const sensorKeyMatches = combined.match(/[a-z]+_[a-z0-9_]+_(?:c|psi|mms|amps|pct|mlpm|mps)/g);
  if (sensorKeyMatches) {
    for (const sk of sensorKeyMatches) {
      tags.add(sk);
    }
  }

  return Array.from(tags);
}

export function chunkMarkdownManual(
  rawContent: string
): { meta: ManualFrontMatter; chunks: ParsedChunk[] } {
  const { meta, content } = parseFrontMatter(rawContent);
  const lines = content.split(/\r?\n/);

  let currentH2 = "";
  let currentH3 = "";
  let currentLines: string[] = [];
  const rawSections: { h2: string; h3: string; lines: string[] }[] = [];

  function flushCurrent() {
    if (currentLines.some((l) => l.trim().length > 0)) {
      rawSections.push({
        h2: currentH2,
        h3: currentH3,
        lines: [...currentLines],
      });
      currentLines = [];
    }
  }

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flushCurrent();
      currentH2 = line.replace(/^##\s+/, "").trim();
      currentH3 = "";
    } else if (line.startsWith("### ")) {
      flushCurrent();
      currentH3 = line.replace(/^###\s+/, "").trim();
    } else if (line.startsWith("# ")) {
      // Top-level document title, skip
      continue;
    } else {
      currentLines.push(line);
    }
  }
  flushCurrent();

  const chunks: ParsedChunk[] = [];

  for (const sec of rawSections) {
    const sectionBody = sec.lines.join("\n").trim();
    if (!sectionBody) continue;

    const fullTitle = sec.h3 ? `${sec.h2} > ${sec.h3}` : sec.h2;
    const activeHeading = sec.h3 || sec.h2;

    // Stable chunkId derived from manualId + heading slug
    let slugPart = slugify(activeHeading);
    if (sec.h2.toLowerCase().includes("fault") && !slugPart.startsWith("fault-")) {
      slugPart = `fault-${slugPart}`;
    }
    const chunkId = `${meta.manualId}-${slugPart}`;

    const wordCount = sectionBody.split(/\s+/).filter(Boolean).length;
    const tags = extractTags(sectionBody, fullTitle, meta.equipmentType);

    chunks.push({
      chunkId,
      equipmentType: meta.equipmentType,
      title: fullTitle,
      section: sec.h2,
      content: sectionBody,
      tags,
      wordCount,
    });
  }

  return { meta, chunks };
}

async function computeEmbeddings(chunks: ParsedChunk[]): Promise<void> {
  if (!process.env.ATLAS_VECTOR_INDEX?.trim()) {
    console.log(
      "ATLAS_VECTOR_INDEX is not configured; seeding manual chunks without vector embeddings."
    );
    return;
  }

  const settings = getEmbeddingSettings();
  console.log(
    `Computing embeddings using ${settings.provider} model '${settings.model}'...`
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    chunk.embedding = await createEmbedding(
      `${chunk.title}\n\n${chunk.content}`,
      "document"
    );
    if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
      console.log(` - Embedded ${i + 1}/${chunks.length} chunks`);
    }
  }
}

export async function seedKnowledgeBase(): Promise<{ totalChunks: number }> {
  const kbDir = path.resolve(process.cwd(), "data", "kb");
  if (!fs.existsSync(kbDir)) {
    throw new Error(`Knowledge base directory not found at ${kbDir}`);
  }

  const files = fs
    .readdirSync(kbDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("."));

  console.log(`Found ${files.length} knowledge base manuals in ${kbDir}`);

  const allChunks: ParsedChunk[] = [];
  const allMetas: Record<string, ManualFrontMatter> = {};

  for (const file of files) {
    const filePath = path.join(kbDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { meta, chunks } = chunkMarkdownManual(content);
    allMetas[meta.manualId] = meta;
    allChunks.push(...chunks);
    console.log(
      ` - ${file} (${meta.equipmentType}, ${meta.manualId}): generated ${chunks.length} chunks`
    );
  }

  console.log(`Total generated chunks: ${allChunks.length}`);

  await computeEmbeddings(allChunks);

  // Connect to DB and upsert chunks idempotently
  const db = await getDb();
  await ensureIndexes(db);
  const collection = await getKbChunksCollection(db);

  console.log("Upserting chunks into 'kb_chunks' collection...");
  let upsertedCount = 0;

  for (const chunk of allChunks) {
    const meta = allMetas[chunk.chunkId.split("-")[0]] || {
      revision: "1.0",
      manualId: chunk.chunkId,
    };
    const now = new Date().toISOString();

    const updateDoc: Record<string, unknown> = {
      chunkId: chunk.chunkId,
      equipmentType: chunk.equipmentType,
      title: chunk.title,
      section: chunk.section,
      content: chunk.content,
      tags: chunk.tags,
      metadata: {
        manualId: meta.manualId,
        revision: meta.revision,
        wordCount: chunk.wordCount,
      },
      updatedAt: now,
    };

    if (chunk.embedding) {
      updateDoc.embedding = chunk.embedding;
    }

    await collection.updateOne(
      { chunkId: chunk.chunkId },
      {
        $set: updateDoc,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    upsertedCount++;
  }

  console.log(`Successfully upserted ${upsertedCount} chunks into kb_chunks.`);
  return { totalChunks: upsertedCount };
}

// Run directly if invoked from command line
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedKnowledgeBase()
    .then((res) => {
      console.log(`\nKnowledge base seed complete: ${res.totalChunks} chunks active.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Knowledge base seed failed:", err);
      process.exit(1);
    });
}
