import crypto from "node:crypto";
import { IssueReportInput, IssueReportInputSchema } from "../schemas/issue-report";
import { TriageRecord } from "../schemas/triage-record";
import { WorkOrder } from "../schemas/work-order";
import { AuditEvent } from "../schemas/audit";
import { ValidationError, AiError, AiErrorSubtype } from "../schemas/errors";
import {
  evaluateThresholds,
  evaluateKeywordRules,
  detectDataQuality,
  computePriorityFloor,
  mergePriority,
} from "../rules";
import {
  retrieveContext,
  RetrieveContextParams,
  RetrieveContextResult,
  RetrievedChunk,
} from "../rag/retrieve";
import { generateTriage } from "../ai/triage";
import { TriageModel, createConfiguredTriageModel } from "../ai/model";
import { createTriageRecord } from "../db/repos/triage";
import { logServerEvent } from "./logger";
import { checkAndThrowDebugFail } from "./debugFail";

export interface TriageServiceDependencies {
  retrieveContextFn?: (params: RetrieveContextParams) => Promise<RetrieveContextResult>;
  triageModel?: TriageModel;
  saveRecordFn?: (record: TriageRecord) => Promise<TriageRecord>;
  idGenerator?: (prefix: string) => string;
  nowFn?: () => string;
}

export type StageStatus = "ok" | "failed" | "skipped";

export interface ProcessTriageResult {
  triageId: string;
  workOrderId: string;
  status: {
    rules: "ok";
    retrieval: StageStatus;
    ai: StageStatus | "skipped_no_context";
  };
  record: TriageRecord;
}

const defaultIdGen = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const defaultNow = () => new Date().toISOString();

/**
 * Executes the complete triage pipeline with strict stage isolation:
 * 1. Input validation via Zod (throws ValidationError on invalid schema).
 * 2. Deterministic rule evaluation + data quality inspection (always executes).
 * 3. Knowledge base retrieval (isolated; failures do not abort pipeline).
 * 4. AI triage proposal (only executed if manual chunks exist; failures do not abort).
 * 5. Priority merging (final = max(ruleFloor, aiSuggested)).
 * 6. Work order creation (status ALWAYS 'draft', never 'approved').
 * 7. Complete TriageRecord persistence with full audit trail.
 */
