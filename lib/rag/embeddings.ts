import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { z } from "zod";

const EmbeddingProviderSchema = z.enum(["gemini", "groq"]);
const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_TIMEOUT_MS = 10_000;

export interface EmbeddingSettings {
  provider: z.infer<typeof EmbeddingProviderSchema>;
  model: string;
  apiKey: string;
}

export function getEmbeddingSettings(): EmbeddingSettings {
  const configuredProvider = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  const inferredProvider = process.env.GROQ_API_KEY ? "groq" : "gemini";
  const providerResult = EmbeddingProviderSchema.safeParse(
    configuredProvider || inferredProvider
  );

  if (!providerResult.success) {
    throw new Error("EMBEDDING_PROVIDER must be set to 'gemini' or 'groq'.");
  }

  const provider = providerResult.data;
  const apiKey =
    provider === "groq"
      ? process.env.GROQ_API_KEY?.trim()
      : process.env.GEMINI_API_KEY?.trim();
  const model =
    provider === "groq"
      ? process.env.GROQ_EMBEDDING_MODEL?.trim()
      : process.env.GEMINI_EMBEDDING_MODEL?.trim();

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY is required for embeddings.`);
  }
  if (!model) {
    throw new Error(
      `${provider === "groq" ? "GROQ_EMBEDDING_MODEL" : "GEMINI_EMBEDDING_MODEL"} is required for embeddings.`
    );
  }

  return { provider, model, apiKey };
}

export async function createEmbedding(
  text: string,
  purpose: "document" | "query"
): Promise<number[]> {
  const settings = getEmbeddingSettings();
  let vector: number[] | undefined;

  if (settings.provider === "groq") {
    const groq = new Groq({
      apiKey: settings.apiKey,
      maxRetries: 0,
    });
    const input =
      purpose === "query"
        ? `search_query: ${text}`
        : `search_document: ${text}`;
    const result = await groq.embeddings.create({
      model: settings.model,
      input,
      encoding_format: "float",
    }, {
      timeout: EMBEDDING_TIMEOUT_MS,
    });
    const embedding = result.data[0]?.embedding;
    vector = Array.isArray(embedding) ? embedding : undefined;
  } else {
    const ai = new GoogleGenAI({ apiKey: settings.apiKey });
    const isEmbedding2 = settings.model.includes("gemini-embedding-2");
    const content =
      isEmbedding2 && purpose === "query"
        ? `task: search result | query: ${text}`
        : isEmbedding2
          ? `title: ${text}`
          : text;
    const result = await ai.models.embedContent({
      model: settings.model,
      contents: content,
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        abortSignal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
      },
    });
    vector = result.embeddings?.[0]?.values;
  }

  if (
    !vector ||
    vector.length !== EMBEDDING_DIMENSIONS ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `Embedding provider returned an invalid vector; expected ${EMBEDDING_DIMENSIONS} finite values.`
    );
  }

  return vector;
}

export const ATLAS_VECTOR_DIMENSIONS = EMBEDDING_DIMENSIONS;
