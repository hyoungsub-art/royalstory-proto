/* ============================================================
   로얄스토리 v2 — 밸런스 테이블 (오버라이드)
   ------------------------------------------------------------
   이 파일의 숫자만 고치고 저장하면 게임에 바로 반영됩니다 (새로고침).
   여기 적은 값이 index.html의 내장 기본값을 덮어씁니다.
   이 파일이 없어도 게임은 내장 기본값으로 동작합니다.
   전 수치 (가정) 상태 — 플레이 검증으로 확정해 갈 것.
   ============================================================ */
window.BALANCE = {

  /* 경제: 회복 주기(초/1), 시작량, 티어별 최대치, 골드 광산 1개당 보너스(+50%), 티어 승급 비용 */
  /* upCost: 목표 레벨별 비용 [_, _, Lv2, Lv3] — 레벨업 vs 변형을 택일 판단으로 만들기 위해 상향 */
  /* cap 10/20/30 (2026-09-04): 자연 회복으로 상한 도달 → 블러드 스타 1개 적립(바 0으로).
     스타 녹이기 = 현재 상한만큼 환원. 영웅 비용 = 스타(HERO_COST) */
  /* 2026-09-07 경제 개편: 승급·변형 = 블러드 스타(★), 레벨업 = 골드 (레벨당 고정) */
  /* 자원 재편 (2026-09-12 확정): 골드(상한 없음, 숫자 누적) + 블러드 스타(적 유닛 처치로 게이지 적립). 전 수치 (가정) */
  ECON: { regen: 2.8, start: 6, cap: [0, 10, 20, 30], gasBonus: 0.5,
          tierRegen: [0, 1, 1.25, 1.5],  // 티어별 골드 회복 배율 — 상한이 사라진 대신 승급의 경제 보상 (가정)
          pushGold: 15,                  // AI: 이 이상 골드가 남으면 전진 타워 압박에 쓴다
          starBy: "none",                // 2026-09-12 2차 확정: 블러드 스타 폐지 — 스타 관련 값은 실험용 보존
          tierGold: [0, 0, 15, 35],      // 승급 비용(골드): 킵 15 / 캐슬 35 (가정)
          transformGold: 8,              // 건물 변형 비용(골드) 일괄 8 (가정)
          bloodPer: 30, bloodDiv: 100, starPer: 1.0, tierStars: [0, 0, 1, 2], transformStar: 1,   // (실험용 보존)
          upPerLevel: [0, 4, 8, 12] },   // 레벨업(레벨당 골드): 1티어 건설 4 / 킵 건설 8 / 변형 획득 12

  /* 규칙 수치 */
  EXCLUDE_R: 5.25,  // 적 "본진" 주변 건설 배제 반경 (2026-08-31: 본진에만 적용, 타 건물 옆 건설 허용)
  RUIN_LINE: { off: 3, h: 2 },   // 무너진 성벽 흔적 (2026-09-13): 본진 앞 off칸 간격, h칸 두께 가로 성벽선 — 거점은 이 위에서만
  BUILD_RING: [0, 2, 4, 6],   // 건설 띠 폭[티어] (2026-09-12 확정): 본진·거점 풋프린트 주변 — 타운홀 2 / 킵 4 / 캐슬 6 (승급마다 +2, 강등 없음). 거점 자체는 어디든 건설 가능
  HALL_ZONE: 5.25,  // (레거시 — 미사용)
  TOWER_ZONE: 5.25, // (레거시 — 미사용)
  TOWER_VS_BLDG: 0.25, // 타워의 건물 공격 피해 배율 (타워전 억제)
  HERO_VS_BLDG: 0.15,  // 영웅의 건물 공격 피해 배율 — 영웅은 유닛전 특화 (가정)
  AURA_R: 4,        // 영웅 오라 반경
  AURA_PWR: 0.25,   // 오라 공·방 +25% (중첩 허용 — 이슈 #11 가정)
  UPG_PWR: 0.12,    // 유닛 레벨 1단계당 스탯 +12% (생산 건물 레벨 = 유닛 레벨)
  UNIT_CAP: 60,     // 진영당 일반 유닛 상한
  HERO_COST: 0,     // 영웅 무료 소환 (2026-09-12 확정) — 사망 시 HERO_CD 쿨다운만
  HERO_CD: 12,      // 영웅 사망 후 재소환 쿨다운 (초)
  HEROES_ON: 0,     // 영웅 시스템 스위치 (2026-09-12: 일단 제거 — 1로 바꾸면 영웅 탭·AI 소환·튜토리얼 단계가 다시 켜짐)

  /* 이동 감각 (2026-09-08, 가정) — 스타/워크식 관성·선회. 결정론 시뮬 값이라 양측 동일 적용
     accel: 최고 속도 도달 빠르기 (1/초, 9 ≈ 0.25초) / turnRate: 선회 속도 (rad/초, 11 ≈ 180° 회전에 0.29초)
     turnSlow: 큰 각도 선회 중 최소 속도 비율 (0.3 = 뒤돌아설 때 30% 속도로 제자리 선회) */
  MOVE: { accel: 9, turnRate: 11, turnSlow: 0.3 },

  /* 지형 보정 (2026-09-12, 6-9, 가정): 다리(길∩강) 위 지상 유닛 이속 배율 / 성벽 인접 타워 사거리 보너스(타일) */
  TERRAIN: { bridgeSpd: 1.15, wallRng: 0.5 },
  /* 전역 태세 (2026-09-12, 6-4, 가정): 대기 시 집결 반경(타일) / 대기 중 자위 반응 반경(타일) */
  STANCE: { holdR: 2, aggroR: 6 },

  /* 건물: hp/cost/생산 주기 등 — 키·구조는 index.html 기본값과 동일해야 함
     2026-08-30 조정: 전 건물 HP ×2, 타워류 공격력 ×2 */
  BUILDINGS: {
    hall:          { hp: 19200,
                     /* 본진 공격: 티어별 공격력·동시 공격 대상 수 (인덱스 1~3 = 티어). 사거리는 모든 타워 이상 자동 보장 */
                     hAtk: { hs: 0.8, rng: 7, dmg: [0, 109, 160, 240], targets: [0, 2, 5, 10] },
                     /* 본진 방어: 티어별 받는 피해 배율 — 킵 -20% / 캐슬 -35% (가정) */
                     hDef: [0, 1, 0.8, 0.65] },
    elixirBase:    { hp: 1800, cost: 4 },
    barracks:      { hp: 2600, cost: 5, prod: { unit: "footman",       period: 8  } },   // Lv3 → 쉴드 배럭
    shieldBarracks:{ hp: 2800,          prod: { unit: "shieldman",     period: 9  } },   // 배럭 Lv3 변형
    assaultBarracks:{hp: 2700, cost: 7, prod: { unit: "cavalry",       period: 10 } },   // 킵 필요, Lv3 → 기사단 회당
    archery:       { hp: 2400, cost: 6, prod: { unit: "archer",        period: 9  } },   // Lv3 → 슈터 가든 변형
    shooterGarden: { hp: 2600,          prod: { unit: "rifleman",      period: 9  } },
    knightHall:    { hp: 2800,          prod: { unit: "knight",        period: 11 } },
    workshop:      { hp: 2600, cost: 6, prod: { unit: "ram",           period: 13 } },   // 공성추 생산, Lv3 → 시즈 워크숍
    sanctum:       { hp: 2600, cost: 6, prod: { unit: "mage",          period: 10 } },
    tower:         { hp: 3200, cost: 5 },   // 비무장 거점 전용 (2026-09-04) — 공격은 가드/아케인 변형만
    guardTower:    { hp: 3600,          atk: { dmg: 360, hs: 0.8, rng: 6 } },   // 2026-09-08 사거리 5→6 (아케인과 교환, 가정)
    arcaneTower:   { hp: 3400,          atk: { dmg: 270, hs: 1.4, rng: 5, splash: 2.0 } },   // 2026-09-08 사거리 6→5, 공속 1.0→1.4 — 근거리 광역 카운터 (가정)
    siegeWorkshop: { hp: 3000,          prod: { unit: "siegeTank",     period: 20 } },   // 워크숍 Lv3 변형
    dragonNest:    { hp: 3200,          prod: { unit: "dragon",        period: 16 } },   // 생텀 Lv3 변형
    golemCradle:   { hp: 3400,          prod: { unit: "golem",         period: 16 } },   // 생텀 Lv3 변형 (택일)
  },

  /* 유닛: cat = 업그레이드 분류 (gp 지상물리 / ap 공중물리 / gm 지상마법 / am 공중마법) */
  UNITS: {
    footman:       { hp: 883,  dmg: 101, hs: 1.2, rng: 0.8, spd: 1.0 },   // 공·방 절반 (2026-08-30)
    shieldman:     { hp: 1600, dmg: 90,  hs: 1.4, rng: 0.8, spd: 0.9, rangedResist: 0.6 },   // 원거리 물리 60% 경감
    cavalry:       { hp: 1200, dmg: 220, hs: 1.3, rng: 0.9, spd: 1.9, pierceVsMelee: 0.5, rangedWeak: 0.5 },   // 창 관통/원거리 취약
    archer:        { hp: 310,  dmg: 55,  hs: 1.3, rng: 3.2, spd: 1.0 },   // 기본 원거리 (아처리) — 공·방·사거리 하향
    rifleman:      { hp: 720,  dmg: 150, hs: 1.6, rng: 4.5, spd: 1.0 },   // 공속·공격력 하향
    knight:        { hp: 2300, dmg: 330, hs: 1.5, rng: 0.9, spd: 1.6, pierceVsMelee: 0.5, rangedWeak: 0.5 },   // 철갑 기병 — 창 관통/원거리 취약
    ram:           { hp: 1500, dmg: 450, hs: 2.4, rng: 0.9, spd: 0.32 },  // 공성추 — 건물만 공격 (근접·초저속). 2026-09-08 HP 2600→1500(전차와 동일), 이속·공속 하향 (가정)
    siegeTank:     { hp: 1500, dmg: 620, hs: 4.0, rng: 4.0, spd: 0.24 },  // 공성 전차 — 공격 타워(5~6)에 아웃레인지. 2026-09-08 이속·공속 하향 (가정)
    mage:          { hp: 620,  dmg: 190, hs: 1.4, rng: 3.5, spd: 1.0, splash: 1.8 },   // 사거리 < 라이플맨, 광역 강화
    dragon:        { hp: 2400, dmg: 320, hs: 1.6, rng: 3.0, spd: 1.2, splash: 1.2 },   // 최상위 공중 마법 (광역 브레스)
    golem:         { hp: 3000, dmg: 300, hs: 1.8, rng: 0.9, spd: 0.55 },   // 최상위 지상 물리 탱커 (골렘 요람) — 저속
  },

  /* 난이도 = AI 전략 수준만 조정. 스탯·자원 규칙은 플레이어와 동등 (0/1은 사용 여부) */
  /* aggro=1: 생산 건물까지 전방 배치 / towerTf: 타워 변형(가드·아케인) 목표
     atkTwMin: 레벨업 저축보다 우선하는 최소 공격 타워 수 / heroUse: AI 영웅 소환(비용·쿨다운 동등)
     매우 어려움 = 어려움 전략의 강화판 — 양(건물 수)과 질(레벨·변형)을 끝까지 최대화 */
  DIFF: {
    easy:    { aiDelay: 10, aiInterval: 3.0,  maxTier: 2, maxLevel: 1, gasBases: 1, prodMax: 2,  towerMax: 2,  transform: 0, aviary: 0, defensive: 0, aggro: 0, towerTf: 0,  atkTwMin: 0, heroUse: 0, lvAfterProd: 2 },
    normal:  { aiDelay: 5,  aiInterval: 1.6,  maxTier: 3, maxLevel: 2, gasBases: 2, prodMax: 4,  towerMax: 5,  transform: 0, aviary: 0, defensive: 1, aggro: 0, towerTf: 3,  atkTwMin: 2, heroUse: 0, lvAfterProd: 3 },
    hard:    { aiDelay: 2,  aiInterval: 0.9,  maxTier: 3, maxLevel: 3, gasBases: 3, prodMax: 7,  towerMax: 9,  transform: 1, aviary: 1, defensive: 1, aggro: 1, towerTf: 6,  atkTwMin: 3, heroUse: 1, spendAll: 1, lvAfterProd: 4 },
    extreme: { aiDelay: 0,  aiInterval: 0.45, maxTier: 3, maxLevel: 3, gasBases: 3, prodMax: 10, towerMax: 14, transform: 1, aviary: 1, defensive: 1, aggro: 0, towerTf: 99, atkTwMin: 4, heroUse: 1, spendAll: 1, lvAfterProd: 4 },
    /* lvAfterProd (2026-09-12, 기본기): 생산 건물이 이 수에 이르기 전에는 레벨업 금지 — 초반은 넓게 짓고 업그레이드는 그 다음 */
    /* spendAll (2026-09-12): 전략적 저축(승급·변형·영웅 ★) 외에는 자원을 놀리지 않음 — 소프트 캡을 넘어 레벨업·증설·타워로 계속 소비, 잉여 ★은 녹여 사용 */
  },

  /* AI 전략 인격 (2026-09-12, 가정): 스파링 상대 8종 — 매우 어려움(DIFF.extreme) 위에 덮어쓰는 오버라이드 + 선호 필드.
     스탯·자원은 여전히 플레이어와 동등. 스파링 시작 시 시드 난수로 무작위 선택 (같은 시드 = 같은 상대).
     prodW: 생산 계열 증설 가중치(높을수록 자주) / techPref: 먼저 여는 테크(workshop|sanctum) / tfPref: 변형 우선순위
     heroMin: 전장 유지 영웅 수 / gasFirst·lvFirst·siegeFirst·heroFirst·towerFirst: 빌드 순서 스위치 */
  AI_STYLES: {
    rush:    { nm: "강습대장",   d: "초반 물량 러시",        wave: 7, aggro: 1, gasBases: 1, atkTwMin: 1, towerTf: 3, towerMax: 8, prodMax: 12, maxTier: 2, maxLevel: 2, heroMin: 1, prodW: { barracks: 3, archery: 1 }, techPref: "workshop", tfPref: ["shieldBarracks"] },
    cavalry: { nm: "기병대장",   d: "기병 돌격",             wave: 6, aggro: 1, gasBases: 2, atkTwMin: 2, towerTf: 5, heroMin: 1, prodW: { assaultBarracks: 3, barracks: 1, archery: 1 }, techPref: "workshop", tfPref: ["knightHall", "shieldBarracks", "shooterGarden"] },
    archer:  { nm: "궁수장군",   d: "원거리 물량·가드 타워", heroMin: 1, prodW: { archery: 3, barracks: 1 }, techPref: "workshop", tfPref: ["shooterGarden", "shieldBarracks"] },
    siege:   { nm: "공성기술자", d: "공성 병기 철거",        siegeFirst: 1, atkTwMin: 1, towerTf: 4, heroMin: 1, prodW: { workshop: 2, barracks: 1, archery: 1 }, techPref: "workshop", tfPref: ["siegeWorkshop", "shieldBarracks"] },
    arcane:  { nm: "대마법사",   d: "마법 테크·아케인 타워", atkTwMin: 2, heroMin: 1, prodW: { sanctum: 3, archery: 1 }, techPref: "sanctum", tfPref: ["dragonNest", "shooterGarden"] },
    turtle:  { nm: "요새군주",   d: "철벽 방어 후 역습",     aggro: 0, towerFirst: 1, atkTwMin: 6, towerTf: 99, towerMax: 16, prodMax: 6, heroMin: 1, prodW: { archery: 2, barracks: 1 }, techPref: "sanctum", tfPref: ["shieldBarracks", "dragonNest"] },
    greed:   { nm: "상인왕",     d: "경제 우선·후반 폭발",   gasFirst: 1, lvFirst: 1, gasBases: 3, atkTwMin: 1, towerTf: 4, prodMax: 12, heroMin: 1, prodW: { barracks: 1, archery: 1, assaultBarracks: 1 }, techPref: "workshop", tfPref: ["knightHall", "shooterGarden", "shieldBarracks", "dragonNest"] },
    hero:    { nm: "영웅왕",     d: "영웅 중심 전투",        heroFirst: 1, heroMin: 3, atkTwMin: 2, prodW: { archery: 2, barracks: 1, sanctum: 1 }, techPref: "sanctum", tfPref: ["shooterGarden", "dragonNest"] },
  },

  /* 영웅 (5인 고정 덱, 비용 = 블러드 스타). 스탯은 최상위 유닛(드래곤 2400/320) 초과로 상향 (2026-09-04) */
  HEROES: {
    archmage:     { hp: 2600, dmg: 380, hs: 1.4, rng: 4.0, spd: 1.0 },
    mountainKing: { hp: 4200, dmg: 520, hs: 1.4, rng: 0.9, spd: 1.1 },
    paladin:      { hp: 3800, dmg: 300, hs: 1.3, rng: 0.9, spd: 1.0, heal: 50 },
    bloodMage:    { hp: 2800, aoe: { dmg: 450, rad: 1.8, period: 3, castRng: 5 } },
    skyMage:      { hp: 2500, dmg: 360, hs: 1.3, rng: 4.0, spd: 1.0 },
  },
};
