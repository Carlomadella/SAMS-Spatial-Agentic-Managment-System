import { anthropic } from "./anthropic";
import { config } from "./config";
import { createPullRequest } from "./github";
import type { AssignBody, WireEvent } from "./types";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "task"
  );
}

function makeBranch(agentName: string, title: string): string {
  const who = agentName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `sams/${who}/${slugify(title)}-${Date.now().toString(36)}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Drive one Managed Agents session: mount the repo, send the task, stream the
 * agent's progress back through `emit`, then open a pull request.
 */
export async function runTask(body: AssignBody, emit: (e: WireEvent) => void): Promise<void> {
  const agentId = body.agentId;
  const agentName = body.agentName || body.agentId;
  const title = body.title;
  const branch = body.branch?.trim() || makeBranch(agentName, title);

  emit({ agentId, agentName, status: "working", progress: 4, level: "INFO", message: `Avvio sessione · branch ${branch}` });

  const session = await anthropic.beta.sessions.create({
    agent: config.agentId,
    environment_id: config.environmentId,
    title: `${agentName}: ${truncate(title, 60)}`,
    resources: [
      {
        type: "github_repository",
        url: `https://github.com/${config.githubRepo}`,
        authorization_token: config.githubToken,
        checkout: { type: "branch", name: config.baseBranch },
      },
    ],
  });

  emit({ agentId, agentName, level: "INFO", message: `Session ${session.id} creata su ${config.githubRepo}` });

  // Stream-first, then send the kickoff message (so we don't miss early events).
  const stream = await anthropic.beta.sessions.events.stream(session.id);
  await anthropic.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text:
              `Task: ${title}\n\n` +
              `Work on branch: ${branch} (create it from ${config.baseBranch} if it doesn't exist).\n` +
              `When finished, commit your changes and push with: git push -u origin ${branch}\n` +
              `Then give a short summary of what changed.`,
          },
        ],
      },
    ],
  });

  let progress = 8;
  emit({ agentId, agentName, progress });

  for await (const ev of stream) {
    switch (ev.type) {
      case "session.status_running":
        emit({ agentId, agentName, status: "working", level: "INFO", message: "Agente al lavoro…" });
        break;
      case "agent.message": {
        const text = ev.content.map((b) => b.text).join(" ").trim();
        if (text) emit({ agentId, agentName, level: "INFO", message: truncate(text, 180) });
        break;
      }
      case "agent.tool_use": {
        progress = Math.min(92, progress + 7);
        const cmd = typeof ev.input.command === "string" ? ` ${truncate(ev.input.command, 60)}` : "";
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
        emit({ agentId, agentName, status: "blocked", level: "ERROR", message: ev.error.message || "Errore di sessione" });
        break;
      default:
        break;
    }

    if (ev.type === "session.status_terminated") break;
    if (ev.type === "session.status_idle") {
      if (ev.stop_reason.type === "requires_action") {
        emit({ agentId, agentName, level: "WARN", message: "L'agente attende una conferma non gestita — chiudo la sessione" });
      }
      break;
    }
  }

  emit({ agentId, agentName, progress: 100, status: "review", level: "SUCCESS", message: "Lavoro completato" });

  if (config.openPRs && config.githubToken) {
    try {
      const pr = await createPullRequest({
        branch,
        title,
        body: `Automated by SAMS agent **${agentName}**.\n\n**Task:** ${title}\n\n_Branch \`${branch}\` → \`${config.baseBranch}\`._`,
      });
      emit({ agentId, agentName, level: "SUCCESS", message: `PR #${pr.number}: ${pr.html_url}` });
    } catch (err) {
      emit({ agentId, agentName, level: "WARN", message: `PR non creata: ${(err as Error).message}` });
    }
  }
}
