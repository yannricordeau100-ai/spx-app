import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";
import { getServerLocale } from "@/lib/i18n/server";

export const metadata = {
  title: "Conditions générales d'utilisation et de vente · Mettrik AI",
  description:
    "Conditions générales d'utilisation et de vente du site et des abonnements Mettrik AI.",
};

/**
 * Document légal unique combinant CGU (utilisation) et CGV (vente).
 * Fusion demandée par Yann le 3 mai 2026 : un seul corpus contractuel
 * pour simplifier la lecture utilisateur, plutôt que 2 docs séparés
 * avec doublons (qualification user, VPN, anti-IA, force majeure).
 *
 * Plan :
 *   PARTIE I — Conditions générales d'utilisation (accès au service)
 *   PARTIE II — Conditions générales de vente (abonnements payants)
 *   PARTIE III — Dispositions communes (PI, anti-IA, responsabilité, juridiction)
 */
const STR = {
  fr: {
    title: "Conditions générales d'utilisation et de vente",
    updatedAt: "3 mai 2026",
    intro_1_a: "Les présentes conditions générales (ci-après les «",
    intro_1_b: "Conditions",
    intro_1_c: "») régissent l'accès et l'utilisation du site",
    intro_1_site: "www.mettrik.ai",
    intro_1_d: "ainsi que la souscription d'abonnements à ses services payants (ci-après les «",
    intro_1_e: "Services",
    intro_1_f: "»). Elles forment un unique corpus contractuel, organisé en trois parties : utilisation (Partie I), vente (Partie II) et dispositions communes (Partie III).",
    intro_2: "En accédant au site ou en souscrivant à un abonnement, vous reconnaissez avoir pris connaissance des présentes Conditions et les accepter sans réserve.",

    s0_title: "0. Identité de l'éditeur et du vendeur",
    s0_p1_a: "L'éditeur du site et le vendeur des abonnements est",
    s0_p1_b: "AIRSCAPE",
    s0_p1_c: "(exploitant la marque",
    s0_p1_d: "Mettrik AI",
    s0_p1_e: "), dont le siège social est situé :",
    s0_p1_addr: "60 rue François 1er, 75008 Paris, France",
    s0_p1_f: ".",
    s0_p2_a: "SIREN : 935 055 137 · TVA intracommunautaire : FR16935055137 · Email :",

    part1_title: "Partie I · Utilisation du service",

    s11_title: "I.1 Objet du service",
    s11_p1: "Mettrik AI est une plateforme d'intelligence KPI (« KPI Intelligence ») destinée principalement aux investisseurs professionnels (asset managers, family offices, analystes financiers) et accessoirement aux particuliers avertis.",
    s11_p2: "Le service propose une analyse synthétique d'indicateurs clés de performance des sociétés cotées en bourse, extraits de leurs publications financières officielles, enrichis par des méthodologies de scoring propriétaires (Super KPIs, indicateurs composites, scores de qualité, scores de risque).",
    s11_p3_b: "Statut éditorial.",
    s11_p3_t: "Les contenus diffusés sur Mettrik AI constituent des",
    s11_p3_b2: "opinions éditoriales",
    s11_p3_t2: "au sens de l'article 11 de la Déclaration des Droits de l'Homme et du Citoyen et de l'article L. 121-1 du Code de la consommation. Ils ne constituent ni un conseil en investissement (au sens de L. 541-1 du Code monétaire et financier), ni une recommandation personnalisée d'achat ou de vente d'instruments financiers, ni une sollicitation à investir.",
    s11_p4: "Les performances passées ne préjugent pas des performances futures. Toute décision d'investissement relève de la seule responsabilité de l'utilisateur.",

    s12_title: "I.2 Qualification de l'utilisateur (particulier ou professionnel)",
    s12_p1_a: "Lors de la création du compte ou de la souscription, l'utilisateur indique sa qualité :",
    s12_p1_b: "particulier",
    s12_p1_c: "(consommateur, au sens de l'article liminaire du Code de la consommation) ou",
    s12_p1_d: "professionnel",
    s12_p1_e: "(au sens de l'article L. 121-1 du Code de la consommation).",
    s12_p2_a: "La qualité",
    s12_p2_b: "professionnel",
    s12_p2_c: "est sélectionnée par défaut, reflétant la cible principale du service.",
    s12_p3: "Cette qualification détermine les régimes applicables :",
    s12_li1_b: "Particuliers (B2C)",
    s12_li1_t: ": application du Code de la consommation, droit de rétractation (sous réserve de l'article II.4 ci-dessous), médiateur de la consommation, juridiction protectrice.",
    s12_li2_b: "Professionnels (B2B)",
    s12_li2_t: ": pas de droit de rétractation (article L. 221-3 Code conso), pas de bénéfice de la loi Hamon, juridiction commerciale exclusive de Paris.",

    s13_title: "I.3 Accès au service",
    s13_p1: "Le site est accessible 24 heures sur 24, 7 jours sur 7, sauf cas de force majeure ou opérations de maintenance. Mettrik AI ne saurait être tenue responsable des interruptions ou ralentissements du service.",
    s13_p2_a: "Certains contenus avancés sont réservés aux abonnés",
    s13_p2_b: "Premium",
    s13_p2_c: ". Les modalités d'abonnement sont détaillées dans la Partie II ci-après.",

    s14_title: "I.4 Compte utilisateur (caractère personnel et nominatif)",
    s14_p1: "La création d'un compte est gratuite et donne accès à un nombre limité de sociétés en plan Free. L'utilisateur s'engage à fournir des informations exactes et à jour lors de son inscription, et à préserver la confidentialité de son mot de passe.",
    s14_p2_a: "Chaque compte est",
    s14_p2_b: "strictement personnel et nominatif",
    s14_p2_c: ". Un abonnement Premium ouvre l'accès au service à un et un seul utilisateur identifié, depuis un nombre raisonnable d'appareils utilisés par cette même personne (typiquement ordinateur + smartphone personnel).",
    s14_p3_a: "Le partage des identifiants, l'accès simultané ou alterné depuis plusieurs personnes physiques, l'accès via comptes mutualisés ou organisations multiples relèvent exclusivement de l'abonnement",
    s14_p3_b: "Enterprise",
    s14_p3_c: ".",
    s14_p4_a: "Mettrik AI met en œuvre des dispositifs techniques de détection des accès simultanés ou alternés depuis des contextes incompatibles (signatures de navigateur, géolocalisation IP, fréquence de connexion, empreintes d'appareil). En cas de partage avéré :",
    s14_p4_b: "résiliation immédiate sans remboursement",
    s14_p4_c: "et facturation rétroactive de chaque utilisateur additionnel détecté au tarif Premium en vigueur, conformément à l'article L. 122-4 du Code de la propriété intellectuelle.",
    s14_p5_a: "L'utilisateur est responsable de toute activité effectuée depuis son compte. En cas d'utilisation frauduleuse, il s'engage à en informer immédiatement Mettrik AI à l'adresse",
    s14_p5_b: ".",

    s15_title: "I.5 Interdiction d'utilisation de VPN et de réseaux d'anonymisation",
    s15_p1_a: "L'utilisation de tout réseau virtuel privé (",
    s15_p1_vpn: "VPN",
    s15_p1_b: "), proxy, service de masquage IP, réseau d'anonymisation (TOR, IPSec tunnel, services équivalents) ou tout autre moyen visant à dissimuler, modifier ou rerouter l'origine de la connexion est",
    s15_p1_c: "strictement interdite",
    s15_p1_d: "pour accéder au service Mettrik AI, directement ou indirectement.",
    s15_p2_a: "Toute connexion détectée via VPN ou proxy entraîne la",
    s15_p2_b: "suspension automatique du compte",
    s15_p2_c: "le temps de vérification. Les VPN d'entreprise utilisés par les abonnés Enterprise font l'objet d'un agrément préalable au cas par cas, sur demande motivée.",

    s16_title: "I.6 Obligations générales de l'utilisateur",
    s16_p1: "L'utilisateur s'engage à utiliser le service conformément aux présentes Conditions et aux lois en vigueur, et à ne pas porter atteinte à la sécurité ou à l'intégrité du service. Les interdictions techniques et la clause anti-IA font l'objet de l'article III.2 ci-après.",

    s17_title: "I.7 Données et sources, délais d'actualisation",
    s17_p1: "Mettrik AI utilise des données financières publiquement disponibles, principalement extraites des dépôts réglementaires (10-K, 10-Q, 8-K aux États-Unis ; rapports équivalents en Europe et Asie). Chaque donnée est accompagnée d'un indicateur de fraîcheur et, lorsque possible, d'un lien vers la source originale.",
    s17_p2_b: "Délai d'actualisation.",
    s17_p2_t: "Même lorsqu'une mention « en temps réel », « live », « à jour » ou équivalente est affichée, les données peuvent comporter un",
    s17_p2_b2: "décalage de plusieurs secondes, plusieurs minutes voire plusieurs heures",
    s17_p2_t2: "par rapport à la valeur effective sur les marchés (différé de feed, latences réseau, traitements algorithmiques, fenêtres de mise à jour). Mettrik AI ne garantit en aucun cas la disponibilité des données en temps réel strict.",
    s17_p3: "L'utilisateur est invité à vérifier les données critiques auprès des sources officielles avant toute décision d'investissement.",

    part2_title: "Partie II · Vente et abonnements",

    s21_title: "II.1 Offres d'abonnement",
    s21_p1: "Mettrik AI propose les abonnements suivants :",
    s21_li1_b: "Free",
    s21_li1_t: ": 0 € / mois. Accès limité (sociétés de démonstration).",
    s21_li2_b: "Premium mensuel",
    s21_li2_t: ": 24,90 € HT / mois. Accès complet aux sociétés couvertes, comparaison, watchlists, alertes.",
    s21_li3_b: "Premium annuel",
    s21_li3_t: ": 189 € HT / an. Mêmes fonctionnalités, économie d'environ 37 %.",
    s21_li4_b: "Enterprise / API",
    s21_li4_t: ": sur devis. Multi-utilisateurs, accès API, support dédié.",
    s21_p2_a: "Les prix sont indiqués hors taxes. La TVA applicable (taux du pays de résidence de l'utilisateur) est ajoutée automatiquement par notre prestataire de paiement",
    s21_p2_b: "Stripe",
    s21_p2_c: "au moment du paiement.",

    s22_title: "II.2 Souscription et paiement",
    s22_p1_a: "La souscription s'effectue en ligne via la plateforme de paiement sécurisée",
    s22_p1_b: "Stripe",
    s22_p1_c: ", conforme aux normes PCI-DSS. Mettrik AI n'a accès à aucune donnée bancaire.",
    s22_p2: "La souscription prend effet immédiatement après confirmation du paiement. L'utilisateur reçoit une confirmation par email à l'adresse renseignée lors de l'inscription.",

    s23_title: "II.3 Renouvellement et résiliation",
    s23_p1_a: "Les abonnements Premium se renouvellent",
    s23_p1_b: "automatiquement par tacite reconduction",
    s23_p1_c: "à la fin de chaque période (mensuelle ou annuelle), pour une durée identique à celle de la période initiale, sans nécessité de notification préalable.",
    s23_p2_a: "La résiliation est possible à tout moment depuis l'espace personnel utilisateur. Elle prend effet à la fin de la période en cours.",
    s23_p2_b: "Aucun remboursement, total ou partiel, n'est effectué pour la période entamée",
    s23_p2_c: ", quelle que soit la fraction restant à courir.",
    s23_p3_b: "Résolution unilatérale par Mettrik AI.",
    s23_p3_t: "Mettrik AI se réserve le droit de résilier unilatéralement et sans préavis tout abonnement en cas (a) d'impayé, (b) de violation des présentes Conditions, (c) d'usage frauduleux, abusif ou non conforme du service, (d) de partage avéré du compte, (e) d'usage de VPN ou de moyens d'anonymisation, (f) d'extraction automatisée ou d'usage IA non autorisé, (g) de contestation, charge-back ou litige bancaire, (h) de toute autre situation portant atteinte à Mettrik AI ou à ses autres abonnés. La résiliation unilatérale ne donne droit à aucun remboursement.",

    s24_title: "II.4 Exclusion du droit de rétractation (service personnalisé)",
    s24_p1_a: "Conformément à l'article L. 221-28 3° du Code de la consommation, le droit de rétractation",
    s24_p1_b: "ne s'applique pas",
    s24_p1_c: "aux contrats portant sur la",
    s24_p1_d: "fourniture d'un service de contenu numérique personnalisé",
    s24_p1_e: ", exécuté immédiatement à la souscription.",
    s24_p2_a: "Le service Mettrik AI consiste en la fourniture",
    s24_p2_b: "personnalisée et continue",
    s24_p2_c: "de KPIs sélectionnés en fonction du profil de l'utilisateur, de ses watchlists, de ses préférences sectorielles, de son historique de comparaisons et de ses paramètres d'alertes : il s'agit d'un service personnalisé au sens de l'article précité, dont l'exécution commence immédiatement à la souscription avec consentement express de l'utilisateur (case dédiée cochée au checkout).",
    s24_p3_a: "Cette exclusion est rappelée explicitement au moment du paiement.",
    s24_p3_b: "Aucun droit de rétractation ne s'applique aux abonnements professionnels",
    s24_p3_c: "(article L. 221-3 Code conso).",

    s25_title: "II.5 Modifications de prix",
    s25_p1: "Mettrik AI se réserve le droit de modifier ses tarifs à tout moment. Toute modification est notifiée aux abonnés au moins 30 jours avant son entrée en vigueur, par email à l'adresse associée au compte. L'utilisateur peut résilier son abonnement avant l'entrée en vigueur du nouveau tarif sans frais.",

    s26_title: "II.6 Facturation",
    s26_p1: "Une facture est émise automatiquement à chaque échéance d'abonnement et envoyée par email. Toutes les factures sont également téléchargeables depuis l'espace personnel.",

    part3_title: "Partie III · Dispositions communes",

    s31_title: "III.1 Propriété intellectuelle (œuvres dérivées cumulatives)",
    s31_p1: "Les contenus présentés sur Mettrik AI sont de deux natures :",
    s31_li1_b: "Données primaires sources",
    s31_li1_t: ": chiffres financiers, déclarations, faits relatifs aux sociétés cotées analysées, issus de publications officielles (rapports annuels, trimestriels, communiqués réglementaires). Ces données restent la propriété de leurs auteurs respectifs.",
    s31_li2_b: "Contenus générés et travaillés par Mettrik AI",
    s31_li2_t: ": méthodologies de scoring, indicateurs composites, interprétations éditoriales, analyses comparatives, scores de qualité, scores de risque, classements, agrégations, visualisations. Ces contenus sont la",
    s31_li2_b2: "propriété exclusive de Mettrik AI",
    s31_li2_t2: ", protégés par le droit d'auteur, le droit des bases de données (art. L. 341-1 et suivants CPI), et le droit sui generis du producteur.",
    s31_p2_b: "Œuvres dérivées cumulatives.",
    s31_p2_t: "Chaque mise à jour algorithmique, méthodologique ou éditoriale constitue une",
    s31_p2_b2: "œuvre dérivée nouvelle",
    s31_p2_t2: "protégée de manière cumulative (art. L. 113-2 CPI). La fin de l'abonnement ne donne aucun droit d'usage sur les versions accédées historiquement.",
    s31_p3: "L'abonnement confère à l'utilisateur un droit d'usage personnel, non exclusif et non transférable. Toute reproduction, redistribution, republication, revente, adaptation, traduction ou exploitation commerciale, totale ou partielle, est strictement interdite sans autorisation écrite préalable.",

    s32_title: "III.2 Interdictions techniques et clause anti-IA",
    s32_p1: "L'utilisateur s'engage explicitement à ne pas :",
    s32_li1_b: "Procéder à toute forme de rétro-ingénierie",
    s32_li1_t: "du service, de son code, de ses algorithmes ou de ses méthodologies de scoring, sauf dans les cas strictement autorisés par la loi (article L. 122-6-1 IV CPI) ;",
    s32_li2_b: "Effectuer toute extraction automatisée de données",
    s32_li2_t: "(scraping, crawling, robots, scripts, plug-ins) en dehors des éventuelles API officielles fournies par Mettrik AI ;",
    s32_li3: "Tenter de contourner les limites techniques (paywall, quotas, authentification, jetons, chiffrements) ;",
    s32_li4: "Décompiler, désassembler, modifier le code source du service ;",
    s32_li5: "Reproduire la base de données Mettrik AI dans tout ou en partie qualitativement ou quantitativement substantielle ;",
    s32_li6_b: "Utiliser tout contenu Mettrik AI (textes, scores, méthodologies, données dérivées, visualisations, interprétations) pour entraîner, fine-tuner, alimenter ou enrichir tout modèle d'intelligence artificielle",
    s32_li6_t: "(LLM, machine learning, embeddings, RAG, transformers, réseaux de neurones, et toute architecture similaire). Cette interdiction s'applique à l'auteur direct (utilisateur du compte), aux plateformes d'IA (responsables des LLM tiers entraînés), et aux services intermédiaires (proxys, agrégateurs, services partagés).",
    s32_p2_b: "Poursuites systématiques.",
    s32_p2_t: "En cas de violation de l'interdiction d'usage IA ci-dessus, Mettrik AI s'engage à engager systématiquement des poursuites civiles et pénales contre :",
    s32_p2_li1: "L'utilisateur direct du compte ayant servi à l'extraction ;",
    s32_p2_li2: "L'éditeur du modèle d'IA ayant intégré ou diffusé les contenus extraits ;",
    s32_p2_li3: "Tout intermédiaire technique (services proxys, partages d'accès, agrégateurs) ayant facilité la violation, dans les conditions de l'article 1240 du Code civil et de l'article L. 335-3 CPI.",
    s32_p3: "Toute violation entraîne en outre la résiliation immédiate du compte sans remboursement.",
    s32_p4_b: "Clause pénale forfaitaire.",
    s32_p4_t: "Sans préjudice de tout préjudice supplémentaire et d'éventuels dommages et intérêts complémentaires, toute extraction automatisée non autorisée, toute reproduction substantielle de la base de données, et tout usage d'un contenu Mettrik AI pour entraîner un modèle d'intelligence artificielle, constituent une violation grave entraînant le paiement par le contrevenant d'une",
    s32_p4_b2: "indemnité forfaitaire minimale de cinquante mille (50 000) euros par infraction constatée",
    s32_p4_t2: ", due de plein droit. Cette clause pénale est cumulable avec toute action civile et pénale.",
    s32_p5_b: "Incessibilité.",
    s32_p5_t: "Le compte utilisateur, l'abonnement et tous les droits qui en découlent sont strictement personnels et ne peuvent être cédés, prêtés, loués, sous-licenciés ou transférés à un tiers, à titre gratuit ou onéreux, sous quelque forme que ce soit. Toute tentative de cession est nulle et entraîne la résiliation immédiate.",

    s33_title: "III.3 Statut éditorial des contenus diffusés",
    s33_p1_a: "Les scores, classements, interprétations, indicateurs composites (Super KPIs), comparaisons, signaux et tout contenu produit par Mettrik AI constituent des",
    s33_p1_b: "opinions éditoriales",
    s33_p1_c: ", protégées par la liberté d'expression (article 11 de la Déclaration des Droits de l'Homme et du Citoyen) et l'article L. 121-1 du Code de la consommation.",
    s33_p2_a: "Ces contenus ne constituent",
    s33_p2_b: "ni une recommandation personnalisée d'investissement",
    s33_p2_c: ",",
    s33_p2_d: "ni une assertion de fait",
    s33_p2_e: ",",
    s33_p2_f: "ni un conseil financier",
    s33_p2_g: "au sens de l'article L. 541-1 du Code monétaire et financier. Ils sont fournis à titre purement informatif et reflètent l'analyse éditoriale de Mettrik AI à un instant donné.",
    s33_p3: "Toute décision d'investissement relève de la seule responsabilité de l'utilisateur. Les performances passées ne préjugent pas des performances futures.",

    s34_title: "III.4 Responsabilité et garanties",
    s34_p1: "Mettrik AI s'engage à fournir le service avec diligence. Le service est fourni « en l'état » sans garantie d'adéquation à un usage particulier, d'absence d'erreur, de fiabilité, d'exactitude, d'exhaustivité ou de continuité.",
    s34_p2_b: "Limitation de responsabilité.",
    s34_p2_t: "La responsabilité totale et cumulée de Mettrik AI envers l'utilisateur, toutes causes confondues, est",
    s34_p2_b2: "strictement limitée au montant des abonnements effectivement payés par l'utilisateur sur les 3 derniers mois",
    s34_p2_t2: "précédant le fait générateur, dans la limite maximale de 250 €. Cette limitation s'applique à toute action contractuelle, délictuelle ou quasi-délictuelle, et inclut sans limitation : pertes financières directes ou indirectes, manque à gagner, perte de chance, préjudice moral, atteinte à la réputation. Pour les abonnements gratuits (Free), la responsabilité est expressément",
    s34_p2_b3: "limitée à zéro euro",
    s34_p2_t3: ".",
    s34_p3_b: "Renonciation à l'action collective.",
    s34_p3_t: "L'utilisateur renonce expressément à toute forme d'action collective, action de groupe (loi Hamon), class action ou recours collectif contre Mettrik AI. Tout litige doit être traité individuellement.",
    s34_p4_b: "Force majeure étendue.",
    s34_p4_t: "Constituent des cas de force majeure exonératoires : cyberattaques externes (DDoS, ransomware, intrusions, exploitation de vulnérabilités tiers), défaillance des prestataires d'infrastructure ou de paiement, panne d'internet ou d'opérateur télécom, modification réglementaire imposant l'arrêt du service, indisponibilité des sources de données publiques, décisions administratives, sanctions internationales, conflits armés, pandémies, catastrophes naturelles. Cette liste est indicative et non exhaustive. Mettrik AI ne saurait être tenue responsable des conséquences de tels événements.",

    s35_title: "III.5 Sous-traitants",
    s35_p1_a: "Pour le traitement des paiements, Mettrik AI fait appel à",
    s35_p1_b: "Stripe",
    s35_p1_c: ", conforme aux normes PCI-DSS Level 1 et au Règlement (UE) 2016/679 (RGPD). Stripe est autonome dans le traitement des données bancaires confiées par l'utilisateur lors du paiement.",
    s35_p2: "Pour tout autre traitement technique nécessaire au fonctionnement du service, Mettrik AI peut faire appel à des sous-traitants sélectionnés selon les critères de l'article 28 du RGPD. Mettrik AI se réserve le droit de modifier librement la liste de ces sous-traitants sans préavis individuel, sous réserve de maintenir un niveau de protection équivalent ou supérieur.",

    s36_title: "III.6 Modification des Conditions",
    s36_p1: "Mettrik AI se réserve le droit de modifier les présentes Conditions à tout moment. Les modifications prennent effet dès leur publication sur le site. L'utilisateur est invité à consulter régulièrement la dernière version en vigueur.",

    s37_title: "III.7 Médiation de la consommation (particuliers uniquement)",
    s37_p1_a: "Conformément à l'article L. 612-1 du Code de la consommation, le particulier peut, en cas de différend non résolu après réclamation écrite, recourir gratuitement à la médiation. Il est invité à",
    s37_p1_b: "contacter le médiateur de la consommation compétent le plus proche du siège social de Mettrik AI",
    s37_p1_c: ", via le répertoire public des médiateurs accrédités par la Commission d'évaluation et de contrôle de la médiation de la consommation (CECMC).",

    s38_title: "III.8 Droit applicable et juridiction",
    s38_p1: "Les présentes Conditions sont régies par le droit français. En cas de litige :",
    s38_li1_b: "Pour les particuliers",
    s38_li1_t: ": recherche prioritaire d'une solution amiable, puis médiation (article III.7), puis juridiction protectrice prévue par le Code de la consommation.",
    s38_li2_b: "Pour les professionnels",
    s38_li2_t: ": compétence exclusive du",
    s38_li2_b2: "Tribunal de commerce de Paris",
    s38_li2_t2: ", même en cas de pluralité de défendeurs ou d'appel en garantie.",
  },
  en: {
    title: "General Terms and Conditions",
    updatedAt: "May 3, 2026",
    intro_1_a: "These general terms and conditions (hereinafter the \"",
    intro_1_b: "Conditions",
    intro_1_c: "\") govern access to and use of the website",
    intro_1_site: "www.mettrik.ai",
    intro_1_d: "as well as subscription to its paid services (hereinafter the \"",
    intro_1_e: "Services",
    intro_1_f: "\"). They form a single contractual corpus, organized in three parts: use (Part I), sale (Part II) and common provisions (Part III).",
    intro_2: "By accessing the website or subscribing, you acknowledge that you have read and unreservedly accept these Conditions.",

    s0_title: "0. Identity of the Publisher and Seller",
    s0_p1_a: "The publisher of the website and seller of the subscriptions is",
    s0_p1_b: "AIRSCAPE",
    s0_p1_c: "(operating the brand",
    s0_p1_d: "Mettrik AI",
    s0_p1_e: "), with registered office located at:",
    s0_p1_addr: "60 rue François 1er, 75008 Paris, France",
    s0_p1_f: ".",
    s0_p2_a: "SIREN: 935 055 137 · Intra-community VAT: FR16935055137 · Email:",

    part1_title: "Part I · Use of the Service",

    s11_title: "I.1 Purpose of the Service",
    s11_p1: "Mettrik AI is a KPI intelligence platform (\" KPI Intelligence \") intended primarily for professional investors (asset managers, family offices, financial analysts) and secondarily for informed retail users.",
    s11_p2: "The service offers a synthetic analysis of key performance indicators of listed companies, extracted from their official financial publications, enriched with proprietary scoring methodologies (Super KPIs, composite indicators, quality scores, risk scores).",
    s11_p3_b: "Editorial status.",
    s11_p3_t: "The content published on Mettrik AI constitutes",
    s11_p3_b2: "editorial opinions",
    s11_p3_t2: "within the meaning of Article 11 of the French Declaration of the Rights of Man and of the Citizen and Article L. 121-1 of the French Consumer Code. It does not constitute investment advice (within the meaning of Article L. 541-1 of the French Monetary and Financial Code), nor a personalized recommendation to buy or sell financial instruments, nor a solicitation to invest.",
    s11_p4: "Past performance is not indicative of future results. Any investment decision is the sole responsibility of the user.",

    s12_title: "I.2 User qualification (consumer or professional)",
    s12_p1_a: "Upon account creation or subscription, the user indicates their status:",
    s12_p1_b: "consumer",
    s12_p1_c: "(within the meaning of the preliminary article of the French Consumer Code) or",
    s12_p1_d: "professional",
    s12_p1_e: "(within the meaning of Article L. 121-1 of the French Consumer Code).",
    s12_p2_a: "The",
    s12_p2_b: "professional",
    s12_p2_c: "status is selected by default, reflecting the primary target audience of the service.",
    s12_p3: "This qualification determines the applicable legal regime:",
    s12_li1_b: "Consumers (B2C)",
    s12_li1_t: ": application of the French Consumer Code, right of withdrawal (subject to Article II.4 below), consumer mediator, protective jurisdiction.",
    s12_li2_b: "Professionals (B2B)",
    s12_li2_t: ": no right of withdrawal (Article L. 221-3 of the French Consumer Code), no benefit of the Hamon law, exclusive commercial jurisdiction of Paris.",

    s13_title: "I.3 Access to the service",
    s13_p1: "The website is accessible 24 hours a day, 7 days a week, except in cases of force majeure or maintenance operations. Mettrik AI cannot be held liable for any interruptions or slowdowns of the service.",
    s13_p2_a: "Certain advanced content is reserved for",
    s13_p2_b: "Premium",
    s13_p2_c: "subscribers. Subscription terms are detailed in Part II below.",

    s14_title: "I.4 User account (personal and named character)",
    s14_p1: "Account creation is free and grants access to a limited number of companies under the Free plan. The user undertakes to provide accurate and up-to-date information at registration, and to keep the password confidential.",
    s14_p2_a: "Each account is",
    s14_p2_b: "strictly personal and named",
    s14_p2_c: ". A Premium subscription grants access to one and only one identified user, from a reasonable number of devices used by that same person (typically computer + personal smartphone).",
    s14_p3_a: "Sharing of credentials, simultaneous or alternating access by several individuals, access via shared accounts or multiple organizations fall exclusively under the",
    s14_p3_b: "Enterprise",
    s14_p3_c: "subscription.",
    s14_p4_a: "Mettrik AI implements technical detection mechanisms for simultaneous or alternating access from incompatible contexts (browser fingerprints, IP geolocation, connection frequency, device fingerprints). In the event of confirmed sharing:",
    s14_p4_b: "immediate termination without refund",
    s14_p4_c: "and retroactive billing of each additional user detected at the current Premium rate, in accordance with Article L. 122-4 of the French Intellectual Property Code.",
    s14_p5_a: "The user is responsible for any activity carried out from their account. In the event of fraudulent use, they undertake to immediately inform Mettrik AI at",
    s14_p5_b: ".",

    s15_title: "I.5 Prohibition of VPN and anonymization networks",
    s15_p1_a: "The use of any virtual private network (",
    s15_p1_vpn: "VPN",
    s15_p1_b: "), proxy, IP masking service, anonymization network (TOR, IPSec tunnel, equivalent services) or any other means aimed at concealing, modifying or rerouting the origin of the connection is",
    s15_p1_c: "strictly prohibited",
    s15_p1_d: "for accessing the Mettrik AI service, directly or indirectly.",
    s15_p2_a: "Any connection detected via VPN or proxy results in",
    s15_p2_b: "automatic suspension of the account",
    s15_p2_c: "during verification. Corporate VPNs used by Enterprise subscribers are subject to prior approval on a case-by-case basis, upon justified request.",

    s16_title: "I.6 General obligations of the user",
    s16_p1: "The user undertakes to use the service in accordance with these Conditions and applicable laws, and not to undermine the security or integrity of the service. Technical prohibitions and the anti-AI clause are set out in Article III.2 below.",

    s17_title: "I.7 Data and sources, update delays",
    s17_p1: "Mettrik AI uses publicly available financial data, primarily extracted from regulatory filings (10-K, 10-Q, 8-K in the United States; equivalent reports in Europe and Asia). Each piece of data is accompanied by a freshness indicator and, where possible, a link to the original source.",
    s17_p2_b: "Update delay.",
    s17_p2_t: "Even when a label such as \"real-time\", \"live\", \"up to date\" or equivalent is displayed, the data may include a",
    s17_p2_b2: "delay of several seconds, several minutes or even several hours",
    s17_p2_t2: "compared to the actual market value (feed delay, network latencies, algorithmic processing, update windows). Mettrik AI in no way guarantees the availability of data in strict real time.",
    s17_p3: "The user is invited to verify critical data with official sources before any investment decision.",

    part2_title: "Part II · Sale and Subscriptions",

    s21_title: "II.1 Subscription plans",
    s21_p1: "Mettrik AI offers the following subscriptions:",
    s21_li1_b: "Free",
    s21_li1_t: ": €0 / month. Limited access (demonstration companies).",
    s21_li2_b: "Premium monthly",
    s21_li2_t: ": €24.90 excl. VAT / month. Full access to covered companies, comparison, watchlists, alerts.",
    s21_li3_b: "Premium annual",
    s21_li3_t: ": €189 excl. VAT / year. Same features, savings of approximately 37%.",
    s21_li4_b: "Enterprise / API",
    s21_li4_t: ": on request. Multi-user, API access, dedicated support.",
    s21_p2_a: "Prices are shown excluding tax. The applicable VAT (rate of the user's country of residence) is added automatically by our payment provider",
    s21_p2_b: "Stripe",
    s21_p2_c: "at the time of payment.",

    s22_title: "II.2 Subscription and payment",
    s22_p1_a: "Subscription is made online via the secure payment platform",
    s22_p1_b: "Stripe",
    s22_p1_c: ", compliant with PCI-DSS standards. Mettrik AI does not have access to any banking data.",
    s22_p2: "The subscription takes effect immediately upon payment confirmation. The user receives an email confirmation at the address provided at registration.",

    s23_title: "II.3 Renewal and termination",
    s23_p1_a: "Premium subscriptions renew",
    s23_p1_b: "automatically by tacit renewal",
    s23_p1_c: "at the end of each period (monthly or annual), for a duration identical to the initial period, without the need for prior notification.",
    s23_p2_a: "Termination is possible at any time from the user's personal area. It takes effect at the end of the current period.",
    s23_p2_b: "No refund, full or partial, is made for the period in progress",
    s23_p2_c: ", regardless of the remaining fraction.",
    s23_p3_b: "Unilateral termination by Mettrik AI.",
    s23_p3_t: "Mettrik AI reserves the right to unilaterally terminate any subscription without notice in the event of (a) non-payment, (b) breach of these Conditions, (c) fraudulent, abusive or non-compliant use of the service, (d) confirmed account sharing, (e) use of VPN or anonymization means, (f) automated extraction or unauthorized AI use, (g) chargeback or banking dispute, (h) any other situation harming Mettrik AI or its other subscribers. Unilateral termination does not give rise to any refund.",

    s24_title: "II.4 Exclusion of the right of withdrawal (personalized service)",
    s24_p1_a: "In accordance with Article L. 221-28 3° of the French Consumer Code, the right of withdrawal",
    s24_p1_b: "does not apply",
    s24_p1_c: "to contracts relating to the",
    s24_p1_d: "supply of a personalized digital content service",
    s24_p1_e: ", performed immediately upon subscription.",
    s24_p2_a: "The Mettrik AI service consists of the",
    s24_p2_b: "personalized and continuous",
    s24_p2_c: "supply of KPIs selected based on the user's profile, watchlists, sector preferences, comparison history and alert settings: it is a personalized service within the meaning of the aforementioned article, the performance of which begins immediately upon subscription with the user's express consent (dedicated checkbox ticked at checkout).",
    s24_p3_a: "This exclusion is explicitly recalled at the time of payment.",
    s24_p3_b: "No right of withdrawal applies to professional subscriptions",
    s24_p3_c: "(Article L. 221-3 of the French Consumer Code).",

    s25_title: "II.5 Price changes",
    s25_p1: "Mettrik AI reserves the right to modify its prices at any time. Any change is notified to subscribers at least 30 days before its entry into force, by email to the address associated with the account. The user may terminate their subscription before the new price takes effect at no cost.",

    s26_title: "II.6 Billing",
    s26_p1: "An invoice is automatically issued at each subscription renewal and sent by email. All invoices are also downloadable from the user's personal area.",

    part3_title: "Part III · Common Provisions",

    s31_title: "III.1 Intellectual property (cumulative derivative works)",
    s31_p1: "The content presented on Mettrik AI is of two natures:",
    s31_li1_b: "Primary source data",
    s31_li1_t: ": financial figures, statements, facts relating to the listed companies analyzed, drawn from official publications (annual reports, quarterly reports, regulatory press releases). Such data remains the property of its respective authors.",
    s31_li2_b: "Content generated and processed by Mettrik AI",
    s31_li2_t: ": scoring methodologies, composite indicators, editorial interpretations, comparative analyses, quality scores, risk scores, rankings, aggregations, visualizations. Such content is the",
    s31_li2_b2: "exclusive property of Mettrik AI",
    s31_li2_t2: ", protected by copyright, database rights (Articles L. 341-1 et seq. of the French Intellectual Property Code), and the producer's sui generis right.",
    s31_p2_b: "Cumulative derivative works.",
    s31_p2_t: "Each algorithmic, methodological or editorial update constitutes a",
    s31_p2_b2: "new derivative work",
    s31_p2_t2: "protected cumulatively (Article L. 113-2 of the French Intellectual Property Code). The end of the subscription does not grant any right of use over historically accessed versions.",
    s31_p3: "The subscription grants the user a personal, non-exclusive and non-transferable right of use. Any reproduction, redistribution, republication, resale, adaptation, translation or commercial exploitation, in whole or in part, is strictly prohibited without prior written authorization.",

    s32_title: "III.2 Technical prohibitions and anti-AI clause",
    s32_p1: "The user expressly undertakes not to:",
    s32_li1_b: "Engage in any form of reverse engineering",
    s32_li1_t: "of the service, its code, algorithms or scoring methodologies, except in cases strictly authorized by law (Article L. 122-6-1 IV of the French Intellectual Property Code);",
    s32_li2_b: "Carry out any automated data extraction",
    s32_li2_t: "(scraping, crawling, robots, scripts, plug-ins) outside any official APIs provided by Mettrik AI;",
    s32_li3: "Attempt to circumvent technical limits (paywall, quotas, authentication, tokens, encryption);",
    s32_li4: "Decompile, disassemble, modify the source code of the service;",
    s32_li5: "Reproduce the Mettrik AI database, in whole or in a qualitatively or quantitatively substantial part;",
    s32_li6_b: "Use any Mettrik AI content (texts, scores, methodologies, derived data, visualizations, interpretations) to train, fine-tune, feed or enrich any artificial intelligence model",
    s32_li6_t: "(LLMs, machine learning, embeddings, RAG, transformers, neural networks, and any similar architecture). This prohibition applies to the direct author (account user), to AI platforms (operators of trained third-party LLMs), and to intermediary services (proxies, aggregators, shared services).",
    s32_p2_b: "Systematic prosecution.",
    s32_p2_t: "In the event of a breach of the AI use prohibition above, Mettrik AI undertakes to systematically initiate civil and criminal proceedings against:",
    s32_p2_li1: "The direct user of the account used for the extraction;",
    s32_p2_li2: "The publisher of the AI model that incorporated or distributed the extracted content;",
    s32_p2_li3: "Any technical intermediary (proxy services, access sharing, aggregators) that facilitated the breach, under the conditions of Article 1240 of the French Civil Code and Article L. 335-3 of the French Intellectual Property Code.",
    s32_p3: "Any breach further entails the immediate termination of the account without refund.",
    s32_p4_b: "Liquidated damages clause.",
    s32_p4_t: "Without prejudice to any additional damage and possible additional damages, any unauthorized automated extraction, any substantial reproduction of the database, and any use of Mettrik AI content to train an artificial intelligence model, constitute a serious breach giving rise to the payment by the offender of a",
    s32_p4_b2: "minimum liquidated indemnity of fifty thousand (50,000) euros per breach observed",
    s32_p4_t2: ", due as of right. This liquidated damages clause is cumulative with any civil and criminal action.",
    s32_p5_b: "Non-assignability.",
    s32_p5_t: "The user account, the subscription and all rights deriving therefrom are strictly personal and may not be assigned, lent, leased, sublicensed or transferred to a third party, free of charge or for consideration, in any form whatsoever. Any attempted assignment is null and void and entails immediate termination.",

    s33_title: "III.3 Editorial status of published content",
    s33_p1_a: "The scores, rankings, interpretations, composite indicators (Super KPIs), comparisons, signals and any content produced by Mettrik AI constitute",
    s33_p1_b: "editorial opinions",
    s33_p1_c: ", protected by freedom of expression (Article 11 of the French Declaration of the Rights of Man and of the Citizen) and Article L. 121-1 of the French Consumer Code.",
    s33_p2_a: "This content does not constitute",
    s33_p2_b: "a personalized investment recommendation",
    s33_p2_c: ",",
    s33_p2_d: "an assertion of fact",
    s33_p2_e: ",",
    s33_p2_f: "or financial advice",
    s33_p2_g: "within the meaning of Article L. 541-1 of the French Monetary and Financial Code. It is provided for information purposes only and reflects Mettrik AI's editorial analysis at a given moment.",
    s33_p3: "Any investment decision is the sole responsibility of the user. Past performance is not indicative of future results.",

    s34_title: "III.4 Liability and warranties",
    s34_p1: "Mettrik AI undertakes to provide the service with due diligence. The service is provided \"as is\" without warranty of fitness for a particular purpose, error-free operation, reliability, accuracy, completeness or continuity.",
    s34_p2_b: "Limitation of liability.",
    s34_p2_t: "The total cumulative liability of Mettrik AI towards the user, on any grounds whatsoever, is",
    s34_p2_b2: "strictly limited to the amount of subscriptions actually paid by the user during the last 3 months",
    s34_p2_t2: "preceding the triggering event, with a maximum of €250. This limitation applies to any contractual, tortious or quasi-tortious action, and includes without limitation: direct or indirect financial losses, loss of profit, loss of opportunity, moral damage, harm to reputation. For free subscriptions (Free), liability is expressly",
    s34_p2_b3: "limited to zero euros",
    s34_p2_t3: ".",
    s34_p3_b: "Waiver of class action.",
    s34_p3_t: "The user expressly waives any form of collective action, group action (Hamon law), class action or class proceedings against Mettrik AI. Any dispute must be handled individually.",
    s34_p4_b: "Extended force majeure.",
    s34_p4_t: "The following constitute exonerating cases of force majeure: external cyberattacks (DDoS, ransomware, intrusions, exploitation of third-party vulnerabilities), failure of infrastructure or payment providers, internet or telecom outage, regulatory change requiring service shutdown, unavailability of public data sources, administrative decisions, international sanctions, armed conflicts, pandemics, natural disasters. This list is indicative and non-exhaustive. Mettrik AI cannot be held liable for the consequences of such events.",

    s35_title: "III.5 Subprocessors",
    s35_p1_a: "For payment processing, Mettrik AI uses",
    s35_p1_b: "Stripe",
    s35_p1_c: ", compliant with PCI-DSS Level 1 standards and EU Regulation 2016/679 (GDPR). Stripe is autonomous in the processing of banking data entrusted by the user at the time of payment.",
    s35_p2: "For any other technical processing necessary for the operation of the service, Mettrik AI may use subprocessors selected according to the criteria of Article 28 of the GDPR. Mettrik AI reserves the right to freely modify the list of these subprocessors without individual notice, provided that an equivalent or higher level of protection is maintained.",

    s36_title: "III.6 Modification of the Conditions",
    s36_p1: "Mettrik AI reserves the right to modify these Conditions at any time. Modifications take effect upon publication on the website. The user is invited to regularly consult the latest version in force.",

    s37_title: "III.7 Consumer mediation (consumers only)",
    s37_p1_a: "In accordance with Article L. 612-1 of the French Consumer Code, the consumer may, in the event of a dispute not resolved after written claim, resort free of charge to mediation. They are invited to",
    s37_p1_b: "contact the competent consumer mediator nearest the registered office of Mettrik AI",
    s37_p1_c: ", via the public directory of mediators accredited by the Consumer Mediation Evaluation and Control Commission (CECMC).",

    s38_title: "III.8 Governing law and jurisdiction",
    s38_p1: "These Conditions are governed by French law. In the event of a dispute:",
    s38_li1_b: "For consumers",
    s38_li1_t: ": priority search for an amicable solution, then mediation (Article III.7), then the protective jurisdiction provided by the French Consumer Code.",
    s38_li2_b: "For professionals",
    s38_li2_t: ": exclusive jurisdiction of the",
    s38_li2_b2: "Commercial Court of Paris",
    s38_li2_t2: ", even in the event of multiple defendants or third-party warranty claims.",
  },
};

