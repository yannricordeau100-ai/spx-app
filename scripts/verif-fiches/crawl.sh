#!/bin/bash
# Telecharge le HTML servi de chaque fiche sur la preversion (jeton d audit), 6 en parallele.
S=/private/tmp/claude-501/-Users-yann/f9760fc2-7eac-4e41-821a-262ae5427645/scratchpad
TOK=$(grep "^VISUAL_AUDIT_TOKEN=" /Users/yann/spx-app/.env.local | cut -d= -f2)
mkdir -p $S/html
un() { t="$1"; l=$(echo "$t" | tr 'A-Z' 'a-z'); code=$(curl -s -o "$S/html/$t.html" -w "%{http_code}" --max-time 90 "https://mettrik-niveau2.vercel.app/$l?audit_token=$TOK"); echo "$t $code $(wc -c < "$S/html/$t.html")"; }
export -f un; export S TOK
cat $S/tickers.txt | xargs -P 6 -I{} bash -c 'un {}' > $S/crawl-codes.txt
awk '$2!=200' $S/crawl-codes.txt | head; echo "total $(wc -l < $S/crawl-codes.txt), non-200: $(awk '$2!=200' $S/crawl-codes.txt | wc -l)"
