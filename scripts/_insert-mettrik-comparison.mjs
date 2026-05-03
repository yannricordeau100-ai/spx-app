import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync("/Users/yann/spx-app/.env.local", "utf-8")
    .split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim().replace(/^"|"$/g, "")]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const body = `# 📊 V1 5 stés — Mettrik vs fiscal.ai vs stockanalysis.com (synthèse 1 min)

**Légende** : 💎 WOW Mettrik · 🟢 exclusif Mettrik · 🔵 exclusif fiscal.ai · 🟡 exclusif stockanalysis · ⚪ partout

---

## GOOGL · 12 KPI Mettrik
- **Hero** Cloud Revenue (les 3 sites)
- **Segments rev** : Cloud / YT Ads / Search / Subs (les 3 sites) — fiscal+stock ajoutent Other Bets et Hedging
- 🟢 Mettrik exclusif : 💎 TAC, 💎 Capex IA, 💎 Other Bets Loss, narration 4 points
- 🔵🟡 Eux exclusifs : géo (US/EMEA/APAC/Other Americas), EBIT par segment, ratios complets

## META · 12 KPI Mettrik
- **Hero** DAP (Mettrik) / Family DAP (fiscal) / Family of Apps Rev (stock)
- **Operational** : 💎 DAP, ARPP, Ad Impressions, Ad Price (Mettrik + fiscal)
- 🟢 Mettrik exclusif : 💎 Capex IA, 💎 RL Loss, narration
- 🔵 fiscal exclusif : DAU régional (US&Canada / Europe / APAC / RoW)

## MSCI · 10 KPI Mettrik
- **Hero** Total Run Rate
- **Segments** : Sub RR / ABF / Index / Analytics (les 3 sites)
- 🟢 Mettrik exclusif : 💎 Net New Subscription Sales, 💎 Retention quarterly
- 🔵 fiscal exclusif : Run Rate par géo (Americas/EMEA/APAC), EBITDA par segment

## SPGI · 16 KPI Mettrik (LE PLUS RICHE)
- **Hero** Ratings Revenue
- **Segments** : Ratings, MI, Indices, Energy, Mobility (les 3 sites)
- 🟢 Mettrik EXCLUSIF (très fort) : 💎 Vitality Revenue, 💎 Kensho Customers, 💎 Kensho API Calls, 💎 ACV IA Multiplier, 💎 Billed Issuance, 💎 ETD Volume
- 🔵 fiscal exclusif : géo, op profit segments

## CAT · 19 KPI Mettrik (LE PLUS COMPLET)
- **Hero** Backlog
- **Segments** : Construction / Resource / Energy & Transport (les 3 sites)
- 🟢 Mettrik EXCLUSIF (très fort) : 💎 Autonomous Trucks, 💎 Connected Fleet, 💎 Power Gen Sales, 💎 Services Revenues, 💎 Cap Return, 💎 FCF MP&E
- 🔵 fiscal exclusif : géo (NA/LatAm/EAME/APAC), op profit segments, capex segments

---

## 🎯 Synthèse globale

| Critère | Mettrik | fiscal.ai | stockanalysis |
|---|---|---|---|
| Nombre KPI | 10-19 sélectif | 30-50 exhaustif | 25-40 |
| Hero KPI explicite | ✅ | ❌ | ❌ |
| WOW innovation/IA | ✅ Kensho, Connected Fleet | ❌ | ❌ |
| Géo régional | ❌ | ✅ | ✅ |
| Op profit par segment | ❌ | ✅ | ✅ |
| Stories court historique | ✅ unique | ❌ | ❌ |
| Interprétation 4 points | ✅ | ❌ | ❌ |
| Risques + scoring | ✅ | ❌ | ❌ |
| Gouvernance + IA stance | ✅ | ❌ | ❌ |

## ✅ A AJOUTER au pipeline Mettrik (gaps identifiés)

1. Revenue par géographie (US / EMEA / APAC / RoW) systématique
2. Operating Profit par segment
3. Capex par segment (CAT type)
4. DAU régional (META + équivalents tech)
5. Run Rate par géo (MSCI + équivalents subs)

## 💎 USP Mettrik à VALORISER

1. Hero KPI explicite + rationale
2. WOW innovation/IA (Kensho, Connected Fleet, Capex IA)
3. Stories court historique (KPIs <5 ans)
4. Interprétation 4 points narrative
5. Risques scorés 1-5 avec rationale
6. Gouvernance + IA positioning stance
7. Tagline + ranking mondial/sectoriel
`;

const ownerEmail = env.DESK_OWNER_EMAIL || "yannricordeau100@gmail.com";

const { data, error } = await supabase.from("desk_notes").insert({
  owner_email: ownerEmail,
  title: "📊 V1 Mettrik vs fiscal.ai vs stockanalysis — comparison",
  body: body,
  tags: ["benchmark", "kpi", "mettrik-vs-eux", "v1"],
  pinned: true,
}).select().single();

if (error) {
  console.error("ERR:", error);
  process.exit(1);
}
console.log("✅ Note inserted, id:", data.id, "title:", data.title);
