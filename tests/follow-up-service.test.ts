import { beforeEach, describe, expect, it, vi } from "vitest";
import { TriageRecordSchema } from "../lib/schemas/triage-record";

const mocks = vi.hoisted(() => ({
  getTriageRecordsCollection: vi.fn(),
  getWorkOrdersCollection: vi.fn(),
  appendAuditEvent: vi.fn(),
  retrieveContext: vi.fn(),
  generateTriage: vi.fn(),
}));

vi.mock("../lib/db/collections", () => ({
  getTriageRecordsCollection: mocks.getTriageRecordsCollection,
  getWorkOrdersCollection: mocks.getWorkOrdersCollection,
}));
vi.mock("../lib/db/repos/audit", () => ({
  appendAuditEvent: mocks.appendAuditEvent,
}));
vi.mock("../lib/rag/retrieve", () => ({
  retrieveContext: mocks.retrieveContext,
}));
vi.mock("../lib/ai/triage", () => ({
  generateTriage: mocks.generateTriage,
}));

import { submitFollowUpAnswers } from "../lib/services/followUpService";

const now = "2026-10-06T09:00:00.000Z";
const record = TriageRecordSchema.parse({
  id: "triage_test",
  issueReport: {
    equipmentType: "centrifugal_pump",
    equipmentId: "PUMP-101",
    issueDescription: "Persistent seal leakage with unusual casing vibration.",
    recentEvents: [{ description: "none reported" }],
    reportedBy: "Reporter One",
    reportedByUserId: "reporter-1",
  },
  ruleFindings: [],
  ruleFloorPriority: "high",
  dataQualityFlags: [],
  retrievedChunkIds: ["manual-1"],
  aiTriage: {
    observations: [],
    possibleCauses: [],
    followUpQuestions: [
      {
        question: "Did the leakage increase suddenly?",
        whyItMatters: "The timing can help distinguish an abrupt seal failure.",
        citations: [],
      },
    ],
    inspectionSteps: [],
    suggestedPriority: "medium",
    priorityRationale: { text: "Review required.", citations: [] },
    draftWorkOrder: {
      title: "Inspect seal",
      description: "Inspect the reported leakage.",
      recommendedActions: ["Inspect seal housing"],
      partsToCheck: ["Mechanical seal"],
    },
    uncertaintyNotes: [],
  },
  finalPriority: "high",
  workOrder: {
    id: "wo_test",
    triageRecordId: "triage_test",
    status: "draft",
    title: "Inspect seal",
    description: "Inspect the reported leakage.",
    finalPriority: "high",
    recommendedActions: ["Inspect seal housing"],
    partsToCheck: ["Mechanical seal"],
    createdAt: now,
    updatedAt: now,
  },
  createdAt: now,
  updatedAt: now,
});

const refreshedOutput = {
  ...record.aiTriage!,
  suggestedPriority: "low" as const,
  draftWorkOrder: {
    title: "Updated seal inspection",
    description: "Reassess the seal with the reported timing.",
    recommendedActions: ["Inspect seal housing and verify leakage trend"],
    partsToCheck: ["Mechanical seal"],
  },
};

describe("follow-up answer workflow", () => {
  const updateOne = vi.fn();
  const triageCollection = { findOne: vi.fn(), updateOne };
  const workOrderUpdateOne = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    triageCollection.findOne.mockResolvedValue(record);
    updateOne.mockResolvedValue({ matchedCount: 1 });
    workOrderUpdateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.getTriageRecordsCollection.mockResolvedValue(triageCollection);
    mocks.getWorkOrdersCollection.mockResolvedValue({ updateOne: workOrderUpdateOne });
    mocks.appendAuditEvent.mockResolvedValue(undefined);
    mocks.retrieveContext.mockResolvedValue({
      chunks: [{ chunkId: "manual-1" }],
      method: "text",
      warnings: [],
      queryUsed: "seal leakage",
    });
    mocks.generateTriage.mockResolvedValue({
      triage: refreshedOutput,
      droppedSuggestions: [],
    });
  });

  it("accepts the report owner’s answer and refreshes suggestions without lowering the rule floor", async () => {
    const result = await submitFollowUpAnswers(
      record.id,
      [{ questionIndex: 0, answer: "It increased gradually over the last shift." }],
      {
        id: "reporter-1",
        name: "Reporter One",
        email: "reporter@example.com",
        role: "reporter",
      }
    );

    expect(result.aiRefreshed).toBe(true);
    expect(result.record.followUpAnswers[0]).toMatchObject({
      answer: "It increased gradually over the last shift.",
      answeredBy: "Reporter One",
      answeredByRole: "reporter",
    });
    expect(result.record.issueReport.recentEvents.at(-1)?.description).toContain(
      "Human follow-up answer"
    );
    expect(result.record.finalPriority).toBe("high");
    expect(result.record.workOrder.status).toBe("draft");
    expect(result.record.workOrder.title).toBe("Updated seal inspection");
    expect(mocks.generateTriage).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          recentEvents: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining("It increased gradually"),
            }),
          ]),
        }),
      })
    );
  });

  it("denies a reporter who does not own the report", async () => {
    await expect(
      submitFollowUpAnswers(
        record.id,
        [{ questionIndex: 0, answer: "Not my report." }],
        {
          id: "reporter-2",
          name: "Reporter Two",
          email: "other@example.com",
          role: "reporter",
        }
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mocks.retrieveContext).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });
});
