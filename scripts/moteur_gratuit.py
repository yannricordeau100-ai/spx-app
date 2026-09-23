#!/usr/bin/env python3
"""Client des moteurs GRATUITS, partage par les scripts automatiques.

Yann 23 sept 2026. Pourquoi ce module : Yann possede deux comptes Max 20x et
bascule de l un a l autre dans l application Mac. La facturation suit le compte
CONNECTE AU MOMENT DE L EXECUTION, pas celui qui a ecrit le prompt. Une tache
automatique qui appelle `claude -p` tombe donc au hasard sur l un des deux
comptes : c est ainsi que 864 millions de jetons demandes depuis un compte ont
ete factures a l autre entre le 20 et le 22 septembre.

Regle qui en decoule : AUCUNE tache automatique n appelle Claude. Elles passent
toutes par Cerebras, avec repli Groq, puis Gemini. Si les trois echouent, le
script appelant doit ecrire un brouillon dans .conv-state et NE RIEN ecrire dans
src/data.

Usage :
    from moteur_gratuit import appelle, MoteurIndisponible
    texte, moteur = appelle(prompt)                 # texte brut
    donnees, moteur = appelle(prompt, json_attendu=True)   # JSON deja analyse

`moteur` vaut par exemple "cerebras:CEREBRAS2_API_KEY" ou "groq:llama-3.3-70b",
a journaliser pour savoir qui a repondu.
"""
from __future__ import annotations

import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# Modeles retenus : ceux deja utilises par les 59 scripts Cerebras et 15 Groq du
# depot, pour ne pas introduire un comportement different de l existant.
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
CEREBRAS_MODELES = ("gpt-oss-120b", "llama-3.3-70b")
# 23 sept 2026 : les trois cles Cerebras repondent « payment required », le
# palier gratuit est ferme. Cerebras reste en tete de liste au cas ou Yann
# rouvrirait un acces, mais c est Groq qui sert en pratique, puis Gemini.
# Le modele Groq llama-3.3-70b-versatile a ete retire du catalogue : les
# modeles reellement disponibles sont ceux listes ci dessous, verifies le
# 23 septembre 2026 contre l API.
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELES = ("openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b")
GEMINI_MODELES = ("gemini-2.0-flash", "gemini-2.5-flash")

_CLES_CB: list[tuple[str, str]] = []
_CB_EPUISEES: set[str] = set()


class MoteurIndisponible(RuntimeError):
    """Aucun moteur gratuit n a pu repondre. L appelant doit ecrire un brouillon."""


def charge_env(chemin: str = ".env.local") -> None:
    """Charge les cles depuis .env.local si elles ne sont pas deja dans l environnement."""
    try:
        with open(chemin) as f:
            for ligne in f:
                ligne = ligne.strip()
                if not ligne or ligne.startswith("#") or "=" not in ligne:
                    continue
                cle, val = ligne.split("=", 1)
                os.environ.setdefault(cle.strip(), val.strip().strip('"').strip("'"))
    except OSError:
        pass


def cles_cerebras() -> list[tuple[str, str]]:
    global _CLES_CB
    if not _CLES_CB:
        for nom in ("CEREBRAS_API_KEY", "CEREBRAS2_API_KEY", "CEREBRAS3_API_KEY"):
            val = os.environ.get(nom)
            if val:
                _CLES_CB.append((nom, val))
    return [(n, v) for n, v in _CLES_CB if n not in _CB_EPUISEES]


UA = "Mozilla/5.0 (Macintosh) Mettrik contact@mettrik.ai"


def _poste(url: str, corps: dict, entetes: dict, delai: int = 120) -> dict:
    # Sans agent utilisateur, la passerelle renvoie une erreur 1010 avant meme
    # d atteindre l API.
    entetes = {"User-Agent": UA, **entetes}
    req = urllib.request.Request(url, data=json.dumps(corps).encode(), headers=entetes)
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=delai) as r:
        return json.loads(r.read())


