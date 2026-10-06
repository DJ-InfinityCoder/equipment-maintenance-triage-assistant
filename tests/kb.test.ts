import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { chunkMarkdownManual } from "../scripts/seed";
import {
  EQUIPMENT_SENSOR_LIMITS,
  getSensorLimit,
} from "../lib/rules/limits";
import { BASE_EQUIPMENT_TYPES } from "../lib/schemas/equipment";

describe("Knowledge Base & Limits (data/kb & lib/rules/limits)", () => {
  const kbDir = path.resolve(process.cwd(), "data", "kb");

  describe("1. Markdown Manual Structure & Chunking", () => {
    it("has manuals for all 5 base equipment types", () => {
      for (const eqType of BASE_EQUIPMENT_TYPES) {
        const filePath = path.join(kbDir, `${eqType}.md`);
        expect(fs.existsSync(filePath), `Missing manual for ${eqType}`).toBe(true);
      }
    });

    it("parses and chunks centrifugal_pump manual cleanly", () => {
      const filePath = path.join(kbDir, "centrifugal_pump.md");
      const content = fs.readFileSync(filePath, "utf-8");
      const { meta, chunks } = chunkMarkdownManual(content);

      expect(meta.equipmentType).toBe("centrifugal_pump");
      expect(meta.manualId).toBe("pump-m1");
      expect(meta.revision).toBe("2.1");

      expect(chunks.length).toBeGreaterThanOrEqual(10);

      // Verify stable chunk IDs
      for (const chunk of chunks) {
        expect(chunk.chunkId.startsWith("pump-m1-")).toBe(true);
        expect(chunk.title.length).toBeGreaterThan(3);
        expect(chunk.content.length).toBeGreaterThan(50);
        expect(chunk.tags.length).toBeGreaterThan(0);
        expect(chunk.wordCount).toBeGreaterThan(20);
      }

      // Check specific fault chunk
      const cavChunk = chunks.find((c) =>
        c.chunkId.includes("cavitation")
      );
      expect(cavChunk).toBeDefined();
      expect(cavChunk?.title).toContain("Cavitation");
      expect(cavChunk?.tags).toContain("cavitation");
      expect(cavChunk?.tags).toContain("suction_pressure_psi");
    });

    it("ensures each manual has at least 6 fault descriptions", () => {
      for (const eqType of BASE_EQUIPMENT_TYPES) {
        const filePath = path.join(kbDir, `${eqType}.md`);
        const content = fs.readFileSync(filePath, "utf-8");
        const { chunks } = chunkMarkdownManual(content);

        const faultChunks = chunks.filter((c) =>
          c.chunkId.includes("fault") || c.section.toLowerCase().includes("fault")
        );
        expect(
          faultChunks.length,
          `${eqType} should have at least 6 fault chunks, found ${faultChunks.length}`
        ).toBeGreaterThanOrEqual(6);
      }
    });

    it("ensures all chunk IDs are unique within each manual and across all manuals", () => {
      const allChunkIds = new Set<string>();

      for (const eqType of BASE_EQUIPMENT_TYPES) {
        const filePath = path.join(kbDir, `${eqType}.md`);
        const content = fs.readFileSync(filePath, "utf-8");
        const { chunks } = chunkMarkdownManual(content);

        for (const chunk of chunks) {
          expect(allChunkIds.has(chunk.chunkId)).toBe(false);
          allChunkIds.add(chunk.chunkId);
        }
      }

      expect(allChunkIds.size).toBe(65);
    });
  });

  describe("2. Machine-Readable Sensor Alarm Limits (lib/rules/limits.ts)", () => {
    it("defines limits for every equipment type", () => {
      for (const eqType of BASE_EQUIPMENT_TYPES) {
        const limits = EQUIPMENT_SENSOR_LIMITS[eqType];
        expect(limits).toBeDefined();
        expect(limits.length).toBeGreaterThanOrEqual(5);

        for (const limit of limits) {
          expect(limit.sensorKey.length).toBeGreaterThan(2);
          expect(limit.unit.length).toBeGreaterThan(0);
          expect(limit.name.length).toBeGreaterThan(2);
          expect(limit.description.length).toBeGreaterThan(5);

          // Verify either warningHigh or warningLow is present
          expect(
            limit.warningHigh !== undefined || limit.warningLow !== undefined
          ).toBe(true);
        }
      }
    });

    it("getSensorLimit retrieves correct rule", () => {
      const rule = getSensorLimit("centrifugal_pump", "bearing_temp_c");
      expect(rule).toBeDefined();
      expect(rule?.normalMax).toBe(70);
      expect(rule?.warningHigh).toBe(75);
      expect(rule?.criticalHigh).toBe(85);
    });

    it("ensures sensor keys in limits.ts match the markdown tables exactly", () => {
      for (const eqType of BASE_EQUIPMENT_TYPES) {
        const filePath = path.join(kbDir, `${eqType}.md`);
        const content = fs.readFileSync(filePath, "utf-8");
        const limits = EQUIPMENT_SENSOR_LIMITS[eqType];

        for (const limit of limits) {
          // Verify backtick-enclosed sensorKey exists in the markdown manual table
          expect(
            content.includes(`\`${limit.sensorKey}\``),
            `Manual ${eqType}.md should include sensor key \`${limit.sensorKey}\``
          ).toBe(true);
        }
      }
    });
  });
});
