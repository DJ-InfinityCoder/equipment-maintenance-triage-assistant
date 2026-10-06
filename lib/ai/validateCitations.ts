import { AiTriageOutput } from "../schemas/ai-triage";
import { Citation } from "../schemas/citation";
import { EquipmentType } from "../schemas/equipment";
import { RetrievedChunk } from "../rag/retrieve";
import { getSensorLimit } from "../rules/limits";

export interface DroppedSuggestion {
  category: "observation" | "possibleCause" | "followUpQuestion" | "inspectionStep";
  text: string;
  reason: string;
  originalCitations?: Citation[];
}

export interface CitationValidationContext {
  retrievedChunks: RetrievedChunk[];
  recentEvents?: Array<{ description: string; occurredAt?: string }>;
  sensorReadings?: Array<{ key: string }>;
  equipmentType?: EquipmentType;
}

export interface ValidateCitationsResult {
  validatedOutput: AiTriageOutput;
  droppedSuggestions: DroppedSuggestion[];
}

/**
 * Normalizes text for lenient quote verification (lowercase, collapse whitespace).
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates a single citation against the active context.
 * Returns true if the citation resolves to a real chunk, event, or sensor reading.
 */
export function isCitationValid(
  citation: Citation,
  context: CitationValidationContext
): boolean {
  if (!citation || typeof citation !== "object") {
    return false;
  }

  // 1. Knowledge Base Chunk Citation
  if (citation.type === "kb") {
    if (!citation.chunkId) {
      return false;
    }

    const chunk = context.retrievedChunks.find(
      (c) => c.chunkId === citation.chunkId || c.id === citation.chunkId
    );

    if (!chunk) {
      return false; // Hallucinated chunk ID
    }

    // If quote is provided, verify it appears in the chunk text
    if (citation.quote && citation.quote.trim().length > 0) {
      const normalizedQuote = normalizeForSearch(citation.quote);
      const normalizedContent = normalizeForSearch(chunk.content);
      const normalizedTitle = normalizeForSearch(chunk.title);

      if (!normalizedContent.includes(normalizedQuote) && !normalizedTitle.includes(normalizedQuote)) {
        return false; // Hallucinated quote
      }
    }

    return true;
  }

  // 2. Operating Event Citation
  if (citation.type === "event") {
    if (
      typeof citation.eventIndex !== "number" ||
      !Number.isInteger(citation.eventIndex) ||
      citation.eventIndex < 0
    ) {
      return false;
    }

    const eventsCount = context.recentEvents?.length ?? 0;
    return citation.eventIndex < eventsCount;
  }

  // 3. Sensor Reading Citation
  if (citation.type === "sensor") {
    if (!citation.key || citation.key.trim().length === 0) {
      return false;
    }

    const key = citation.key.trim();
    // Check if key is in provided sensor readings
    const inReadings = (context.sensorReadings || []).some((r) => r.key === key);
    if (inReadings) {
      return true;
    }

    // Also valid if it is a defined sensor for this equipment type
    if (context.equipmentType) {
      return getSensorLimit(context.equipmentType, key) !== undefined;
    }

    return false;
  }

  return false;
}

/**
 * Validates all citations in an AI triage output.
 * Suggestions (observations, hypotheses, questions, inspection steps) with ZERO valid citations
 * are dropped and recorded in droppedSuggestions.
 * Inspection step ordering is re-indexed.
 * Pure function with zero I/O.
 */
export function validateCitations(
  triage: AiTriageOutput,
  context: CitationValidationContext
): ValidateCitationsResult {
  const droppedSuggestions: DroppedSuggestion[] = [];

  // 1. Observations
  const validatedObservations = triage.observations
    .map((obs) => {
      const validCitations = (obs.citations || []).filter((c) =>
        isCitationValid(c, context)
      );
      return {
        ...obs,
        citations: validCitations,
      };
    })
    .filter((obs) => {
      if (obs.citations.length === 0) {
        droppedSuggestions.push({
          category: "observation",
          text: obs.text,
          reason: "No valid or verifiable source citations found in context",
          originalCitations: triage.observations.find((o) => o.text === obs.text)?.citations,
        });
        return false;
      }
      return true;
    });

  // 2. Possible Causes
  const validatedPossibleCauses = triage.possibleCauses
    .map((cause) => {
      const validCitations = (cause.citations || []).filter((c) =>
        isCitationValid(c, context)
      );
      return {
        ...cause,
        citations: validCitations,
      };
    })
    .filter((cause) => {
      if (cause.citations.length === 0) {
        droppedSuggestions.push({
          category: "possibleCause",
          text: cause.hypothesis,
          reason: "No valid or verifiable source citations found in context",
          originalCitations: triage.possibleCauses.find(
            (c) => c.hypothesis === cause.hypothesis
          )?.citations,
        });
        return false;
      }
      return true;
    });

  // 3. Follow-up Questions (max 5)
  const validatedQuestions = triage.followUpQuestions
    .map((q) => {
      const validCitations = (q.citations || []).filter((c) =>
        isCitationValid(c, context)
      );
      return {
        ...q,
        citations: validCitations,
      };
    })
    .filter((q) => {
      if (q.citations.length === 0) {
        droppedSuggestions.push({
          category: "followUpQuestion",
          text: q.question,
          reason: "No valid or verifiable source citations found in context",
          originalCitations: triage.followUpQuestions.find(
            (item) => item.question === q.question
          )?.citations,
        });
        return false;
      }
      return true;
    })
    .slice(0, 5);

  // 4. Inspection Steps (re-indexed 1..N)
  const remainingSteps = triage.inspectionSteps
    .map((step) => {
      const validCitations = (step.citations || []).filter((c) =>
        isCitationValid(c, context)
      );
      return {
        ...step,
        citations: validCitations,
      };
    })
    .filter((step) => {
      if (step.citations.length === 0) {
        droppedSuggestions.push({
          category: "inspectionStep",
          text: step.instruction,
          reason: "No valid or verifiable source citations found in context",
          originalCitations: triage.inspectionSteps.find(
            (item) => item.instruction === step.instruction
          )?.citations,
        });
        return false;
      }
      return true;
    });

  const validatedInspectionSteps = remainingSteps.map((step, idx) => ({
    ...step,
    order: idx + 1,
  }));

  // 5. Priority Rationale
  const validRationaleCitations = (triage.priorityRationale.citations || []).filter(
    (c) => isCitationValid(c, context)
  );

  // 6. Uncertainty Notes
  const uncertaintyNotes = [...triage.uncertaintyNotes];
  if (droppedSuggestions.length > 0) {
    uncertaintyNotes.push(
      `${droppedSuggestions.length} suggestion(s) were removed because they lacked verifiable source citations.`
    );
  }

  const validatedOutput: AiTriageOutput = {
    observations: validatedObservations,
    possibleCauses: validatedPossibleCauses,
    followUpQuestions: validatedQuestions,
    inspectionSteps: validatedInspectionSteps,
    suggestedPriority: triage.suggestedPriority,
    priorityRationale: {
      text: triage.priorityRationale.text,
      citations: validRationaleCitations,
    },
    draftWorkOrder: triage.draftWorkOrder,
    uncertaintyNotes,
  };

  return {
    validatedOutput,
    droppedSuggestions,
  };
}
