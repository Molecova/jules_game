/* 밸런스 시트에서 적용한 값. scripts/balance-sheet.cjs apply 가 만든다(손으로 고치지 말고 시트로).
   data4.js 원본과 다른 값만 담는다. 비우면 원본 그대로. */
(function (global) {
  'use strict';
  const PATCH = {
    "units": {
      "merc": {
        "hp": 1250,
        "atk": 70
      },
      "warden": {
        "hp": 2150
      },
      "venom": {
        "atk": 46
      },
      "scout": {
        "hp": 800,
        "atk": 66
      },
      "ranger": {
        "atk": 104
      },
      "ninja": {
        "atk": 135
      },
      "monk": {
        "atk": 60
      },
      "summoner": {
        "hp": 1160,
        "atk": 54
      },
      "bishop": {
        "hp": 2200,
        "atk": 100
      }
    },
    "ult": {
      "hammer": {
        "power": 200
      },
      "warden": {
        "mana": 70
      },
      "venom": {
        "power": 65,
        "poison.dps": 25,
        "desc": "대상 피해 + 6초 중독(초당 25) + 1초 둔화"
      },
      "crossbow": {
        "mana": 80,
        "power": 310
      },
      "scout": {
        "mana": 60,
        "amt": 1.4,
        "desc": "4초간 자신 공격 속도 +40%"
      },
      "ranger": {
        "mana": 80,
        "power": 230
      },
      "ninja": {
        "power": 115
      },
      "monk": {
        "mana": 65,
        "power": 55,
        "desc": "가장 가까운 아군 2명 마나 +55"
      },
      "summoner": {
        "mana": 80
      },
      "warlock": {
        "power": 230
      },
      "bishop": {
        "power": 560,
        "heal": 560,
        "desc": "무작위 적 1명에게 피해 560, 체력 비율이 가장 낮은 아군 560 회복"
      }
    },
    "skills": {
      "bulwark": {
        "desc": "자신과 주변 2칸 아군 4초간 받는 피해 −30%, 초당 체력 50 회복",
        "hot": 50
      },
      "bleedcut": {
        "power": 110,
        "drain": 0.6,
        "desc": "앞쪽 3칸을 베고 준 피해의 60%만큼 회복"
      },
      "shadowstep": {
        "power": 160
      },
      "assassinate": {
        "power": 400,
        "stun": 2,
        "desc": "체력 비율이 가장 낮은 적에게 확정 치명 + 2초 기절"
      },
      "aegis": {
        "heal": 100,
        "desc": "모든 아군에게 보호막 135 + 체력 100 회복"
      },
      "heavy": {
        "power": 2,
        "desc": "대상에게 공격력 ×2 피해"
      },
      "execution": {
        "power": 620
      },
      "resolve": {
        "desc": "자신 체력을 최대 체력의 40%로 낮추고 6초간 공격 속도 +100%(★2 체력 45% · ★3 50%, 이미 낮으면 유지)",
        "hpFloor": 0.4,
        "hpFloorPerStar": 0.05
      },
      "marktarget": {
        "desc": "대상을 표시. 아군 기본 공격 3번이 확정 치명(★2 4번 · ★3 5번, 8초)",
        "markPerStar": 1
      },
      "windwalk": {
        "desc": "자신 회피 +40%, 공격 속도 +20%. 3초 지속(★2 3.5초 · ★3 4초)",
        "durPerStar": 0.5
      },
      "net": {
        "power": 120,
        "desc": "대상 중심 3×3 적 위력 120 + 2초간 이동 불가"
      },
      "aimedshot": {
        "power": 1050,
        "desc": "2초 조준 뒤 체력이 가장 높은 적에게 위력 1050"
      },
      "explosive": {
        "desc": "대상에게 위력 250, 2초 뒤 대상 중심 3×3에 위력 320 폭발",
        "blast": 320
      },
      "bindchain": {
        "desc": "적 둘이 받는 피해의 50%를 서로 공유. 6초 지속(★2 7초 · ★3 8초)",
        "durPerStar": 1
      },
      "stormeye": {
        "desc": "공격 속도 ×2, 기본 공격 주변 피해 50%. 5초 지속(★2 5.5초 · ★3 6초)",
        "durPerStar": 0.5
      },
      "sureshot": {
        "desc": "확정 치명 + 치명 피해 +100%. 5초 지속(★2 5.5초 · ★3 6초)",
        "durPerStar": 0.5
      },
      "iceblessing": {
        "desc": "체력 비율이 가장 낮은 아군 3초 무적(★2 3.25초 · ★3 3.5초)",
        "durPerStar": 0.25
      }
    },
    "items": {
      "holymace": {
        "desc": "체력 +20%, 공격력 +10%. 공격할 때마다 가장 다친 아군을 공격력의 25%만큼 회복",
        "st.atk": 0.1,
        "st.hp": 0.2
      },
      "greatsword": {
        "desc": "공격력 +25%, 흡혈 15%. 체력 50% 이하에서는 흡혈 25%",
        "st.atk": 0.25
      },
      "elephanthammer": {
        "desc": "체력 +18%, 받는 피해 −6%. 기본 공격 피해 450%, 공격 속도 절반, 기본 공격 명중률 50%(★2 60% · ★3 70%)",
        "st.hp": 0.18,
        "st.armor": 0.06
      },
      "towershield": {
        "desc": "체력 +38%, 받는 피해 −15%. 받은 피해의 10%만큼 가장 다친 아군 회복",
        "st.hp": 0.38
      },
      "whistle": {
        "desc": "전투 시작 시 사냥매 소환(무기 ★2 체력·공격 ×1.6, ★3 ×2.5). 같은 적 연속 공격 피해 최대 +25%(★2·★3 +40%)"
      },
      "eagleeye": {
        "desc": "사거리 +1, 공격력 +15%, 치명 +25%, 치명 피해 +40%. 10초마다 가장 먼 적 저격, 맞은 적 3초간 받는 피해 +20%",
        "st.atk": 0.15
      },
      "hornbow": {
        "desc": "근접 공격(사거리 1), 공격력 +20%, 공격 속도 +15%, 치명 +15%, 체력 +25%. 4번째 공격마다 대상 2초 이동 불가",
        "st.as": 0.15,
        "st.hp": 0.25
      },
      "prayerbook": {
        "desc": "치유 +25%, 체력 +10%, 공격당 마나 +3. 다친 아군이 있으면 기본 공격 대신 공격력의 45%만큼 치유",
        "st.hp": 0.1,
        "st.heal": 0.25,
        "st.manaPerHit": 3
      },
      "manaring": {
        "desc": "스킬 위력 +12%, 마나 10으로 시작. 초당 마나 +3, 장착 스킬 대기시간 −15%",
        "st.spell": 0.12
      },
      "vampsword": {
        "desc": "공격 속도 +100%, 흡혈 8%. 전투를 체력 50%로 시작. 공격할 때마다 흡혈 +1%(전투 동안 누적)",
        "st.lifesteal": 0.08
      },
      "archstaff": {
        "desc": "스킬 위력 +45%, 마나 20으로 시작, 공격당 마나 +3. 고유기 3번마다 한 번 더(60%)",
        "st.spell": 0.45,
        "st.manaPerHit": 3
      }
    }
  };
  const V = global.V4;
  const put = (obj, ch) => { for (const [k, v] of Object.entries(ch)) { if (k.includes('.')) { const [a, b] = k.split('.'); obj[a] = Object.assign({}, obj[a], { [b]: v }); } else obj[k] = v; } };
  for (const u of V.UNITS) {
    if (PATCH.units[u.id]) put(u, PATCH.units[u.id]);
    if (u.ult && PATCH.ult[u.id]) { put(u.ult, PATCH.ult[u.id]); u.trait = u.ult.name + ': ' + u.ult.desc; }
  }
  for (const s of V.SKILLS) if (PATCH.skills[s.id]) { put(s, PATCH.skills[s.id]); if (PATCH.skills[s.id].t != null) s.tier = s.t; }
  for (const it of V.ITEMS) if (PATCH.items[it.id]) put(it, PATCH.items[it.id]);
  V.BALANCE_PATCH = PATCH;
})(window);
