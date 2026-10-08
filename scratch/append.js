const fs=require("fs");
const p="./.batches-drafts-safe/kpis-haut/CTAS.json";
const j=JSON.parse(fs.readFileSync(p));
const H=(pairs)=>pairs.map(([q,v])=>({q,v}));
const add=[
{
 short:"ROUTES", name_fr:"Circuits de livraison locaux", name_en:"Local delivery routes",
 value:12100, unit:"unités", yoy:"+3.4%", frequency:"annual",
 history:H([["FY2016",9000],["FY2017",11000],["FY2018",11100],["FY2019",11400],["FY2020",11100],["FY2021",11000],["FY2022",11300],["FY2023",11500],["FY2024",11700],["FY2025",12100]]),
 pv_score:7, last_data_date:"2025-05-31",
 signal:"Environ 12 100 circuits de livraison locaux au 31 mai 2025 (10-K FY2025), contre environ 11 700 un an plus tot. Densification continue du reseau de distribution qui porte la penetration des produits chez les clients existants.",
 description:"Nombre de circuits de livraison locaux operant depuis les usines de traitement et succursales. Indicateur de capacite operationnelle et de maillage territorial propre au modele de location de vetements et services aux etablissements. Chaque 10-K le publie en 'approximately X' (Item 1, Operations and Distribution).",
 _approx_note:"Chiffres publies en 'approximately X' dans chaque 10-K. YoY derive arithmetiquement (12 100 vs 11 700)."
},
{
 short:"OP_FACILITIES", name_fr:"Etablissements operationnels", name_en:"Operational facilities",
 value:478, unit:"sites", yoy:"+2.4%", frequency:"annual",
 history:H([["FY2016",377],["FY2017",528],["FY2018",474],["FY2019",470],["FY2020",472],["FY2021",460],["FY2022",462],["FY2023",461],["FY2024",467],["FY2025",478]]),
 pv_score:6, last_data_date:"2025-05-31",
 signal:"Environ 478 etablissements operationnels au 31 mai 2025 (10-K FY2025), contre 467 un an plus tot. Le pic FY2017 (528) reflete l'integration de l'acquisition G&K Services, suivie d'une rationalisation du parc.",
 description:"Nombre total d'etablissements operationnels (usines de traitement, succursales) hors centres de distribution. Mesure la capacite operationnelle installee. Publie en 'approximately X' dans chaque 10-K (Item 1, Operations and Distribution).",
 _approx_note:"Chiffres publies en 'approximately X' dans chaque 10-K. YoY derive arithmetiquement (478 vs 467)."
},
{
 short:"EMPLOYEES", name_fr:"Effectif salarie", name_en:"Employee-partners",
 value:48300, unit:"personnes", yoy:"+3.9%", frequency:"annual",
 history:H([["FY2016",35000],["FY2017",42000],["FY2018",41000],["FY2019",45000],["FY2020",40000],["FY2021",40000],["FY2022",43000],["FY2023",44500],["FY2024",46500],["FY2025",48300]]),
 pv_score:6, last_data_date:"2025-05-31",
 signal:"Environ 48 300 salaries ('employee-partners') au 31 mai 2025 (10-K FY2025), contre environ 46 500 un an plus tot. Croissance de l'effectif alignee sur l'expansion du reseau dans une activite a forte intensite de main d'oeuvre.",
 description:"Effectif total employe par Cintas ('employee-partners'), publie en 'approximately X' dans chaque 10-K (Item 1, Human Capital). Indicateur d'echelle operationnelle pour un modele de services de proximite a forte intensite de main d'oeuvre.",
 _approx_note:"Chiffres publies en 'approximately X' dans chaque 10-K. YoY derive arithmetiquement (48 300 vs 46 500)."
},
{
 short:"GM_TOTAL", name_fr:"Marge brute totale", name_en:"Total gross margin",
 value:50.0, unit:"%", yoy:"+1.2 pts", frequency:"annual",
 history:H([["FY2020",45.6],["FY2021",46.6],["FY2022",46.2],["FY2023",47.3],["FY2024",48.8],["FY2025",50.0]]),
 pv_score:8, last_data_date:"2025-05-31",
 signal:"Marge brute totale de 50,0% du CA en FY2025 (10-K), contre 48,8% en FY2024. Expansion continue portee par les gains de productivite, l'efficacite energetique et une meilleure utilisation des stocks en service.",
 description:"Marge brute consolidee (CA moins cout des ventes) en pourcentage du chiffre d'affaires. Publiee dans le tableau 'Gross margin' de la section MD&A de chaque 10-K. Mesure de qualite operationnelle et de pouvoir de fixation des prix.",
 _derived_note:"Valeur 'Total gross margin' verbatim du tableau MD&A de chaque 10-K. YoY exprime en points (50,0% vs 48,8%)."
},
{
 short:"GM_URFS", name_fr:"Marge brute Location Uniformes", name_en:"Uniform Rental & Facility Services gross margin",
 value:49.3, unit:"%", yoy:"+1.1 pts", frequency:"annual",
 history:H([["FY2020",45.9],["FY2021",47.6],["FY2022",46.7],["FY2023",47.3],["FY2024",48.2],["FY2025",49.3]]),
 pv_score:7, last_data_date:"2025-05-31",
 signal:"Marge brute du segment Location Uniformes et Services aux etablissements de 49,3% en FY2025 (10-K), contre 48,2% en FY2024. Progression tiree par les gains d'efficacite energetique et de production dans le segment dominant (environ 77% du CA).",
 description:"Marge brute du segment Uniform Rental and Facility Services (segment dominant) en pourcentage de son chiffre d'affaires. Publiee dans le tableau 'Gross margin' de la MD&A de chaque 10-K.",
 _derived_note:"Valeur verbatim du tableau MD&A de chaque 10-K. YoY exprime en points (49,3% vs 48,2%)."
},
{
 short:"GM_FIRSTAID", name_fr:"Marge brute Premiers Secours et Securite", name_en:"First Aid & Safety Services gross margin",
 value:57.2, unit:"%", yoy:"+1.7 pts", frequency:"annual",
 history:H([["FY2021",42.4],["FY2022",44.7],["FY2023",50.7],["FY2024",55.5],["FY2025",57.2]]),
 pv_score:8, last_data_date:"2025-05-31",
 signal:"Marge brute du segment Premiers Secours et Securite de 57,2% en FY2025 (10-K), contre 55,5% en FY2024, en forte expansion depuis 42,4% en FY2021. Amelioration structurelle liee au mix de ventes favorable, aux initiatives d'approvisionnement et de productivite.",
 description:"Marge brute du segment First Aid and Safety Services en pourcentage de son chiffre d'affaires. Publiee dans le tableau 'Gross margin' de la MD&A de chaque 10-K. Illustre la montee en gamme du segment a plus forte croissance.",
 _derived_note:"Valeur verbatim du tableau MD&A de chaque 10-K. YoY exprime en points (57,2% vs 55,5%). Serie sur 5 exercices."
}
];
const existing=new Set(j.kpis.map(k=>k.short));
for(const k of add){ if(existing.has(k.short)){console.log("SKIP dup",k.short);continue;} j.kpis.push(k); }
fs.writeFileSync(p, JSON.stringify(j,null,1));
console.log("total kpis now",j.kpis.length);
