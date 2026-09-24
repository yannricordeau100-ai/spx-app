const fs=require('fs');
const p='.batches-drafts-safe/kpis-haut/MSI.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
const K=d.kpis;
const find=s=>K.find(k=>k.short===s);

// MAJ backlog_total -> annual year-end series
const bt=find('backlog_total');
bt.value=15.742; bt.unit='Mds $'; bt.yoy='+7%'; bt.frequency='annual';
bt.last_data_date='2025-12-31';
bt.signal="Carnet total record de 15,7 Mds $ fin 2025, en hausse de 1,0 Md $ sur un an, visibilité long terme pour la sécurité publique";
bt.history=[['2019',11.259],['2020',11.434],['2021',13.559],['2022',14.347],['2023',14.259],['2024',14.697],['2025',15.742]].map(([q,v])=>({q,v}));

// MAJ rpo -> add Q1-2026
const rpo=find('rpo');
rpo.history.push({q:'Q1-2026',v:9.5});
rpo.value=9.5; rpo.yoy='+7%'; rpo.last_data_date='2026-04-04';

const nk=[
 {short:'rd_expense',name_fr:"Dépenses de recherche et développement",name_en:"Research and development expenditures",
  value:970,unit:'M $',yoy:'+6%',frequency:'annual',pv_score:7,last_data_date:'2025-12-31',
  signal:"R&D en hausse continue (970 M $ en 2025), environ 40% des effectifs dédiés à la R&D et l'ingénierie, priorité logiciels et IA",
  description:"Dépenses annuelles de recherche et développement de Motorola Solutions.",
  history:[['2018',637],['2019',687],['2020',686],['2021',734],['2022',779],['2023',858],['2024',917],['2025',970]].map(([q,v])=>({q,v}))},
 {short:'backlog_psi',name_fr:"Carnet de commandes Produits et Intégration Systèmes",name_en:"Products and Systems Integration backlog",
  value:3.812,unit:'Mds $',yoy:'-8%',frequency:'annual',pv_score:7,last_data_date:'2025-12-31',
  signal:"Carnet Produits à 3,8 Mds $ fin 2025, en repli, conversion rapide des commandes matériel en chiffre d'affaires",
  description:"Carnet de commandes de fin d'année du segment Produits et Intégration Systèmes.",
  history:[['2019',3.158],['2020',3.120],['2021',4.006],['2022',4.900],['2023',4.993],['2024',4.135],['2025',3.812]].map(([q,v])=>({q,v}))},
 {short:'backlog_ss',name_fr:"Carnet de commandes Logiciels et Services",name_en:"Software and Services backlog",
  value:11.930,unit:'Mds $',yoy:'+13%',frequency:'annual',pv_score:8,last_data_date:'2025-12-31',
  signal:"Carnet Logiciels et Services record à 11,9 Mds $ fin 2025, visibilité pluriannuelle sur les revenus récurrents",
  description:"Carnet de commandes de fin d'année du segment Logiciels et Services.",
  history:[['2019',8.101],['2020',8.314],['2021',9.553],['2022',9.447],['2023',9.266],['2024',10.562],['2025',11.930]].map(([q,v])=>({q,v}))},
 {short:'employees',name_fr:"Effectif mondial",name_en:"Global headcount",
  value:23000,unit:'salariés',yoy:'+10%',frequency:'annual',pv_score:6,last_data_date:'2025-12-31',
  signal:"Environ 23 000 salariés fin 2025, répartis à 51% en Amérique du Nord et 49% à l'International",
  description:"Nombre approximatif de salariés dans le monde en fin d'année.",
  history:[['2020',18000],['2021',18700],['2022',20000],['2023',21000],['2024',21000],['2025',23000]].map(([q,v])=>({q,v}))},
 {short:'patents',name_fr:"Portefeuille de brevets accordés",name_en:"Granted patents owned",
  value:6630,unit:'brevets',yoy:'+2%',frequency:'annual',pv_score:6,last_data_date:'2025-12-31',
  signal:"Portefeuille d'environ 6 630 brevets accordés fin 2025, avec près de 690 demandes en cours, socle de propriété intellectuelle",
  description:"Nombre de brevets accordés détenus aux Etats-Unis et à l'étranger en fin d'année.",
  history:[['2020',6100],['2021',6430],['2022',6530],['2023',6560],['2024',6485],['2025',6630]].map(([q,v])=>({q,v}))},
];
for(const k of nk){ if(!find(k.short)) K.push(k); }
d._extracted_at=new Date().toISOString();
fs.writeFileSync(p, JSON.stringify(d,null,2));
console.log('kpis now', K.length, '->', K.map(k=>k.short).join(', '));
