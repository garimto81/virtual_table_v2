/**
 * HandLogger - 포커 핸드 로깅 및 관리 모듈
 * 핸드 데이터의 생성, 추적, 저장을 담당하는 핵심 컴포넌트
 */

import { v4 as uuidv4 } from 'uuid';
import { ChipCalculator } from './ChipCalculator.js';

export class HandLogger {
  constructor(dataService, config = {}) {
    this.dataService = dataService;
    this.chipCalculator = new ChipCalculator(config.chipConfig);

    // 현재 활성 핸드
    this.currentHand = null;

    // 핸드 히스토리 캐시
    this.handHistory = [];
    this.maxHistorySize = config.maxHistorySize || 100;

    // 자동 저장 설정
    this.autoSave = config.autoSave !== false;
    this.autoSaveInterval = config.autoSaveInterval || 30000; // 30초

    // 오프라인 모드
    this.offlineMode = false;
    this.offlineQueue = [];

    // 이벤트 리스너
    this.listeners = new Map();

    // 자동 저장 타이머 시작
    if (this.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * 새 핸드 시작
   * @param {Object} params - 핸드 초기 정보
   * @returns {string} 생성된 핸드 ID
   */
  startNewHand(params = {}) {
    // 현재 핸드가 있으면 자동 저장
    if (this.currentHand && this.autoSave) {
      this.saveHand().catch(console.error);
    }

    const {
      dealerButton = 1,
      cameraPosition = 1,
      initialChips = 0,
      tableName = 'Table 1',
      playerCount = 9,
      blinds = { small: 1, big: 2 },
      ante = 0
    } = params;

    this.currentHand = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      dealerButton,
      cameraPosition,
      initialChips,
      tableName,
      playerCount,
      blinds,
      ante,
      actions: [],
      cards: {
        hole: [],
        flop: [],
        turn: null,
        river: null
      },
      pot: 0,
      rake: 0,
      result: null,
      finalChips: null,
      duration: null,
      status: 'active',
      notes: ''
    };

    // 이벤트 발생
    this.emit('handStarted', this.currentHand);

    return this.currentHand.id;
  }

  /**
   * 액션 추가
   * @param {Object} action - 액션 정보
   */
  addAction(action) {
    if (!this.currentHand) {
      throw new Error('No active hand. Start a new hand first.');
    }

    if (this.currentHand.status !== 'active') {
      throw new Error('Cannot add action to completed hand.');
    }

    const actionData = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      street: this.getCurrentStreet(),
      position: action.position || this.currentHand.cameraPosition,
      type: action.type, // FOLD, CHECK, CALL, BET, RAISE, ALL_IN
      amount: action.amount || 0,
      potBefore: this.currentHand.pot,
      description: action.description || ''
    };

    // 액션 타입에 따른 팟 업데이트
    if (['CALL', 'BET', 'RAISE', 'ALL_IN'].includes(action.type)) {
      this.currentHand.pot += actionData.amount;
      actionData.potAfter = this.currentHand.pot;
    }

    this.currentHand.actions.push(actionData);

    // 이벤트 발생
    this.emit('actionAdded', actionData);

    return actionData.id;
  }

  /**
   * 카드 추가
   * @param {Object} cards - 카드 정보
   */
  addCards(cards) {
    if (!this.currentHand) {
      throw new Error('No active hand');
    }

    const { hole, flop, turn, river } = cards;

    if (hole && hole.length === 2) {
      this.currentHand.cards.hole = hole;
    }

    if (flop && flop.length === 3) {
      this.currentHand.cards.flop = flop;
      this.emit('streetChanged', 'flop');
    }

    if (turn) {
      this.currentHand.cards.turn = turn;
      this.emit('streetChanged', 'turn');
    }

    if (river) {
      this.currentHand.cards.river = river;
      this.emit('streetChanged', 'river');
    }
  }

