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
  /* cap 10/20/30 (2026-09-04): 자연 회복으로 상한 도달 → 엘릭서 스타 1개 적립(바 0으로).
     스타 녹이기 = 현재 상한만큼 환원. 영웅 비용 = 스타(HERO_COST) */
  ECON: { regen: 2.8, start: 6, cap: [0, 10, 20, 30], gasBonus: 0.5,
          tierCost: [0, 0, 9, 14],       // 킵 9 / 캐슬 14
          upCost: [0, 0, 10, 18],        // 레벨2 10 / 레벨3 18
          transformCost: 10 },           // 변형 10

  /* 규칙 수치 */
  EXCLUDE_R: 5.25,  // 적 "본진" 주변 건설 배제 반경 (2026-08-31: 본진에만 적용, 타 건물 옆 건설 허용)
  HALL_ZONE: 5.25,  // 본진 주변 아군 영역 반경 (+1칸 개정, 판정은 건물 중심 기준)
  TOWER_ZONE: 5.25, // 타워 전선 확장 반경 = 본진과 동일
  AURA_R: 4,        // 영웅 오라 반경
  AURA_PWR: 0.25,   // 오라 공·방 +25% (중첩 허용 — 이슈 #11 가정)
  UPG_PWR: 0.12,    // 유닛 레벨 1단계당 스탯 +12% (생산 건물 레벨 = 유닛 레벨)
  UNIT_CAP: 60,     // 진영당 일반 유닛 상한
  HERO_COST: 1,     // 영웅 공통 코스트 — 단위: 엘릭서 스타 (최소 1, 전원 동일)
  HERO_CD: 12,      // 영웅 사망 후 재소환 쿨다운 (초)

  /* 건물: hp/cost/생산 주기 등 — 키·구조는 index.html 기본값과 동일해야 함
     2026-08-30 조정: 전 건물 HP ×2, 타워류 공격력 ×2 */
  BUILDINGS: {
    hall:          { hp: 19200,
                     /* 본진 공격: 티어별 공격력·동시 공격 대상 수 (인덱스 1~3 = 티어) */
                     hAtk: { hs: 0.8, rng: 7, dmg: [0, 109, 160, 240], targets: [0, 2, 5, 10] } },
    elixirBase:    { hp: 1800, cost: 4 },
    barracks:      { hp: 2600, cost: 5, prod: { unit: "footman",       period: 8  } },   // Lv3 → 쉴드 배럭
    shieldBarracks:{ hp: 2800,          prod: { unit: "shieldman",     period: 9  } },   // 배럭 Lv3 변형
    assaultBarracks:{hp: 2700, cost: 7, prod: { unit: "cavalry",       period: 10 } },   // 킵 필요, Lv3 → 기사단 회당
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
    ram:           { hp: 2600, dmg: 450, hs: 1.8, rng: 0.9, spd: 0.4 },   // 공성추 — 건물만 공격 (근접·초저속)
    siegeTank:     { hp: 1500, dmg: 700, hs: 3.0, rng: 4.5, spd: 0.3 },   // 공성 전차 — 건물만 공격 (장거리·초저속)
    mage:          { hp: 620,  dmg: 190, hs: 1.4, rng: 3.5, spd: 1.0, splash: 1.8 },   // 사거리 < 라이플맨, 광역 강화
    dragon:        { hp: 2400, dmg: 320, hs: 1.6, rng: 3.0, spd: 1.2, splash: 1.2 },   // 최상위 공중 마법 (광역 브레스)
    golem:         { hp: 3000, dmg: 300, hs: 1.8, rng: 0.9, spd: 0.55 },   // 최상위 지상 물리 탱커 (골렘 요람) — 저속
  },

  /* 난이도 = AI 전략 수준만 조정. 스탯·자원 규칙은 플레이어와 동등 (0/1은 사용 여부) */
  /* aggro=1: 생산 건물까지 전방 배치 / towerTf: 타워 변형(가드·아케인) 목표
     매우 어려움 = 어려움 전략의 강화판 — 양(건물 수)과 질(레벨·변형)을 끝까지 최대화 */
  DIFF: {
    easy:    { aiDelay: 12, aiInterval: 3.0, maxTier: 2, maxLevel: 1, gasBases: 1, prodMax: 1, towerMax: 2,  transform: 0, aviary: 0, defensive: 0, aggro: 0, towerTf: 0 },
    normal:  { aiDelay: 6,  aiInterval: 2.2, maxTier: 3, maxLevel: 2, gasBases: 2, prodMax: 2, towerMax: 4,  transform: 0, aviary: 0, defensive: 1, aggro: 0, towerTf: 0 },
    hard:    { aiDelay: 3,  aiInterval: 1.2, maxTier: 3, maxLevel: 3, gasBases: 3, prodMax: 6, towerMax: 8,  transform: 1, aviary: 1, defensive: 1, aggro: 0, towerTf: 2 },
    extreme: { aiDelay: 1,  aiInterval: 0.6, maxTier: 3, maxLevel: 3, gasBases: 3, prodMax: 9, towerMax: 12, transform: 1, aviary: 1, defensive: 1, aggro: 0, towerTf: 99 },
  },

  /* 영웅 (5인 고정 덱, 비용 = 엘릭서 스타). 스탯은 최상위 유닛(드래곤 2400/320) 초과로 상향 (2026-09-04) */
  HEROES: {
    archmage:     { hp: 2600, dmg: 380, hs: 1.4, rng: 4.0, spd: 1.0 },
    mountainKing: { hp: 4200, dmg: 520, hs: 1.4, rng: 0.9, spd: 1.1 },
    paladin:      { hp: 3800, dmg: 300, hs: 1.3, rng: 0.9, spd: 1.0, heal: 50 },
    bloodMage:    { hp: 2800, aoe: { dmg: 450, rad: 1.8, period: 3, castRng: 5 } },
    skyMage:      { hp: 2500, dmg: 360, hs: 1.3, rng: 4.0, spd: 1.0 },
  },
};
