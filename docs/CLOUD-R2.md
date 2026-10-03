# Cloud des documents Mettrik : Cloudflare R2 (decision de Yann, 4 oct 2026)

A redonner tel quel quand Yann demande « les infos pour mettre en place le cloud ».

## Pourquoi
- Aucune sauvegarde en ligne des documents aujourd hui (seule une partie est sur GitHub).
- Depot git de 34 Go a cause des PDF et filings versionnes sans LFS ; 25 Go non suivis dans data-lake.
- Le SITE n en a pas besoin : il ne lit que src/data et docs/cahier embarques au deploiement (data-lake exclu par
  .vercelignore et next.config.ts). Le cloud sert aux scripts, crons, GitHub Actions et a la sauvegarde.

## Ce qui ira sur R2 (146 Go au 4 oct 2026)
| Dossier local | Taille | Contenu |
|---|---|---|
| ~/spx-app/data-lake/ | 37 Go (78 090 fichiers + 44 995 liens symboliques absolus vers ~/Mettrik/sec-data) | documents par societe : SEC (10K 10Q 8K DEF14A xbrl), Europe ir/URD ir/CP ir/TRIM, extractions json |
| ~/Mettrik/sec-data | 96 Go | SEC brut cat1-us, cat2-foreign-adr, cat3-european, cat-canadian, ir-scrape (41 Go) |
| ~/Mettrik/docs | 13 Go | ER, transcripts, supplements par societe |
Les liens symboliques ne seront pas copies comme liens : copier la cible (ou ne copier que sec-data et recreer l index).

## Cout
R2 : 10 Go gratuits, puis ~0,015 $ / Go / mois, sortie (telechargement) gratuite. 146 Go = environ 2 $ / mois.
Operations : classe A (ecriture) 1 M/mois gratuites, classe B (lecture) 10 M/mois gratuites : largement suffisant.
Ecartes : Supabase Storage (sortie payante), Vercel Blob (plus cher), Dropbox/Google Drive (pas d API S3, synchro lente).

## Compatibilite
R2 parle l API S3 : boto3 (Python), aws cli, rclone, @aws-sdk (Node) fonctionnent avec un endpoint
https://<ACCOUNT_ID>.r2.cloudflarestorage.com. GitHub Actions peut y lire et ecrire.

## Ce que Yann fait (5 min, sa connexion)
1. Compte Cloudflare (gratuit) puis R2 : activer (carte demandee, rien facture sous le gratuit).
2. Creer un bucket `mettrik-docs` (region automatique, Europe de preference).
3. Creer un jeton API R2 « Object Read & Write » limite a ce bucket.
4. Coller lui meme dans ~/spx-app/.env.local : R2_ACCOUNT_ID=, R2_ACCESS_KEY_ID=, R2_SECRET_ACCESS_KEY=, R2_BUCKET=mettrik-docs
   (et les memes en secrets GitHub si les Actions doivent y acceder). Ne jamais les mettre dans un message ou une URL.

## Ce que Claude fait ensuite
Etape A, sauvegarde seule (~2 h, aucun risque pour le site) :
- rclone (brew install rclone) configure depuis .env.local ; `rclone sync` de data-lake (suivi des liens), ~/Mettrik/sec-data,
  ~/Mettrik/docs vers mettrik-docs/{data-lake,sec-data,docs}/ ; premier envoi long (146 Go, quelques heures selon la connexion).
- Sync incrementale quotidienne ajoutee a la fin de daily-doc-watcher.sh (apres collecte), sans appel a Claude.
- Controle : nombre de fichiers et taille identiques des deux cotes.
Etape B, migration complete (1 a 2 jours, apres l ouverture du site) :
- ~85 scripts ecrivent des documents (77 citent data-lake, 48 sec-data, 14 ~/Mettrik/docs) : les faire ecrire via une
  fonction commune `stockage.py` (local + R2) au lieu de chemins en dur.
- Retirer les PDF et filings de git (git rm --cached + .gitignore), alleger le depot de 34 Go.
- Normaliser au passage : dossiers en minuscules (74), doublons de casse (5), noms des sous-dossiers ir/.

## Pieges a ne pas oublier
- Jamais `git add -A` sur data-lake (25 Go non suivis, 3 PDF > 100 Mo refuses par GitHub).
- Les liens symboliques du data-lake pointent en absolu vers /Users/yann/Mettrik/sec-data.
- data-lake/_homonymes-sec/ (depots SEC d homonymes) : a sauvegarder mais a ne jamais utiliser comme source.
