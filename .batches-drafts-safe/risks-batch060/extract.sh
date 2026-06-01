#!/bin/zsh
mkdir -p /tmp/risks-batch060/extract
typeset -A files
files=(
  TPR  2025/TPR_2025-08-14.htm.gz
  TRGP 2026/TRGP_2026-02-19.htm.gz
  TRMB 2026/TRMB_2026-02-25.htm.gz
  TROW 2026/TROW_2026-02-13.htm.gz
  TRV  2026/TRV_2026-02-12.htm.gz
  TSCO 2026/TSCO_2026-02-19.htm.gz
  TSLA 2026/TSLA_2026-01-29.htm.gz
  TSN  2025/TSN_2025-11-10.htm.gz
  TT   2026/TT_2026-02-05.htm.gz
  TTD  2026/TTD_2026-02-27.htm.gz
)
for t in ${(k)files}; do
  f="/Users/yann/spx-app/sec-data/cat1-us/10K/${files[$t]}"
  out="/tmp/risks-batch060/extract/${t}.txt"
  gzcat "$f" 2>/dev/null | python3 /tmp/risks-batch060/parse.py > "$out"
  echo "$t: $(wc -c <"$out") chars"
done
