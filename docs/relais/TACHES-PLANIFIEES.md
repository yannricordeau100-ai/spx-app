# Taches planifiees a recreer (elles meurent avec la session)

CronCreate, cron « 17,47 * * * * », recurrent, prompt :

REPRISE AUTOMATIQUE (Mettrik). 1) Lire l usage (get_usage de session_mgmt). 2) Si la limite hebdomadaire >= 96 % :
TaskStop de TOUS les workflows et agents, mettre docs/relais/EN-COURS.md a jour (statut interrompu + reprise exacte),
puis bash scripts/sauvegarde-relais.sh arret-96, puis CronDelete de cette tache et ne plus rien lancer ; dire a Yann en
2 lignes que le relais est pret. 3) Sinon, si aucun travail ne tourne : relancer les elements « interrompu » ou « a faire »
de docs/relais/EN-COURS.md dans l ordre, sans refaire ce qui est fait. 4) Sinon ne rien dire.
