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
