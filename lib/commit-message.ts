import { Agent } from "@earendil-works/pi-agent-core";
import { buildSessionTitleAgentOptions } from "./session-title";

const COMMIT_TIMEOUT_MS = 90_000;
const MAX_DIFF_CHARS = 6000;

const COMMIT_PROMPT = `You are writing a git commit message for the change below.

Rules:
- Write the subject in <LANG>. If the project's source text suggests another
  primary language, follow the source; otherwise use <LANG>.
- Use conventional-commit style for the subject: <type>(<scope>): <subject>.
- Keep the subject under 72 characters. Keep the message concise.
- Base the message strictly on the change shown. Do not invent anything.
- Return only the commit message as plain text. Do not wrap it in code fences,
  no label prefix, no trailing explanation.`;

function languageName(lang?: string): string {
  if (lang === "zh-CN") return "简体中文";
  return "English";
}

/** Build the user-message content handed to the model. */
export function buildCommitPrompt(diffText: string, lang?: string): string {
  const truncated = diffText.length > MAX_DIFF_CHARS
    ? `${diffText.slice(0, MAX_DIFF_CHARS)}\n\n[truncated]`
    : diffText;
  return `${COMMIT_PROMPT.replaceAll("<LANG>", languageName(lang))}\n\nChange:\n${truncated}`;
}

function readAssistantMessage(agent: Agent): string {
  const messages = agent.state.messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    if (message.stopReason === "error") {
      throw new Error(message.errorMessage || "Commit message generation failed");
    }
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) continue;
    return text;
  }
  throw new Error("The model did not return a commit message");
}

/**
 * Ask the default AI (reused from the title generator's temp-Agent pattern) to
 * write a commit message from a diff summary. Throws when no answer is produced.
 */
export async function generateCommitMessageFromAgent(source: Agent, diffText: string, lang?: string): Promise<string> {
  await source.waitForIdle();
  const options = buildSessionTitleAgentOptions(source);
  const promptText = buildCommitPrompt(diffText, lang);
  options.initialState!.messages = [];

  const temporaryAgent = new Agent(options);
  const runPromise = temporaryAgent.prompt(promptText);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      runPromise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          temporaryAgent.abort();
          reject(new Error("Commit message generation timed out"));
        }, COMMIT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    temporaryAgent.abort();
    await runPromise.catch(() => {});
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  return readAssistantMessage(temporaryAgent);
}