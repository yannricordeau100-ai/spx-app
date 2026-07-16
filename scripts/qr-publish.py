#!/usr/bin/env python3
"""
PUBLICATION AUTONOME (GO Yann 16 juil 2026).

Périmètre STRICT du GO : publier automatiquement les stés du run quotidien
dont les 3 verrous sont verts (statut PUBLIABLE dans l'historique) :
  verrou 1 = double extraction concordante,
  verrou 2 = 100 % des KPI mis à jour + aucun bloc texte en attente,
  verrou 3 = audit de rendu sans problème.
Les stés BLOQUÉES ne sont JAMAIS publiées. Tout autre travail en cours dans
le repo n'est PAS embarqué (git add ciblé fichier par fichier).

Chaîne : sanity JSON → git add ciblé → commit → push → deploy hook →
attente READY → alias mettrik-niveau2 → curl verify des pages publiées →
résultat écrit dans l'historique (_quarterly-refresh-history.json).

Usage : qr-publish.py [--dry-run]
"""
from __future__ import annotations
import json
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
HIST = ROOT / "src/data/_quarterly-refresh-history.json"
RUN_RESULT = ROOT / ".conv-state/quarterly-refresh-run-result.json"
DRY = "--dry-run" in sys.argv


def log(msg: str) -> None:
    print(f"[publish] {msg}", flush=True)


def load(p: Path):
    try:
        return json.loads(p.read_text("utf8"))
    except Exception:
        return None


