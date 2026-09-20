#!/usr/bin/env node
/**
 * Yann 21 sept 2026 : sur Safari, l aperçu des graphiques moyen terme affichait
 * un carre avec un point d interrogation, alors que le SVG etait valide et
 * servi avec le bon type. Plutot que de chercher indefiniment la cause cote
 * navigateur, on double le systeme : chaque SVG a desormais un jumeau PNG,
 * rendu par sharp, que l affichage peut servir a coup sur.
 *
 * Usage :
 *   node scripts/findings-png.js               tous les SVG de public/findings
 *   node scripts/findings-png.js <chemin.svg>  un seul fichier
 *
 * Idempotent : un PNG plus recent que son SVG n est pas regenere.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const RACINE = path.join(__dirname, "..", "public", "findings");
const LARGEUR = 1200; // une fois et demie la largeur du gabarit, net sans peser

function listeSvg(dossier, acc = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) listeSvg(p, acc);
    else if (e.name.endsWith(".svg")) acc.push(p);
  }
  return acc;
}

async function convertir(svg) {
  const png = svg.replace(/\.svg$/, ".png");
  try {
    const sSvg = fs.statSync(svg);
    if (fs.existsSync(png) && fs.statSync(png).mtimeMs >= sSvg.mtimeMs) return "a jour";
  } catch {
    /* fichier disparu entre temps */
  }
  await sharp(fs.readFileSync(svg), { density: 200 })
    .resize({ width: LARGEUR })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(png);
  return "ecrit";
}

(async () => {
  const arg = process.argv[2];
  let fichiers;
  if (arg === "--liste") {
    // Liste de chemins publics (un par ligne) : on ne convertit que ceux la,
    // pour ne pas alourdir le depot avec des milliers d images inutilisees.
    const lignes = fs.readFileSync(process.argv[3], "utf8").split("\n").filter(Boolean);
    fichiers = lignes
      .map((l) => path.join(__dirname, "..", "public", l.replace(/^\//, "")))
      .filter((f) => f.endsWith(".svg") && fs.existsSync(f));
  } else {
    fichiers = arg ? [arg] : listeSvg(RACINE);
  }
  let ecrits = 0;
  let ajour = 0;
  let echecs = 0;
  for (const f of fichiers) {
    try {
      const r = await convertir(f);
      if (r === "ecrit") ecrits++;
      else ajour++;
    } catch (e) {
      echecs++;
      console.error("echec", f, e.message);
    }
  }
  console.log(`PNG : ${ecrits} ecrits, ${ajour} deja a jour, ${echecs} echecs, sur ${fichiers.length} SVG`);
})();
