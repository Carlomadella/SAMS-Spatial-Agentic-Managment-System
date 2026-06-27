import { getClient } from "./anthropic";
import { getSettings } from "./config";
import { createPullRequest } from "./github";
import { appendTaskLog, notionConfigured } from "./notion";
import { makeBranch, truncate } from "./agentTools";
import { logTask } from "./db";
import type { AssignBody, WireEvent } from "./types";

/**
 * Drive one Managed Agents session: mount the repo, send the task, stream the
 * agent's progress back through `emit`, then open a pull request.
 */
export async function runTask(body: AssignBody, emit: (e: WireEvent) => void): Promise<void> {
  const s = getSettings();
  const client = getClient();

  const agentId = body.agentId;
  const agentName = body.agentName || body.agentId;
  const title = body.title;
  const branch = body.branch?.trim() || makeBranch(agentName, title);

  emit({ agentId, agentName, status: "working", progress: 4, level: "INFO", message: `Avvio sessione · branch ${branch}` });

  const session = await client.beta.sessions.create({
    agent: s.agentId,
    environment_id: s.environmentId,
    title: `${agentName}: ${truncate(title, 60)}`,
    resources: [
      {
        type: "github_repository",
        url: `https://github.com/${s.githubRepo}`,
        authorization_token: s.githubToken,
        checkout: { type: "branch", name: s.baseBranch },
      },
    ],
  });

  emit({ agentId, agentName, level: "INFO", message: `Session ${session.id} creata su ${s.githubRepo}` });

  // Stream-first, then send the kickoff message (so we don't miss early events).
  const stream = await client.beta.sessions.events.stream(session.id);
  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text:
              `Task: ${title}\n\n` +
              `Work on branch: ${branch} (create it from ${s.baseBranch} if it doesn't exist).\n` +
              `When finished, commit your changes and push with: git push -u origin ${branch}\n` +
              `Then give a short summary of what changed.`,
          },
        ],
      },
    ],
  });

  let progress = 8;
  let sessionError = false;
  emit({ agentId, agentName, progress });

  for await (const ev of stream) {
    switch (ev.type) {
      case "session.status_running":
        emit({ agentId, agentName, status: "working", level: "INFO", message: "Agente al lavoro…" });
        break;
      case "agent.message": {
        // Content blocks may be non-text (tool_use, image…) — keep only text.
        const text = ev.content
          .map((b) => (b as { text?: string }).text ?? "")
          .join(" ")
          .trim();
        if (text) emit({ agentId, agentName, level: "INFO", message: truncate(text, 180) });
        break;
      }
      case "agent.tool_use": {
        progress = Math.min(92, progress + 7);
        const cmd = ev.input && typeof ev.input.command === "string" ? ` ${truncate(ev.input.command, 60)}` : "";
        emit({ agentId, agentName, progress, level: "INFO", message: `tool: ${ev.name}${cmd}` });
        break;
      }
      case "agent.tool_result":
        progress = Math.min(92, progress + 2);
        emit({ agentId, agentName, progress });
        break;
      case "span.model_request_end":
        progress = Math.min(92, progress + 1);
        emit({ agentId, agentName, progress });
        break;
      case "session.error":
        sessionError = true;
        emit({ agentId, agentName, status: "blocked", progress: 100, level: "ERROR", message: ev.error.message || "Errore di sessione" });
        break;
      default:
        break;
    }

    // Stop on terminal states or a fatal error (don't keep draining the stream).
    if (sessionError || ev.type === "session.status_terminated") break;
    if (ev.type === "session.status_idle") {
      if (ev.stop_reason.type === "requires_action") {
        emit({ agentId, agentName, level: "WARN", message: "L'agente attende una conferma non gestita — chiudo la sessione" });
      }
      break;
    }
  }

  // A failed session must not be reported as completed nor open a PR.
  if (sessionError) return;

  emit({ agentId, agentName, progress: 100, status: "review", level: "SUCCESS", message: "Lavoro completato" });
  logTask({ agentId, agentName, title, branch, status: "review", tokens: 0, ts: Date.now() });

  let prUrl: string | undefined;
  if (s.openPRs && s.githubToken) {
    try {
      const pr = await createPullRequest({
        branch,
        title,
        body: `Automated by SAMS agent **${agentName}**.\n\n**Task:** ${title}\n\n_Branch \`${branch}\` → \`${s.baseBranch}\`._`,
      });
      prUrl = pr.html_url;
      emit({ agentId, agentName, level: "SUCCESS", message: `PR #${pr.number}: ${pr.html_url}` });
    } catch (err) {
      emit({ agentId, agentName, level: "WARN", message: `PR non creata: ${(err as Error).message}` });
    }
  }

  if (notionConfigured()) {
    try {
      await appendTaskLog({ agentName, title, branch, repo: s.githubRepo, prUrl });
      emit({ agentId, agentName, level: "SUCCESS", message: "Notion: changelog aggiornato" });
    } catch (err) {
      emit({ agentId, agentName, level: "WARN", message: `Notion non aggiornato: ${(err as Error).message}` });
    }
  }
}
