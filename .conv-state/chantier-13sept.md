# Chantier du 13 sept 2026 (Yann, deux prompts) — etat tenu a jour par Claude

## Prompt A
A1 Doublons KPI : FAIT. scripts/scan-kpi-doublons.py --apply dans la chaine 23h ; 13 retires le 13 sept ; rapport .conv-state/kpi-doublons.json. AI.PA recurrent vs publie = 2 mesures reelles (pas un doublon).
A2 Systeme de mise a jour : FAIT (page /sandbox/mises-a-jour, calendrier passe+futur 529 stes, regles src/data/mise-a-jour-regles.json + CLAUDE.md §8, alerte /api/cron/alertes-maj cron Vercel 06:05 UTC + chaine 23h, email envoye le 13 sept : 494 blocs rouges / 384 stes). Transcripts : 177 US rafraichis (MarketBeat) ; EU impossible (MarketBeat sans transcripts EU, FMP ferme). Manque : cron du bloc Positionnement IA, secret GitHub FMP_PAID_API_KEY (Yann).
A3 FAIT : 666 stes ; /sandbox/bourses liste les stes dans 2 indices.
A4 FAIT : 53 series ajoutees, 13 series existantes allongees, 38 deja presentes, 4 gardees (mienne plus complete), 63 indisponibles listes ; 18 choix de Yann reappliques en hero. Qualite ChatGPT : MOYENNE (12/29 valeurs concordantes a 5 % sur produits identiques).

## Prompt B
B1 IDE CHE-281.919.422 cree dans Stripe (txi_1UF3OKClUEb0T7vSOKl5GU06) ; l activation par defaut sur les factures est refusee par l API : Yann doit cocher dans Stripe > Parametres > Factures > Numero d identification fiscale. Pas de TVA : rien a faire. Nom deja « Mettrik AI ».
B2 FAIT : titre « Mettrik AI · Les chiffres qui font bouger chaque action » pose partout ; finalistes proposes a Yann.
B3 FAIT : market-position-card sourceMasquee (categorie vraie generique).
B4 FAIT par agent : 4 risques ajoutes, scores revus, 2 875 remplacements « 10-K ».
B5 FAIT.
B6 FAIT : /sandbox/valeurs-approximatives (145 cas, 11 a trancher).

Regle : ne pas executer une partie a gros doute ; expliquer clairement.

## Prompt C (13 sept, soir)
C1 Emails : FAIT (resend.ts emailAutorise : seuls billing-failed, contact, support, alerte ; bienvenue et onboarding bloques sauf @mettrik.ai ; auth Supabase inchangee).
C2 MarketBeat vs FMP : calendrier US = MarketBeat (scripts/marketbeat-calendar.py, fusion dans build-earnings-calendar.py), transcripts US = MarketBeat ; FMP optionnel (endpoints EU et transcripts fermes par l abonnement). Positionnement IA : etape 4bis de la tache nocturne maj-societes-nuit.
C3 S&P 500 : RDDT, FERG, FLEX, FDXF ajoutees (agents Opus, verif-societe.py sans manque) ; univers 670 ; veille /api/cron/veille-indices (Wikipedia S&P, portail Nasdaq NDX) cron Vercel 06:35 UTC, email aux entrees/sorties ; FAUX EMAIL envoye le 13 sept (Nasdaq lu vide avant garde-fou) : a ignorer. Sorties du S&P (AVB CAG CPB EA EPAM EQR POOL) conservees en ligne. « Boom Energy » = Bloom Energy (BE), entree S&P 500 sept 2026 : ajout lance (agent) le 13 sept soir. Audit des stes recentes : SPCX (agent) + 28 US en 2 lots (agents), EU des vagues d aout non reauditees.
C4 Produit phare : 108 stes restantes (.conv-state/phare-reste.json), lots de 20 par agent Opus, sorties docs/cahier/produit-phare/externe/sorties/claude/, integration par scripts/phare-integrer-externe.py (adapter EXT).
C5 « 666 » : src/lib/univers.ts NB_SOCIETES (dynamique) dans layout et page ; sandbox : textes generiques.
C6 Indices : /sandbox/indices (S&P 500, Nasdaq 100, SOXX, CAC 40, DAX, AEX, SMI), src/data/indices-composition.json (scripts/indices-wikipedia.py).
- build-v17-public.ts DETRUIT v1-7-public.json (isStrictPass3 rejette tout) : NE PAS LANCER (audit 13 sept). Traductions EN/DE : cles Cerebras/Groq HS (payment_required, 401) : action Yann.
