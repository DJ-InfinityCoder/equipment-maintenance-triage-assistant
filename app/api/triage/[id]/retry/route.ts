import { NextRequest, NextResponse } from "next/server";
import { getTriageRecordsCollection, getWorkOrdersCollection } from "@/lib/db/collections";
import { RetrievedChunk, retrieveContext } from "@/lib/rag/retrieve";
import { generateTriage } from "@/lib/ai/triage";
import { mapToAiError } from "@/lib/ai/model";
import { mergePriority } from "@/lib/rules/priority";
import { appendAuditEvent } from "@/lib/db/repos/audit";
import { stripMongoId } from "@/lib/db/repos/utils";
import { TriageRecord } from "@/lib/schemas/triage-record";
import { AiErrorSubtype } from "@/lib/schemas/errors";
import { authorizeRequest } from "@/lib/auth/authorization";
import { getAccessibleTriageRecord } from "@/lib/auth/triage-access";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authorization = await authorizeRequest(request, ["reporter", "technician"]);
  if (!authorization.authorized) return authorization.response;

  const { id: triageId } = await context.params;

  try {
    const triageColl = await getTriageRecordsCollection();
    const workOrderColl = await getWorkOrdersCollection();

    const record = await getAccessibleTriageRecord(triageId, authorization.session);
    if (!record) {
      return NextResponse.json(
        { error: `Triage record ${triageId} not found.` },
        { status: 404 }
      );
    }
    if (record.workOrder.status !== "draft") {
      return NextResponse.json(
        { error: "Finalized work orders cannot be retried or modified." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // 1. Re-run Retrieval
    let retrievalStatus: "ok" | "failed" | "skipped" = "ok";
    let retrievedChunks: RetrievedChunk[] = [];
    let retrievalMethod: "vector" | "text" | "keyword" | undefined;
    let retrievalWarnings: string[] = [];
    let retrievalError: string | undefined;

    try {
      const retrievalRes = await retrieveContext({
        equipmentType: record.issueReport.equipmentType,
        issueDescription: record.issueReport.issueDescription,
        recentEvents: record.issueReport.recentEvents,
        sensorReadings: record.issueReport.sensorReadings,
        k: 6,
      });
      retrievedChunks = retrievalRes.chunks;
      retrievalMethod = retrievalRes.method;
      retrievalWarnings = retrievalRes.warnings;
    } catch (rErr) {
      retrievalStatus = "failed";
      retrievalError = rErr instanceof Error ? rErr.message : String(rErr);
    }

    // 2. Re-run AI Generation if context exists
    let aiStatus: "ok" | "failed" | "skipped_no_context" = "ok";
    let aiOutput = null;
    let aiError: string | undefined;
    let aiErrorSubtype: AiErrorSubtype | undefined;
    let droppedSuggestions: unknown[] = [];

    if (retrievalStatus !== "ok" || retrievedChunks.length === 0) {
      aiStatus = "skipped_no_context";
    } else {
      try {
        const triageRes = await generateTriage({
          input: record.issueReport,
          retrieved: retrievedChunks,
          ruleFindings: record.ruleFindings,
          dataFlags: record.dataQualityFlags,
        });
        aiOutput = triageRes.triage;
        droppedSuggestions = triageRes.droppedSuggestions;
      } catch (aErr) {
        aiStatus = "failed";
        const typedError = mapToAiError(aErr);
        aiError = typedError.userMessage;
        aiErrorSubtype = typedError.subtype;
      }
    }

    // 3. Priority merge
    const aiSuggestedPriority = aiOutput?.suggestedPriority ?? record.ruleFloorPriority;
    const priorityMerge = mergePriority(record.ruleFloorPriority, aiSuggestedPriority);
    const finalPriority = priorityMerge.finalPriority;

    // 4. Update draft work order if still in draft
    let updatedWorkOrder = record.workOrder;
    if (record.workOrder.status === "draft" && aiOutput) {
      updatedWorkOrder = {
        ...record.workOrder,
        title: aiOutput.draftWorkOrder.title,
        description: aiOutput.draftWorkOrder.description,
        recommendedActions: aiOutput.draftWorkOrder.recommendedActions,
        partsToCheck: aiOutput.draftWorkOrder.partsToCheck,
        finalPriority,
        updatedAt: now,
      };

      await workOrderColl.updateOne(
        { id: updatedWorkOrder.id },
        { $set: updatedWorkOrder }
      );
    }

    // 5. Update triage record in DB
    const updatePayload = {
      retrievedChunkIds: retrievedChunks.map((c) => c.chunkId),
      retrieval: {
        status: retrievalStatus,
        method: retrievalMethod,
        chunkIds: retrievedChunks.map((c) => c.chunkId),
        warnings: retrievalWarnings,
        error: retrievalError,
      },
      aiTriage: aiOutput,
      ai: {
        status: aiStatus,
        output: aiOutput,
        error: aiError,
        errorSubtype: aiErrorSubtype,
        droppedSuggestions,
      },
      finalPriority,
      finalSuggestedPriority: aiOutput?.suggestedPriority,
      workOrder: updatedWorkOrder,
      updatedAt: now,
    };

    await triageColl.updateOne({ id: triageId }, { $set: updatePayload });

    await appendAuditEvent({
      entityId: triageId,
      type: "TRIAGE_RETRY_EXECUTED",
      actor: authorization.session.role,
      timestamp: now,
      note: `Triage pipeline retry by ${authorization.session.role} ${authorization.session.name}: retrieval ${retrievalStatus}, AI ${aiStatus}`,
      after: {
        retrievalStatus,
        aiStatus,
        finalPriority,
      },
    });

    const refreshedDoc = await triageColl.findOne({ id: triageId });
    return NextResponse.json({
      success: true,
      record: stripMongoId(refreshedDoc!) as unknown as TriageRecord,
    });
  } catch (error) {
    console.error("Triage retry failed.", error);
    return NextResponse.json(
      { error: "Triage retry failed. Please try again." },
      { status: 500 }
    );
  }
}
