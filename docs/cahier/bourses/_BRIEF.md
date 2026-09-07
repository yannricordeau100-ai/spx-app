# Brief : arborescence des bourses mondiales (07 sept 2026)

Mission du proprietaire : pour chaque pays, lister la composition ACTUELLE
(idealement septembre 2026, au pire courant 2026) de l indice principal et de
l indice secondaire de la bourse du pays. Le toggle /sandbox/bourses affichera
un arbre pays -> indice -> societes, avec un lien vers la fiche Mettrik quand
la societe est deja en ligne.

## Format du fichier docs/cahier/bourses/<CODE>.json

{
 "pays": "France",
 "code": "FR",
 "drapeau": "🇫🇷",
 "indices": [
   {
     "cle": "principal",            // "principal" | "secondaire" | pour USA : "sp500" | "nasdaq100" | "soxx"
     "nom": "CAC 40",
     "reference": "2026-09",        // date de la composition utilisee (AAAA-MM)
     "source": {"url": "...", "titre": "..."},
     "stes": [
       {
         "nom": "Air Liquide",
         "ticker": "AI.PA",         // ticker local usuel (suffixe Yahoo si europeen)
         "mettrik": "AI.PA",        // ticker EXACT present dans docs/cahier/societes-gics.json si la ste est dans l univers Mettrik, sinon null
         "sp500": false             // USA uniquement : true si la ste est aussi dans le S&P 500
       }
     ]
   },
   { "cle": "secondaire", ... }
 ]
}

## Regles absolues
- JAMAIS de societe inventee : chaque liste vient d une source identifiee
  (site de l operateur de bourse ou du fournisseur d indice d abord, sinon
  Wikipedia recent, sinon source financiere reconnue). Donner l URL.
- Composition la plus recente possible ; noter la date dans "reference".
- "mettrik" : comparer au fichier `docs/cahier/societes-gics.json` (cle
  "societes", tickers Mettrik). Correspondance par ticker OU par nom evident.
  En cas de doute : null.
- Le secondaire INCLUT parfois le principal (ex SBF 120 contient le CAC 40) :
  lister la composition complete telle que publiee, sans retirer les doublons.
- Pas de tiret long, pas de nom de personne. JSON valide, UTF-8 accentue.

## Indices retenus par pays (decision du 07 sept 2026)
| Pays | Principal | Secondaire |
|---|---|---|
| FR France | CAC 40 | SBF 120 |
| IT Italie | FTSE MIB | FTSE Italia Mid Cap |
| ES Espagne | IBEX 35 | IBEX Medium Cap |
| AT Autriche | ATX | ATX Prime |
| DE Allemagne | DAX 40 | MDAX |
| NL Pays-Bas | AEX | AMX |
| BE Belgique | BEL 20 | BEL Mid |
| CH Suisse | SMI | SMIM |
| AU Australie | S&P/ASX 50 | S&P/ASX 200 |
| SG Singapour | STI | FTSE ST Mid Cap |
| KR Coree du Sud | KOSPI 200 | (aucun) |
| JP Japon | Nikkei 225 | (aucun) |
| HK Hong Kong | Hang Seng | Hang Seng Composite MidCap |
| CA Canada | S&P/TSX 60 | S&P/TSX Composite |
| SE Suede | OMXS30 | OMX Stockholm Benchmark |
| GB Royaume-Uni | FTSE 100 | FTSE 250 |
| TW Taiwan | FTSE TWSE Taiwan 50 | TWSE Mid-Cap 100 |
| US USA | sp500 + nasdaq100 + soxx (3 indices distincts, champ "sp500" sur nasdaq100 et soxx) |
