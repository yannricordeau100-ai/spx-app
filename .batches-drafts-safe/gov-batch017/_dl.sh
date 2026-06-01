#!/bin/bash
UA="Mettrik Research yannricordeau100@gmail.com"
mkdir -p /tmp/gov-batch017/raw
for t in CPB CPRT CPT CRH CRL CRM CRWD CRWV CSCO; do
  url=$(python3 -c "import json; print(json.load(open('/tmp/gov-batch017/_def14a_urls.json'))['$t']['url'])")
  echo "Downloading $t..."
  curl -s -H "User-Agent: $UA" "$url" -o "/tmp/gov-batch017/raw/${t}.htm"
  ls -la "/tmp/gov-batch017/raw/${t}.htm"
done
