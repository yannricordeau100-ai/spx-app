import { LegalLayout, LegalSection, ToFill } from "@/components/legal/legal-layout";

export const metadata = {
  title: "Conditions générales d'utilisation · Mettrik AI",
  description: "Conditions générales d'utilisation du site Mettrik AI.",
};

export default function CGUPage() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" updatedAt="30 avril 2026">
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (ci-après « <strong>CGU</strong> ») régissent l&apos;accès et
        l&apos;utilisation du site <strong>www.mettrik.ai</strong> et des services associés (ci-après « <strong>les Services</strong> »).
      </p>
      <p>
        En accédant au site, vous reconnaissez avoir pris connaissance des présentes CGU et les accepter sans réserve.
      </p>

      <LegalSection title="1. Objet du service">
        <p>
          Mettrik AI est une plateforme d&apos;intelligence KPI (« <em>KPI Intelligence</em> ») destinée aux investisseurs.
          Le service propose une analyse synthétique d&apos;indicateurs clés de performance des sociétés cotées en bourse,
          extraits de leurs publications financières officielles (rapports annuels, trimestriels, communiqués de presse).
        </p>
        <p>
          <strong>Important :</strong> Les contenus diffusés sur Mettrik AI sont fournis à titre informatif uniquement et ne
          constituent en aucun cas un conseil en investissement, une recommandation d&apos;achat ou de vente d&apos;instruments
          financiers, ni une sollicitation à investir. Les performances passées ne préjugent pas des performances futures.
        </p>
      </LegalSection>

      <LegalSection title="2. Accès au service">
        <p>
          Le site est accessible 24 heures sur 24, 7 jours sur 7, sauf cas de force majeure ou opérations de maintenance.
          Mettrik AI ne saurait être tenue responsable des interruptions ou ralentissements du service.
        </p>
        <p>
          Certains contenus avancés sont réservés aux abonnés <strong>Premium</strong>. Les modalités d&apos;abonnement sont
          détaillées dans les Conditions Générales de Vente.
        </p>
      </LegalSection>

      <LegalSection title="3. Compte utilisateur">
        <p>
          La création d&apos;un compte est gratuite et donne accès à un nombre limité de sociétés en plan Free
          (Google et Meta dans la version actuelle). L&apos;utilisateur s&apos;engage à fournir des informations exactes et à
          jour lors de son inscription, et à préserver la confidentialité de son mot de passe.
        </p>
        <p>
          L&apos;utilisateur est responsable de toute activité effectuée depuis son compte. En cas d&apos;utilisation
          frauduleuse, il s&apos;engage à en informer immédiatement Mettrik AI à l&apos;adresse <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">contact@mettrik.ai</a>.
        </p>
      </LegalSection>

      <LegalSection title="4. Obligations de l'utilisateur">
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
          <li>Ne pas tenter de contourner les limites techniques du service (paywall, quotas, authentification, jetons) ;</li>
          <li>Ne pas reproduire la base de données Mettrik AI en tout ou partie substantielle ;</li>
          <li>Ne pas porter atteinte à la sécurité ou à l&apos;intégrité du service.</li>
        </ul>
        <p>
          Toute violation de ces obligations entraînera la suspension ou résiliation immédiate du compte, sans
          remboursement, et pourra donner lieu à des poursuites civiles et pénales.
        </p>
      </LegalSection>

      <LegalSection title="5. Données et sources">
        <p>
          Mettrik AI utilise des données financières publiquement disponibles, principalement extraites des dépôts
          réglementaires (10-K, 10-Q, 8-K aux États-Unis ; rapports équivalents en Europe et Asie). Chaque donnée est
          accompagnée d&apos;un indicateur de fraîcheur et, lorsque possible, d&apos;un lien vers la source originale.
        </p>
        <p>
          Mettrik AI s&apos;efforce d&apos;assurer l&apos;exactitude des données, sans pouvoir garantir leur exhaustivité ou
          l&apos;absence d&apos;erreur. L&apos;utilisateur est invité à vérifier les données critiques auprès des sources officielles.
        </p>
      </LegalSection>

      <LegalSection title="6. Propriété intellectuelle">
        <p>
          L&apos;ensemble des éléments du site (textes, graphismes, code, marques, logos) est protégé par les lois en vigueur
          sur la propriété intellectuelle et reste la propriété exclusive de Mettrik AI ou de ses partenaires.
        </p>
        <p>
          L&apos;utilisateur dispose d&apos;un droit d&apos;usage personnel, non exclusif, non transférable et révocable des
          contenus auxquels son abonnement lui donne accès. Toute autre utilisation est strictement interdite.
        </p>
      </LegalSection>

      <LegalSection title="7. Suspension et résiliation">
        <p>
          Mettrik AI se réserve le droit de suspendre ou résilier sans préavis l&apos;accès d&apos;un utilisateur en cas de
          violation des présentes CGU, d&apos;impayé, d&apos;utilisation frauduleuse ou de toute action portant atteinte au
          service ou à d&apos;autres utilisateurs.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation de responsabilité">
        <p>
          Mettrik AI ne saurait être tenue responsable des décisions d&apos;investissement prises par l&apos;utilisateur sur
          la base des contenus du site, ni des éventuelles pertes financières qui en résulteraient. L&apos;utilisateur
          reconnaît que tout investissement comporte des risques et qu&apos;il agit sous sa seule responsabilité.
        </p>
      </LegalSection>

      <LegalSection title="9. Modification des CGU">
        <p>
          Mettrik AI se réserve le droit de modifier les présentes CGU à tout moment. Les modifications prennent effet dès
          leur publication sur le site. L&apos;utilisateur est invité à consulter régulièrement la dernière version en vigueur.
        </p>
      </LegalSection>

      <LegalSection title="10. Droit applicable">
        <p>
          Les présentes CGU sont régies par le droit français. Tout litige relèvera de la
          compétence exclusive des tribunaux de Paris.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
