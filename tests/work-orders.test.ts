import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, POST as rootPostHandler, GET as rootGetHandler } from "../app/api/work-orders/[id]/route";
import { POST as approveHandler } from "../app/api/work-orders/[id]/approve/route";
import { POST as rejectHandler } from "../app/api/work-orders/[id]/reject/route";
import * as collections from "../lib/db/collections";

type MockDocument = Record<string, unknown> & { id: string };
type MockAuditEvent = {
  type: string;
  after?: Record<string, unknown>;
};
type MockUpdate = {
  $set?: Record<string, unknown>;
  $push?: {
    auditTrail?: MockAuditEvent | { $each: MockAuditEvent[] };
  };
};

vi.mock("../lib/auth/authorization", () => ({
  authorizeRequest: vi.fn(async (_request: unknown, roles?: string[]) => {
    if (roles && !roles.includes("technician")) {
      return {
        authorized: false,
        response: Response.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    return {
      authorized: true,
      session: {
        id: "test-technician-id",
        name: "Test Technician",
        email: "technician@example.test",
        role: "technician",
      },
    };
  }),
}));

describe("Work Orders API & State Machine (/api/work-orders/[id])", () => {
  let mockWorkOrderDoc: MockDocument;
  let mockTriageRecordDoc: MockDocument & { auditTrail: MockAuditEvent[] };
  let loggedAuditEvents: MockAuditEvent[] = [];

  const mockWorkOrderColl = {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  };

  const mockTriageColl = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  };

  const mockAuditColl = {
    insertOne: vi.fn(),
  };

  beforeEach(() => {
    loggedAuditEvents = [];

    mockWorkOrderDoc = {
      _id: "mongo_wo_1",
      id: "WO-TEST-1",
      triageRecordId: "TR-TEST-1",
      status: "draft",
      title: "Initial AI Work Order Title",
      description: "Initial AI Work Order Description",
      finalPriority: "high",
      recommendedActions: ["Check mechanical seal", "Inspect cooling loop"],
      partsToCheck: ["Mechanical seal", "Impeller"],
      confirmedFindings: [],
      createdAt: "2026-10-05T12:00:00.000Z",
      updatedAt: "2026-10-05T12:00:00.000Z",
    };

    mockTriageRecordDoc = {
      _id: "mongo_tr_1",
      id: "TR-TEST-1",
      ruleFloorPriority: "high",
      finalPriority: "high",
      confirmedFindings: [],
      auditTrail: [],
      workOrder: { ...mockWorkOrderDoc },
    };

    mockWorkOrderColl.findOne.mockImplementation(async ({ id }: { id: string }) => {
      if (id === mockWorkOrderDoc.id) return { ...mockWorkOrderDoc };
      return null;
    });

    mockWorkOrderColl.findOneAndUpdate.mockImplementation(
      async (
        { id }: { id: string },
        { $set }: { $set: Record<string, unknown> }
      ) => {
        if (id === mockWorkOrderDoc.id) {
          mockWorkOrderDoc = { ...mockWorkOrderDoc, ...$set };
          return { ...mockWorkOrderDoc };
        }
        return null;
      }
    );

    mockTriageColl.findOne.mockImplementation(async ({ id }: { id: string }) => {
      if (id === mockTriageRecordDoc.id) return { ...mockTriageRecordDoc };
      return null;
    });

    mockTriageColl.updateOne.mockImplementation(
      async ({ id }: { id: string }, update: MockUpdate) => {
        if (id === mockTriageRecordDoc.id) {
          if (update.$set) {
            mockTriageRecordDoc = {
              ...mockTriageRecordDoc,
              ...update.$set,
              auditTrail: mockTriageRecordDoc.auditTrail,
            };
          }
          if (update.$push?.auditTrail) {
            if ("$each" in update.$push.auditTrail) {
              mockTriageRecordDoc.auditTrail.push(
                ...update.$push.auditTrail.$each
              );
            } else {
              mockTriageRecordDoc.auditTrail.push(update.$push.auditTrail);
            }
          }
          return { modifiedCount: 1 };
        }
        return { modifiedCount: 0 };
      }
    );

    mockAuditColl.insertOne.mockImplementation(async (doc: MockAuditEvent) => {
      loggedAuditEvents.push(doc);
      return { insertedId: { toHexString: () => `audit_${loggedAuditEvents.length}` } };
    });

    vi.spyOn(collections, "getWorkOrdersCollection").mockResolvedValue(
      mockWorkOrderColl as unknown as Awaited<
        ReturnType<typeof collections.getWorkOrdersCollection>
      >
    );
    vi.spyOn(collections, "getTriageRecordsCollection").mockResolvedValue(
      mockTriageColl as unknown as Awaited<
        ReturnType<typeof collections.getTriageRecordsCollection>
      >
    );
    vi.spyOn(collections, "getAuditEventsCollection").mockResolvedValue(
      mockAuditColl as unknown as Awaited<
        ReturnType<typeof collections.getAuditEventsCollection>
      >
    );
  });

  // -------------------------------------------------------------------------
  // 1. GET WORK ORDER
  // -------------------------------------------------------------------------
  describe("GET /api/work-orders/[id]", () => {
    it("returns work order and matching record", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1");
      const res = await rootGetHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.workOrder.id).toBe("WO-TEST-1");
      expect(body.workOrder._id).toBeUndefined();
    });

    it("returns 404 for unknown work order", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/UNKNOWN");
      const res = await rootGetHandler(req, {
        params: Promise.resolve({ id: "UNKNOWN" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // 2. PATCH /api/work-orders/[id] (Edits & Audit Events)
  // -------------------------------------------------------------------------
  describe("PATCH /api/work-orders/[id]", () => {
    it("updates work order fields and preserves immutable aiOriginal snapshot", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1", {
        method: "PATCH",
        body: JSON.stringify({
          title: "Technician Custom Title",
          description: "Technician Custom Description",
          technicianName: "Tech Dave",
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workOrder.title).toBe("Technician Custom Title");
      expect(body.workOrder.aiOriginal).toBeDefined();
      expect(body.workOrder.aiOriginal.title).toBe("Initial AI Work Order Title");

      // Verify audit events logged
      const fieldEditedEvents = loggedAuditEvents.filter(
        (e) => e.type === "field_edited"
      );
      expect(fieldEditedEvents.length).toBeGreaterThanOrEqual(2);
      expect(fieldEditedEvents.some((e) => e.after?.field === "title")).toBe(true);
      expect(fieldEditedEvents.some((e) => e.after?.field === "description")).toBe(true);
    });

    it("logs priority_changed audit event when priority is edited", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1", {
        method: "PATCH",
        body: JSON.stringify({
          finalPriority: "critical",
          technicianName: "Lead Tech",
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(200);
      expect(
        loggedAuditEvents.some(
          (e) => e.type === "priority_changed" && e.after?.priority === "critical"
        )
      ).toBe(true);
    });

    it("logs step_completed and question_answered audit events", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1", {
        method: "PATCH",
        body: JSON.stringify({
          stepCompletion: {
            stepNumber: 1,
            stepText: "Check casing temperature",
            completed: true,
          },
          questionAnswer: {
            questionIndex: 0,
            questionText: "Is seal dripping continuously?",
            answer: "Yes, approx 40 drops/min",
          },
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(200);
      expect(loggedAuditEvents.some((e) => e.type === "step_completed")).toBe(true);
      expect(loggedAuditEvents.some((e) => e.type === "question_answered")).toBe(true);
    });

    it("RULE 4: rejects confirmed findings originating from an AI source", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1", {
        method: "PATCH",
        body: JSON.stringify({
          newFinding: {
            text: "AI generated finding",
            recordedBy: "ai",
            recordedAt: new Date().toISOString(),
          },
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(JSON.stringify(body)).toContain("technician");
    });

    it("accepts confirmed finding recorded by human technician and logs finding_added", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1", {
        method: "PATCH",
        body: JSON.stringify({
          newFinding: {
            text: "Mechanical seal face carbon ring cracked",
            recordedBy: "Technician Alice",
            recordedAt: new Date().toISOString(),
          },
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(200);
      expect(loggedAuditEvents.some((e) => e.type === "finding_added")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. POST /api/work-orders/[id]/approve (Rule 1 & Rule 2)
  // -------------------------------------------------------------------------
  describe("POST /api/work-orders/[id]/approve", () => {
    it("RULE 1: requires technician name", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1/approve", {
        method: "POST",
        body: JSON.stringify({
          technicianName: "   ",
        }),
      });

      const res = await approveHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(400);
    });

    it("RULE 1: requires justification if priority < ruleFloor", async () => {
      // ruleFloor is 'high'. Attempting to approve with 'low' priority without justification
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1/approve", {
        method: "POST",
        body: JSON.stringify({
          technicianName: "Technician Dave",
          finalPriority: "low",
          justification: "", // empty justification!
        }),
      });

      const res = await approveHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("justification string is required");
    });

    it("successfully approves when final priority >= ruleFloor", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1/approve", {
        method: "POST",
        body: JSON.stringify({
          technicianName: "Technician Dave Miller",
          finalPriority: "high", // equal to ruleFloor
        }),
      });

      const res = await approveHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workOrder.status).toBe("approved");
      expect(body.workOrder.approvedBy).toBe("Test Technician");
      expect(loggedAuditEvents.some((e) => e.type === "approved")).toBe(true);
    });

    it("successfully approves with downgraded priority if valid justification is provided", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1/approve", {
        method: "POST",
        body: JSON.stringify({
          technicianName: "Technician Dave Miller",
          finalPriority: "medium", // below rule floor 'high'
          justification: "Sensor calibrated and inspected; reading was a transient baseline blip.",
        }),
      });

      const res = await approveHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workOrder.status).toBe("approved");
      expect(body.workOrder.finalPriority).toBe("medium");
    });
  });

  // -------------------------------------------------------------------------
  // 4. POST /api/work-orders/[id]/reject
  // -------------------------------------------------------------------------
  describe("POST /api/work-orders/[id]/reject", () => {
    it("requires rejection reason", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1/reject", {
        method: "POST",
        body: JSON.stringify({
          technicianName: "Tech Dave",
          rejectionReason: "",
        }),
      });

      const res = await rejectHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(400);
    });

    it("successfully rejects work order and logs rejected event", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1/reject", {
        method: "POST",
        body: JSON.stringify({
          technicianName: "Technician Dave",
          rejectionReason: "Equipment already serviced in previous shift; false positive.",
        }),
      });

      const res = await rejectHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workOrder.status).toBe("rejected");
      expect(body.workOrder.rejectionReason).toContain("false positive");
      expect(loggedAuditEvents.some((e) => e.type === "rejected")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. RULE 2: STATE MACHINE - 409 CONFLICT ON FINALIZED WORK ORDERS
  // -------------------------------------------------------------------------
  describe("RULE 2: Server-side State Machine (draft -> approved / rejected)", () => {
    it("returns 409 Conflict when attempting to edit an approved work order", async () => {
      mockWorkOrderDoc.status = "approved";

      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1", {
        method: "PATCH",
        body: JSON.stringify({
          title: "New Illegal Title",
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain("already approved");
    });

    it("returns 409 Conflict when attempting to approve an already approved work order", async () => {
      mockWorkOrderDoc.status = "approved";

      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1/approve", {
        method: "POST",
        body: JSON.stringify({
          technicianName: "Tech Dave",
        }),
      });

      const res = await approveHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain("status is already 'approved'");
    });

    it("returns 409 Conflict when attempting to reject an already rejected work order", async () => {
      mockWorkOrderDoc.status = "rejected";

      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1/reject", {
        method: "POST",
        body: JSON.stringify({
          technicianName: "Tech Dave",
          rejectionReason: "Some reason",
        }),
      });

      const res = await rejectHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain("status is already 'rejected'");
    });

    it("supports root POST /api/work-orders/[id] delegation for approve/reject", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-orders/WO-TEST-1", {
        method: "POST",
        body: JSON.stringify({
          action: "approve",
          technicianName: "Tech Master",
        }),
      });

      const res = await rootPostHandler(req, {
        params: Promise.resolve({ id: "WO-TEST-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workOrder.status).toBe("approved");
    });
  });
});
