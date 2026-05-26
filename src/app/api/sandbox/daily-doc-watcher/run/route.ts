import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

/**
 * POST /api/sandbox/daily-doc-watcher/run
 * Admin-gated (email = DESK_OWNER_EMAIL).
 *
 * Déclenche scripts/daily-doc-watcher.sh en arrière-plan (detached). Renvoie
 * immédiatement avec un message d'accusé. La page admin doit être rechargée
 * pour voir les résultats (le script met à jour
 * src/data/_daily-doc-watcher-status.json en fin de run).
 */

export const dynamic = "force-dynamic";

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, email: user.email };
}

export async function POST() {
  const r = await requireOwner();
  if (!r.ok) return r.response;

  // En prod Vercel, on ne peut pas spawn un script bash : filesystem read-only +
  // pas d'accès aux scripts/. Cette route n'a de sens qu'en local (cron + run
  // manuel depuis le Mac de Yann).
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        error: "vercel_unsupported",
        message:
          "Le run manuel n'est pas disponible en prod Vercel. Le cron 04h00 local Mac s'en occupe.",
      },
      { status: 503 },
    );
  }

  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, "scripts/daily-doc-watcher.sh");

  try {
    await fs.access(scriptPath, fs.constants.X_OK);
  } catch {
    return NextResponse.json(
      { error: "script_not_found", path: scriptPath },
      { status: 500 },
    );
  }

  // Spawn detached, redirige stdout/stderr vers /tmp/daily-doc-watcher.log.
  // Le process parent (Next.js) ne attend pas la fin.
  const logPath = "/tmp/daily-doc-watcher.log";
  try {
    const out = await fs.open(logPath, "a");
    const child = spawn("/bin/bash", [scriptPath], {
      cwd: projectRoot,
      detached: true,
      stdio: ["ignore", out.fd, out.fd],
      env: { ...process.env, DAILY_DOC_WATCHER_TRIGGER: "manual" },
    });
    child.unref();
    out.close().catch(() => {});

    return NextResponse.json({
      ok: true,
      message: `Script lancé en arrière-plan (pid ${child.pid}). Logs: ${logPath}. Recharge la page dans ~10-20 min pour voir les résultats.`,
      pid: child.pid,
      log_path: logPath,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "spawn_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