export async function processTriageReport(
  rawInput: unknown,
  deps?: TriageServiceDependencies
): Promise<ProcessTriageResult> {
  const idGen = deps?.idGenerator ?? defaultIdGen;
  const now = (deps?.nowFn ?? defaultNow)();
  const saveFn = deps?.saveRecordFn ?? createTriageRecord;
  const retrieveFn = deps?.retrieveContextFn ?? retrieveContext;
  const model = deps?.triageModel ?? createConfiguredTriageModel();

  // -------------------------------------------------------------------------
  // STAGE 1: Input Validation
  // -------------------------------------------------------------------------
  const validation = IssueReportInputSchema.safeParse(rawInput);
  if (!validation.success) {
    logServerEvent("warn", "triage_input_validation_failed", {
      errors: validation.error.flatten(),
    });
    throw new ValidationError("Invalid equipment issue report payload", {
      details: validation.error.flatten(),
    });
  }

  const input: IssueReportInput = validation.data;
  logServerEvent("info", "triage_process_started", {
    equipmentId: input.equipmentId,
    equipmentType: input.equipmentType,
    reportedBy: input.reportedBy,
  });

  const auditTrail: AuditEvent[] = [
    {
      id: idGen("audit"),
      type: "report_submitted",
      actor: "system",
      timestamp: now,
      note: `Issue reported by ${input.reportedBy} for equipment ${input.equipmentId}`,
    },
  ];

  // -------------------------------------------------------------------------
  // STAGE 2: Rules Evaluation + Data Quality Inspection (Always Runs)
  // -------------------------------------------------------------------------
  const thresholdFindings = evaluateThresholds(input.equipmentType, input.sensorReadings);
  const keywordFindings = evaluateKeywordRules(input.issueDescription, input.recentEvents);
  const ruleFindings = [...thresholdFindings, ...keywordFindings];

  const dataFlags = detectDataQuality({
    equipmentType: input.equipmentType,
    issueDescription: input.issueDescription,
    recentEvents: input.recentEvents,
    sensorReadings: input.sensorReadings,
  });

  const floorEval = computePriorityFloor(ruleFindings, dataFlags, input.equipmentType);
  const ruleFloor = floorEval.priorityFloor;

  auditTrail.push({
    id: idGen("audit"),
    type: "rules_evaluated",
    actor: "system",
    timestamp: now,
    note: `Deterministic rules evaluated: ${ruleFindings.length} findings, ${dataFlags.length} data flags. Priority floor: ${ruleFloor}.`,
    after: {
      ruleFloor,
      requiresVerification: floorEval.requiresVerification,
      findingsCount: ruleFindings.length,
    },
  });

  logServerEvent("info", "triage_rules_evaluated", {
    equipmentId: input.equipmentId,
    ruleFloor,
    findingsCount: ruleFindings.length,
    dataFlagsCount: dataFlags.length,
  });

  // -------------------------------------------------------------------------
  // STAGE 3: Knowledge Base Retrieval (Isolated)
  // -------------------------------------------------------------------------
  let retrievalStatus: StageStatus = "ok";
  let retrievedChunks: RetrievedChunk[] = [];
  let retrievalMethod: "vector" | "text" | "keyword" | undefined;
  let retrievalWarnings: string[] = [];
  let retrievalErrorMsg: string | undefined;

  try {
    checkAndThrowDebugFail("retrieval");
    const retrievalRes = await retrieveFn({
      equipmentType: input.equipmentType,
      issueDescription: input.issueDescription,
      recentEvents: input.recentEvents,
      sensorReadings: input.sensorReadings,
      k: 6,
    });

    retrievedChunks = retrievalRes.chunks;
    retrievalMethod = retrievalRes.method;
    retrievalWarnings = retrievalRes.warnings;

    auditTrail.push({
      id: idGen("audit"),
      type: "retrieval_completed",
      actor: "system",
      timestamp: now,
      note: `Retrieved ${retrievedChunks.length} manual chunks via ${retrievalMethod} search.`,
      after: {
        chunkIds: retrievedChunks.map((c) => c.chunkId),
        method: retrievalMethod,
      },
    });
  } catch (retrievalErr) {
    retrievalStatus = "failed";
    retrievalErrorMsg =
      retrievalErr instanceof Error ? retrievalErr.message : String(retrievalErr);

    logServerEvent("error", "triage_retrieval_failed", {
      equipmentId: input.equipmentId,
      error: retrievalErrorMsg,
    });

    auditTrail.push({
      id: idGen("audit"),
      type: "retrieval_failed",
      actor: "system",
      timestamp: now,
      note: `Knowledge retrieval failed: ${retrievalErrorMsg}. Continuing with rules-only triage.`,
    });
  }

  // -------------------------------------------------------------------------
  // STAGE 4: AI Generation (Executed only if retrieval produced context)
  // -------------------------------------------------------------------------
  let aiStatus: StageStatus | "skipped_no_context" = "ok";
  let aiOutput = null;
  let aiErrorMsg: string | undefined;
  let aiErrorSubtype: AiErrorSubtype | undefined;
  let droppedSuggestions: unknown[] = [];

  if (retrievalStatus !== "ok" || retrievedChunks.length === 0) {
    aiStatus = "skipped_no_context";
    auditTrail.push({
      id: idGen("audit"),
      type: "ai_skipped",
      actor: "system",
      timestamp: now,
      note: "AI triage generation skipped: no verified knowledge base manual chunks available.",
    });
  } else {
    try {
      checkAndThrowDebugFail("ai");
      const triageResult = await generateTriage({
        input,
        retrieved: retrievedChunks,
        ruleFindings,
        dataFlags,
        model,
      });

      aiOutput = triageResult.triage;
      droppedSuggestions = triageResult.droppedSuggestions;

      // Ensure missing/conflicting sensor data quality flags are reflected in uncertainty notes
      const enrichedUncertaintyNotes = [...aiOutput.uncertaintyNotes];
      for (const flag of dataFlags) {
        if (flag.type === "missing" || flag.type === "conflict") {
          const alreadyNoted = enrichedUncertaintyNotes.some(
            (note) =>
              note.toLowerCase().includes(flag.type) ||
              flag.relatedKeys.some((k) => note.includes(k))
          );
          if (!alreadyNoted) {
            enrichedUncertaintyNotes.push(
              `Data Quality Alert (${flag.type}): ${flag.message}`
            );
          }
        }
      }
      aiOutput = {
        ...aiOutput,
        uncertaintyNotes: enrichedUncertaintyNotes,
      };

      auditTrail.push({
        id: idGen("audit"),
        type: "ai_generated",
        actor: "ai",
        timestamp: now,
        note: `AI triage generated successfully with ${droppedSuggestions.length} dropped suggestions. Suggested priority: ${aiOutput.suggestedPriority}.`,
        after: {
          suggestedPriority: aiOutput.suggestedPriority,
          droppedCount: droppedSuggestions.length,
          repaired: triageResult.repaired,
        },
      });
    } catch (aiErr) {
      aiStatus = "failed";
      aiErrorMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      if (aiErr instanceof AiError) {
        aiErrorSubtype = aiErr.subtype;
      }

      logServerEvent("warn", "triage_ai_generation_failed", {
        equipmentId: input.equipmentId,
        subtype: aiErrorSubtype,
        error: aiErrorMsg,
      });

      auditTrail.push({
        id: idGen("audit"),
        type: "ai_failed",
        actor: "system",
        timestamp: now,
        note: `AI triage generation failed (${aiErrorSubtype ?? "error"}): ${aiErrorMsg}. Falling back to deterministic rules floor.`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // STAGE 5: Priority Merging (Non-negotiable Rule 1)
  // -------------------------------------------------------------------------
  const aiSuggestedPriority = aiOutput?.suggestedPriority ?? ruleFloor;
  const priorityMerge = mergePriority(ruleFloor, aiSuggestedPriority);
  const finalPriority = priorityMerge.finalPriority;

  // -------------------------------------------------------------------------
  // STAGE 6: Work Order Creation (Initial status is ALWAYS 'draft', never 'approved')
  // -------------------------------------------------------------------------
  const triageId = idGen("triage");
  const workOrderId = idGen("wo");

  let woTitle: string;
  let woDesc: string;
  let woActions: string[];
  let woParts: string[];

  if (aiOutput) {
    woTitle = aiOutput.draftWorkOrder.title;
    woDesc = aiOutput.draftWorkOrder.description;
    woActions = aiOutput.draftWorkOrder.recommendedActions;
    woParts = aiOutput.draftWorkOrder.partsToCheck;
  } else {
    // Minimal fallback work order derived deterministically from rule findings
    woTitle = `Manual Triage Required: ${input.equipmentType} (${input.equipmentId})`;
    woDesc = `Automated rules evaluated. Rule floor priority: '${ruleFloor}'. ${ruleFindings.length} safety finding(s) identified. Full AI triage was ${aiStatus}. Human technician manual inspection required.`;
    woActions =
      ruleFindings.length > 0
        ? ruleFindings.map((f) => `Inspect sensor / condition: ${f.message}`)
        : [`Perform physical inspection and diagnostic walkdown on ${input.equipmentId}`];
    woParts = ruleFindings
      .filter((f) => f.sensorKey)
      .map((f) => f.sensorKey as string);
    if (woParts.length === 0) {
      woParts = ["Drive assembly", "Sensor connections"];
    }
  }

  const draftWorkOrder: WorkOrder = {
    id: workOrderId,
    triageRecordId: triageId,
    status: "draft", // Strictly 'draft'! Non-negotiable Rule 2.
    title: woTitle,
    description: woDesc,
    finalPriority,
    recommendedActions: woActions,
    partsToCheck: woParts,
    aiOriginal: {
      title: woTitle,
      description: woDesc,
      finalPriority,
      recommendedActions: [...woActions],
      partsToCheck: [...woParts],
      createdAt: now,
    },
    confirmedFindings: [],
    createdAt: now,
    updatedAt: now,
  };

  auditTrail.push({
    id: idGen("audit"),
    type: "draft_created",
    actor: "system",
    timestamp: now,
    note: `Draft work order ${workOrderId} created with status 'draft' and priority '${finalPriority}'. Pending human technician approval.`,
    after: {
      workOrderId,
      status: "draft",
      finalPriority,
    },
  });

  // -------------------------------------------------------------------------
  // STAGE 7: Complete TriageRecord Persistence
  // -------------------------------------------------------------------------
  const triageRecord: TriageRecord = {
    id: triageId,
    issueReport: input,
    ruleFindings,
    ruleFloorPriority: ruleFloor,
    dataQualityFlags: dataFlags,
    retrievedChunkIds: retrievedChunks.map((c) => c.chunkId),
    retrieval: {
      status: retrievalStatus,
      method: retrievalMethod,
      chunkIds: retrievedChunks.map((c) => c.chunkId),
      warnings: retrievalWarnings,
      error: retrievalErrorMsg,
    },
    aiTriage: aiOutput,
    followUpAnswers: [],
    ai: {
      status: aiStatus,
      output: aiOutput,
      error: aiErrorMsg,
      errorSubtype: aiErrorSubtype,
      droppedSuggestions,
    },
    finalPriority,
    finalSuggestedPriority: aiOutput?.suggestedPriority,
    workOrder: draftWorkOrder,
    confirmedFindings: [],
    auditTrail,
    createdAt: now,
    updatedAt: now,
  };

  checkAndThrowDebugFail("db");
  await saveFn(triageRecord);

  logServerEvent("info", "triage_process_completed", {
    triageId,
    workOrderId,
    rulesStatus: "ok",
    retrievalStatus,
    aiStatus,
    finalPriority,
  });

  return {
    triageId,
    workOrderId,
    status: {
      rules: "ok",
      retrieval: retrievalStatus,
      ai: aiStatus,
    },
    record: triageRecord,
  };
}
