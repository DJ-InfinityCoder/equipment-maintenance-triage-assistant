import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmbedding, getEmbeddingSettings } from "../lib/rag/embeddings";

describe("RAG embedding configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the configured Groq embedding model and query prefix", async () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    vi.stubEnv("GROQ_EMBEDDING_MODEL", "configured-embedding-model");

    let requestBody: { model: string; input: string } | undefined;
    vi.stubGlobal("fetch", (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as typeof requestBody;
      return new Response(
        JSON.stringify({
          data: [{ embedding: Array.from({ length: 768 }, () => 0.25) }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) satisfies typeof fetch);

    const result = await createEmbedding("pump bearing vibration", "query");

    expect(result).toHaveLength(768);
    expect(requestBody).toEqual({
      model: "configured-embedding-model",
      input: "search_query: pump bearing vibration",
      encoding_format: "float",
    });
  });

  it("requires an environment-selected embedding model", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    vi.stubEnv("GROQ_EMBEDDING_MODEL", "");

    expect(() => getEmbeddingSettings()).toThrow("GROQ_EMBEDDING_MODEL is required");
  });

  it("rejects vectors with a dimension that does not match the Atlas index", async () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    vi.stubEnv("GROQ_EMBEDDING_MODEL", "configured-embedding-model");
    vi.stubGlobal("fetch", (async () =>
      new Response(
        JSON.stringify({ data: [{ embedding: [0.25, 0.5] }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) satisfies typeof fetch);

    await expect(createEmbedding("text", "document")).rejects.toThrow(
      "expected 768 finite values"
    );
  });
});
