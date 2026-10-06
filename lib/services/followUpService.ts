import crypto from "node:crypto";
import { getTriageRecordsCollection, getWorkOrdersCollection } from "@/lib/db/collections";
import { appendAuditEvent } from "@/lib/db/repos/audit";
import { stripMongoId } from "@/lib/db/repos/utils";
import { mapToAiError } from "@/lib/ai/model";
import { generateTriage } from "@/lib/ai/triage";
import { mergePriority } from "@/lib/rules/priority";
import { retrieveContext, RetrievedChunk } from "@/lib/rag/retrieve";
import { AiErrorSubtype, AppError, DatabaseError } from "@/lib/schemas/errors";
import { FollowUpAnswer, TriageRecord } from "@/lib/schemas/triage-record";
import { SessionUser } from "@/lib/auth/session";

export interface FollowUpAnswerSubmission {
  questionIndex: number;
  answer: string;
}

export async function submitFollowUpAnswers(
  triageId: string,
  submissions: FollowUpAnswerSubmission[],
  user: SessionUser
): Promise<{ record: TriageRecord; aiRefreshed: boolean; message?: string }> {
  const triageCollection = await getTriageRecordsCollection();
  const existingDoc = await triageCollection.findOne({ id: triageId });
  if (!existingDoc) {
    throw new AppErrorNotFound(`Triage record ${triageId} was not found.`);
  }

  const record = stripMongoId(existingDoc) as unknown as TriageRecord;
  if (
    user.role === "reporter" &&
    record.issueReport.reportedByUserId !== user.id
  ) {
    throw new AppErrorForbidden("Only the reporter who submitted this report may answer as its reporter.");
  }
  if (record.workOrder.status !== "draft") {
    throw new AppErrorConflict("Follow-up answers cannot change a finalized work order.");
  }

  const questions = record.aiTriage?.followUpQuestions ?? [];
  if (questions.length === 0) {
    throw new AppErrorConflict("There are no AI follow-up questions to answer for this report.");
  }

  const now = new Date().toISOString();
  const answers: FollowUpAnswer[] = submissions.map(({ questionIndex, answer }) => {
    const question = questions[questionIndex];
    if (!question) {
      throw new AppErrorConflict(`Follow-up question ${questionIndex + 1} is no longer available.`);
    }
    return {
      question: question.question,
      answer,
      answeredBy: user.name,
      answeredByRole: user.role,
      answeredAt: now,
    };
  });

  const recentEvents = [
    ...record.issueReport.recentEvents,
    ...answers.map((item) => ({
      description: `Human follow-up answer to "${item.question}" (answered by ${item.answeredBy}, ${item.answeredByRole}): ${item.answer}`,
      occurredAt: item.answeredAt,
    })),
  ];
  const updatedIssueReport = {
    ...record.issueReport,
    recentEvents,
  };
  const followUpAnswers = [...(record.followUpAnswers ?? []), ...answers];

  let retrievalStatus: "ok" | "failed" = "ok";
  let retrievedChunks: RetrievedChunk[] = [];
  let retrievalMethod: "vector" | "text" | "keyword" | undefined;
  let retrievalWarnings: string[] = [];
  let retrievalError: string | undefined;
  try {
    const retrieval = await retrieveContext({
      equipmentType: updatedIssueReport.equipmentType,
      issueDescription: updatedIssueReport.issueDescription,
      recentEvents: updatedIssueReport.recentEvents,
      sensorReadings: updatedIssueReport.sensorReadings,
      k: 6,
    });
    retrievedChunks = retrieval.chunks;
    retrievalMethod = retrieval.method;
    retrievalWarnings = retrieval.warnings;
  } catch (error) {
    retrievalStatus = "failed";
    retrievalError =
      error instanceof AppError
        ? error.userMessage
        : "Knowledge-base retrieval failed while refining the triage.";
  }

  let aiStatus: "ok" | "failed" | "skipped_no_context" = "skipped_no_context";
  let aiOutput = record.aiTriage;
  let aiError: string | undefined;
  let aiErrorSubtype: AiErrorSubtype | undefined;
  let droppedSuggestions: unknown[] = record.ai?.droppedSuggestions ?? [];

  if (retrievalStatus === "ok" && retrievedChunks.length > 0) {
    try {
      const result = await generateTriage({
        input: updatedIssueReport,
        retrieved: retrievedChunks,
        ruleFindings: record.ruleFindings,
        dataFlags: record.dataQualityFlags,
      });
      aiOutput = result.triage;
      droppedSuggestions = result.droppedSuggestions;
      aiStatus = "ok";
    } catch (error) {
      const typedError = mapToAiError(error);
      aiStatus = "failed";
      aiError = typedError.userMessage;
      aiErrorSubtype = typedError.subtype;
    }
  } else if (retrievalStatus === "failed") {
    aiStatus = "failed";
    aiError = "AI refresh was skipped because manual retrieval failed.";
  }

  const finalPriority =
    aiStatus === "ok" && aiOutput
      ? mergePriority(record.ruleFloorPriority, aiOutput.suggestedPriority).finalPriority
      : record.finalPriority;
  let workOrder = record.workOrder;
  if (aiStatus === "ok" && aiOutput) {
    workOrder = {
      ...record.workOrder,
      title: aiOutput.draftWorkOrder.title,
      description: aiOutput.draftWorkOrder.description,
      recommendedActions: aiOutput.draftWorkOrder.recommendedActions,
      partsToCheck: aiOutput.draftWorkOrder.partsToCheck,
      finalPriority,
      updatedAt: now,
    };
    const workOrderCollection = await getWorkOrdersCollection();
    const workOrderUpdate = await workOrderCollection.updateOne(
      { id: workOrder.id, status: "draft" },
      { $set: workOrder }
    );
    if (workOrderUpdate.matchedCount !== 1) {
      throw new AppErrorConflict("The work order was finalized while follow-up answers were being processed.");
    }
  }

  const auditEvent = {
    id: `audit_${crypto.randomUUID()}`,
    type: "follow_up_answers_submitted",
    actor: user.role,
    timestamp: now,
    note: `${user.role === "reporter" ? "Reporter" : "Technician"} ${user.name} answered ${answers.length} diagnostic question(s).`,
    after: {
      questions: answers.map(({ question }) => question),
      aiStatus,
    },
  } satisfies TriageRecord["auditTrail"][number];

  const updatedRecord: TriageRecord = {
    ...record,
    issueReport: updatedIssueReport,
    followUpAnswers,
    retrievedChunkIds: retrievedChunks.map((chunk) => chunk.chunkId),
    retrieval: {
      status: retrievalStatus,
      method: retrievalMethod,
      chunkIds: retrievedChunks.map((chunk) => chunk.chunkId),
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
    finalSuggestedPriority:
      aiStatus === "ok" ? aiOutput?.suggestedPriority : record.finalSuggestedPriority,
    workOrder,
    auditTrail: [...record.auditTrail, auditEvent],
    updatedAt: now,
  };

  const update = await triageCollection.updateOne(
    { id: triageId, "workOrder.status": "draft" },
    {
      $set: {
        issueReport: updatedIssueReport,
        followUpAnswers,
        retrievedChunkIds: updatedRecord.retrievedChunkIds,
        retrieval: updatedRecord.retrieval,
        aiTriage: updatedRecord.aiTriage,
        ai: updatedRecord.ai,
        finalPriority,
        finalSuggestedPriority: updatedRecord.finalSuggestedPriority,
        workOrder,
        auditTrail: updatedRecord.auditTrail,
        updatedAt: now,
      },
    }
  );
  if (update.matchedCount !== 1) {
    throw new AppErrorConflict("The work order was finalized while follow-up answers were being processed.");
  }

  await appendAuditEvent({
    entityId: triageId,
    type: "FOLLOW_UP_ANSWERS_SUBMITTED",
    actor: user.role,
    timestamp: now,
    after: {
      answerCount: answers.length,
      aiStatus,
      finalPriority,
    },
    note: `${user.role === "reporter" ? "Reporter" : "Technician"} ${user.name} submitted diagnostic answers.`,
  });

  return {
    record: updatedRecord,
    aiRefreshed: aiStatus === "ok",
    message:
      aiStatus === "ok"
        ? undefined
        : aiError ??
          "Answers were saved, but AI triage could not be refreshed. The existing draft and safety floor remain unchanged.",
  };
}

class AppErrorNotFound extends AppError {
  readonly code = "NOT_FOUND";
  constructor(message: string) {
    super(message, { userMessage: message, statusCode: 404 });
  }
}

class AppErrorForbidden extends AppError {
  readonly code = "FORBIDDEN";
  constructor(message: string) {
    super(message, { userMessage: message, statusCode: 403 });
  }
}

class AppErrorConflict extends AppError {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(message, { userMessage: message, statusCode: 409 });
  }
}

export function asFollowUpDatabaseError(error: unknown): DatabaseError {
  return error instanceof DatabaseError
    ? error
    : new DatabaseError("Failed to save and process follow-up answers", {
        userMessage: "Follow-up answers could not be saved. Please try again.",
        cause: error,
      });
}