  /**
   * 현재 스트리트 확인
   * @returns {string} 현재 스트리트
   */
  getCurrentStreet() {
    if (!this.currentHand) return 'preflop';

    const { flop, turn, river } = this.currentHand.cards;

    if (river) return 'river';
    if (turn) return 'turn';
    if (flop && flop.length === 3) return 'flop';
    return 'preflop';
  }

  /**
   * 핸드 완료
   * @param {Object} result - 결과 정보
   */
  completeHand(result = {}) {
    if (!this.currentHand) {
      throw new Error('No active hand to complete');
    }

    const endTime = new Date();
    const startTime = new Date(this.currentHand.timestamp);
    const duration = Math.floor((endTime - startTime) / 1000);

    this.currentHand.status = 'completed';
    this.currentHand.completedAt = endTime.toISOString();
    this.currentHand.duration = duration;
    this.currentHand.result = result.result || 'unknown'; // win, loss, split, no_showdown
    this.currentHand.finalChips = result.finalChips || this.currentHand.initialChips;
    this.currentHand.profit = this.currentHand.finalChips - this.currentHand.initialChips;
    this.currentHand.rake = result.rake || 0;
    this.currentHand.notes = result.notes || '';

    // 핸드 히스토리에 추가
    this.addToHistory(this.currentHand);

    // 이벤트 발생
    this.emit('handCompleted', this.currentHand);

    // 자동 저장
    if (this.autoSave) {
      this.saveHand().catch(console.error);
    }

    return this.currentHand;
  }

  /**
   * 핸드 저장
   * @returns {Promise} 저장 결과
   */
  async saveHand() {
    if (!this.currentHand) {
      throw new Error('No hand to save');
    }

    try {
      // 온라인 저장 시도
      if (!this.offlineMode && this.dataService) {
        const result = await this.dataService.saveHand(this.currentHand);
        this.emit('handSaved', result);
        return result;
      }
    } catch (error) {
      console.error('Failed to save hand online:', error);
      // 오프라인 모드로 전환
      this.offlineMode = true;
    }

    // 오프라인 저장
    this.saveOffline(this.currentHand);
    return { offline: true, id: this.currentHand.id };
  }

  /**
   * 오프라인 저장
   * @param {Object} hand - 저장할 핸드
   */
  saveOffline(hand) {
    this.offlineQueue.push(hand);

    // 로컬 스토리지에 저장
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = JSON.parse(localStorage.getItem('offlineHands') || '[]');
      existing.push(hand);
      localStorage.setItem('offlineHands', JSON.stringify(existing));
    }