def analyse_json(contenu: str):
    """Extrait un objet JSON d une reponse, meme entouree de texte ou de balises."""
    contenu = re.sub(r"^```(?:json)?\s*|\s*```$", "", (contenu or "").strip())
    try:
        return json.loads(contenu)
    except json.JSONDecodeError:
        for motif in (r"\{.*\}", r"\[.*\]"):
            m = re.search(motif, contenu, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except json.JSONDecodeError:
                    continue
    return None


def _cerebras(prompt: str, json_attendu: bool, temperature: float):
    for nom_cle, cle in cles_cerebras():
        for modele in CEREBRAS_MODELES:
            for essai in range(2):
                corps = {
                    "model": modele,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                }
                if json_attendu:
                    corps["response_format"] = {"type": "json_object"}
                try:
                    rep = _poste(CEREBRAS_URL, corps,
                                 {"Authorization": f"Bearer {cle}", "Content-Type": "application/json"})
                    txt = rep["choices"][0]["message"]["content"]
                    return txt, f"cerebras:{nom_cle}:{modele}"
                except urllib.error.HTTPError as e:
                    if e.code in (429, 402):
                        # 429 : quota journalier. 402 : palier gratuit ferme.
                        # Dans les deux cas la cle ne servira plus de la session.
                        _CB_EPUISEES.add(nom_cle)
                        break
                    if e.code in (500, 502, 503) and essai == 0:
                        time.sleep(3)
                        continue
                    break
                except Exception:
                    if essai == 0:
                        time.sleep(2)
                        continue
                    break
    return None


def _groq(prompt: str, json_attendu: bool, temperature: float):
    cle = os.environ.get("GROQ_API_KEY")
    if not cle:
        return None
    for modele in GROQ_MODELES:
        for essai in range(2):
            corps = {
                "model": modele,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
            }
            if json_attendu:
                corps["response_format"] = {"type": "json_object"}
            try:
                rep = _poste(GROQ_URL, corps,
                             {"Authorization": f"Bearer {cle}", "Content-Type": "application/json"})
                return rep["choices"][0]["message"]["content"], f"groq:{modele}"
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    return None
                if e.code in (500, 502, 503) and essai == 0:
                    time.sleep(3)
                    continue
                return None
            except Exception:
                if essai == 0:
                    time.sleep(2)
                    continue
                return None
    return None


def _gemini(prompt: str, json_attendu: bool, temperature: float, schema=None):
    cle = os.environ.get("GEMINI_API_KEY")
    if not cle:
        return None
    for modele in GEMINI_MODELES:
        try:
            config = {"temperature": temperature}
            if json_attendu:
                config["responseMimeType"] = "application/json"
                # 24 sept 2026 : sur les longues reponses, Gemini oublie parfois
                # une accolade ; un schema impose une sortie JSON valide.
                if schema:
                    config["responseSchema"] = schema
            rep = _poste(
                f"https://generativelanguage.googleapis.com/v1beta/models/{modele}:generateContent?key={cle}",
                {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": config},
                {"content-type": "application/json"},
            )
            return rep["candidates"][0]["content"]["parts"][0]["text"], f"gemini:{modele}"
        except Exception:
            continue
    return None


def appelle(prompt: str, json_attendu: bool = False, temperature: float = 0.0, schema=None):
    """Interroge Cerebras, puis Groq, puis Gemini. Jamais Claude.

    Renvoie (reponse, moteur). `reponse` est le texte brut, ou l objet analyse
    quand json_attendu vaut vrai. Leve MoteurIndisponible si tout echoue : a ce
    moment l appelant ECRIT UN BROUILLON et n ecrit rien dans src/data.
    """
    charge_env()
    for fonction in (_cerebras, _groq, _gemini):
        res = fonction(prompt, json_attendu, temperature, schema) if fonction is _gemini else fonction(prompt, json_attendu, temperature)
        if not res:
            continue
        txt, moteur = res
        if not json_attendu:
            if txt and txt.strip():
                return txt, moteur
            continue
        donnees = analyse_json(txt)
        if donnees is not None:
            return donnees, moteur
    raise MoteurIndisponible(
        "Cerebras, Groq et Gemini ont tous echoue. Ecris un brouillon dans .conv-state, "
        "n ecris rien dans src/data, et n appelle jamais Claude depuis une tache automatique."
    )


def ecris_brouillon(dossier: str, nom: str, contenu) -> str:
    """Depose un brouillon a traiter a la main, hors de src/data."""
    racine = os.path.join(".conv-state", dossier)
    os.makedirs(racine, exist_ok=True)
    chemin = os.path.join(racine, nom)
    with open(chemin, "w") as f:
        if isinstance(contenu, (dict, list)):
            json.dump(contenu, f, ensure_ascii=False, indent=1)
        else:
            f.write(str(contenu))
    return chemin


if __name__ == "__main__":
    charge_env()
    print("cles Cerebras :", [n for n, _ in cles_cerebras()])
    print("Groq :", bool(os.environ.get("GROQ_API_KEY")), "| Gemini :", bool(os.environ.get("GEMINI_API_KEY")))
    try:
        txt, moteur = appelle("Reponds exactement : SONDE-OK")
        print("sonde :", moteur, "->", (txt or "").strip()[:40])
    except MoteurIndisponible as e:
        print("ECHEC :", e)
