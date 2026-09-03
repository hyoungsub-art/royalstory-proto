/* ============================================================
   로얄스토리 v2 — 밸런스 테이블 (오버라이드)
   ------------------------------------------------------------
   이 파일의 숫자만 고치고 저장하면 게임에 바로 반영됩니다 (새로고침).
   여기 적은 값이 index.html의 내장 기본값을 덮어씁니다.
   이 파일이 없어도 게임은 내장 기본값으로 동작합니다.
   전 수치 (가정) 상태 — 플레이 검증으로 확정해 갈 것.
   ============================================================ */
window.BALANCE = {

  /* 경제: 회복 주기(초/1), 시작량, 티어별 최대치, 가스 기지 1개당 보너스(+50%), 티어 승급 비용 */
  /* upCost: 목표 레벨별 비용 [_, _, Lv2, Lv3] — 레벨업 vs 변형을 택일 판단으로 만들기 위해 상향 */
  ECON: { regen: 2.8, start: 6, cap: [0, 10, 15, 20], gasBonus: 0.5,
          /* 주의: 승급 비용은 직전 티어의 엘릭서 상한 이하여야 함 (킵≤10, 캐슬≤15) */
          tierCost: [0, 0, 9, 14],       // 킵 9 / 캐슬 14 (상향)
          upCost: [0, 0, 10, 18],        // 레벨2 10 / 레벨3 18
          transformCost: 10 },           // 변형 10 (상향)

  /* 규칙 수치 */
  EXCLUDE_R: 4,     // 적 건물 건설 배제 반경 (타일)
  HALL_ZONE: 5.25,  // 본진 주변 아군 영역 반경 (+1칸 개정, 판정은 건물 중심 기준)
  TOWER_ZONE: 5.25, // 타워 전선 확장 반경 = 본진과 동일
  AURA_R: 4,        // 영웅 오라 반경
  AURA_PWR: 0.25,   // 오라 공·방 +25% (중첩 허용 — 이슈 #11 가정)
  UPG_PWR: 0.12,    // 유닛 레벨 1단계당 스탯 +12% (생산 건물 레벨 = 유닛 레벨)
  UNIT_CAP: 60,     // 진영당 일반 유닛 상한
  HERO_COST: 6,     // 영웅 공통 코스트 (확정: 전원 동일)
  HERO_CD: 12,      // 영웅 사망 후 재소환 쿨다운 (초)

  /* 건물: hp/cost/생산 주기 등 — 키·구조는 index.html 기본값과 동일해야 함
     2026-08-30 조정: 전 건물 HP ×2, 타워류 공격력 ×2 */
  BUILDINGS: {
    hall:          { hp: 19200,
                     /* 본진 공격: 티어별 공격력·동시 공격 대상 수 (인덱스 1~3 = 티어) */
                     hAtk: { hs: 0.8, rng: 7, dmg: [0, 109, 160, 240], targets: [0, 2, 5, 10] } },
    elixirBase:    { hp: 1800, cost: 4 },
    barracks:      { hp: 2600, cost: 5, prod: { unit: "footman",       period: 8  } },
    archery:       { hp: 2400, cost: 6, prod: { unit: "archer",        period: 9  } },   // Lv3 → 슈터 가든 변형
    shooterGarden: { hp: 2600,          prod: { unit: "rifleman",      period: 9  } },
    knightHall:    { hp: 2800,          prod: { unit: "knight",        period: 11 } },
    workshop:      { hp: 2600, cost: 6, prod: { unit: "ram",           period: 13 } },   // 공성추 생산, Lv3 → 시즈 워크숍
    sanctum:       { hp: 2600, cost: 6, prod: { unit: "mage",          period: 10 } },
    tower:         { hp: 3200, cost: 5, atk: { dmg: 218, hs: 0.8, rng: 5 } },
    guardTower:    { hp: 3600,          atk: { dmg: 360, hs: 0.8, rng: 5 } },
    arcaneTower:   { hp: 3400,          atk: { dmg: 270, hs: 1.0, rng: 6, splash: 2.0 } },   // 장사거리 광역 카운터
    siegeWorkshop: { hp: 3000,          prod: { unit: "siegeTank",     period: 20 } },   // 워크숍 Lv3 변형
    dragonNest:    { hp: 3200,          prod: { unit: "dragon",        period: 16 } },   // 생텀 Lv3 변형
  },

  /* 유닛: cat = 업그레이드 분류 (gp 지상물리 / ap 공중물리 / gm 지상마법 / am 공중마법) */
  UNITS: {
    footman:       { hp: 883,  dmg: 101, hs: 1.2, rng: 0.8, spd: 1.0 },   // 공·방 절반 (2026-08-30)
    archer:        { hp: 310,  dmg: 55,  hs: 1.3, rng: 3.2, spd: 1.0 },   // 기본 원거리 (아처리) — 공·방·사거리 하향
    rifleman:      { hp: 720,  dmg: 150, hs: 1.6, rng: 4.5, spd: 1.0 },   // 공속·공격력 하향
    knight:        { hp: 2300, dmg: 330, hs: 1.5, rng: 0.9, spd: 1.5 },
    ram:           { hp: 2600, dmg: 450, hs: 1.8, rng: 0.9, spd: 0.8 },   // 공성추 — 건물만 공격 (근접)
    siegeTank:     { hp: 1500, dmg: 700, hs: 3.0, rng: 4.5, spd: 0.7 },   // 공성 전차 — 건물만 공격 (장거리)
    mage:          { hp: 620,  dmg: 190, hs: 1.4, rng: 3.5, spd: 1.0, splash: 1.8 },   // 사거리 < 라이플맨, 광역 강화
    dragon:        { hp: 2400, dmg: 320, hs: 1.6, rng: 3.0, spd: 1.2, splash: 1.2 },   // 최상위 공중 마법 (광역 브레스)
  },

  /* 난이도 = AI 전략 수준만 조정. 스탯·자원 규칙은 플레이어와 동등 (0/1은 사용 여부) */
  /* aggro=1: 생산 건물까지 전방 배치해 압박 (스폰 지점 전진) */
  DIFF: {
    easy:    { aiDelay: 12, aiInterval: 3.0, maxTier: 2, maxLevel: 1, gasBases: 1, prodMax: 1, towerMax: 2, transform: 0, aviary: 0, defensive: 0, aggro: 0 },
    normal:  { aiDelay: 6,  aiInterval: 2.2, maxTier: 3, maxLevel: 2, gasBases: 2, prodMax: 2, towerMax: 4, transform: 0, aviary: 0, defensive: 1, aggro: 0 },
    hard:    { aiDelay: 3,  aiInterval: 1.2, maxTier: 3, maxLevel: 3, gasBases: 3, prodMax: 6, towerMax: 8, transform: 1, aviary: 1, defensive: 1, aggro: 0 },   // 건물 목표 상향
    extreme: { aiDelay: 1,  aiInterval: 0.6, maxTier: 3, maxLevel: 3, gasBases: 3, prodMax: 4, towerMax: 5, transform: 1, aviary: 1, defensive: 1, aggro: 1 },
  },

  /* 영웅 (5인 고정 덱, 코스트 공통 = HERO_COST) */
  HEROES: {
    archmage:     { hp: 900,  dmg: 160, hs: 1.4, rng: 4.0, spd: 1.0 },
    mountainKing: { hp: 2600, dmg: 320, hs: 1.4, rng: 0.9, spd: 1.1 },
    paladin:      { hp: 2200, dmg: 180, hs: 1.3, rng: 0.9, spd: 1.0, heal: 25 },
    bloodMage:    { hp: 800,  aoe: { dmg: 260, rad: 1.8, period: 3, castRng: 5 } },
    skyMage:      { hp: 850,  dmg: 150, hs: 1.3, rng: 4.0, spd: 1.0 },
  },
};
