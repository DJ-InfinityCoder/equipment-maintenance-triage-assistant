import { describe, it, expect } from "vitest";
import {
  buildRetrievalQuery,
  tokenizeText,
  scoreChunksByKeyword,
  RetrievedChunk,
} from "../lib/rag/retrieve";
import { KbChunkDoc } from "../lib/db/collections";

describe("RAG Retrieval & Keyword Scorer (lib/rag/retrieve)", () => {
  describe("1. Query Builder & Tokenizer", () => {
    it("builds query combining description, events, and sensor keys", () => {
      const query = buildRetrievalQuery({
        issueDescription: "Loud cavitation rattling heard near impeller housing.",
        recentEvents: [
          { description: "Flow rate dropped abruptly at shift change." },
          { description: "none reported" }, // Should be ignored
        ],
        sensorReadings: [
          { key: "discharge_pressure_psi", value: 18.2, unit: "psi" },
          { key: "bearing_temp_c", value: 82.0, unit: "celsius" },
        ],
      });

      expect(query).toContain("Loud cavitation rattling");
      expect(query).toContain("Flow rate dropped abruptly");
      expect(query).not.toContain("none reported");
      expect(query).toContain("discharge pressure");
      expect(query).toContain("bearing temp");
    });

    it("tokenizes and removes common stop words", () => {
      const tokens = tokenizeText("The bearing temperature of the pump is dangerously high!");
      expect(tokens).toContain("bearing");
      expect(tokens).toContain("temperature");
      expect(tokens).toContain("pump");
      expect(tokens).toContain("dangerously");
      expect(tokens).toContain("high");
      expect(tokens).not.toContain("the");
      expect(tokens).not.toContain("of");
      expect(tokens).not.toContain("is");
    });
  });

  describe("2. In-Memory Keyword/Tag Overlap Scorer", () => {
    const mockChunks: KbChunkDoc[] = [
      {
        chunkId: "pump-m1-equipment-overview",
        equipmentType: "centrifugal_pump",
        title: "Equipment Overview and Normal Operating Ranges",
        section: "Overview",
        content: "Centrifugal pumps convert rotational energy into hydrodynamic energy. Standard bearing temp is 35-70C.",
        tags: ["centrifugal_pump", "pump", "bearing", "temperature"],
        createdAt: "2026-10-05T00:00:00.000Z",
        updatedAt: "2026-10-05T00:00:00.000Z",
      },
      {
        chunkId: "pump-m1-fault-cavitation-and-vapor-bubble-implosion",
        equipmentType: "centrifugal_pump",
        title: "Fault Descriptions > Cavitation and Vapor Bubble Implosion",
        section: "Fault Descriptions",
        content: "Symptoms include gravel noise, rattling in volute casing, suction pressure dropping below 5 psi.",
        tags: ["centrifugal_pump", "cavitation", "suction_pressure_psi", "vibration"],
        createdAt: "2026-10-05T00:00:00.000Z",
        updatedAt: "2026-10-05T00:00:00.000Z",
      },
      {
        chunkId: "pump-m1-fault-mechanical-seal-leakage",
        equipmentType: "centrifugal_pump",
        title: "Fault Descriptions > Mechanical Seal Face Degradation and Leakage",
        section: "Fault Descriptions",
        content: "Liquid dripping from gland port, seal face scoring, seal leakage rate exceeding 15 ml/min.",
        tags: ["centrifugal_pump", "seal", "leakage", "seal_leakage_flow_mlpm"],
        createdAt: "2026-10-05T00:00:00.000Z",
        updatedAt: "2026-10-05T00:00:00.000Z",
      },
      {
        chunkId: "pump-m1-maintenance-seal-replacement",
        equipmentType: "centrifugal_pump",
        title: "Maintenance Instructions > Mechanical Seal Replacement",
        section: "Maintenance Instructions",
        content: "Step-by-step seal cartridge removal and shaft inspection procedure.",
        tags: ["centrifugal_pump", "maintenance", "seal"],
        createdAt: "2026-10-05T00:00:00.000Z",
        updatedAt: "2026-10-05T00:00:00.000Z",
      },
      {
        chunkId: "pump-m1-safety-warnings-and-hazard-protocols",
        equipmentType: "centrifugal_pump",
        title: "Safety Warnings and Hazard Protocols > Lockout/Tagout (LOTO)",
        section: "Safety Warnings",
        content: "Lockout/Tagout requirement: always de-energize electrical disconnect and vent pressurized fluid before access.",
        tags: ["centrifugal_pump", "safety", "loto", "lockout"],
        createdAt: "2026-10-05T00:00:00.000Z",
        updatedAt: "2026-10-05T00:00:00.000Z",
      },
    ];

    it("ranks relevant fault chunk highest when query matches specific symptoms", () => {
      const query = "Gravel rattling noise inside casing with low suction pressure cavitation";
      const results = scoreChunksByKeyword(mockChunks, query, "centrifugal_pump", 3);

      expect(results.length).toBe(3);
      // Cavitation chunk should rank #1
      expect(results[0].chunkId).toBe("pump-m1-fault-cavitation-and-vapor-bubble-implosion");
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it("always includes the Safety Warnings chunk even if query has zero safety keywords", () => {
      const query = "mechanical seal dripping fluid leakage";
      // Request top 2 chunks
      const results = scoreChunksByKeyword(mockChunks, query, "centrifugal_pump", 2);

      expect(results.length).toBe(2);
      // One of the returned chunks must be the safety chunk
      const hasSafety = results.some(
        (c) =>
          c.chunkId.includes("safety") ||
          c.title.toLowerCase().includes("safety")
      );
      expect(hasSafety).toBe(true);

      // And the seal leakage chunk should also be included
      const hasSeal = results.some((c) => c.chunkId.includes("seal"));
      expect(hasSeal).toBe(true);
    });

    it("returns correctly formatted RetrievedChunk objects for citation resolution", () => {
      const results: RetrievedChunk[] = scoreChunksByKeyword(
        mockChunks,
        "cavitation",
        "centrifugal_pump",
        3
      );

      const first = results[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("chunkId");
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("content");
      expect(first).toHaveProperty("score");
      expect(first).toHaveProperty("manualId");
      expect(first).toHaveProperty("equipmentType");
      expect(first.id).toBe(first.chunkId);
      expect(first.manualId).toBe("pump-m1");
    });

    it("returns empty array when no chunks are available", () => {
      const results = scoreChunksByKeyword([], "any query", "centrifugal_pump", 3);
      expect(results).toEqual([]);
    });
  });
});
