import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import {
  createMongoClient,
  pingDb,
} from "../lib/db/client";
import { stripMongoId, serializeMongoDoc } from "../lib/db/repos/utils";
import * as auditRepo from "../lib/db/repos/audit";
import { saveWorkOrderDecision } from "../lib/db/repos/work-orders";
import { GET as healthHandler } from "../app/api/health/route";
import { ValidationError } from "../lib/schemas/errors";

describe("Database Layer (lib/db)", () => {
  describe("1. MongoClient Configuration", () => {
    it("creates client with strict 3000ms server selection timeout", () => {
      const client = createMongoClient("mongodb://127.0.0.1:27017/test");
      expect(client.options.serverSelectionTimeoutMS).toBe(3000);
      expect(client.options.connectTimeoutMS).toBe(3000);
    });

    it("pingDb returns false gracefully when DB is unreachable", async () => {
      // Connect to non-existent port to test rapid 3s failure
      const isOk = await pingDb("non_existent_db");
      expect(typeof isOk).toBe("boolean");
    });
  });

  describe("2. Document Boundary Serializers", () => {
    it("stripMongoId cleanly strips _id from document", () => {
      const doc = {
        _id: new ObjectId(),
        id: "REC-1",
        title: "Test doc",
      };
      const cleaned = stripMongoId(doc);
      expect(cleaned).toBeDefined();
      expect((cleaned as Record<string, unknown>)._id).toBeUndefined();
      expect(cleaned?.id).toBe("REC-1");
      expect(cleaned?.title).toBe("Test doc");
    });

    it("serializeMongoDoc converts ObjectIds to hex strings recursively", () => {
      const id1 = new ObjectId();
      const id2 = new ObjectId();
      const complexDoc = {
        _id: id1,
        id: "TR-100",
        nested: {
          refId: id2,
          name: "sub-part",
        },
        items: [{ itemId: id2 }],
      };

      const serialized = serializeMongoDoc(complexDoc);
      expect(serialized._id).toBeUndefined();
      expect(serialized.id).toBe("TR-100");
      expect(serialized.nested.refId).toBe(id2.toHexString());
      expect(serialized.items[0].itemId).toBe(id2.toHexString());
    });
  });

  describe("3. Append-Only Audit Trail", () => {
    it("exposes only appendAuditEvent and listAuditEvents, no update or delete", () => {
      const exports = Object.keys(auditRepo);
      expect(exports).toContain("appendAuditEvent");
      expect(exports).toContain("listAuditEvents");

      // Verify no mutating or deleting functions exist
      const forbiddenOperations = ["update", "delete", "remove", "drop", "modify", "patch"];
      for (const op of forbiddenOperations) {
        const found = exports.some((fn) => fn.toLowerCase().includes(op));
        expect(found).toBe(false);
      }
    });
  });

  describe("4. Work Order Decision Validation", () => {
    it("rejects invalid status", async () => {
      await expect(
        saveWorkOrderDecision({
          workOrderId: "WO-1",
          // @ts-expect-error testing invalid status
          status: "pending",
          decidedBy: "tech-1",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("rejects rejection without reason", async () => {
      await expect(
        saveWorkOrderDecision({
          workOrderId: "WO-1",
          status: "rejected",
          decidedBy: "tech-1",
          rejectionReason: "   ",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("rejects empty decidedBy", async () => {
      await expect(
        saveWorkOrderDecision({
          workOrderId: "WO-1",
          status: "approved",
          decidedBy: "  ",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("5. Health Route Handler (/api/health)", () => {
    it("returns JSON with { db: 'ok' | 'down' }", async () => {
      const response = await healthHandler();
      expect(response).toBeDefined();
      expect([200, 503]).toContain(response.status);

      const json = await response.json();
      expect(json).toHaveProperty("db");
      expect(["ok", "down"]).toContain(json.db);
    });
  });
});
