import { IssueReportInput } from "../schemas/issue-report";
import { RuleFinding, DataQualityFlag } from "../schemas/rules";
import { AiTriageOutput, AiTriageOutputSchema } from "../schemas/ai-triage";
import { AiError } from "../schemas/errors";
import { RetrievedChunk } from "../rag/retrieve";
import { TRIAGE_SYSTEM_PROMPT, buildTriageUserPrompt, buildRepairPrompt } from "./prompts";
import { validateCitations, DroppedSuggestion } from "./validateCitations";
import { TriageModel, createConfiguredTriageModel } from "./model";

export interface GenerateTriageParams {
  input: IssueReportInput;
  retrieved: RetrievedChunk[];
  ruleFindings?: RuleFinding[];
  dataFlags?: DataQualityFlag[];
  model?: TriageModel;
}

export interface GenerateTriageResult {
  triage: AiTriageOutput;
  droppedSuggestions: DroppedSuggestion[];
  rawResponse: string;
  repaired: boolean;
}

const AI_TRIAGE_TIMEOUT_MS = 60_000;

function createTimeoutError(): AiError {
  return new AiError("AI triage exceeded its 60 second deadline", {
    subtype: "timeout",
    userMessage:
      "AI triage took too long. A deterministic safety-based draft will be saved for technician review.",
  });
}

async function generateWithSignal(
  model: TriageModel,
  request: Parameters<TriageModel["generate"]>[0],
  signal: AbortSignal
): Promise<string> {
  if (signal.aborted) {
    throw createTimeoutError();
  }

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(createTimeoutError());
    signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([
      model.generate({ ...request, signal }),
      aborted,
    ]);
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

/**
 * Attempts to parse JSON string and validate against AiTriageOutputSchema.
 */
function tryParseAndValidate(raw: string): {
  success: boolean;
  data?: AiTriageOutput;
  errorMessage?: string;
} {
  try {
    const parsedJson = JSON.parse(raw);
    const result = AiTriageOutputSchema.safeParse(parsedJson);
    if (result.success) {
      return { success: true, data: result.data };
    }
    const issueMessages = result.error.issues
      .map((i) => `Path [${i.path.join(".")}]: ${i.message}`)
      .join("; ");
    return { success: false, errorMessage: issueMessages };
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    return { success: false, errorMessage: `JSON parse error: ${msg}` };
  }
}

/**
 * Generates an advisory triage report using the configured AI model.
 *
 * Pipeline:
 * 1. Formats context with explicit [KB:<id>], [EVT:<idx>], and [SENSOR:<key>] delimiters.
 * 2. Invokes TriageModel (Gemini or injected fake) with structured JSON output schema.
 * 3. Validates output with Zod schema.
 * 4. Executes a single repair attempt if output is invalid. Throws AiError('invalid_output') on final failure.
 * 5. Runs validateCitations to drop hallucinated or unsourced suggestions and track them.
 */
export async function generateTriage(
  params: GenerateTriageParams
): Promise<GenerateTriageResult> {
  const { input, retrieved, ruleFindings = [], dataFlags = [], model } = params;

  const triageModel = model ?? createConfiguredTriageModel();
  const userPrompt = buildTriageUserPrompt({
    input,
    retrieved,
    ruleFindings,
    dataFlags,
  });

  const deadlineController = new AbortController();
  const timeoutId = setTimeout(
    () => deadlineController.abort(),
    AI_TRIAGE_TIMEOUT_MS
  );

  try {
    let rawOutput = await generateWithSignal(
      triageModel,
      {
        systemPrompt: TRIAGE_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.2,
        timeoutMs: 20000,
      },
      deadlineController.signal
    );

    let parseResult = tryParseAndValidate(rawOutput);
    let repaired = false;

    // Single repair attempt if initial output was invalid
    if (!parseResult.success) {
      repaired = true;
      const repairPrompt = buildRepairPrompt(
        userPrompt,
        rawOutput,
        parseResult.errorMessage || "Unknown validation error"
      );

      try {
        rawOutput = await generateWithSignal(
          triageModel,
          {
            systemPrompt: TRIAGE_SYSTEM_PROMPT,
            userPrompt: repairPrompt,
            temperature: 0.1,
            timeoutMs: 20000,
          },
          deadlineController.signal
        );

        parseResult = tryParseAndValidate(rawOutput);
      } catch (repairError) {
        if (repairError instanceof AiError) {
          throw repairError;
        }
        throw new AiError("AI triage repair call failed", {
          subtype: "invalid_output",
          userMessage: "The AI assistant produced an unparseable response.",
          cause: repairError,
        });
      }

      if (!parseResult.success) {
        throw new AiError(
          `AI output validation failed after repair: ${parseResult.errorMessage}`,
          {
            subtype: "invalid_output",
            userMessage: "The AI assistant produced an unparseable response that could not be repaired.",
            details: parseResult.errorMessage,
          }
        );
      }
    }

    const rawParsed = parseResult.data!;

    // Validate citations and filter out unsourced suggestions
    const { validatedOutput, droppedSuggestions } = validateCitations(rawParsed, {
      retrievedChunks: retrieved,
      recentEvents: input.recentEvents,
      sensorReadings: input.sensorReadings,
      equipmentType: input.equipmentType,
    });

    return {
      triage: validatedOutput,
      droppedSuggestions,
      rawResponse: rawOutput,
      repaired,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