def env() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in (ROOT / ".env.local").read_text("utf8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def sh(cmd: list[str], timeout: int = 300) -> tuple[int, str]:
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return r.returncode, (r.stdout + r.stderr).strip()


def http_json(url: str, headers: dict[str, str] | None = None, method: str = "GET"):
    req = urllib.request.Request(url, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf8"))


def record(pub: dict) -> None:
    hist = load(HIST) or {"runs": []}
    if hist.get("runs"):
        hist["runs"][0]["publication"] = pub
        HIST.write_text(json.dumps(hist, ensure_ascii=False, indent=2))


def main() -> int:
    hist = load(HIST) or {"runs": []}
    if not hist.get("runs"):
        log("aucun run dans l'historique, rien à publier")
        return 0
    last = hist["runs"][0]
    publiables = [t for t, s in (last.get("stes") or {}).items() if s.get("statut") == "PUBLIABLE"]
    bloquees = [t for t, s in (last.get("stes") or {}).items() if s.get("statut") != "PUBLIABLE"]
    if not publiables:
        log(f"0 sté publiable ({len(bloquees)} bloquée(s)), rien à publier")
        record({"at": datetime.now(timezone.utc).isoformat(), "published": [],
                "skipped": bloquees, "note": "aucune sté avec les 3 verrous verts"})
        return 0

    # Fichiers data touchés par le run pour ces stés uniquement.
    run = load(RUN_RESULT) or {"results": []}
    files: list[str] = []
    for r in run.get("results", []):
        if r["ticker"] not in publiables:
            continue
        ef = r.get("blocks_auto", {}).get("enrich_file") or r.get("enrich_file")
        base = r["ticker"].lower()
        for cand in ([ef] if ef else []) + [
            f"src/data/v2-pipeline-enrich/{base}.json",
            f"src/data/v2-pipeline-enrich/{base}.quarterly-history.json",
            f"src/data/v2-pipeline/{base}.json",
        ]:
            if cand and (ROOT / cand).exists() and cand not in files:
                files.append(cand)
    # + historique des runs (trace de la publication)
    files.append("src/data/_quarterly-refresh-history.json")

    # Sanity : chaque JSON doit parser (aucune publication de fichier corrompu).
    for f in files:
        if load(ROOT / f) is None:
            log(f"ABANDON : {f} illisible/corrompu")
            record({"at": datetime.now(timezone.utc).isoformat(), "published": [],
                    "error": f"fichier corrompu: {f}"})
            return 1

    if DRY:
        log(f"DRY-RUN : publierait {publiables} via {len(files)} fichier(s)")
        return 0

    # Git : add ciblé + commit + push (le remote porte déjà le token).
    rc, out = sh(["git", "add", "--"] + files)
    if rc != 0:
        log(f"git add KO: {out[:300]}"); return 1
    rc, out = sh(["git", "diff", "--cached", "--quiet"])
    if rc == 0:
        log("aucun changement à committer (déjà publié ?)")
        record({"at": datetime.now(timezone.utc).isoformat(), "published": [],
                "note": "aucun diff"})
        return 0
    msg = (f"data(cron): publication auto de {len(publiables)} sté(s) 3-verrous-verts "
           f"({', '.join(publiables[:12])}{'…' if len(publiables) > 12 else ''})\n\n"
           f"Périmètre GO Yann 16 juil 2026 : uniquement les stés PUBLIABLES du run "
           f"(double extraction concordante + complétude 100% + audit rendu OK).")
    rc, out = sh(["git", "commit", "-m", msg])
    if rc != 0:
        log(f"git commit KO: {out[:300]}"); return 1
    rc, out = sh(["git", "push", "origin", "staging"], timeout=600)
    if rc != 0:
        log(f"git push KO: {out[:300]}")
        record({"at": datetime.now(timezone.utc).isoformat(), "published": [],
                "error": "git push KO"})
        return 1
    log(f"pushé : {len(publiables)} sté(s)")

    # Deploy + alias + verify.
    e = env()
    hook, vtoken = e.get("VERCEL_DEPLOY_HOOK_STAGING"), e.get("VERCEL_TOKEN")
    token = e.get("VISUAL_AUDIT_TOKEN", "")
    if not hook or not vtoken:
        log("env Vercel manquante, publication git faite mais deploy manuel requis")
        record({"at": datetime.now(timezone.utc).isoformat(), "published": publiables,
                "warning": "deploy hook/token manquant"})
        return 1
    try:
        http_json(hook, method="POST")
    except Exception as ex:
        log(f"deploy hook KO: {ex}"); return 1
    deploy_url = None
    for _ in range(40):  # jusqu'à 20 min
        time.sleep(30)
        try:
            d = http_json("https://api.vercel.com/v6/deployments?limit=1",
                          {"Authorization": f"Bearer {vtoken}"})["deployments"][0]
        except Exception:
            continue
        if d.get("readyState") == "READY":
            deploy_url = d["url"]
            break
        if d.get("readyState") in ("ERROR", "CANCELED"):
            log(f"deploy {d.get('readyState')}")
            record({"at": datetime.now(timezone.utc).isoformat(), "published": publiables,
                    "error": f"deploy {d.get('readyState')}"})
            return 1
    if not deploy_url:
        log("deploy jamais READY (timeout 20 min)"); return 1
    rc, out = sh(["npx", "vercel", "alias", "set", deploy_url,
                  "mettrik-niveau2.vercel.app", f"--token={vtoken}"], timeout=120)
    if rc != 0:
        log(f"alias KO: {out[:200]}"); return 1

    # Verify : chaque page publiée répond 200.
    verified, failed = [], []
    for t in publiables:
        url = (f"https://mettrik-niveau2.vercel.app/sandbox/v1-9-5/{t.lower()}"
               f"?audit_token={token}&cb={int(time.time())}")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mettrik-publish-verify"})
            with urllib.request.urlopen(req, timeout=45) as resp:
                (verified if resp.status == 200 else failed).append(t)
        except Exception:
            failed.append(t)
        time.sleep(0.3)
    log(f"vérifiées: {len(verified)}/{len(publiables)} (échecs: {failed or 'aucun'})")
    record({"at": datetime.now(timezone.utc).isoformat(), "published": publiables,
            "deploy": deploy_url, "verified_200": verified, "verify_failed": failed})
    # L'historique modifié après coup sera embarqué au prochain run (trace ok en local).
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
