# Regen stories 85 stes (FDS→LIN) — etat reprise

Liste source: /tmp/stories-fast-1.json (85 tickers FDS..LIN)

## DONE (5)
FDS FDX FE FFIV FICO

## PENDING (80)
FIS FISV FITB FRT FSLR FTNT FTV GD GDDY GE GEHC GEN GILD GIS GLW GM GNRC GOOG GOOGL GPC GPN GRMN HAL HBAN HCA HD HIG HII HLT HON HOOD HPE HST HSY HUBB HUM HWM IBKR IBM ICE IDXX IEX IFF INCY INTC INTU INVH IP IQV IR IRM ISRG IT ITW IVZ J JBHT JBL JCI JKHY JNJ JPM KDP KEY KEYS KHC KIM KKR KMB KMI KO KR KVUE L LDOS LEN LH LHX LII LIN

## Methode (reprise identique)
1. ls data-lake/<T>/10Q/ | sort | tail -1 (fallback 10K si plus recent)
2. gunzip -dc <file> | python3 strip-html-to-text (voir script dans conv precedente, insere \n avant p/div/tr/br/table/h1-6/li)
3. grep -n -iE "revenue.*(increas|decreas)|Net income|Total revenues|segment.*revenue" sur texte extrait
4. Composer 5-8 stories JSON verbatim (voir format dans prompt original), append via python dans kpis[] de src/data/v2-pipeline/<t>.json (append seulement, ne pas toucher au reste du fichier)
5. Script append: /private/tmp/claude-501/-Users-yann/10cedc9f-5671-44ba-bad4-816404d68570/scratchpad/append_stories.py (ephemere, a recreer si besoin — logique: json.load, kpis.extend(stories), json.dump indent=2 ensure_ascii=False)

## Notes
- ZERO INVENTION: toutes valeurs verbatim depuis data-lake, jamais de calcul non sourcé sauf yoy simple (a-b)/b
- 40 tickers restants necessitent memes etapes, rythme ~5 tool calls/ticker
