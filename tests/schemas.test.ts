import { describe, it, expect } from "vitest";
import {
  EquipmentTypeSchema,
  createExtendedEquipmentTypeSchema,
  SensorReadingSchema,
  IssueReportInputSchema,
  RuleFindingSchema,
  DataQualityFlagSchema,
  CitationSchema,
  AiTriageOutputSchema,
  WorkOrderSchema,
  ConfirmedFindingSchema,
  AuditEventSchema,
  TriageRecordSchema,
  FollowUpAnswerSchema,
  FollowUpAnswerSubmissionSchema,
  ValidationError,
  DatabaseError,
  RetrievalError,
  AiError,
  toAppError,
  computeFinalPriority,
} from "../lib/schemas";

describe("Domain Schemas & Validation", () => {
  describe("1. EquipmentType", () => {
    it("accepts all valid base equipment types", () => {
      const types = [
        "centrifugal_pump",
        "air_compressor",
        "hvac_chiller",
        "electric_motor",
        "conveyor",
      ];
      for (const t of types) {
        expect(EquipmentTypeSchema.parse(t)).toBe(t);
      }
    });

    it("rejects unknown equipment types", () => {
      expect(() => EquipmentTypeSchema.parse("diesel_generator")).toThrow();
      expect(() => EquipmentTypeSchema.parse("")).toThrow();
    });

    it("allows seamless extension via createExtendedEquipmentTypeSchema", () => {
      const ExtendedSchema = createExtendedEquipmentTypeSchema([
        "hydraulic_press",
        "steam_boiler",
      ] as const);

      expect(ExtendedSchema.parse("hydraulic_press")).toBe("hydraulic_press");
      expect(ExtendedSchema.parse("centrifugal_pump")).toBe("centrifugal_pump");
      expect(() => ExtendedSchema.parse("unknown")).toThrow();
    });
  });

  describe("2. SensorReading", () => {
    it("parses valid sensor reading with optional ISO timestamp", () => {
      const reading = {
        key: "bearing_temp_c",
        value: 84.5,
        unit: "celsius",
        recordedAt: "2026-10-05T14:30:00.000Z",
      };
      const parsed = SensorReadingSchema.parse(reading);
      expect(parsed.key).toBe("bearing_temp_c");
      expect(parsed.value).toBe(84.5);
    });

    it("rejects non-finite values and empty keys/units", () => {
      expect(() =>
        SensorReadingSchema.parse({ key: "", value: 10, unit: "psi" })
      ).toThrow();
      expect(() =>
        SensorReadingSchema.parse({ key: "pressure", value: NaN, unit: "psi" })
      ).toThrow();
      expect(() =>
        SensorReadingSchema.parse({ key: "pressure", value: Infinity, unit: "psi" })
      ).toThrow();
    });
  });

  describe("3. IssueReportInput", () => {
    it("parses valid issue report input with events and optional sensors", () => {
      const input = {
        equipmentType: "centrifugal_pump",
        equipmentId: "PUMP-042",
        issueDescription: "Loud cavitation rattling heard near impeller housing.",
        recentEvents: [
          {
            description: "Flow rate dropped abruptly at shift change.",
            occurredAt: "2026-10-05T12:00:00.000Z",
          },
        ],
        sensorReadings: [
          {
            key: "discharge_pressure_psi",
            value: 18.2,
            unit: "psi",
          },
        ],
        reportedBy: "tech-operator-4",
      };

      const parsed = IssueReportInputSchema.parse(input);
      expect(parsed.equipmentId).toBe("PUMP-042");
      expect(parsed.sensorReadings?.[0].value).toBe(18.2);
    });

    it("allows recentEvents entry to be 'none reported'", () => {
      const input = {
        equipmentType: "electric_motor",
        equipmentId: "MTR-10",
        issueDescription: "Motor exterior warm to touch during routine patrol.",
        recentEvents: [{ description: "none reported" }],
        reportedBy: "inspector-lee",
      };
      expect(IssueReportInputSchema.parse(input).recentEvents[0].description).toBe(
        "none reported"
      );
    });

    it("caps report event and sensor counts", () => {
      const base = {
        equipmentType: "centrifugal_pump",
        equipmentId: "PUMP-042",
        issueDescription: "Loud cavitation rattling heard near impeller housing.",
        reportedBy: "operator",
      };
      expect(
        IssueReportInputSchema.safeParse({
          ...base,
          recentEvents: Array.from({ length: 21 }, () => ({
            description: "Normal event",
          })),
        }).success
      ).toBe(false);
      expect(
        IssueReportInputSchema.safeParse({
          ...base,
          recentEvents: [{ description: "none reported" }],
          sensorReadings: Array.from({ length: 51 }, () => ({
            key: "pressure",
            value: 30,
            unit: "psi",
          })),
        }).success
      ).toBe(false);
    });

    it("requires timestamps to include a timezone offset", () => {
      const input = {
        equipmentType: "centrifugal_pump",
        equipmentId: "PUMP-042",
        issueDescription: "Loud cavitation rattling near the impeller housing.",
        recentEvents: [
          {
            description: "Demo event",
            occurredAt: "2026-10-05T12:00",
          },
        ],
        reportedBy: "inspector-lee",
      };

      expect(() => IssueReportInputSchema.parse(input)).toThrow();
      expect(
        IssueReportInputSchema.parse({
          ...input,
          recentEvents: [
            {
              ...input.recentEvents[0],
              occurredAt: "2026-10-05T12:00:00.000Z",
            },
          ],
        }).recentEvents[0].occurredAt
      ).toBe("2026-10-05T12:00:00.000Z");
    });

    it("rejects descriptions that are too short (< 10 chars)", () => {
      const input = {
        equipmentType: "conveyor",
        equipmentId: "CNV-1",
        issueDescription: "broken",
        recentEvents: [{ description: "none reported" }],
        reportedBy: "tech-sam",
      };
      expect(() => IssueReportInputSchema.parse(input)).toThrow(
        /at least 10 characters/i
      );
    });

    it("rejects empty recentEvents array", () => {
      const input = {
        equipmentType: "air_compressor",
        equipmentId: "CMP-01",
        issueDescription: "High discharge temperature warning displayed.",
        recentEvents: [],
        reportedBy: "tech-sam",
      };
      expect(() => IssueReportInputSchema.parse(input)).toThrow();
    });
  });

  describe("4. RuleFinding & DataQualityFlag", () => {
    it("parses valid rule finding with threshold and priority floor", () => {
      const finding = {
        ruleId: "RULE-PUMP-OVERTEMP",
        severity: "critical",
        sensorKey: "bearing_temp_c",
        message: "Bearing temperature exceeded maximum threshold of 80C",
        measured: 92.5,
        threshold: 80.0,
        unit: "C",
        priorityFloor: "critical",
      };
      const parsed = RuleFindingSchema.parse(finding);
      expect(parsed.priorityFloor).toBe("critical");
      expect(parsed.severity).toBe("critical");
    });

    it("parses valid data quality flags", () => {
      const flag = {
        type: "stale",
        message: "Vibration telemetry has not updated in over 30 minutes",
        relatedKeys: ["vibration_rms_x", "vibration_rms_y"],
      };
      const parsed = DataQualityFlagSchema.parse(flag);
      expect(parsed.type).toBe("stale");
      expect(parsed.relatedKeys.length).toBe(2);
    });
  });

  describe("5. Citation Discriminated Union", () => {
    it("parses knowledge base citation", () => {
      const citation = {
        type: "kb",
        chunkId: "manual_pump_sec_4",
        quote: "Check seal flushing lines for blockages.",
      };
      const parsed = CitationSchema.parse(citation);
      expect(parsed.type).toBe("kb");
      if (parsed.type === "kb") {
        expect(parsed.chunkId).toBe("manual_pump_sec_4");
      }
    });

    it("parses operating event citation", () => {
      const citation = { type: "event", eventIndex: 0 };
      const parsed = CitationSchema.parse(citation);
      expect(parsed.type).toBe("event");
    });

    it("parses sensor citation", () => {
      const citation = { type: "sensor", key: "bearing_temp_c" };
      const parsed = CitationSchema.parse(citation);
      expect(parsed.type).toBe("sensor");
    });

    it("rejects invalid citation types or negative event indices", () => {
      expect(() => CitationSchema.parse({ type: "unknown", id: "1" })).toThrow();
      expect(() =>
        CitationSchema.parse({ type: "event", eventIndex: -1 })
      ).toThrow();
    });
  });

  describe("6. AiTriageOutput & Rule 3 Enforcement", () => {
    const validAiPayload = {
      observations: [
        {
          text: "Bearing temperature is elevated beyond normal operating parameters.",
          citations: [{ type: "sensor", key: "bearing_temp_c" }],
        },
      ],
      possibleCauses: [
        {
          hypothesis: "Insufficient lubrication or contaminated grease in bearing cavity.",
          likelihood: "high",
          citations: [
            {
              type: "kb",
              chunkId: "lubrication_guide_p12",
              quote: "Grease degradation causes exponential thermal buildup.",
            },
          ],
        },
      ],
      followUpQuestions: [
        {
          question: "When was the last scheduled grease re-packing performed?",
          whyItMatters: "Helps distinguish dry bearing run from catastrophic race failure.",
          citations: [{ type: "event", eventIndex: 0 }],
        },
      ],
      inspectionSteps: [
        {
          order: 1,
          instruction: "Perform Lockout/Tagout (LOTO) on pump power supply before inspection.",
          safetyNote: "Ensure pump impeller is completely stopped and de-energized.",
          citations: [{ type: "kb", chunkId: "safety_loto_01" }],
        },
      ],
      suggestedPriority: "high",
      priorityRationale: {
        text: "Thermal escalation risks catastrophic bearing seizure if left unaddressed.",
        citations: [{ type: "sensor", key: "bearing_temp_c" }],
      },
      draftWorkOrder: {
        title: "Bearing Inspection and Grease Sampling",
        description: "Inspect pump outboard bearing for lubrication failure or metal flaking.",
        recommendedActions: ["Inspect seal", "Flush old grease", "Measure axial runout"],
        partsToCheck: ["Outboard roller bearing", "Grease fitting", "Shaft seal"],
      },
      uncertaintyNotes: ["No acoustic telemetry available to confirm roller race pitting."],
    };

    it("parses valid AI triage output successfully", () => {
      const parsed = AiTriageOutputSchema.parse(validAiPayload);
      expect(parsed.suggestedPriority).toBe("high");
      expect(parsed.possibleCauses[0].hypothesis).toContain("lubrication");
    });

    it("strictly rejects AiTriageOutput when possible causes contain 'isConfirmed'", () => {
      const invalidPayload = {
        ...validAiPayload,
        possibleCauses: [
          {
            hypothesis: "Bearing failure",
            likelihood: "high",
            citations: [],
            isConfirmed: true, // FORBIDDEN!
          },
        ],
      };

      expect(() => AiTriageOutputSchema.parse(invalidPayload)).toThrow(
        /isConfirmed|forbidden/i
      );
    });

    it("strictly rejects AiTriageOutput containing confirmedCauses or confirmedFindings at root", () => {
      const payloadWithConfirmedFindings = {
        ...validAiPayload,
        confirmedFindings: ["Technician confirmed broken shaft"], // FORBIDDEN!
      };
      expect(() => AiTriageOutputSchema.parse(payloadWithConfirmedFindings)).toThrow(
        /forbidden|unrecognized_keys/i
      );

      const payloadWithConfirmedCauses = {
        ...validAiPayload,
        confirmedCauses: [{ text: "Confirmed root cause" }], // FORBIDDEN!
      };
      expect(() => AiTriageOutputSchema.parse(payloadWithConfirmedCauses)).toThrow(
        /forbidden|unrecognized_keys/i
      );
    });
  });

  describe("7. WorkOrder, ConfirmedFinding, AuditEvent & TriageRecord", () => {
    it("parses valid confirmed finding recorded by human technician", () => {
      const finding = {
        text: "Inspected bearing cavity: found black charred grease with brass flakes.",
        recordedBy: "tech-j-smith",
        recordedAt: "2026-10-05T14:40:00.000Z",
        relatedCauseIndex: 0,
      };
      const parsed = ConfirmedFindingSchema.parse(finding);
      expect(parsed.recordedBy).toBe("tech-j-smith");
    });

    it("parses valid WorkOrder with technician decisions", () => {
      const workOrder = {
        id: "WO-9821",
        triageRecordId: "TR-101",
        status: "approved",
        title: "Pump Outboard Bearing Replacement",
        description: "Replace damaged bearing and re-grease assembly.",
        finalPriority: "critical",
        recommendedActions: ["Lockout/Tagout", "Pull bearing", "Install SKF 6205"],
        partsToCheck: ["Shaft journal", "Housing bore"],
        confirmedFindings: [
          {
            text: "Bearing cage cracked.",
            recordedBy: "lead-tech-dan",
            recordedAt: "2026-10-05T14:42:00.000Z",
          },
        ],
        approvedBy: "supervisor-elena",
        decidedAt: "2026-10-05T14:45:00.000Z",
        createdAt: "2026-10-05T14:35:00.000Z",
        updatedAt: "2026-10-05T14:45:00.000Z",
      };

      const parsed = WorkOrderSchema.parse(workOrder);
      expect(parsed.status).toBe("approved");
      expect(parsed.approvedBy).toBe("supervisor-elena");
    });

    it("parses valid AuditEvent", () => {
      const audit = {
        recordId: "TR-101",
        type: "WORK_ORDER_APPROVED",
        actor: "technician",
        timestamp: "2026-10-05T14:45:00.000Z",
        note: "Approved for immediate maintenance shutdown.",
      };
      const parsed = AuditEventSchema.parse(audit);
      expect(parsed.actor).toBe("technician");
    });

    it("parses full composite TriageRecord", () => {
      const triageRecord = {
        id: "TR-202",
        issueReport: {
          equipmentType: "centrifugal_pump",
          equipmentId: "PUMP-1",
          issueDescription: "Vibration alarms triggering on baseline startup.",
          recentEvents: [{ description: "none reported" }],
          reportedBy: "op-1",
        },
        ruleFindings: [],
        ruleFloorPriority: "low",
        dataQualityFlags: [],
        retrievedChunkIds: ["chunk-1"],
        aiTriage: null,
        finalPriority: "medium",
        workOrder: {
          id: "WO-202",
          triageRecordId: "TR-202",
          status: "draft",
          title: "Vibration baseline check",
          description: "Inspect mounts",
          finalPriority: "medium",
          recommendedActions: ["Check mount bolts"],
          partsToCheck: ["Foundation"],
          createdAt: "2026-10-05T14:00:00.000Z",
          updatedAt: "2026-10-05T14:00:00.000Z",
        },
        confirmedFindings: [],
        auditTrail: [],
        createdAt: "2026-10-05T14:00:00.000Z",
        updatedAt: "2026-10-05T14:00:00.000Z",
      };

      const parsed = TriageRecordSchema.parse(triageRecord);
      expect(parsed.id).toBe("TR-202");
      expect(parsed.followUpAnswers).toEqual([]);
    });

    it("validates and preserves human follow-up answers with attribution", () => {
      const answer = FollowUpAnswerSchema.parse({
        question: "Did the leakage start suddenly?",
        answer: "It started gradually during the last shift.",
        answeredBy: "Demo Reporter",
        answeredByRole: "reporter",
        answeredAt: "2026-10-06T09:00:00.000Z",
      });
      expect(answer.answeredByRole).toBe("reporter");

      expect(
        FollowUpAnswerSubmissionSchema.safeParse({
          answers: [
            { questionIndex: 0, answer: "Gradually." },
            { questionIndex: 0, answer: "Suddenly." },
          ],
        }).success
      ).toBe(false);
    });
  });

  describe("8. AppError Hierarchy & Serialization", () => {
    it("creates ValidationError with 400 status and code", () => {
      const err = new ValidationError("Invalid field input");
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.statusCode).toBe(400);
      expect(err.userMessage).toContain("Input validation failed");
      expect(err.toJSON().code).toBe("VALIDATION_ERROR");
    });

    it("creates DatabaseError with 500 status and code", () => {
      const err = new DatabaseError("Connection timeout");
      expect(err.code).toBe("DATABASE_ERROR");
      expect(err.statusCode).toBe(500);
      expect(err.userMessage).toContain("Database operation failed");
    });

    it("creates RetrievalError with 500 status and code", () => {
      const err = new RetrievalError("Vector search failure");
      expect(err.code).toBe("RETRIEVAL_ERROR");
      expect(err.statusCode).toBe(500);
    });

    it("creates AiError with appropriate subtypes and status codes", () => {
      const timeoutErr = new AiError("Gateway timeout", { subtype: "timeout" });
      expect(timeoutErr.statusCode).toBe(504);
      expect(timeoutErr.subtype).toBe("timeout");

      const rateLimitErr = new AiError("Quota exceeded", { subtype: "rate_limit" });
      expect(rateLimitErr.statusCode).toBe(429);
      expect(rateLimitErr.subtype).toBe("rate_limit");

      const invalidOutputErr = new AiError("JSON parse error", {
        subtype: "invalid_output",
      });
      expect(invalidOutputErr.statusCode).toBe(502);

      const blockedErr = new AiError("Prompt flagged by safety filters", {
        subtype: "blocked",
      });
      expect(blockedErr.statusCode).toBe(400);

      const configurationErr = new AiError("Gemini model not found", {
        subtype: "configuration",
      });
      expect(configurationErr.statusCode).toBe(500);
      expect(configurationErr.userMessage).toContain("AI_PROVIDER");
    });

    it("converts unknown error to AppError via toAppError helper", () => {
      const generic = new Error("Disk full");
      const converted = toAppError(generic);
      expect(converted.code).toBe("DATABASE_ERROR");
    });
  });

  describe("Deterministic Priority Rules (Rule 1)", () => {
    it("enforces rule floor when AI suggestion is lower", () => {
      expect(computeFinalPriority("critical", "low")).toBe("critical");
      expect(computeFinalPriority("high", "medium")).toBe("high");
      expect(computeFinalPriority("high", "low")).toBe("high");
    });

    it("allows AI to elevate priority when justified above floor", () => {
      expect(computeFinalPriority("low", "high")).toBe("high");
      expect(computeFinalPriority("medium", "critical")).toBe("critical");
      expect(computeFinalPriority("low", "medium")).toBe("medium");
    });

    it("keeps priority when equal", () => {
      expect(computeFinalPriority("medium", "medium")).toBe("medium");
    });
  });
});
