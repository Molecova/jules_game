/* 밸런스 시트에서 적용한 값. scripts/balance-sheet.cjs apply 가 만든다(손으로 고치지 말고 시트로).
   data4.js 원본과 다른 값만 담는다. 비우면 원본 그대로. */
(function (global) {
  'use strict';
  const PATCH = {
    "units": {},
    "ult": {},
    "skills": {}
  };
  const V = global.V4;
  const put = (obj, ch) => { for (const [k, v] of Object.entries(ch)) { if (k.includes('.')) { const [a, b] = k.split('.'); obj[a] = Object.assign({}, obj[a], { [b]: v }); } else obj[k] = v; } };
  for (const u of V.UNITS) {
    if (PATCH.units[u.id]) put(u, PATCH.units[u.id]);
    if (u.ult && PATCH.ult[u.id]) { put(u.ult, PATCH.ult[u.id]); u.trait = u.ult.name + ': ' + u.ult.desc; }
  }
  for (const s of V.SKILLS) if (PATCH.skills[s.id]) { put(s, PATCH.skills[s.id]); if (PATCH.skills[s.id].t != null) s.tier = s.t; }
  V.BALANCE_PATCH = PATCH;
})(window);
