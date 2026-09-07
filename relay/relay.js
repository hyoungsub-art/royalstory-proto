/* ============================================================
   킹덤 크래프트 — PvP 매칭·릴레이 서버 (1단계, 2026-09-07)
   ------------------------------------------------------------
   역할: ① 대기열 2명 페어링 ② 시드·진영 배정 ③ 방 내 메시지 중계.
   게임 로직 없음 — 클라이언트가 결정론 락스텝으로 각자 시뮬레이션.

   실행:  npm install && npm start          (기본 포트 8787)
   배포:  fly.io / Render / Railway 등 Node 지원 무료 티어 어디든.
          PORT 환경변수를 따른다. wss:// 뒤에 두려면 플랫폼 TLS 사용.
   ============================================================ */
const { WebSocketServer } = require("ws");
const PORT = process.env.PORT || 8787;
const wss = new WebSocketServer({ port: PORT });

let waiting = null;          // 대기 중인 1명
let nextRoom = 1;

function safeSend(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (raw) => {
    let d;
    try { d = JSON.parse(raw); } catch (e) { return; }

    if (d.type === "queue") {
      /* 매칭 큐: 첫 번째는 대기, 두 번째가 오면 페어링 */
      if (waiting === ws) return;
      if (waiting && waiting.readyState === 1) {
        const a = waiting; waiting = null;
        const room = nextRoom++;
        const seed = ((Math.random() * 1e9) | 0) || 1;
        a.peer = ws; ws.peer = a;
        a.room = ws.roomId = a.roomId = room;
        /* host = 아래(파랑) 진영, guest = 위(빨강) 진영 — 캐논 시뮬 공유 */
        safeSend(a,  { type: "start", side: "host",  seed, room });
        safeSend(ws, { type: "start", side: "guest", seed, room });
        console.log(`[room ${room}] matched (seed ${seed})`);
      } else {
        waiting = ws;
        safeSend(ws, { type: "waiting" });
      }
      return;
    }

    if (d.type === "cancel") {
      if (waiting === ws) waiting = null;
      return;
    }

    /* 그 외 전부: 같은 방 상대에게 그대로 중계 (라운드 커맨드, 해시, 항복 등) */
    if (ws.peer) safeSend(ws.peer, d);
  });

  ws.on("close", () => {
    if (waiting === ws) waiting = null;
    if (ws.peer) { safeSend(ws.peer, { type: "peer_left" }); ws.peer.peer = null; }
  });
});

/* 죽은 연결 정리 (30초 핑) */
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 30000);

console.log("킹덤 크래프트 릴레이 서버 — ws://localhost:" + PORT);
