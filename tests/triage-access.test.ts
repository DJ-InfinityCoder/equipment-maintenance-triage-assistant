import { describe, expect, it } from "vitest";
import { canAccessTriageRecord } from "../lib/auth/triage-access";

describe("triage record access", () => {
  const record = {
    issueReport: { reportedByUserId: "reporter-1" },
  };

  it("allows a reporter to access only their own report", () => {
    expect(
      canAccessTriageRecord(record, { id: "reporter-1", role: "reporter" })
    ).toBe(true);
    expect(
      canAccessTriageRecord(record, { id: "reporter-2", role: "reporter" })
    ).toBe(false);
    expect(
      canAccessTriageRecord(
        { issueReport: {} },
        { id: "reporter-1", role: "reporter" }
      )
    ).toBe(false);
  });

  it("allows technicians to access reports across reporters", () => {
    expect(
      canAccessTriageRecord(record, { id: "technician-1", role: "technician" })
    ).toBe(true);
  });
});
