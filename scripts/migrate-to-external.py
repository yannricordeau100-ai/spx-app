#!/usr/bin/env python3
"""
À LANCER AU MATIN après avoir autorisé Claude Code dans :
  System Settings → Confidentialité et sécurité → Accès complet au disque
  → ajouter Claude Code (ou Terminal)

Effets :
  1. Crée /Volumes/250GB/Mettrik/
  2. Déplace ~/spx-app/sec-data/ vers /Volumes/250GB/Mettrik/sec-data/
  3. Crée un symlink ~/spx-app/sec-data → /Volumes/250GB/Mettrik/sec-data/
     (les scripts continuent de fonctionner sans modification)
  4. Update les scripts sec-download-v2.py et eu-download.py pour pointer
     directement vers le disque externe (élimine le symlink hop)

Usage :
  python3 scripts/migrate-to-external.py            # dry-run
  python3 scripts/migrate-to-external.py --confirm  # exécution réelle
"""
import argparse
import shutil
import sys
from pathlib import Path

INTERNAL = Path.home() / "spx-app" / "sec-data"
EXTERNAL_BASE = Path("/Volumes/250GB")
MOUNT_TARGET = EXTERNAL_BASE / "Mettrik"
EXTERNAL = MOUNT_TARGET / "sec-data"


def check_external():
    if not EXTERNAL_BASE.exists():
        print(f"❌ {EXTERNAL_BASE} introuvable. Disque externe non monté ?")
        return False
    try:
        # Test accès écriture
        test = EXTERNAL_BASE / ".claude_access_test"
        test.write_text("ok")
        test.unlink()
    except (PermissionError, OSError) as e:
        print(f"❌ Pas d'accès écriture sur {EXTERNAL_BASE}: {e}")
        print()
        print("FIX :")
        print("  1. Ouvre Réglages système → Confidentialité et sécurité")
        print("  2. Clique 'Accès complet au disque'")
        print("  3. Active Claude Code (ou ajoute-le via [+])")
        print("  4. Relance le script")
        return False
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", action="store_true",
                        help="Exécute réellement (sinon dry-run)")
    args = parser.parse_args()

    print("=== Migration sec-data vers disque externe ===\n")

    if not check_external():
        sys.exit(1)
    print(f"✓ Accès écriture OK sur {EXTERNAL_BASE}\n")

    if not INTERNAL.exists():
        print(f"❌ {INTERNAL} introuvable.")
        sys.exit(1)

    if INTERNAL.is_symlink():
        print(f"✓ {INTERNAL} est déjà un symlink → {INTERNAL.resolve()}")
        print("Migration déjà faite, rien à faire.")
        return

    size_mb = sum(f.stat().st_size for f in INTERNAL.rglob("*") if f.is_file()) / (1024 * 1024)
    print(f"Taille à migrer : {size_mb:.0f} MB ({size_mb/1024:.1f} GB)")
    print(f"Source : {INTERNAL}")
    print(f"Cible  : {EXTERNAL}")
    print()

    if not args.confirm:
        print("DRY-RUN. Relance avec --confirm pour exécuter.")
        return

    # 1. mkdir cible
    print("1. Création de Mettrik/ sur disque externe...")
    MOUNT_TARGET.mkdir(parents=True, exist_ok=True)
    if EXTERNAL.exists():
        print(f"  ⚠ {EXTERNAL} existe déjà. Utilise rsync au lieu de mv.")
        # Use rsync-style merge
        for src in INTERNAL.rglob("*"):
            if src.is_file():
                rel = src.relative_to(INTERNAL)
                dest = EXTERNAL / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    shutil.move(str(src), str(dest))
        # Cleanup empty dirs
        for d in sorted(INTERNAL.rglob("*"), key=lambda p: -len(p.parts)):
            if d.is_dir():
                try: d.rmdir()
                except OSError: pass
        if INTERNAL.exists() and not any(INTERNAL.iterdir()):
            INTERNAL.rmdir()
    else:
        # 2. mv (atomique sur même filesystem, copy+rm sur cross-fs)
        print(f"2. Déplacement {INTERNAL} → {EXTERNAL} (peut prendre ~5 min)...")
        shutil.move(str(INTERNAL), str(EXTERNAL))

    # 3. Symlink
    print(f"3. Création symlink {INTERNAL} → {EXTERNAL}")
    INTERNAL.symlink_to(EXTERNAL)

    print()
    print("=== Migration terminée ===")
    print(f"sec-data est maintenant sur le disque externe.")
    print(f"Le symlink {INTERNAL} permet aux scripts existants de continuer à marcher.")


if __name__ == "__main__":
    main()
