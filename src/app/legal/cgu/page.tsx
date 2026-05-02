import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

export const metadata = {
  title: "Conditions générales d'utilisation · Mettrik AI",
  description: "Conditions générales d'utilisation du site Mettrik AI.",
};

export default function CGUPage() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" updatedAt="3 mai 2026">
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (ci-après « <strong>CGU</strong> ») régissent l&apos;accès et
        l&apos;utilisation du site <strong>www.mettrik.ai</strong> et des services associés (ci-après « <strong>les Services</strong> »).
      </p>
      <p>
        En accédant au site, vous reconnaissez avoir pris connaissance des présentes CGU et les accepter sans réserve.
      </p>

      <LegalSection title="1. Objet du service">
        <p>
          Mettrik AI est une plateforme d&apos;intelligence KPI (« <em>KPI Intelligence</em> ») destinée principalement
          aux investisseurs professionnels (asset managers, family offices, analystes financiers) et accessoirement aux
          particuliers avertis.
        </p>
        <p>
          Le service propose une analyse synthétique d&apos;indicateurs clés de performance des sociétés cotées en bourse,
          extraits de leurs publications financières officielles, enrichis par des méthodologies de scoring propriétaires
          (Super KPIs, indicateurs composites, scores de qualité, scores de risque).
        </p>
        <p>
          <strong>Statut éditorial.</strong> Les contenus diffusés sur Mettrik AI constituent des <strong>opinions
          éditoriales</strong> au sens de l&apos;article 11 de la Déclaration des Droits de l&apos;Homme et du Citoyen
          et de l&apos;article L. 121-1 du Code de la consommation. Ils ne constituent ni un conseil en investissement
          (au sens de L. 541-1 du Code monétaire et financier), ni une recommandation personnalisée d&apos;achat ou de
          vente d&apos;instruments financiers, ni une sollicitation à investir.
        </p>
        <p>
          Les performances passées ne préjugent pas des performances futures. Toute décision d&apos;investissement relève
          de la seule responsabilité de l&apos;utilisateur.
        </p>
      </LegalSection>

      <LegalSection title="2. Qualification de l'utilisateur (particulier ou professionnel)">
        <p>
          Lors de la création du compte, l&apos;utilisateur indique sa qualité (particulier ou professionnel). Le
          statut <strong>professionnel est sélectionné par défaut</strong>, reflétant la cible principale du service.
        </p>
        <p>
          Cette qualification détermine les régimes applicables : protection consumériste pour les particuliers,
          régime commercial pour les professionnels (cf. CGV article 2).
        </p>
      </LegalSection>

      <LegalSection title="3. Accès au service">
        <p>
          Le site est accessible 24 heures sur 24, 7 jours sur 7, sauf cas de force majeure ou opérations de maintenance.
          Mettrik AI ne saurait être tenue responsable des interruptions ou ralentissements du service.
        </p>
        <p>
          Certains contenus avancés sont réservés aux abonnés <strong>Premium</strong>. Les modalités d&apos;abonnement
          sont détaillées dans les Conditions Générales de Vente.
        </p>
      </LegalSection>

      <LegalSection title="4. Compte utilisateur (caractère personnel et nominatif)">
        <p>
          La création d&apos;un compte est gratuite et donne accès à un nombre limité de sociétés en plan Free.
          L&apos;utilisateur s&apos;engage à fournir des informations exactes et à jour lors de son inscription, et à
          préserver la confidentialité de son mot de passe.
        </p>
        <p>
          Chaque compte est <strong>strictement personnel et nominatif</strong>. Le partage des identifiants, l&apos;accès
          simultané ou alterné depuis plusieurs personnes physiques, l&apos;accès via comptes mutualisés ou organisations
          multiples relèvent exclusivement de l&apos;abonnement <strong>Enterprise</strong>.
        </p>
        <p>
          Mettrik AI met en œuvre des dispositifs de détection (signatures de navigateur, géolocalisation IP, fréquence
          de connexion, empreintes d&apos;appareil). Le partage avéré entraîne <strong>résiliation immédiate sans
          remboursement</strong> et facturation rétroactive.
        </p>
        <p>
          L&apos;utilisateur est responsable de toute activité effectuée depuis son compte. En cas d&apos;utilisation
          frauduleuse, il s&apos;engage à en informer immédiatement Mettrik AI à l&apos;adresse
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline"> contact@mettrik.ai</a>.
        </p>
      </LegalSection>

      <LegalSection title="5. Interdiction d'utilisation de VPN et de réseaux d'anonymisation">
        <p>
          L&apos;utilisation de tout réseau virtuel privé (<strong>VPN</strong>), proxy, service de masquage IP,
          réseau d&apos;anonymisation (TOR, IPSec tunnel, services équivalents) ou tout autre moyen visant à dissimuler,
          modifier ou rerouter l&apos;origine de la connexion est <strong>strictement interdite</strong> pour accéder
          au service Mettrik AI, directement ou indirectement.
        </p>
        <p>
          Toute connexion détectée via VPN ou proxy entraîne la <strong>suspension automatique du compte</strong> le temps
          de vérification. Les VPN d&apos;entreprise utilisés par les abonnés Enterprise font l&apos;objet d&apos;un agrément
          préalable au cas par cas, sur demande motivée.
        </p>
      </LegalSection>

      <LegalSection title="6. Obligations de l'utilisateur">
        <p>L&apos;utilisateur s&apos;engage à :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Utiliser le service conformément aux présentes CGU et aux lois en vigueur ;</li>
          <li>
            Ne pas extraire, copier, reproduire, redistribuer ou exploiter à des fins commerciales tout ou partie
            du contenu sans autorisation écrite préalable ;
          </li>
          <li>
            <strong>Ne pas effectuer de rétro-ingénierie</strong> (« reverse engineering »), décompilation,
            désassemblage ou modification du code, des algorithmes ou des méthodologies de scoring ;
          </li>
          <li>
            <strong>Ne pas utiliser de moyens automatisés</strong> (scraping, crawling, bots, scripts, plug-ins,
            outils similaires) pour collecter, extraire ou indexer les données du site, en dehors des éventuelles
            API officielles ;
          </li>
          <li>
            <strong>Ne pas utiliser tout contenu Mettrik AI pour entraîner, fine-tuner, alimenter ou enrichir tout modèle
            d&apos;intelligence artificielle</strong> (LLM, machine learning, embeddings, RAG, transformers, réseaux de
            neurones et architectures équivalentes), tant en tant qu&apos;utilisateur direct qu&apos;intermédiaire ou
            plateforme tierce ;
          </li>
          <li>Ne pas tenter de contourner les limites techniques du service (paywall, quotas, authentification, jetons) ;</li>
          <li>Ne pas reproduire la base de données Mettrik AI en tout ou partie substantielle ;</li>
          <li>Ne pas porter atteinte à la sécurité ou à l&apos;intégrité du service.</li>
        </ul>
        <p>
          <strong>Poursuites systématiques contre toute violation de la clause anti-IA :</strong> Mettrik AI engagera
          systématiquement des poursuites civiles et pénales contre l&apos;utilisateur direct, l&apos;éditeur du modèle
          d&apos;IA ayant intégré les contenus, et tout intermédiaire technique ayant facilité la violation
          (article 1240 du Code civil, article L. 335-3 du Code de la propriété intellectuelle).
        </p>
        <p>
          Toute violation des autres obligations entraîne la suspension ou résiliation immédiate du compte sans
          remboursement, et peut donner lieu à des poursuites civiles et pénales.
        </p>
      </LegalSection>

      <LegalSection title="7. Données et sources, délais d'actualisation">
        <p>
          Mettrik AI utilise des données financières publiquement disponibles, principalement extraites des dépôts
          réglementaires (10-K, 10-Q, 8-K aux États-Unis ; rapports équivalents en Europe et Asie). Chaque donnée
          est accompagnée d&apos;un indicateur de fraîcheur et, lorsque possible, d&apos;un lien vers la source originale.
        </p>
        <p>
          <strong>Délai d&apos;actualisation.</strong> Même lorsqu&apos;une mention « en temps réel », « live »,
          « à jour » ou équivalente est affichée sur les pages société, les données peuvent comporter un
          <strong> décalage de plusieurs secondes, plusieurs minutes voire plusieurs heures</strong> par rapport à la
          valeur effective sur les marchés (différé de feed, latences réseau, traitements algorithmiques, fenêtres
          de mise à jour). Mettrik AI ne garantit en aucun cas la disponibilité des données en temps réel strict.
        </p>
        <p>
          L&apos;utilisateur est invité à vérifier les données critiques auprès des sources officielles avant toute
          décision d&apos;investissement.
        </p>
      </LegalSection>

      <LegalSection title="8. Propriété intellectuelle (œuvres dérivées cumulatives)">
        <p>
          L&apos;ensemble des éléments du site (textes, graphismes, code, marques, logos, méthodologies de scoring,
          indicateurs composites, classements, interprétations) est protégé par les lois en vigueur sur la propriété
          intellectuelle et reste la propriété exclusive de Mettrik AI ou de ses partenaires.
        </p>
        <p>
          <strong>Œuvres dérivées cumulatives.</strong> Chaque mise à jour algorithmique, méthodologique ou éditoriale
          constitue une <strong>œuvre dérivée nouvelle</strong> protégée de manière cumulative (article L. 113-2 CPI).
          La fin de l&apos;abonnement n&apos;ouvre aucun droit d&apos;usage sur les versions accédées historiquement.
        </p>
        <p>
          L&apos;utilisateur dispose d&apos;un droit d&apos;usage personnel, non exclusif, non transférable et révocable
          des contenus auxquels son abonnement lui donne accès. Toute autre utilisation est strictement interdite.
        </p>
      </LegalSection>

      <LegalSection title="9. Suspension et résiliation">
        <p>
          Mettrik AI se réserve le droit de suspendre ou résilier sans préavis l&apos;accès d&apos;un utilisateur en cas
          de violation des présentes CGU, d&apos;impayé, d&apos;utilisation frauduleuse, de partage avéré du compte,
          d&apos;usage de VPN, de scraping, d&apos;usage IA non autorisé, ou de toute action portant atteinte au service
          ou à d&apos;autres utilisateurs.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation de responsabilité">
        <p>
          Mettrik AI ne saurait être tenue responsable des décisions d&apos;investissement prises par l&apos;utilisateur
          sur la base des contenus du site, ni des éventuelles pertes financières qui en résulteraient. L&apos;utilisateur
          reconnaît que tout investissement comporte des risques et qu&apos;il agit sous sa seule responsabilité.
        </p>
        <p>
          Le service est fourni « en l&apos;état » sans garantie d&apos;adéquation à un usage particulier, d&apos;absence
          d&apos;erreur ou de continuité ininterrompue. La responsabilité de Mettrik AI est limitée conformément aux
          conditions de l&apos;article 11 des CGV (cap selon qualité particulier ou professionnel, force majeure étendue).
        </p>
      </LegalSection>

      <LegalSection title="11. Modification des CGU">
        <p>
          Mettrik AI se réserve le droit de modifier les présentes CGU à tout moment. Les modifications prennent effet
          dès leur publication sur le site. L&apos;utilisateur est invité à consulter régulièrement la dernière version
          en vigueur.
        </p>
      </LegalSection>

      <LegalSection title="12. Droit applicable">
        <p>
          Les présentes CGU sont régies par le droit français. Tout litige relèvera de la compétence exclusive des
          tribunaux de Paris, sous réserve des dispositions protectrices applicables aux consommateurs particuliers.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
