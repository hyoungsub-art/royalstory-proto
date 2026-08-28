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
  ECON: { regen: 2.8, start: 6, cap: [0, 10, 15, 20], gasBonus: 0.5, tierCost: [0, 0, 6, 8],
          upCost: 4, transformCost: 3 },

  /* 규칙 수치 */
  EXCLUDE_R: 4,     // 적 건물 건설 배제 반경 (타일)
  HALL_ZONE: 8.5,   // 본진 주변 아군 영역 반경 (가로 15타일 기준 — 하단 가스 지역 도달 보장)
  TOWER_ZONE: 5,    // 타워 전선 확장 반경 (T3)
  AURA_R: 4,        // 영웅 오라 반경
  AURA_PWR: 0.25,   // 오라 공·방 +25% (중첩 허용 — 이슈 #11 가정)
  UPG_PWR: 0.12,    // 건물 업그레이드 단계당 공·방 +12%
  UNIT_CAP: 60,     // 진영당 일반 유닛 상한
  HERO_COST: 6,     // 영웅 공통 코스트 (확정: 전원 동일)
  HERO_CD: 12,      // 영웅 사망 후 재소환 쿨다운 (초)

  /* 건물: hp/cost/생산 주기 등 — 키·구조는 index.html 기본값과 동일해야 함 */
  BUILDINGS: {
    hall:          { hp: 4800 },
    elixirBase:    { hp: 900,  cost: 4 },
    barracks:      { hp: 1300, cost: 5, prod: { unit: "footman",       period: 8  } },
    shooterGarden: { hp: 1300,          prod: { unit: "rifleman",      period: 9  } },
    knightHall:    { hp: 1400,          prod: { unit: "knight",        period: 11 } },
    blacksmith:    { hp: 1100, cost: 5 },
    workshop:      { hp: 1300, cost: 6, prod: { unit: "flyingMachine", period: 10 } },
    sanctum:       { hp: 1300, cost: 6, prod: { unit: "mage",          period: 10 } },
    tower:         { hp: 1600, cost: 5, atk: { dmg: 109, hs: 0.8, rng: 5 } },
    guardTower:    { hp: 1800,          atk: { dmg: 180, hs: 0.8, rng: 5 } },
    arcaneTower:   { hp: 1700,          atk: { dmg: 135, hs: 1.0, rng: 5, splash: 1.5 } },
    aviary:        { hp: 1500, cost: 8, prod: { unit: "gryphon",       period: 14 } },
  },

  /* 유닛: cat = 업그레이드 분류 (gp 지상물리 / ap 공중물리 / gm 지상마법 / am 공중마법) */
  UNITS: {
    footman:       { hp: 1766, dmg: 202, hs: 1.2, rng: 0.8, spd: 1.0 },
    rifleman:      { hp: 720,  dmg: 218, hs: 1.1, rng: 4.0, spd: 1.0 },
    knight:        { hp: 2300, dmg: 330, hs: 1.5, rng: 0.9, spd: 1.5 },
    flyingMachine: { hp: 550,  dmg: 130, hs: 1.0, rng: 3.5, spd: 1.6 },
    mage:          { hp: 620,  dmg: 190, hs: 1.4, rng: 4.2, spd: 1.0, splash: 1.2 },
    gryphon:       { hp: 1900, dmg: 260, hs: 1.5, rng: 0.9, spd: 1.4 },
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
