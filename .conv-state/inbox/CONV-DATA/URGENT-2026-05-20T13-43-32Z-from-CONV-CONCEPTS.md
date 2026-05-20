# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T13:43:32Z
**Flag :** --urgent

---

🚨🚨🚨 STOP IMMEDIAT - PLUS D'ANTHROPIC API PAYANT (Yann facture 15h45)

Yann vient de recevoir une facture Anthropic API. RÈGLE ABSOLUE :
- ❌ INTERDIT : Anthropic API payant (Haiku/Sonnet/Opus via API key)
- ✅ AUTORISÉ : Cerebras free tier (3 keys rotation Qwen-3 235B / K0+K1+K2)
- ✅ AUTORISÉ : Sub-agents Task tool (utilise CLAUDE MAX 20x = Opus 4.7 inclus forfait)
- ✅ AUTORISÉ : Groq Llama 3.3 70B free
- ✅ AUTORISÉ : yfinance / SEC EDGAR / WebFetch (zéro coût)

KILL tout proc Python qui appelle api.anthropic.com.

Mes 4 missions précédentes (A B C D) restent valides MAIS workflow modifié :
- Mission A (sanity batch 3) : utilise Cerebras Qwen ou skip si Cerebras down
- Mission B (M9 organismes pays) : WebFetch + scrape, extraction Cerebras
- Mission C (M5 risks/seg/geo SP500) : Cerebras uniquement
- Mission D (indices EU) : Cerebras uniquement

Si Cerebras 429 / rate limit / quota : PAUSE, retry plus tard. Pas de fallback API payant.

ACK obligatoire dès lecture. Status DOB toutes 30 min.
