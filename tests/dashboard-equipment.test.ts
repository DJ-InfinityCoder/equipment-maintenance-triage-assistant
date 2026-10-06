import { describe, it, expect, vi } from "vitest";
import {
  computeRecurrenceIndicator,
  getEquipmentHistory,
} from "../lib/db/repos/equipment";
import {
  getDashboardSummaryStats,
} from "../lib/db/repos/triage";
import * as collections from "../lib/db/collections";
import { TriageRecord } from "../lib/schemas";

describe("Dashboard & Equipment Repositories", () => {
  describe("computeRecurrenceIndicator", () => {
    it("detects recurrence when cause keyword appears across confirmed findings", () => {
      const now = new Date();
      const mockRecords: Partial<TriageRecord>[] = [
        {
          id: "tr-1",
          createdAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString(),
          confirmedFindings: [
            {
              text: "Severe mechanical seal face erosion and fluid weepage",
              recordedBy: "Tech Alice",
              recordedAt: now.toISOString(),
            },
          ],
        },
        {
          id: "tr-2",
          createdAt: new Date(now.getTime() - 20 * 24 * 3600 * 1000).toISOString(),
          confirmedFindings: [
            {
              text: "Seal gland flush line clogged with particulates",
              recordedBy: "Tech Bob",
              recordedAt: now.toISOString(),
            },
          ],
        },
        {
          id: "tr-3",
          createdAt: new Date(now.getTime() - 40 * 24 * 3600 * 1000).toISOString(),
          confirmedFindings: [
            {
              text: "Replaced degraded primary seal elastomer O-ring",
              recordedBy: "Tech Charlie",
              recordedAt: now.toISOString(),
            },
          ],
        },
      ];

      const result = computeRecurrenceIndicator(mockRecords as TriageRecord[], 90);

      expect(result.hasRecurrence).toBe(true);
      expect(result.keyword).toBe("seal");
      expect(result.count).toBe(3);
      expect(result.days).toBe(90);
      expect(result.message).toContain("Seal-related fault reported 3 times in 90 days");
      expect(result.matchingFindings.length).toBe(3);
    });

    it("does NOT count AI hypotheses or suggestions - strictly confirmed findings", () => {
      const now = new Date();
      // Record with AI suggestions containing 'vibration' but confirmed findings do NOT repeat
      const mockRecords: Partial<TriageRecord>[] = [
        {
          id: "tr-1",
          createdAt: now.toISOString(),
          aiTriage: {
            observations: [],
            possibleCauses: [
              {
                hypothesis: "Extreme shaft vibration imbalance",
                likelihood: "high",
                citations: [],
              },
            ],
            followUpQuestions: [],
            inspectionSteps: [],
            suggestedPriority: "critical",
            priorityRationale: {
              text: "AI reasoned vibration",
              citations: [],
            },
            draftWorkOrder: {
              title: "AI draft",
              description: "AI description",
              recommendedActions: [],
              partsToCheck: [],
            },
            uncertaintyNotes: [],
          },
          // Only 1 confirmed finding with vibration
          confirmedFindings: [
            {
              text: "Vibration measured slightly elevated at 4.2 mm/s",
              recordedBy: "Tech Dave",
              recordedAt: now.toISOString(),
            },
          ],
        },
        {
          id: "tr-2",
          createdAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
          aiTriage: {
            observations: [],
            possibleCauses: [
              {
                hypothesis: "Vibration resonance in bearing housing",
                likelihood: "high",
                citations: [],
              },
            ],
            followUpQuestions: [],
            inspectionSteps: [],
            suggestedPriority: "high",
            priorityRationale: {
              text: "AI reasoned vibration",
              citations: [],
            },
            draftWorkOrder: {
              title: "AI draft 2",
              description: "AI description 2",
              recommendedActions: [],
              partsToCheck: [],
            },
            uncertaintyNotes: [],
          },
          // Confirmed finding was for electrical terminal loose, NOT vibration
          confirmedFindings: [
            {
              text: "Loose terminal lug on junction box",
              recordedBy: "Tech Dave",
              recordedAt: now.toISOString(),
            },
          ],
        },
      ];

      const result = computeRecurrenceIndicator(mockRecords as TriageRecord[], 90);

      // Vibration only appeared once in confirmed findings, so no recurrence!
      expect(result.hasRecurrence).toBe(false);
      expect(result.count).toBe(0);
      expect(result.message).toContain("No recurring faults detected");
    });

    it("filters out confirmed findings older than specified window (e.g. 90 days)", () => {
      const now = new Date();
      const mockRecords: Partial<TriageRecord>[] = [
        {
          id: "tr-recent",
          createdAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
          confirmedFindings: [
            {
              text: "Bearing cage wear detected",
              recordedBy: "Tech Alice",
              recordedAt: now.toISOString(),
            },
          ],
        },
        {
          id: "tr-old",
          // 120 days ago (outside 90 day window)
          createdAt: new Date(now.getTime() - 120 * 24 * 3600 * 1000).toISOString(),
          confirmedFindings: [
            {
              text: "Bearing replaced due to spalling",
              recordedBy: "Tech Bob",
              recordedAt: now.toISOString(),
            },
          ],
        },
      ];

      const result = computeRecurrenceIndicator(mockRecords as TriageRecord[], 90);
      expect(result.hasRecurrence).toBe(false);
    });
  });

  describe("getDashboardSummaryStats", () => {
    it("computes counts for open drafts, critical open, failed AI runs, and approved this week", async () => {
      const mockColl = {
        countDocuments: vi.fn(),
      };

      mockColl.countDocuments
        .mockResolvedValueOnce(5)  // openDrafts
        .mockResolvedValueOnce(2)  // criticalOpen
        .mockResolvedValueOnce(1)  // failedAiRuns
        .mockResolvedValueOnce(8); // approvedThisWeek

      vi.spyOn(collections, "getTriageRecordsCollection").mockResolvedValue(
        mockColl as unknown as Awaited<
          ReturnType<typeof collections.getTriageRecordsCollection>
        >
      );

      const stats = await getDashboardSummaryStats();

      expect(stats.openDrafts).toBe(5);
      expect(stats.criticalOpen).toBe(2);
      expect(stats.failedAiRuns).toBe(1);
      expect(stats.approvedThisWeek).toBe(8);
      expect(mockColl.countDocuments).toHaveBeenCalledTimes(4);
    });
  });

  describe("getEquipmentHistory", () => {
    it("retrieves equipment doc, triage records, and recurrence insight", async () => {
      const mockEquipColl = {
        findOne: vi.fn().mockResolvedValue({
          equipmentId: "PUMP-201",
          equipmentType: "centrifugal_pump",
          issueCount: 4,
          lastIssueAt: "2026-10-05T10:00:00Z",
        }),
      };

      const mockTriageColl = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue([
                {
                  id: "TR-1",
                  issueReport: { equipmentId: "PUMP-201", equipmentType: "centrifugal_pump" },
                  createdAt: new Date().toISOString(),
                  confirmedFindings: [
                    { text: "Impeller vane chipped", recordedBy: "Tech 1", recordedAt: new Date().toISOString() },
                    { text: "Impeller balance check out of spec", recordedBy: "Tech 2", recordedAt: new Date().toISOString() },
                  ],
                },
              ]),
            }),
          }),
        }),
      };

      const mockWorkOrderColl = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      vi.spyOn(collections, "getEquipmentCollection").mockResolvedValue(
        mockEquipColl as unknown as Awaited<
          ReturnType<typeof collections.getEquipmentCollection>
        >
      );
      vi.spyOn(collections, "getTriageRecordsCollection").mockResolvedValue(
        mockTriageColl as unknown as Awaited<
          ReturnType<typeof collections.getTriageRecordsCollection>
        >
      );
      vi.spyOn(collections, "getWorkOrdersCollection").mockResolvedValue(
        mockWorkOrderColl as unknown as Awaited<
          ReturnType<typeof collections.getWorkOrdersCollection>
        >
      );

      const history = await getEquipmentHistory("PUMP-201");

      expect(history.equipment?.equipmentId).toBe("PUMP-201");
      expect(history.recentTriageRecords.length).toBe(1);
      expect(history.recurrenceInsight.hasRecurrence).toBe(true);
      expect(history.recurrenceInsight.keyword).toBe("impeller");
      expect(history.recurrenceInsight.count).toBe(2);
    });
  });
});
