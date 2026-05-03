import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

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
export default function ConditionsPage() {
  return (
    <LegalLayout
      title="Conditions générales d'utilisation et de vente"
      updatedAt="3 mai 2026"
    >
      <p>
        Les présentes conditions générales (ci-après les « <strong>Conditions</strong> »)
        régissent l&apos;accès et l&apos;utilisation du site <strong>www.mettrik.ai</strong>
        ainsi que la souscription d&apos;abonnements à ses services payants (ci-après
        les « <strong>Services</strong> »). Elles forment un unique corpus contractuel,
        organisé en trois parties : utilisation (Partie I), vente (Partie II) et
        dispositions communes (Partie III).
      </p>
      <p>
        En accédant au site ou en souscrivant à un abonnement, vous reconnaissez avoir
        pris connaissance des présentes Conditions et les accepter sans réserve.
      </p>

      {/* ──────────────── IDENTITÉ ─────────────────── */}
      <LegalSection title="0. Identité de l'éditeur et du vendeur">
        <p>
          L&apos;éditeur du site et le vendeur des abonnements est <strong>AIRSCAPE</strong>
          (exploitant la marque <strong>Mettrik AI</strong>), dont le siège social est situé :
          <strong> 60 rue François 1er, 75008 Paris, France</strong>.
        </p>
        <p>
          SIREN : 935 055 137 · TVA intracommunautaire : FR16935055137 · Email :
          {" "}
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">
            contact@mettrik.ai
          </a>
        </p>
      </LegalSection>

      {/* ════════════════════════════════════════════ */}
      {/* PARTIE I — UTILISATION                       */}
      {/* ════════════════════════════════════════════ */}
      <h2 className="mt-12 font-display text-[24px] font-bold tracking-tight text-violet-200">
        Partie I · Utilisation du service
      </h2>

      <LegalSection title="I.1 Objet du service">
        <p>
          Mettrik AI est une plateforme d&apos;intelligence KPI («&nbsp;<em>KPI Intelligence</em>&nbsp;»)
          destinée principalement aux investisseurs professionnels (asset managers, family
          offices, analystes financiers) et accessoirement aux particuliers avertis.
        </p>
        <p>
          Le service propose une analyse synthétique d&apos;indicateurs clés de performance
          des sociétés cotées en bourse, extraits de leurs publications financières
          officielles, enrichis par des méthodologies de scoring propriétaires (Super KPIs,
          indicateurs composites, scores de qualité, scores de risque).
        </p>
        <p>
          <strong>Statut éditorial.</strong> Les contenus diffusés sur Mettrik AI constituent
          des <strong>opinions éditoriales</strong> au sens de l&apos;article 11 de la
          Déclaration des Droits de l&apos;Homme et du Citoyen et de l&apos;article L. 121-1
          du Code de la consommation. Ils ne constituent ni un conseil en investissement
          (au sens de L. 541-1 du Code monétaire et financier), ni une recommandation
          personnalisée d&apos;achat ou de vente d&apos;instruments financiers, ni une
          sollicitation à investir.
        </p>
        <p>
          Les performances passées ne préjugent pas des performances futures. Toute décision
          d&apos;investissement relève de la seule responsabilité de l&apos;utilisateur.
        </p>
      </LegalSection>

      <LegalSection title="I.2 Qualification de l'utilisateur (particulier ou professionnel)">
        <p>
          Lors de la création du compte ou de la souscription, l&apos;utilisateur indique sa
          qualité : <strong>particulier</strong> (consommateur, au sens de l&apos;article
          liminaire du Code de la consommation) ou <strong>professionnel</strong> (au sens
          de l&apos;article L. 121-1 du Code de la consommation).
        </p>
        <p>
          La qualité <strong>professionnel</strong> est sélectionnée par défaut, reflétant
          la cible principale du service.
        </p>
        <p>Cette qualification détermine les régimes applicables :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            <strong>Particuliers (B2C)</strong> : application du Code de la consommation,
            droit de rétractation (sous réserve de l&apos;article II.4 ci-dessous), médiateur
            de la consommation, juridiction protectrice.
          </li>
          <li>
            <strong>Professionnels (B2B)</strong> : pas de droit de rétractation
            (article L. 221-3 Code conso), pas de bénéfice de la loi Hamon, juridiction
            commerciale exclusive de Paris.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="I.3 Accès au service">
        <p>
          Le site est accessible 24 heures sur 24, 7 jours sur 7, sauf cas de force majeure
          ou opérations de maintenance. Mettrik AI ne saurait être tenue responsable des
          interruptions ou ralentissements du service.
        </p>
        <p>
          Certains contenus avancés sont réservés aux abonnés <strong>Premium</strong>. Les
          modalités d&apos;abonnement sont détaillées dans la Partie II ci-après.
        </p>
      </LegalSection>

      <LegalSection title="I.4 Compte utilisateur (caractère personnel et nominatif)">
        <p>
          La création d&apos;un compte est gratuite et donne accès à un nombre limité de
          sociétés en plan Free. L&apos;utilisateur s&apos;engage à fournir des informations
          exactes et à jour lors de son inscription, et à préserver la confidentialité de
          son mot de passe.
        </p>
        <p>
          Chaque compte est <strong>strictement personnel et nominatif</strong>. Un
          abonnement Premium ouvre l&apos;accès au service à un et un seul utilisateur
          identifié, depuis un nombre raisonnable d&apos;appareils utilisés par cette même
          personne (typiquement ordinateur + smartphone personnel).
        </p>
        <p>
          Le partage des identifiants, l&apos;accès simultané ou alterné depuis plusieurs
          personnes physiques, l&apos;accès via comptes mutualisés ou organisations
          multiples relèvent exclusivement de l&apos;abonnement <strong>Enterprise</strong>.
        </p>
        <p>
          Mettrik AI met en œuvre des dispositifs techniques de détection des accès
          simultanés ou alternés depuis des contextes incompatibles (signatures de navigateur,
          géolocalisation IP, fréquence de connexion, empreintes d&apos;appareil). En cas de
          partage avéré : <strong>résiliation immédiate sans remboursement</strong> et
          facturation rétroactive de chaque utilisateur additionnel détecté au tarif Premium
          en vigueur, conformément à l&apos;article L. 122-4 du Code de la propriété
          intellectuelle.
        </p>
        <p>
          L&apos;utilisateur est responsable de toute activité effectuée depuis son compte.
          En cas d&apos;utilisation frauduleuse, il s&apos;engage à en informer immédiatement
          Mettrik AI à l&apos;adresse{" "}
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">
            contact@mettrik.ai
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="I.5 Interdiction d'utilisation de VPN et de réseaux d'anonymisation">
        <p>
          L&apos;utilisation de tout réseau virtuel privé (<strong>VPN</strong>), proxy,
          service de masquage IP, réseau d&apos;anonymisation (TOR, IPSec tunnel, services
          équivalents) ou tout autre moyen visant à dissimuler, modifier ou rerouter
          l&apos;origine de la connexion est <strong>strictement interdite</strong> pour
          accéder au service Mettrik AI, directement ou indirectement.
        </p>
        <p>
          Toute connexion détectée via VPN ou proxy entraîne la <strong>suspension
          automatique du compte</strong> le temps de vérification. Les VPN d&apos;entreprise
          utilisés par les abonnés Enterprise font l&apos;objet d&apos;un agrément préalable
          au cas par cas, sur demande motivée.
        </p>
      </LegalSection>

      <LegalSection title="I.6 Obligations générales de l'utilisateur">
        <p>L&apos;utilisateur s&apos;engage à utiliser le service conformément aux présentes
          Conditions et aux lois en vigueur, et à ne pas porter atteinte à la sécurité ou à
          l&apos;intégrité du service. Les interdictions techniques et la clause anti-IA
          font l&apos;objet de l&apos;article III.2 ci-après.
        </p>
      </LegalSection>

      <LegalSection title="I.7 Données et sources, délais d'actualisation">
        <p>
          Mettrik AI utilise des données financières publiquement disponibles, principalement
          extraites des dépôts réglementaires (10-K, 10-Q, 8-K aux États-Unis ; rapports
          équivalents en Europe et Asie). Chaque donnée est accompagnée d&apos;un indicateur
          de fraîcheur et, lorsque possible, d&apos;un lien vers la source originale.
        </p>
        <p>
          <strong>Délai d&apos;actualisation.</strong> Même lorsqu&apos;une mention « en
          temps réel », « live », « à jour » ou équivalente est affichée, les données
          peuvent comporter un <strong>décalage de plusieurs secondes, plusieurs minutes
          voire plusieurs heures</strong> par rapport à la valeur effective sur les marchés
          (différé de feed, latences réseau, traitements algorithmiques, fenêtres de mise
          à jour). Mettrik AI ne garantit en aucun cas la disponibilité des données en
          temps réel strict.
        </p>
        <p>
          L&apos;utilisateur est invité à vérifier les données critiques auprès des sources
          officielles avant toute décision d&apos;investissement.
        </p>
      </LegalSection>

      {/* ════════════════════════════════════════════ */}
      {/* PARTIE II — VENTE / ABONNEMENTS              */}
      {/* ════════════════════════════════════════════ */}
      <h2 className="mt-12 font-display text-[24px] font-bold tracking-tight text-violet-200">
        Partie II · Vente et abonnements
      </h2>

      <LegalSection title="II.1 Offres d'abonnement">
        <p>Mettrik AI propose les abonnements suivants :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>Free</strong> : 0 € / mois. Accès limité (sociétés de démonstration).</li>
          <li><strong>Premium mensuel</strong> : 24,90 € HT / mois. Accès complet aux sociétés couvertes, comparaison, watchlists, alertes.</li>
          <li><strong>Premium annuel</strong> : 189 € HT / an. Mêmes fonctionnalités, économie d&apos;environ 37 %.</li>
          <li><strong>Enterprise / API</strong> : sur devis. Multi-utilisateurs, accès API, support dédié.</li>
        </ul>
        <p>
          Les prix sont indiqués hors taxes. La TVA applicable (taux du pays de résidence
          de l&apos;utilisateur) est ajoutée automatiquement par notre prestataire de
          paiement <strong>Stripe</strong> au moment du paiement.
        </p>
      </LegalSection>

      <LegalSection title="II.2 Souscription et paiement">
        <p>
          La souscription s&apos;effectue en ligne via la plateforme de paiement sécurisée
          <strong> Stripe</strong>, conforme aux normes PCI-DSS. Mettrik AI n&apos;a accès
          à aucune donnée bancaire.
        </p>
        <p>
          La souscription prend effet immédiatement après confirmation du paiement.
          L&apos;utilisateur reçoit une confirmation par email à l&apos;adresse renseignée
          lors de l&apos;inscription.
        </p>
      </LegalSection>

      <LegalSection title="II.3 Renouvellement et résiliation">
        <p>
          Les abonnements Premium se renouvellent <strong>automatiquement par tacite
          reconduction</strong> à la fin de chaque période (mensuelle ou annuelle), pour
          une durée identique à celle de la période initiale, sans nécessité de
          notification préalable.
        </p>
        <p>
          La résiliation est possible à tout moment depuis l&apos;espace personnel
          utilisateur. Elle prend effet à la fin de la période en cours.
          <strong> Aucun remboursement, total ou partiel, n&apos;est effectué pour la
          période entamée</strong>, quelle que soit la fraction restant à courir.
        </p>
        <p>
          <strong>Résolution unilatérale par Mettrik AI.</strong> Mettrik AI se réserve le
          droit de résilier unilatéralement et sans préavis tout abonnement en cas
          (a) d&apos;impayé, (b) de violation des présentes Conditions, (c) d&apos;usage
          frauduleux, abusif ou non conforme du service, (d) de partage avéré du compte,
          (e) d&apos;usage de VPN ou de moyens d&apos;anonymisation, (f) d&apos;extraction
          automatisée ou d&apos;usage IA non autorisé, (g) de contestation, charge-back ou
          litige bancaire, (h) de toute autre situation portant atteinte à Mettrik AI ou
          à ses autres abonnés. La résiliation unilatérale ne donne droit à aucun
          remboursement.
        </p>
      </LegalSection>

      <LegalSection title="II.4 Exclusion du droit de rétractation (service personnalisé)">
        <p>
          Conformément à l&apos;article L. 221-28 3° du Code de la consommation, le droit
          de rétractation <strong>ne s&apos;applique pas</strong> aux contrats portant sur
          la <strong>fourniture d&apos;un service de contenu numérique personnalisé</strong>,
          exécuté immédiatement à la souscription.
        </p>
        <p>
          Le service Mettrik AI consiste en la fourniture <strong>personnalisée et
          continue</strong> de KPIs sélectionnés en fonction du profil de l&apos;utilisateur,
          de ses watchlists, de ses préférences sectorielles, de son historique de
          comparaisons et de ses paramètres d&apos;alertes : il s&apos;agit d&apos;un service
          personnalisé au sens de l&apos;article précité, dont l&apos;exécution commence
          immédiatement à la souscription avec consentement express de l&apos;utilisateur
          (case dédiée cochée au checkout).
        </p>
        <p>
          Cette exclusion est rappelée explicitement au moment du paiement.
          <strong> Aucun droit de rétractation ne s&apos;applique aux abonnements
          professionnels</strong> (article L. 221-3 Code conso).
        </p>
      </LegalSection>

      <LegalSection title="II.5 Modifications de prix">
        <p>
          Mettrik AI se réserve le droit de modifier ses tarifs à tout moment. Toute
          modification est notifiée aux abonnés au moins 30 jours avant son entrée en
          vigueur, par email à l&apos;adresse associée au compte. L&apos;utilisateur peut
          résilier son abonnement avant l&apos;entrée en vigueur du nouveau tarif sans
          frais.
        </p>
      </LegalSection>

      <LegalSection title="II.6 Facturation">
        <p>
          Une facture est émise automatiquement à chaque échéance d&apos;abonnement et
          envoyée par email. Toutes les factures sont également téléchargeables depuis
          l&apos;espace personnel.
        </p>
      </LegalSection>

      {/* ════════════════════════════════════════════ */}
      {/* PARTIE III — DISPOSITIONS COMMUNES           */}
      {/* ════════════════════════════════════════════ */}
      <h2 className="mt-12 font-display text-[24px] font-bold tracking-tight text-violet-200">
        Partie III · Dispositions communes
      </h2>

      <LegalSection title="III.1 Propriété intellectuelle (œuvres dérivées cumulatives)">
        <p>Les contenus présentés sur Mettrik AI sont de deux natures :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            <strong>Données primaires sources</strong> : chiffres financiers, déclarations,
            faits relatifs aux sociétés cotées analysées, issus de publications officielles
            (rapports annuels, trimestriels, communiqués réglementaires). Ces données restent
            la propriété de leurs auteurs respectifs.
          </li>
          <li>
            <strong>Contenus générés et travaillés par Mettrik AI</strong> : méthodologies
            de scoring, indicateurs composites, interprétations éditoriales, analyses
            comparatives, scores de qualité, scores de risque, classements, agrégations,
            visualisations. Ces contenus sont la <strong>propriété exclusive de Mettrik
            AI</strong>, protégés par le droit d&apos;auteur, le droit des bases de données
            (art. L. 341-1 et suivants CPI), et le droit sui generis du producteur.
          </li>
        </ul>
        <p>
          <strong>Œuvres dérivées cumulatives.</strong> Chaque mise à jour algorithmique,
          méthodologique ou éditoriale constitue une <strong>œuvre dérivée nouvelle</strong>
          {" "}protégée de manière cumulative (art. L. 113-2 CPI). La fin de l&apos;abonnement
          ne donne aucun droit d&apos;usage sur les versions accédées historiquement.
        </p>
        <p>
          L&apos;abonnement confère à l&apos;utilisateur un droit d&apos;usage personnel,
          non exclusif et non transférable. Toute reproduction, redistribution,
          republication, revente, adaptation, traduction ou exploitation commerciale,
          totale ou partielle, est strictement interdite sans autorisation écrite préalable.
        </p>
      </LegalSection>

      <LegalSection title="III.2 Interdictions techniques et clause anti-IA">
        <p>L&apos;utilisateur s&apos;engage explicitement à ne pas :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            <strong>Procéder à toute forme de rétro-ingénierie</strong> du service, de son
            code, de ses algorithmes ou de ses méthodologies de scoring, sauf dans les cas
            strictement autorisés par la loi (article L. 122-6-1 IV CPI) ;
          </li>
          <li>
            <strong>Effectuer toute extraction automatisée de données</strong> (scraping,
            crawling, robots, scripts, plug-ins) en dehors des éventuelles API officielles
            fournies par Mettrik AI ;
          </li>
          <li>
            Tenter de contourner les limites techniques (paywall, quotas, authentification,
            jetons, chiffrements) ;
          </li>
          <li>Décompiler, désassembler, modifier le code source du service ;</li>
          <li>
            Reproduire la base de données Mettrik AI dans tout ou en partie qualitativement
            ou quantitativement substantielle ;
          </li>
          <li>
            <strong>Utiliser tout contenu Mettrik AI (textes, scores, méthodologies,
            données dérivées, visualisations, interprétations) pour entraîner, fine-tuner,
            alimenter ou enrichir tout modèle d&apos;intelligence artificielle</strong>
            {" "}(LLM, machine learning, embeddings, RAG, transformers, réseaux de neurones,
            et toute architecture similaire). Cette interdiction s&apos;applique à
            l&apos;auteur direct (utilisateur du compte), aux plateformes d&apos;IA
            (responsables des LLM tiers entraînés), et aux services intermédiaires (proxys,
            agrégateurs, services partagés).
          </li>
        </ul>
        <p>
          <strong>Poursuites systématiques.</strong> En cas de violation de
          l&apos;interdiction d&apos;usage IA ci-dessus, Mettrik AI s&apos;engage à engager
          systématiquement des poursuites civiles et pénales contre :
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>L&apos;utilisateur direct du compte ayant servi à l&apos;extraction ;</li>
          <li>L&apos;éditeur du modèle d&apos;IA ayant intégré ou diffusé les contenus extraits ;</li>
          <li>
            Tout intermédiaire technique (services proxys, partages d&apos;accès,
            agrégateurs) ayant facilité la violation, dans les conditions de
            l&apos;article 1240 du Code civil et de l&apos;article L. 335-3 CPI.
          </li>
        </ul>
        <p>
          Toute violation entraîne en outre la résiliation immédiate du compte sans
          remboursement.
        </p>
        <p>
          <strong>Clause pénale forfaitaire.</strong> Sans préjudice de tout préjudice
          supplémentaire et d&apos;éventuels dommages et intérêts complémentaires, toute
          extraction automatisée non autorisée, toute reproduction substantielle de la
          base de données, et tout usage d&apos;un contenu Mettrik AI pour entraîner un
          modèle d&apos;intelligence artificielle, constituent une violation grave
          entraînant le paiement par le contrevenant d&apos;une <strong>indemnité
          forfaitaire minimale de cinquante mille (50 000) euros par infraction
          constatée</strong>, due de plein droit. Cette clause pénale est cumulable
          avec toute action civile et pénale.
        </p>
        <p>
          <strong>Incessibilité.</strong> Le compte utilisateur, l&apos;abonnement et tous
          les droits qui en découlent sont strictement personnels et ne peuvent être cédés,
          prêtés, loués, sous-licenciés ou transférés à un tiers, à titre gratuit ou
          onéreux, sous quelque forme que ce soit. Toute tentative de cession est nulle et
          entraîne la résiliation immédiate.
        </p>
      </LegalSection>

      <LegalSection title="III.3 Statut éditorial des contenus diffusés">
        <p>
          Les scores, classements, interprétations, indicateurs composites (Super KPIs),
          comparaisons, signaux et tout contenu produit par Mettrik AI constituent des
          <strong> opinions éditoriales</strong>, protégées par la liberté d&apos;expression
          (article 11 de la Déclaration des Droits de l&apos;Homme et du Citoyen) et
          l&apos;article L. 121-1 du Code de la consommation.
        </p>
        <p>
          Ces contenus ne constituent <strong>ni une recommandation personnalisée
          d&apos;investissement</strong>, <strong>ni une assertion de fait</strong>,
          <strong> ni un conseil financier</strong> au sens de l&apos;article L. 541-1 du
          Code monétaire et financier. Ils sont fournis à titre purement informatif et
          reflètent l&apos;analyse éditoriale de Mettrik AI à un instant donné.
        </p>
        <p>
          Toute décision d&apos;investissement relève de la seule responsabilité de
          l&apos;utilisateur. Les performances passées ne préjugent pas des performances
          futures.
        </p>
      </LegalSection>

      <LegalSection title="III.4 Responsabilité et garanties">
        <p>
          Mettrik AI s&apos;engage à fournir le service avec diligence. Le service est
          fourni « en l&apos;état » sans garantie d&apos;adéquation à un usage particulier,
          d&apos;absence d&apos;erreur, de fiabilité, d&apos;exactitude, d&apos;exhaustivité
          ou de continuité.
        </p>
        <p>
          <strong>Limitation de responsabilité.</strong> La responsabilité totale et cumulée
          de Mettrik AI envers l&apos;utilisateur, toutes causes confondues, est
          <strong> strictement limitée au montant des abonnements effectivement payés par
          l&apos;utilisateur sur les 3 derniers mois</strong> précédant le fait générateur,
          dans la limite maximale de 250 €. Cette limitation s&apos;applique à toute action
          contractuelle, délictuelle ou quasi-délictuelle, et inclut sans limitation :
          pertes financières directes ou indirectes, manque à gagner, perte de chance,
          préjudice moral, atteinte à la réputation. Pour les abonnements gratuits (Free),
          la responsabilité est expressément <strong>limitée à zéro euro</strong>.
        </p>
        <p>
          <strong>Renonciation à l&apos;action collective.</strong> L&apos;utilisateur
          renonce expressément à toute forme d&apos;action collective, action de groupe
          (loi Hamon), class action ou recours collectif contre Mettrik AI. Tout litige
          doit être traité individuellement.
        </p>
        <p>
          <strong>Force majeure étendue.</strong> Constituent des cas de force majeure
          exonératoires : cyberattaques externes (DDoS, ransomware, intrusions, exploitation
          de vulnérabilités tiers), défaillance des prestataires d&apos;infrastructure ou
          de paiement, panne d&apos;internet ou d&apos;opérateur télécom, modification
          réglementaire imposant l&apos;arrêt du service, indisponibilité des sources de
          données publiques, décisions administratives, sanctions internationales, conflits
          armés, pandémies, catastrophes naturelles. Cette liste est indicative et non
          exhaustive. Mettrik AI ne saurait être tenue responsable des conséquences de tels
          événements.
        </p>
      </LegalSection>

      <LegalSection title="III.5 Sous-traitants">
        <p>
          Pour le traitement des paiements, Mettrik AI fait appel à <strong>Stripe</strong>,
          conforme aux normes PCI-DSS Level 1 et au Règlement (UE) 2016/679 (RGPD). Stripe
          est autonome dans le traitement des données bancaires confiées par
          l&apos;utilisateur lors du paiement.
        </p>
        <p>
          Pour tout autre traitement technique nécessaire au fonctionnement du service,
          Mettrik AI peut faire appel à des sous-traitants sélectionnés selon les critères
          de l&apos;article 28 du RGPD. Mettrik AI se réserve le droit de modifier librement
          la liste de ces sous-traitants sans préavis individuel, sous réserve de maintenir
          un niveau de protection équivalent ou supérieur.
        </p>
      </LegalSection>

      <LegalSection title="III.6 Modification des Conditions">
        <p>
          Mettrik AI se réserve le droit de modifier les présentes Conditions à tout
          moment. Les modifications prennent effet dès leur publication sur le site.
          L&apos;utilisateur est invité à consulter régulièrement la dernière version en
          vigueur.
        </p>
      </LegalSection>

      <LegalSection title="III.7 Médiation de la consommation (particuliers uniquement)">
        <p>
          Conformément à l&apos;article L. 612-1 du Code de la consommation, le particulier
          peut, en cas de différend non résolu après réclamation écrite, recourir
          gratuitement à la médiation. Il est invité à <strong>contacter le médiateur de
          la consommation compétent le plus proche du siège social de Mettrik AI</strong>,
          via le répertoire public des médiateurs accrédités par la Commission
          d&apos;évaluation et de contrôle de la médiation de la consommation (CECMC).
        </p>
      </LegalSection>

      <LegalSection title="III.8 Droit applicable et juridiction">
        <p>Les présentes Conditions sont régies par le droit français. En cas de litige :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            <strong>Pour les particuliers</strong> : recherche prioritaire d&apos;une
            solution amiable, puis médiation (article III.7), puis juridiction protectrice
            prévue par le Code de la consommation.
          </li>
          <li>
            <strong>Pour les professionnels</strong> : compétence exclusive du
            <strong> Tribunal de commerce de Paris</strong>, même en cas de pluralité de
            défendeurs ou d&apos;appel en garantie.
          </li>
        </ul>
      </LegalSection>
    </LegalLayout>
  );
}
