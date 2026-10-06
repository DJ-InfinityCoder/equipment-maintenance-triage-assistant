import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  processTriageReport,
  TriageServiceDependencies,
} from "../lib/services/triageService";
import { checkRateLimit, resetRateLimiter } from "../lib/services/rateLimiter";
import { IssueReportInput } from "../lib/schemas/issue-report";
import { TriageRecord } from "../lib/schemas/triage-record";
import { RetrievedChunk, RetrieveContextResult } from "../lib/rag/retrieve";
import { TriageModel } from "../lib/ai/model";
import { AiTriageOutput } from "../lib/schemas/ai-triage";
import { AiError, ValidationError, DatabaseError } from "../lib/schemas/errors";

// Mock retrieved chunks
const mockRetrievedChunks: RetrievedChunk[] = [
  {
    id: "pump-m1-bearing-wear",
    chunkId: "pump-m1-bearing-wear",
    title: "Centrifugal Pump Bearing Overheating and Wear",
    content:
      "Bearing temperatures exceeding 75 C indicate grease breakdown or misalignment. Check lubrication and verify shaft alignment.",
    score: 0.92,
    manualId: "pump-m1",
    section: "Faults",
    tags: ["bearing", "temp", "vibration"],
    equipmentType: "centrifugal_pump",
  },
];

// Valid issue report input
const sampleInput: IssueReportInput = {
  equipmentType: "centrifugal_pump",
  equipmentId: "PUMP-204",
  issueDescription:
    "Pump inboard bearing is hot to touch and emitting a slight rattling noise.",
  recentEvents: [
    {
      description: "Shift supervisor noted lubrication oil level low at 08:00",
      occurredAt: "2026-10-05T08:00:00Z",
    },
  ],
  sensorReadings: [
    { key: "bearing_temp_c", value: 78, unit: "celsius" },
    { key: "vibration_rms_mms", value: 3.5, unit: "mm/s" },
  ],
  reportedBy: "Technician Alice",
};

// Valid AI output
const sampleAiOutput: AiTriageOutput = {
  observations: [
    {
      text: "Bearing temperature of 78 C exceeds 75 C warning threshold.",
      citations: [
        { type: "sensor", key: "bearing_temp_c" },
        { type: "kb", chunkId: "pump-m1-bearing-wear" },
      ],
    },
  ],
  possibleCauses: [
    {
      hypothesis:
        "Lubrication breakdown or early bearing cage wear may cause friction and thermal rise.",
      likelihood: "high",
      citations: [
        { type: "kb", chunkId: "pump-m1-bearing-wear" },
        { type: "event", eventIndex: 0 },
      ],
    },
  ],
  followUpQuestions: [
    {
      question: "When was grease last replenished in the bearing housing?",
      whyItMatters: "Helps verify lubrication breakdown hypothesis.",
      citations: [{ type: "kb", chunkId: "pump-m1-bearing-wear" }],
    },
  ],
  inspectionSteps: [
    {
      order: 1,
      instruction:
        "Lock out motor power supply and check bearing housing temperature with calibrated pyrometer.",
      safetyNote: "Ensure LOTO before physical inspection.",
      citations: [{ type: "kb", chunkId: "pump-m1-bearing-wear" }],
    },
  ],
  suggestedPriority: "high",
  priorityRationale: {
    text: "High priority due to bearing temperature threshold breach.",
    citations: [{ type: "sensor", key: "bearing_temp_c" }],
  },
  draftWorkOrder: {
    title: "Inspect inboard bearing lubrication on PUMP-204",
    description: "Inboard bearing operating hot (78 C) with vibration.",
    recommendedActions: [
      "Isolate pump with LOTO",
      "Purge and replenish high-temperature synthetic grease",
      "Check shaft radial runout",
    ],
    partsToCheck: ["Inboard roller bearing", "Grease seals", "Shaft coupling"],
  },
  uncertaintyNotes: ["Grease manufacturer specification is not confirmed."],
};

class FakeModel implements TriageModel {
  constructor(private response: string | Error) {}

