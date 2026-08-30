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
  ECON: { regen: 2.8, start: 6, cap: [0, 10, 15, 20], gasBonus: 0.5, tierCost: [0, 0, 6, 8],
          upCost: [0, 0, 10, 18], transformCost: 5 },

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
    shooterGarden: { hp: 2600,          prod: { unit: "rifleman",      period: 9  } },
    knightHall:    { hp: 2800,          prod: { unit: "knight",        period: 11 } },
    workshop:      { hp: 2600, cost: 6, prod: { unit: "flyingMachine", period: 10 } },
    sanctum:       { hp: 2600, cost: 6, prod: { unit: "mage",          period: 10 } },
    tower:         { hp: 3200, cost: 5, atk: { dmg: 218, hs: 0.8, rng: 5 } },
    guardTower:    { hp: 3600,          atk: { dmg: 360, hs: 0.8, rng: 5 } },
    arcaneTower:   { hp: 3400,          atk: { dmg: 270, hs: 1.0, rng: 6, splash: 2.0 } },   // 장사거리 광역 카운터
    aviary:        { hp: 3000, cost: 8, prod: { unit: "gryphon",       period: 14 } },
  },

  /* 유닛: cat = 업그레이드 분류 (gp 지상물리 / ap 공중물리 / gm 지상마법 / am 공중마법) */
  UNITS: {
    footman:       { hp: 883,  dmg: 101, hs: 1.2, rng: 0.8, spd: 1.0 },   // 공·방 절반 (2026-08-30)
    rifleman:      { hp: 720,  dmg: 150, hs: 1.6, rng: 4.5, spd: 1.0 },   // 공속·공격력 하향
    knight:        { hp: 2300, dmg: 330, hs: 1.5, rng: 0.9, spd: 1.5 },
    flyingMachine: { hp: 550,  dmg: 130, hs: 1.0, rng: 3.5, spd: 1.6 },
    mage:          { hp: 620,  dmg: 190, hs: 1.4, rng: 3.5, spd: 1.0, splash: 1.8 },   // 사거리 < 라이플맨, 광역 강화
    gryphon:       { hp: 1900, dmg: 260, hs: 1.5, rng: 3.0, spd: 1.4 },   // 사거리 확대
  },

  /* 난이도 = AI 전략 수준만 조정. 스탯·자원 규칙은 플레이어와 동등 (0/1은 사용 여부) */
  DIFF: {
    easy:   { aiDelay: 12, aiInterval: 3.0, maxTier: 2, maxLevel: 1, gasBases: 1, prodMax: 1, towerMax: 2, transform: 0, aviary: 0, defensive: 0 },
    normal: { aiDelay: 4,  aiInterval: 1.8, maxTier: 3, maxLevel: 2, gasBases: 2, prodMax: 2, towerMax: 5, transform: 1, aviary: 0, defensive: 1 },
    hard:   { aiDelay: 2,  aiInterval: 1.0, maxTier: 3, maxLevel: 3, gasBases: 3, prodMax: 4, towerMax: 8, transform: 1, aviary: 1, defensive: 1 },
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
