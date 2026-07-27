# V195 N2 : etat au 27 juillet 2026

## Chiffres
- 733 stes en ligne (669 au debut de session, +64).
- Univers v1-9 : 990 tickers, ~325 restants hors ligne apres resolution des alias.

## Blocage push staging (A TRAITER HORS N2)
Le commit KPI v3 `6168aded6d` (devenu `552bcab954` apres purge locale) pese
4,8 Go a lui seul, dont deux PDF au-dessus de la limite GitHub de 100 Mo :
- data-lake/LULU/EP/LULU_2024-10-10_EP.pdf (399 Mo)
- data-lake/LULU/EP/LULU_2022-04-20_EP.pdf (233 Mo)
GitHub plafonne un push a 2 Go, d'ou le HTTP 500 systematique. Tant que ce
commit n'est pas decoupe en lots < 2 Go, staging ne peut plus etre pousse.
Branche de sauvegarde locale : `backup-avant-purge-pdf`.
Branche locale `staging-purged` = memes 6 commits sans les 2 PDF (toujours
4,8 Go, donc toujours non poussable seule).

## Contournement en place
Le travail N2 part sur la branche `n2-v195-heros`, greffee sur origin/staging.
Worktree : scratchpad/purge. Pour ajouter un lot :
1. commit dans ~/spx-app (branche staging)
2. `git -C <worktree> cherry-pick <sha>`
3. `git -C <worktree> push origin n2-v195-heros`
4. attendre le deploiement Vercel puis aliaser sur mettrik-niveau2.vercel.app

## Piege verifie
Un agent a produit pour KVUE une serie de 17 trimestres alors que
/Users/yann/Mettrik/sec-data/cat1-us/KVUE ne contient AUCUN filing (juste un
home-page-snapshot). Toujours faire verifier l'existence des sources avant
extraction, et sonder les valeurs produites contre les fichiers sources.

## Backlog agents : sources insuffisantes (< 5 exercices verbatim)
HOLN.SW (3 ans), IAG.L (4 ans), UU.L (1 an), JD.L (2 ans), ENT.L (2 ans),
ENEL.MI (4 ans non consecutifs, les rapports 2021-2023 sont Enel Americas),
KVUE (aucun filing).

## Backlog qualification : hero CA total 4 ans, KPIs specifiques < 4
PIRC.MI RNO.PA SN.L SSE.L WPP.L NXT.L PGHN.SW PRU.L MBG.DE ML.PA AUTO.L
EDV.L ELI.BR FBK.MI GBLB.BR GLE.PA HWDN.L MNDI.L SDR.L SMIN.L SMT.L SPX.L
WKL.AS BLND.L IMCD.AS A2A.MI UMI.BR CPG.L KPN.AS PROX.BR HIK.L LAND.L Q
KGF.L IP.MI CFR.SW(fait) LR.PA PSN.L TKO CVE.TO AGS.BR ENGI.PA CRDA.L
DSY.PA SGO.PA BG FTS.TO SATS CBK.DE VOD.L(fait) BKG.L

## Blocked tail connu (ne pas re-tenter)
ARM DTEGF BBVXF ARGX III.L BCP.LS SOLV ABVX
