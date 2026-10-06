import { EquipmentType } from "../schemas/equipment";
import { RetrievalError } from "../schemas/errors";
import { getKbChunksCollection, KbChunkDoc } from "../db/collections";
import { createEmbedding } from "./embeddings";

export interface RetrievedChunk {
  id: string; // Unique chunkId used for citations (e.g. 'pump-m1-fault-seal-leak')
  chunkId: string;
  title: string;
  content: string;
  score: number;
  manualId: string;
  section?: string;
  tags: string[];
  equipmentType: EquipmentType;
}

export type RetrievalMethod = "vector" | "text" | "keyword";

export interface RetrieveContextParams {
  equipmentType: EquipmentType;
  issueDescription: string;
  recentEvents?: Array<{ description: string; occurredAt?: string }>;
  sensorReadings?: Array<{
    key: string;
    value: number;
    unit: string;
    recordedAt?: string;
  }>;
  k?: number;
}

export interface RetrieveContextResult {
  chunks: RetrievedChunk[];
  method: RetrievalMethod;
  warnings: string[];
  queryUsed: string;
}

const COMMON_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
]);

/**
 * Builds a dense retrieval search query from the user issue description,
 * recent operating events, and active sensor keys.
 */
export function buildRetrievalQuery(params: {
  issueDescription: string;
  recentEvents?: Array<{ description: string; occurredAt?: string }>;
  sensorReadings?: Array<{ key: string; value: number; unit: string }>;
}): string {
  const queryParts: string[] = [];

  // 1. Primary issue description
  if (params.issueDescription?.trim()) {
    queryParts.push(params.issueDescription.trim());
  }

  // 2. Meaningful recent event descriptions (skipping "none reported")
  if (params.recentEvents?.length) {
    for (const event of params.recentEvents) {
      const desc = event.description?.trim();
      if (desc && !desc.toLowerCase().includes("none reported")) {
        queryParts.push(desc);
      }
    }
  }

  // 3. Sensor key tokens (convert snake_case keys into search terms)
  if (params.sensorReadings?.length) {
    const sensorTerms: string[] = [];
    for (const reading of params.sensorReadings) {
      if (reading.key?.trim()) {
        const cleanedKey = reading.key
          .replace(/_(?:c|psi|mms|amps|pct|mlpm|mps)$/i, "")
          .replace(/_/g, " ");
        sensorTerms.push(cleanedKey);
      }
    }
    if (sensorTerms.length > 0) {
      queryParts.push(sensorTerms.join(" "));
    }
  }

  return queryParts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Tokenizes text into lowercase non-stopword alphanumeric keywords.
 */
export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !COMMON_STOP_WORDS.has(token));
}

/**
 * Maps raw database doc to standardized RetrievedChunk.
 */
export function mapDocToRetrievedChunk(
  doc: KbChunkDoc & { score?: number },
  fallbackScore = 0.5
): RetrievedChunk {
  const manualId =
    (doc.metadata?.manualId as string) ||
    doc.chunkId.split("-").slice(0, 2).join("-") ||
    "manual";

  return {
    id: doc.chunkId,
    chunkId: doc.chunkId,
    title: doc.title,
    content: doc.content,
    score: typeof doc.score === "number" ? doc.score : fallbackScore,
    manualId,
    section: doc.section,
    tags: doc.tags || [],
    equipmentType: doc.equipmentType,
  };
}

/**
 * In-memory keyword and tag overlap scorer.
 * Strategy 3 fallback: computes weighted term overlap and always includes
 * the 'Safety Warnings' section chunk for the given equipment type.
 */
export function scoreChunksByKeyword(
  chunks: KbChunkDoc[],
  query: string,
  equipmentType: EquipmentType,
  k = 6
): RetrievedChunk[] {
  const queryTokens = tokenizeText(query);
  const tokenSet = new Set(queryTokens);

  if (chunks.length === 0) {
    return [];
  }

  interface ScoredCandidate {
    chunk: KbChunkDoc;
    score: number;
    isSafety: boolean;
  }

  const candidates: ScoredCandidate[] = chunks.map((chunk) => {
    let score = 0;
    const lowerContent = chunk.content.toLowerCase();
    const lowerTitle = chunk.title.toLowerCase();
    const chunkTags = new Set((chunk.tags || []).map((t) => t.toLowerCase()));

    const isSafety =
      chunk.title.toLowerCase().includes("safety") ||
      (chunk.section && chunk.section.toLowerCase().includes("safety")) ||
      chunk.chunkId.includes("safety") ||
      chunk.chunkId.includes("hazard");

    for (const token of tokenSet) {
      // 1. Tag match (highest weight)
      if (chunkTags.has(token)) {
        score += 3.0;
      }
      // 2. Title match (medium weight)
      if (lowerTitle.includes(token)) {
        score += 2.0;
      }
      // 3. Content match (base weight)
      if (lowerContent.includes(token)) {
        score += 1.0;
      }
    }

    return {
      chunk,
      score,
      isSafety,
    };
  });

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  // Guarantee safety chunk inclusion:
  // If no safety chunk is in the top k, swap out the lowest candidate to include the highest-scoring safety chunk.
  const topCandidates = candidates.slice(0, k);
  const hasSafety = topCandidates.some((c) => c.isSafety);

  if (!hasSafety) {
    const bestSafety = candidates.find((c) => c.isSafety);
    if (bestSafety) {
      if (topCandidates.length < k) {
        topCandidates.push(bestSafety);
      } else {
        // Replace last item with safety chunk
        topCandidates[topCandidates.length - 1] = bestSafety;
      }
    }
  }

  return topCandidates.map((c) => mapDocToRetrievedChunk(c.chunk, Math.max(0.1, c.score)));
}