export default async function ConditionsPage() {
  const rawLocale = await getServerLocale();
  const locale: "fr" | "en" = rawLocale === "fr" ? "fr" : "en";
  const t = locale === "fr" ? STR.fr : STR.en;

  return (
    <LegalLayout title={t.title} updatedAt={t.updatedAt} locale={locale}>
      <p>
        {t.intro_1_a}<strong>{t.intro_1_b}</strong>{t.intro_1_c} <strong>{t.intro_1_site}</strong> {t.intro_1_d}<strong>{t.intro_1_e}</strong>{t.intro_1_f}
      </p>
      <p>{t.intro_2}</p>

      {/* ──────────────── IDENTITY ─────────────────── */}
      <LegalSection title={t.s0_title}>
        <p>
          {t.s0_p1_a} <strong>{t.s0_p1_b}</strong> {t.s0_p1_c} <strong>{t.s0_p1_d}</strong>
          {t.s0_p1_e} <strong>{t.s0_p1_addr}</strong>{t.s0_p1_f}
        </p>
        <p>
          {t.s0_p2_a}{" "}
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">
            contact@mettrik.ai
          </a>
        </p>
      </LegalSection>

      {/* PARTIE I — UTILISATION */}
      <h2 className="mt-12 font-display text-[24px] font-bold tracking-tight text-violet-200">
        {t.part1_title}
      </h2>

      <LegalSection title={t.s11_title}>
        <p>{t.s11_p1}</p>
        <p>{t.s11_p2}</p>
        <p>
          <strong>{t.s11_p3_b}</strong> {t.s11_p3_t} <strong>{t.s11_p3_b2}</strong> {t.s11_p3_t2}
        </p>
        <p>{t.s11_p4}</p>
      </LegalSection>

      <LegalSection title={t.s12_title}>
        <p>
          {t.s12_p1_a} <strong>{t.s12_p1_b}</strong> {t.s12_p1_c} <strong>{t.s12_p1_d}</strong> {t.s12_p1_e}
        </p>
        <p>
          {t.s12_p2_a} <strong>{t.s12_p2_b}</strong> {t.s12_p2_c}
        </p>
        <p>{t.s12_p3}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>{t.s12_li1_b}</strong>{t.s12_li1_t}</li>
          <li><strong>{t.s12_li2_b}</strong>{t.s12_li2_t}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t.s13_title}>
        <p>{t.s13_p1}</p>
        <p>
          {t.s13_p2_a} <strong>{t.s13_p2_b}</strong>{t.s13_p2_c}
        </p>
      </LegalSection>

      <LegalSection title={t.s14_title}>
        <p>{t.s14_p1}</p>
        <p>
          {t.s14_p2_a} <strong>{t.s14_p2_b}</strong>{t.s14_p2_c}
        </p>
        <p>
          {t.s14_p3_a} <strong>{t.s14_p3_b}</strong>{t.s14_p3_c}
        </p>
        <p>
          {t.s14_p4_a} <strong>{t.s14_p4_b}</strong> {t.s14_p4_c}
        </p>
        <p>
          {t.s14_p5_a}{" "}
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">
            contact@mettrik.ai
          </a>
          {t.s14_p5_b}
        </p>
      </LegalSection>

      <LegalSection title={t.s15_title}>
        <p>
          {t.s15_p1_a}<strong>{t.s15_p1_vpn}</strong>{t.s15_p1_b} <strong>{t.s15_p1_c}</strong> {t.s15_p1_d}
        </p>
        <p>
          {t.s15_p2_a} <strong>{t.s15_p2_b}</strong> {t.s15_p2_c}
        </p>
      </LegalSection>

      <LegalSection title={t.s16_title}>
        <p>{t.s16_p1}</p>
      </LegalSection>

      <LegalSection title={t.s17_title}>
        <p>{t.s17_p1}</p>
        <p>
          <strong>{t.s17_p2_b}</strong> {t.s17_p2_t} <strong>{t.s17_p2_b2}</strong> {t.s17_p2_t2}
        </p>
        <p>{t.s17_p3}</p>
      </LegalSection>

      {/* PARTIE II — VENTE / ABONNEMENTS */}
      <h2 className="mt-12 font-display text-[24px] font-bold tracking-tight text-violet-200">
        {t.part2_title}
      </h2>

      <LegalSection title={t.s21_title}>
        <p>{t.s21_p1}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>{t.s21_li1_b}</strong>{t.s21_li1_t}</li>
          <li><strong>{t.s21_li2_b}</strong>{t.s21_li2_t}</li>
          <li><strong>{t.s21_li3_b}</strong>{t.s21_li3_t}</li>
          <li><strong>{t.s21_li4_b}</strong>{t.s21_li4_t}</li>
        </ul>
        <p>
          {t.s21_p2_a} <strong>{t.s21_p2_b}</strong> {t.s21_p2_c}
        </p>
      </LegalSection>

      <LegalSection title={t.s22_title}>
        <p>
          {t.s22_p1_a} <strong>{t.s22_p1_b}</strong>{t.s22_p1_c}
        </p>
        <p>{t.s22_p2}</p>
      </LegalSection>

      <LegalSection title={t.s23_title}>
        <p>
          {t.s23_p1_a} <strong>{t.s23_p1_b}</strong> {t.s23_p1_c}
        </p>
        <p>
          {t.s23_p2_a} <strong>{t.s23_p2_b}</strong>{t.s23_p2_c}
        </p>
        <p>
          <strong>{t.s23_p3_b}</strong> {t.s23_p3_t}
        </p>
      </LegalSection>

      <LegalSection title={t.s24_title}>
        <p>
          {t.s24_p1_a} <strong>{t.s24_p1_b}</strong> {t.s24_p1_c} <strong>{t.s24_p1_d}</strong>{t.s24_p1_e}
        </p>
        <p>
          {t.s24_p2_a} <strong>{t.s24_p2_b}</strong> {t.s24_p2_c}
        </p>
        <p>
          {t.s24_p3_a} <strong>{t.s24_p3_b}</strong> {t.s24_p3_c}
        </p>
      </LegalSection>

      <LegalSection title={t.s25_title}>
        <p>{t.s25_p1}</p>
      </LegalSection>

      <LegalSection title={t.s26_title}>
        <p>{t.s26_p1}</p>
      </LegalSection>

      {/* PARTIE III — DISPOSITIONS COMMUNES */}
      <h2 className="mt-12 font-display text-[24px] font-bold tracking-tight text-violet-200">
        {t.part3_title}
      </h2>

      <LegalSection title={t.s31_title}>
        <p>{t.s31_p1}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>{t.s31_li1_b}</strong>{t.s31_li1_t}</li>
          <li>
            <strong>{t.s31_li2_b}</strong>{t.s31_li2_t} <strong>{t.s31_li2_b2}</strong>{t.s31_li2_t2}
          </li>
        </ul>
        <p>
          <strong>{t.s31_p2_b}</strong> {t.s31_p2_t} <strong>{t.s31_p2_b2}</strong>{" "}
          {t.s31_p2_t2}
        </p>
        <p>{t.s31_p3}</p>
      </LegalSection>

      <LegalSection title={t.s32_title}>
        <p>{t.s32_p1}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>{t.s32_li1_b}</strong> {t.s32_li1_t}</li>
          <li><strong>{t.s32_li2_b}</strong> {t.s32_li2_t}</li>
          <li>{t.s32_li3}</li>
          <li>{t.s32_li4}</li>
          <li>{t.s32_li5}</li>
          <li>
            <strong>{t.s32_li6_b}</strong> {t.s32_li6_t}
          </li>
        </ul>
        <p>
          <strong>{t.s32_p2_b}</strong> {t.s32_p2_t}
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>{t.s32_p2_li1}</li>
          <li>{t.s32_p2_li2}</li>
          <li>{t.s32_p2_li3}</li>
        </ul>
        <p>{t.s32_p3}</p>
        <p>
          <strong>{t.s32_p4_b}</strong> {t.s32_p4_t} <strong>{t.s32_p4_b2}</strong>{t.s32_p4_t2}
        </p>
        <p>
          <strong>{t.s32_p5_b}</strong> {t.s32_p5_t}
        </p>
      </LegalSection>

      <LegalSection title={t.s33_title}>
        <p>
          {t.s33_p1_a} <strong>{t.s33_p1_b}</strong>{t.s33_p1_c}
        </p>
        <p>
          {t.s33_p2_a} <strong>{t.s33_p2_b}</strong>{t.s33_p2_c} <strong>{t.s33_p2_d}</strong>{t.s33_p2_e} <strong>{t.s33_p2_f}</strong> {t.s33_p2_g}
        </p>
        <p>{t.s33_p3}</p>
      </LegalSection>

      <LegalSection title={t.s34_title}>
        <p>{t.s34_p1}</p>
        <p>
          <strong>{t.s34_p2_b}</strong> {t.s34_p2_t} <strong>{t.s34_p2_b2}</strong> {t.s34_p2_t2} <strong>{t.s34_p2_b3}</strong>{t.s34_p2_t3}
        </p>
        <p>
          <strong>{t.s34_p3_b}</strong> {t.s34_p3_t}
        </p>
        <p>
          <strong>{t.s34_p4_b}</strong> {t.s34_p4_t}
        </p>
      </LegalSection>

      <LegalSection title={t.s35_title}>
        <p>
          {t.s35_p1_a} <strong>{t.s35_p1_b}</strong>{t.s35_p1_c}
        </p>
        <p>{t.s35_p2}</p>
      </LegalSection>

      <LegalSection title={t.s36_title}>
        <p>{t.s36_p1}</p>
      </LegalSection>

      <LegalSection title={t.s37_title}>
        <p>
          {t.s37_p1_a} <strong>{t.s37_p1_b}</strong>{t.s37_p1_c}
        </p>
      </LegalSection>

      <LegalSection title={t.s38_title}>
        <p>{t.s38_p1}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>{t.s38_li1_b}</strong>{t.s38_li1_t}</li>
          <li>
            <strong>{t.s38_li2_b}</strong>{t.s38_li2_t} <strong>{t.s38_li2_b2}</strong>{t.s38_li2_t2}
          </li>
        </ul>
      </LegalSection>
    </LegalLayout>
  );
}