  async generate(): Promise<string> {
    if (this.response instanceof Error) {
      throw this.response;
    }
    return this.response;
  }
}

describe("lib/services/triageService - Full Pipeline Integration", () => {
  let savedRecords: TriageRecord[];

  beforeEach(() => {
    savedRecords = [];
    resetRateLimiter();
  });

  const createDeps = (overrides?: Partial<TriageServiceDependencies>): TriageServiceDependencies => ({
    saveRecordFn: async (record: TriageRecord) => {
      savedRecords.push(record);
      return record;
    },
    retrieveContextFn: async (): Promise<RetrieveContextResult> => ({
      chunks: mockRetrievedChunks,
      method: "vector",
      warnings: [],
      queryUsed: "bearing temp hot",
    }),
    triageModel: new FakeModel(JSON.stringify(sampleAiOutput)),
    ...overrides,
  });

  // =========================================================================
  // 1. HAPPY PATH
  // =========================================================================
  it("executes happy path pipeline successfully", async () => {
    const deps = createDeps();
    const result = await processTriageReport(sampleInput, deps);

    // Status assertions
    expect(result.status.rules).toBe("ok");
    expect(result.status.retrieval).toBe("ok");
    expect(result.status.ai).toBe("ok");

    // Priority assertions (bearing_temp_c 78°C warning on safety sensor -> high floor; AI suggested high -> high)
    expect(result.record.ruleFloorPriority).toBe("high");
    expect(result.record.finalPriority).toBe("high");

    // Work order prefilled from AI draft
    expect(result.record.workOrder.title).toBe(sampleAiOutput.draftWorkOrder.title);
    expect(result.record.workOrder.status).toBe("draft");
    expect(result.record.workOrder.recommendedActions).toEqual(
      sampleAiOutput.draftWorkOrder.recommendedActions
    );

    // Persistence assertion
    expect(savedRecords).toHaveLength(1);
    expect(savedRecords[0].id).toBe(result.triageId);

    // Audit trail assertions
    const eventTypes = result.record.auditTrail.map((e) => e.type);
    expect(eventTypes).toContain("report_submitted");
    expect(eventTypes).toContain("rules_evaluated");
    expect(eventTypes).toContain("retrieval_completed");
    expect(eventTypes).toContain("ai_generated");
    expect(eventTypes).toContain("draft_created");
  });

  // =========================================================================
  // 2. RETRIEVAL FAILURE (DEGRADED MODE)
  // =========================================================================
  it("handles retrieval failure gracefully in degraded mode (rules ok, ai skipped)", async () => {
    const deps = createDeps({
      retrieveContextFn: async () => {
        throw new Error("Atlas connection timeout: cluster unavailable");
      },
    });

    const result = await processTriageReport(sampleInput, deps);

    // Status shows partial failure
    expect(result.status.rules).toBe("ok");
    expect(result.status.retrieval).toBe("failed");
    expect(result.status.ai).toBe("skipped_no_context");

    // Record is still persisted!
    expect(savedRecords).toHaveLength(1);

    // Fallback work order generated from rule findings
    expect(result.record.workOrder.status).toBe("draft");
    expect(result.record.workOrder.title).toContain("Manual Triage Required");
    expect(result.record.finalPriority).toBe(result.record.ruleFloorPriority);

    // Audit trail contains retrieval_failed and ai_skipped
    const eventTypes = result.record.auditTrail.map((e) => e.type);
    expect(eventTypes).toContain("retrieval_failed");
    expect(eventTypes).toContain("ai_skipped");
    expect(eventTypes).toContain("draft_created");
  });

  // =========================================================================
  // 3. AI FAILURE (DEGRADED MODE)
  // =========================================================================
  it("handles AI failure gracefully in degraded mode (rules ok, retrieval ok, ai failed)", async () => {
    const deps = createDeps({
      triageModel: new FakeModel(
        new AiError("Google API quota 429", { subtype: "rate_limit" })
      ),
    });

    const result = await processTriageReport(sampleInput, deps);

    // Status flags
    expect(result.status.rules).toBe("ok");
    expect(result.status.retrieval).toBe("ok");
    expect(result.status.ai).toBe("failed");

    // Record is still persisted
    expect(savedRecords).toHaveLength(1);
    expect(result.record.ai?.errorSubtype).toBe("rate_limit");

    // Fallback work order derived from rule findings
    expect(result.record.workOrder.status).toBe("draft");
    expect(result.record.workOrder.title).toContain("Manual Triage Required");
    expect(result.record.finalPriority).toBe(result.record.ruleFloorPriority);

    // Audit trail contains ai_failed
    const eventTypes = result.record.auditTrail.map((e) => e.type);
    expect(eventTypes).toContain("ai_failed");
    expect(eventTypes).toContain("draft_created");
  });

  // =========================================================================
  // 4. NON-NEGOTIABLE RULE 2: NEVER SETS STATUS TO 'APPROVED'
  // =========================================================================
  it("GUARANTEES: no code path ever sets workOrder.status to 'approved'", async () => {
    // Scenario 1: Happy path
    const res1 = await processTriageReport(sampleInput, createDeps());
    expect(res1.record.workOrder.status).toBe("draft");
    expect(res1.record.workOrder.status).not.toBe("approved");
    expect(res1.record.workOrder.approvedBy).toBeUndefined();
    expect(res1.record.workOrder.decidedAt).toBeUndefined();

    // Scenario 2: Retrieval failure
    const res2 = await processTriageReport(
      sampleInput,
      createDeps({
        retrieveContextFn: async () => {
          throw new Error("DB error");
        },
      })
    );
    expect(res2.record.workOrder.status).toBe("draft");
    expect(res2.record.workOrder.status).not.toBe("approved");

    // Scenario 3: AI failure
    const res3 = await processTriageReport(
      sampleInput,
      createDeps({
        triageModel: new FakeModel(new Error("AI generation timed out")),
      })
    );
    expect(res3.record.workOrder.status).toBe("draft");
    expect(res3.record.workOrder.status).not.toBe("approved");

    // Scenario 4: Critical safety keyword (Fire)
    const fireInput: IssueReportInput = {
      ...sampleInput,
      issueDescription: "DANGER: Active fire and smoke leaking from motor housing!",
    };
    const res4 = await processTriageReport(fireInput, createDeps());
    expect(res4.record.ruleFloorPriority).toBe("critical");
    expect(res4.record.workOrder.status).toBe("draft");
    expect(res4.record.workOrder.status).not.toBe("approved");
  });

  // =========================================================================
  // 5. INPUT VALIDATION ERRORS
  // =========================================================================
  it("rejects invalid issue report payload with ValidationError", async () => {
    const invalidPayload = {
      equipmentType: "centrifugal_pump",
      // missing equipmentId
      issueDescription: "too short", // less than 10 characters
    };

    await expect(
      processTriageReport(invalidPayload, createDeps())
    ).rejects.toThrowError(ValidationError);
  });

  // =========================================================================
  // 6. IN-MEMORY RATE LIMITER
  // =========================================================================
  describe("Rate Limiter (rateLimiter.ts)", () => {
    it("allows up to 10 requests per minute and rejects the 11th", () => {
      const ip = "192.168.1.50";

      // Requests 1 to 10 must succeed
      for (let i = 1; i <= 10; i++) {
        const check = checkRateLimit(ip, 10, 60000);
        expect(check.allowed).toBe(true);
        expect(check.remaining).toBe(10 - i);
      }

      // 11th request must be rejected
      const rejectedCheck = checkRateLimit(ip, 10, 60000);
      expect(rejectedCheck.allowed).toBe(false);
      expect(rejectedCheck.remaining).toBe(0);

      // Reset works
      resetRateLimiter();
      const afterReset = checkRateLimit(ip, 10, 60000);
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(9);
    });
  });

  // =========================================================================
  // 7. DEDICATED RESILIENCE & FAILURE PATH TESTS
  // =========================================================================
  describe("Dedicated Resilience & Failure Paths", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    // 1. Dev toggle DEBUG_FAIL=retrieval
    it("DEBUG_FAIL=retrieval triggers simulated retrieval failure in dev, but is disabled in production", async () => {
      // In dev mode:
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      process.env.DEBUG_FAIL = "retrieval";

      const resDev = await processTriageReport(sampleInput, createDeps());
      expect(resDev.status.retrieval).toBe("failed");
      expect(resDev.status.ai).toBe("skipped_no_context");
      expect(resDev.record.retrieval?.error).toContain("DEBUG_FAIL=retrieval");
      expect(resDev.record.workOrder.status).toBe("draft");

      // In production mode:
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.DEBUG_FAIL = "retrieval";
      const resProd = await processTriageReport(sampleInput, createDeps());
      expect(resProd.status.retrieval).toBe("ok");
      expect(resProd.status.ai).toBe("ok");
    });

    // 2. Dev toggle DEBUG_FAIL=ai
    it("DEBUG_FAIL=ai triggers simulated AI failure in dev, but is disabled in production", async () => {
      // In dev mode:
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      process.env.DEBUG_FAIL = "ai";

      const resDev = await processTriageReport(sampleInput, createDeps());
      expect(resDev.status.rules).toBe("ok");
      expect(resDev.status.retrieval).toBe("ok");
      expect(resDev.status.ai).toBe("failed");
      expect(resDev.record.ai?.errorSubtype).toBe("unavailable");
      expect(resDev.record.finalPriority).toBe("high");

      // In production mode:
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.DEBUG_FAIL = "ai";
      const resProd = await processTriageReport(sampleInput, createDeps());
      expect(resProd.status.ai).toBe("ok");
    });

    // 3. Dev toggle DEBUG_FAIL=db
    it("DEBUG_FAIL=db triggers simulated database failure in dev, but is disabled in production", async () => {
      // In dev mode:
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      process.env.DEBUG_FAIL = "db";

      await expect(processTriageReport(sampleInput, createDeps())).rejects.toThrowError(
        DatabaseError
      );

      // In production mode:
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.DEBUG_FAIL = "db";
      const resProd = await processTriageReport(sampleInput, createDeps());
      expect(resProd.record.workOrder.status).toBe("draft");
    });

    // 4. Retrieval returns zero chunks
    it("retrieval returning zero chunks saves record, skips AI, and preserves rule findings", async () => {
      const deps = createDeps({
        retrieveContextFn: async () => ({
          chunks: [],
          method: "vector",
          warnings: ["No chunks met similarity threshold"],
          queryUsed: "bearing noise",
        }),
      });

      const res = await processTriageReport(sampleInput, deps);
      expect(res.status.rules).toBe("ok");
      expect(res.status.retrieval).toBe("ok");
      expect(res.status.ai).toBe("skipped_no_context");
      expect(res.record.retrievedChunkIds).toEqual([]);
      expect(res.record.ruleFindings.length).toBeGreaterThan(0);
      expect(res.record.finalPriority).toBe(res.record.ruleFloorPriority);
      expect(res.record.workOrder.title).toContain("Manual Triage Required");
    });

    // 5. Gemini 429, 503, timeout, blocked, malformed JSON mapping
    it.each([
      {
        name: "429 rate limit",
        error: new AiError("Rate limit exceeded 429", { subtype: "rate_limit" }),
        expectedSubtype: "rate_limit",
      },
      {
        name: "503 service unavailable",
        error: new AiError("Service 503 unavailable", { subtype: "unavailable" }),
        expectedSubtype: "unavailable",
      },
      {
        name: "timeout",
        error: new AiError("Operation timed out after 20000ms", { subtype: "timeout" }),
        expectedSubtype: "timeout",
      },
      {
        name: "blocked content",
        error: new AiError("Prompt blocked by safety filters", { subtype: "blocked" }),
        expectedSubtype: "blocked",
      },
      {
        name: "malformed JSON",
        error: new AiError("AI produced unparseable JSON", { subtype: "invalid_output" }),
        expectedSubtype: "invalid_output",
      },
    ])(
      "maps Gemini failure: $name to expected subtype and preserves safety floor",
      async ({ error, expectedSubtype }) => {
        const deps = createDeps({
          triageModel: new FakeModel(error),
        });

        const res = await processTriageReport(sampleInput, deps);
        expect(res.status.ai).toBe("failed");
        expect(res.record.ai?.errorSubtype).toBe(expectedSubtype);
        expect(res.record.finalPriority).toBe(res.record.ruleFloorPriority);
        expect(res.record.workOrder.status).toBe("draft");
      }
    );

    // 6. Citation validation drops ungrounded items and enriches uncertainty notes
    it("citation validation drops ungrounded items and records how many and why", async () => {
      const outputWithHallucinations: AiTriageOutput = {
        ...sampleAiOutput,
        possibleCauses: [
          // Valid hypothesis
          {
            hypothesis: "Valid bearing fault hypothesis",
            likelihood: "high",
            citations: [{ type: "kb", chunkId: "pump-m1-bearing-wear" }],
          },
          // Hallucinated hypothesis pointing to fake chunk
          {
            hypothesis: "Hallucinated seal crack hypothesis",
            likelihood: "medium",
            citations: [{ type: "kb", chunkId: "fake-chunk-999" }],
          },
        ],
        followUpQuestions: [
          // Question with invalid event index
          {
            question: "Did the shift supervisor check the seal at 08:00?",
            whyItMatters: "Verifies event timing",
            citations: [{ type: "event", eventIndex: 99 }],
          },
        ],
      };

      const deps = createDeps({
        triageModel: new FakeModel(JSON.stringify(outputWithHallucinations)),
      });

      const res = await processTriageReport(sampleInput, deps);
      expect(res.status.ai).toBe("ok");

      // Verify that hallucinated items were dropped
      const causes = res.record.aiTriage?.possibleCauses || [];
      expect(causes).toHaveLength(1);
      expect(causes[0].hypothesis).toBe("Valid bearing fault hypothesis");

      const questions = res.record.aiTriage?.followUpQuestions || [];
      expect(questions).toHaveLength(0);

      // Verify droppedSuggestions metadata
      const dropped = (res.record.ai?.droppedSuggestions as Array<{ category: string; reason: string }>) || [];
      expect(dropped.length).toBe(2);
      expect(dropped[0].category).toBe("possibleCause");
      expect(dropped[0].reason).toContain("citations");
      expect(dropped[1].category).toBe("followUpQuestion");

      // Verify uncertainty notes mention dropped items
      const notes = res.record.aiTriage?.uncertaintyNotes || [];
      expect(
        notes.some((n) =>
          n.includes("removed because they lacked verifiable source citations")
        )
      ).toBe(true);
    });

    // 7. Missing and conflicting sensors surface in data quality flags and AI uncertainty notes
    it("missing and conflicting sensors surface in data quality flags and AI uncertainty notes", async () => {
      const inputWithConflictsAndMissing: IssueReportInput = {
        ...sampleInput,
        sensorReadings: [
          { key: "bearing_temp_c", value: 78, unit: "celsius" },
          { key: "vibration_rms_mms", value: 3.5, unit: "mm/s" },
          { key: "vibration_rms_mms", value: 8.9, unit: "mm/s" }, // Conflict!
        ],
      };

      const deps = createDeps();
      const res = await processTriageReport(inputWithConflictsAndMissing, deps);

      // Data quality flags include missing and conflict
      const flagTypes = res.record.dataQualityFlags.map((f) => f.type);
      expect(flagTypes).toContain("missing");
      expect(flagTypes).toContain("conflict");

      // Uncertainty notes contain explicit alerts for missing and conflict
      const notes = res.record.aiTriage?.uncertaintyNotes || [];
      expect(
        notes.some(
          (n) => n.includes("Data Quality Alert (missing)") || n.includes("missing")
        )
      ).toBe(true);
      expect(
        notes.some(
          (n) => n.includes("Data Quality Alert (conflict)") || n.includes("conflict")
        )
      ).toBe(true);
    });
  });
});
