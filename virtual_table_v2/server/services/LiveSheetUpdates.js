/**
 * 실시간 시트 데이터 업데이트 (WebSocket)
 * 시트 변경사항을 실시간으로 클라이언트에 푸시
 */

import { WebSocketServer } from 'ws';
import GoogleSheetsService from './GoogleSheetsService.js';
import { getSheetCache } from './SheetCache.js';

class LiveSheetUpdates {
  constructor() {
    this.wss = null;
    this.clients = new Set();
    this.sheetsService = new GoogleSheetsService();
    this.sheetCache = getSheetCache();
    this.lastData = null;
    this.pollInterval = null;
    this.changeListeners = new Map();
  }

  /**
   * WebSocket 서버 초기화
   */
  initialize(server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, request) => {
      console.log(`🔗 새 클라이언트 연결: ${request.socket.remoteAddress}`);
      this.clients.add(ws);

      // 연결 시 현재 데이터 전송
      this.sendCurrentData(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error.message);
        }
      });

      ws.on('close', () => {
        console.log('👋 클라이언트 연결 해제');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket 오류:', error.message);
        this.clients.delete(ws);
      });
    });

    // 폴링 시작
    this.startPolling();

    console.log('📡 Live Sheet Updates WebSocket 서버 시작');
  }

  /**
   * 현재 시트 데이터를 클라이언트에 전송
   */
  async sendCurrentData(ws) {
    try {
      const result = await this.sheetCache.get('Type!A2:H');
      const stats = await this.sheetCache.getStats();

      const message = {
        type: 'initial_data',
        data: {
          tables: result.data,
          stats,
          source: result.source,
          cached: result.cached,
          timestamp: new Date().toISOString()
        }
      };

      this.sendToClient(ws, message);
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        message: '초기 데이터 로드 실패',
        error: error.message
      });
    }
  }

  /**
   * 클라이언트 메시지 처리
   */
  async handleClientMessage(ws, message) {
    switch (message.type) {
      case 'subscribe':
        await this.handleSubscribe(ws, message);
        break;

      case 'search_player':
        await this.handlePlayerSearch(ws, message);
        break;

      case 'request_refresh':
        await this.handleRefreshRequest(ws, message);
        break;

      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        console.log('알 수 없는 메시지 타입:', message.type);
    }
  }

  /**
   * 구독 처리
   */
  async handleSubscribe(ws, message) {
    const { events = [] } = message;
    ws.subscriptions = new Set(events);

    this.sendToClient(ws, {
      type: 'subscription_confirmed',
      events,
      timestamp: Date.now()
    });
  }

  /**
   * 플레이어 검색 처리
   */
  async handlePlayerSearch(ws, message) {
    try {
      const { playerName } = message;
      const result = await this.sheetCache.searchPlayer(playerName);

      this.sendToClient(ws, {
        type: 'search_result',
        query: playerName,
        data: result,
        timestamp: Date.now()
      });
    } catch (error) {
      this.sendToClient(ws, {
        type: 'search_error',
        query: message.playerName,
        error: error.message
      });
    }
  }

  /**
   * 새로고침 요청 처리
   */
  async handleRefreshRequest(ws, message) {
    try {
      const result = await this.sheetCache.get('Type!A2:H', { forceRefresh: true });

      this.sendToClient(ws, {
        type: 'refresh_complete',
        data: result.data,
        source: result.source,
        timestamp: Date.now()
      });
    } catch (error) {
      this.sendToClient(ws, {
        type: 'refresh_error',
        error: error.message
      });
    }
  }

  /**
   * 단일 클라이언트에 메시지 전송
   */
  sendToClient(ws, message) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('클라이언트 전송 오류:', error.message);
        this.clients.delete(ws);
      }
    }
  }

  /**
   * 모든 클라이언트에 브로드캐스트
   */
  broadcast(message, filter = null) {
    const jsonMessage = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach(ws => {
      if (filter && !filter(ws)) return;

      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(jsonMessage);
          sentCount++;
        } catch (error) {
          console.error('브로드캐스트 오류:', error.message);
          this.clients.delete(ws);
        }
      } else {
        this.clients.delete(ws);
      }
    });

    return sentCount;
  }

  /**
   * 변경사항 폴링 시작
   */
  startPolling(intervalSeconds = 10) {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(async () => {
      await this.checkForChanges();
    }, intervalSeconds * 1000);

    console.log(`🕐 시트 변경사항 폴링 시작: ${intervalSeconds}초 간격`);
  }

  /**
   * 변경사항 감지 및 처리
   */
  async checkForChanges() {
    try {
      const currentResult = await this.sheetCache.get('Type!A2:H');
      const currentData = currentResult.data;

      if (this.lastData) {
        const changes = this.detectChanges(this.lastData, currentData);

        if (changes.hasChanges) {
          console.log(`📊 시트 변경 감지:`, {
            tables: changes.tableChanges,
            players: changes.playerChanges
          });

          // 변경사항 브로드캐스트
          const sentCount = this.broadcast({
            type: 'sheet_updated',
            data: currentData,
            changes,
            timestamp: new Date().toISOString()
          });

          console.log(`📡 ${sentCount}개 클라이언트에 업데이트 전송`);

          // 통계도 업데이트
          const stats = await this.sheetCache.getStats({ forceRefresh: true });
          this.broadcast({
            type: 'stats_updated',
            data: stats,
            timestamp: new Date().toISOString()
          });
        }
      }

      this.lastData = currentData;
    } catch (error) {
      console.error('변경사항 체크 오류:', error.message);
    }
  }

  /**
   * 변경사항 감지 알고리즘
   */
  detectChanges(oldData, newData) {
    const changes = {
      hasChanges: false,
      tableChanges: {
        added: [],
        removed: [],
        modified: []
      },
      playerChanges: {
        added: [],
        removed: [],
        moved: [],
        chipsChanged: []
      }
    };

    if (!oldData || !newData) {
      changes.hasChanges = true;
      return changes;
    }

    // 테이블 레벨 변경사항
    const oldTableKeys = new Set(oldData.map(t => `${t.pokerRoom}_${t.tableNo}`));
    const newTableKeys = new Set(newData.map(t => `${t.pokerRoom}_${t.tableNo}`));

    // 새 테이블
    newData.forEach(table => {
      const key = `${table.pokerRoom}_${table.tableNo}`;
      if (!oldTableKeys.has(key)) {
        changes.tableChanges.added.push(table);
        changes.hasChanges = true;
      }
    });

    // 제거된 테이블
    oldData.forEach(table => {
      const key = `${table.pokerRoom}_${table.tableNo}`;
      if (!newTableKeys.has(key)) {
        changes.tableChanges.removed.push(table);
        changes.hasChanges = true;
      }
    });

    // 플레이어 레벨 변경사항 감지
    this.detectPlayerChanges(oldData, newData, changes);

    return changes;
  }

  /**
   * 플레이어 변경사항 상세 감지
   */
  detectPlayerChanges(oldData, newData, changes) {
    const oldPlayers = new Map();
    const newPlayers = new Map();

    // 플레이어 맵 생성
    oldData.forEach(table => {
      table.players.forEach(player => {
        const key = `${table.pokerRoom}_${table.tableNo}_${player.seatNo}`;
        oldPlayers.set(key, { ...player, table: table.tableNo, room: table.pokerRoom });
      });
    });

    newData.forEach(table => {
      table.players.forEach(player => {
        const key = `${table.pokerRoom}_${table.tableNo}_${player.seatNo}`;
        newPlayers.set(key, { ...player, table: table.tableNo, room: table.pokerRoom });
      });
    });

    // 새 플레이어
    newPlayers.forEach((player, key) => {
      if (!oldPlayers.has(key)) {
        changes.playerChanges.added.push(player);
        changes.hasChanges = true;
      }
    });

    // 제거된 플레이어
    oldPlayers.forEach((player, key) => {
      if (!newPlayers.has(key)) {
        changes.playerChanges.removed.push(player);
        changes.hasChanges = true;
      }
    });

    // 칩 변경
    newPlayers.forEach((newPlayer, key) => {
      const oldPlayer = oldPlayers.get(key);
      if (oldPlayer && oldPlayer.currentChips !== newPlayer.currentChips) {
        changes.playerChanges.chipsChanged.push({
          player: newPlayer.name,
          oldChips: oldPlayer.currentChips,
          newChips: newPlayer.currentChips,
          difference: newPlayer.currentChips - oldPlayer.currentChips,
          table: newPlayer.table,
          room: newPlayer.room
        });
        changes.hasChanges = true;
      }
    });
  }

  /**
   * 연결된 클라이언트 상태
   */
  getClientStatus() {
    return {
      connectedClients: this.clients.size,
      pollingActive: !!this.pollInterval,
      lastDataUpdate: this.lastData ? new Date().toISOString() : null
    };
  }

  /**
   * 정리
   */
  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    if (this.wss) {
      this.wss.close();
    }

    this.clients.clear();
    console.log('🔌 Live Sheet Updates 서비스 종료');
  }
}

export default LiveSheetUpdates;