    this.emit('handSavedOffline', hand);
  }

  /**
   * 오프라인 데이터 동기화
   */
  async syncOfflineData() {
    if (this.offlineQueue.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const hand of this.offlineQueue) {
      try {
        await this.dataService.saveHand(hand);
        synced++;
      } catch (error) {
        console.error(`Failed to sync hand ${hand.id}:`, error);
        failed++;
      }
    }

    // 성공적으로 동기화된 항목 제거
    if (synced > 0) {
      this.offlineQueue = this.offlineQueue.slice(synced);

      // 로컬 스토리지 업데이트
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('offlineHands', JSON.stringify(this.offlineQueue));
      }
    }

    // 모두 동기화되면 온라인 모드로 전환
    if (this.offlineQueue.length === 0) {
      this.offlineMode = false;
    }

    this.emit('syncCompleted', { synced, failed });
    return { synced, failed };
  }

  /**
   * 핸드 히스토리에 추가
   * @param {Object} hand - 추가할 핸드
   */
  addToHistory(hand) {
    this.handHistory.unshift(hand);

    // 최대 크기 유지
    if (this.handHistory.length > this.maxHistorySize) {
      this.handHistory = this.handHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * 핸드 히스토리 조회
   * @param {Object} filters - 필터 옵션
   * @returns {Array} 필터된 핸드 목록
   */
  getHistory(filters = {}) {
    let history = [...this.handHistory];

    // 날짜 필터
    if (filters.startDate) {
      history = history.filter(h =>
        new Date(h.timestamp) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      history = history.filter(h =>
        new Date(h.timestamp) <= new Date(filters.endDate)
      );
    }

    // 결과 필터
    if (filters.result) {
      history = history.filter(h => h.result === filters.result);
    }

    // 테이블 필터
    if (filters.tableName) {
      history = history.filter(h => h.tableName === filters.tableName);
    }

    // 정렬
    if (filters.sortBy === 'profit') {
      history.sort((a, b) => (b.profit || 0) - (a.profit || 0));
    } else if (filters.sortBy === 'duration') {
      history.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }

    // 제한
    if (filters.limit) {
      history = history.slice(0, filters.limit);
    }

    return history;
  }

  /**
   * 통계 계산
   * @returns {Object} 통계 정보
   */
  getStatistics() {
    const completedHands = this.handHistory.filter(h => h.status === 'completed');

    if (completedHands.length === 0) {
      return {
        totalHands: 0,
        winRate: 0,
        averageProfit: 0,
        totalProfit: 0,
        averageDuration: 0,
        vpip: 0, // Voluntarily Put money In Pot
        pfr: 0   // Pre-Flop Raise
      };
    }

    const wins = completedHands.filter(h => h.result === 'win').length;
    const totalProfit = completedHands.reduce((sum, h) => sum + (h.profit || 0), 0);
    const totalDuration = completedHands.reduce((sum, h) => sum + (h.duration || 0), 0);

    // VPIP 계산
    const handsWithVoluntaryAction = completedHands.filter(h => {
      const preflopActions = h.actions.filter(a => a.street === 'preflop');
      return preflopActions.some(a => ['CALL', 'BET', 'RAISE'].includes(a.type));
    }).length;

    // PFR 계산
    const handsWithPreflopRaise = completedHands.filter(h => {
      const preflopActions = h.actions.filter(a => a.street === 'preflop');
      return preflopActions.some(a => ['BET', 'RAISE'].includes(a.type));
    }).length;

    return {
      totalHands: completedHands.length,
      winRate: ((wins / completedHands.length) * 100).toFixed(2),
      averageProfit: Math.round(totalProfit / completedHands.length),
      totalProfit,
      averageDuration: Math.round(totalDuration / completedHands.length),
      vpip: ((handsWithVoluntaryAction / completedHands.length) * 100).toFixed(2),
      pfr: ((handsWithPreflopRaise / completedHands.length) * 100).toFixed(2),
      biggestWin: Math.max(...completedHands.map(h => h.profit || 0)),
      biggestLoss: Math.min(...completedHands.map(h => h.profit || 0))
    };
  }

  /**
   * 자동 저장 시작
   */
  startAutoSave() {
    this.autoSaveTimer = setInterval(() => {
      if (this.currentHand && this.currentHand.status === 'active') {
        // 5분 이상 활동이 없으면 자동 완료
        const lastAction = this.currentHand.actions[this.currentHand.actions.length - 1];
        const lastActivityTime = lastAction ?
          new Date(lastAction.timestamp) :
          new Date(this.currentHand.timestamp);

        const inactiveTime = Date.now() - lastActivityTime.getTime();
        if (inactiveTime > 300000) { // 5분
          this.completeHand({ result: 'timeout' });
        }
      }

      // 오프라인 데이터 동기화 시도
      if (this.offlineQueue.length > 0) {
        this.syncOfflineData().catch(console.error);
      }
    }, this.autoSaveInterval);
  }

  /**
   * 자동 저장 중지
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * 이벤트 리스너 등록
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 이벤트 리스너 제거
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 이벤트 발생
   * @param {string} event - 이벤트 이름
   * @param {any} data - 이벤트 데이터
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * 정리
   */
  destroy() {
    this.stopAutoSave();
    this.listeners.clear();
    this.currentHand = null;
    this.handHistory = [];
    this.offlineQueue = [];
  }
}

export default HandLogger;