/**
 * Retrieves relevant knowledge base manual chunks using a tiered strategy:
 * 1. Atlas Vector Search (if ATLAS_VECTOR_INDEX and an embedding provider are configured)
 * 2. MongoDB $text search with textScore
 * 3. In-memory keyword/tag overlap with guaranteed safety warnings inclusion
 *
 * Throws RetrievalError on any database or embedding failure.
 */
export async function retrieveContext(
  params: RetrieveContextParams
): Promise<RetrieveContextResult> {
  const { equipmentType, issueDescription, recentEvents, sensorReadings, k = 6 } = params;
  const warnings: string[] = [];

  const queryUsed = buildRetrievalQuery({
    issueDescription,
    recentEvents,
    sensorReadings,
  });

  if (!queryUsed.trim()) {
    warnings.push("No query terms provided for manual retrieval.");
    return {
      chunks: [],
      method: "keyword",
      warnings,
      queryUsed: "",
    };
  }

  // -------------------------------------------------------------
  // STRATEGY 1: Atlas Vector Search ($vectorSearch)
  // -------------------------------------------------------------
  const vectorIndexName = process.env.ATLAS_VECTOR_INDEX?.trim();

  if (vectorIndexName) {
    try {
      const queryVector = await createEmbedding(queryUsed, "query");
      const collection = await getKbChunksCollection();
      const pipeline = [
        {
          $vectorSearch: {
            index: vectorIndexName,
            path: "embedding",
            queryVector,
            numCandidates: Math.max(k * 10, 50),
            limit: k,
            filter: {
              equipmentType: { $eq: equipmentType },
            },
          },
        },
        {
          $project: {
            _id: 0,
            chunkId: 1,
            title: 1,
            content: 1,
            section: 1,
            tags: 1,
            metadata: 1,
            equipmentType: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ];

      const vectorDocs = (await collection
        .aggregate(pipeline)
        .maxTimeMS(10_000)
        .toArray()) as unknown as Array<KbChunkDoc & { score?: number }>;

      if (vectorDocs && vectorDocs.length > 0) {
        return {
          chunks: vectorDocs.map((d) => mapDocToRetrievedChunk(d)),
          method: "vector",
          warnings,
          queryUsed,
        };
      }
    } catch {
      warnings.push(
        "Vector retrieval failed or timed out; trying manual text search instead."
      );
    }
  }

  // -------------------------------------------------------------
  // STRATEGY 2: MongoDB $text Search
  // -------------------------------------------------------------
  try {
    const collection = await getKbChunksCollection();

    const textDocs = (await collection
      .find(
        {
          equipmentType,
          $text: { $search: queryUsed },
        },
        {
          projection: {
            _id: 0,
            chunkId: 1,
            title: 1,
            content: 1,
            section: 1,
            tags: 1,
            metadata: 1,
            equipmentType: 1,
            score: { $meta: "textScore" },
          },
        }
      )
      .sort({ score: { $meta: "textScore" } })
      .limit(k)
      .maxTimeMS(10_000)
      .toArray()) as unknown as Array<KbChunkDoc & { score?: number }>;

    if (textDocs && textDocs.length > 0) {
      return {
        chunks: textDocs.map((d) => mapDocToRetrievedChunk(d)),
        method: "text",
        warnings,
        queryUsed,
      };
    }
  } catch {
    warnings.push(
      "Manual text search failed or timed out; trying keyword-based manual search instead."
    );
  }

  // -------------------------------------------------------------
  // STRATEGY 3: In-Memory Keyword/Tag Overlap Fallback
  // -------------------------------------------------------------
  try {
    const collection = await getKbChunksCollection();
    const allEquipmentChunks = await collection
      .find({ equipmentType })
      .maxTimeMS(10_000)
      .toArray();

    if (allEquipmentChunks.length === 0) {
      warnings.push("No relevant manual sections found.");
      return {
        chunks: [],
        method: "keyword",
        warnings,
        queryUsed,
      };
    }

    const keywordChunks = scoreChunksByKeyword(
      allEquipmentChunks,
      queryUsed,
      equipmentType,
      k
    );

    if (keywordChunks.length === 0) {
      warnings.push("No relevant manual sections found.");
    }

    return {
      chunks: keywordChunks,
      method: "keyword",
      warnings,
      queryUsed,
    };
  } catch (error) {
    throw new RetrievalError("Keyword scoring fallback failed", {
      userMessage: "Failed to score manual chunks during fallback retrieval.",
      cause: error,
    });
  }
}
