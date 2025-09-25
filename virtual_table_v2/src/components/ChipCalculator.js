/**
 * ChipCalculator - 칩 계산 및 최적화 모듈
 * 포커 칩 관련 모든 계산을 담당하는 재사용 가능한 컴포넌트
 */

export class ChipCalculator {
  constructor(config = {}) {
    // 기본 칩 단위 설정
    this.denominations = config.denominations || [1, 5, 25, 100, 500, 1000, 5000, 25000];
    this.currency = config.currency || 'chips';
    this.precision = config.precision || 0;
  }

  /**
   * 칩 총합 계산
   * @param {Object} chips - 칩 개수 객체 {denomination: count}
   * @returns {number} 총 칩 가치
   */
  calculateTotal(chips) {
    if (!chips || typeof chips !== 'object') {
      return 0;
    }

    return Object.entries(chips).reduce((total, [denomination, count]) => {
      const denomValue = parseInt(denomination, 10);
      const chipCount = parseInt(count, 10) || 0;

      if (isNaN(denomValue) || isNaN(chipCount)) {
        console.warn(`Invalid chip entry: ${denomination}:${count}`);
        return total;
      }

      return total + (denomValue * chipCount);
    }, 0);
  }

  /**
   * 금액을 최적의 칩 조합으로 변환
   * @param {number} amount - 변환할 금액
   * @returns {Object} 최적화된 칩 조합
   */
  optimizeChips(amount) {
    if (amount <= 0) {
      return {};
    }

    const result = {};
    let remaining = Math.round(amount);

    // 큰 단위부터 작은 단위로 변환
    for (let i = this.denominations.length - 1; i >= 0; i--) {
      const denom = this.denominations[i];
      if (remaining >= denom) {
        const count = Math.floor(remaining / denom);
        result[denom] = count;
        remaining = remaining % denom;
      }
    }

    // 반올림 오차 처리
    if (remaining > 0 && remaining < this.denominations[0]) {
      const smallestDenom = this.denominations[0];
      if (result[smallestDenom]) {
        result[smallestDenom]++;
      } else {
        result[smallestDenom] = 1;
      }
    }

    return result;
  }

  /**
   * 두 칩 세트를 합산
   * @param {Object} chips1 - 첫 번째 칩 세트
   * @param {Object} chips2 - 두 번째 칩 세트
   * @returns {Object} 합산된 칩 세트
   */
  addChips(chips1, chips2) {
    const result = { ...chips1 };

    Object.entries(chips2).forEach(([denom, count]) => {
      const denomValue = parseInt(denom, 10);
      if (result[denomValue]) {
        result[denomValue] += count;
      } else {
        result[denomValue] = count;
      }
    });

    return result;
  }

  /**
   * 칩 세트에서 다른 칩 세트를 차감
   * @param {Object} chips1 - 기준 칩 세트
   * @param {Object} chips2 - 차감할 칩 세트
   * @returns {Object} 차감된 칩 세트
   */
  subtractChips(chips1, chips2) {
    const result = { ...chips1 };

    Object.entries(chips2).forEach(([denom, count]) => {
      const denomValue = parseInt(denom, 10);
      if (result[denomValue]) {
        result[denomValue] -= count;
        if (result[denomValue] <= 0) {
          delete result[denomValue];
        }
      }
    });

    return result;
  }

  /**
   * 칩을 읽기 쉬운 형식으로 포맷팅
   * @param {Object} chips - 칩 세트
   * @returns {string} 포맷된 문자열
   */
  formatChips(chips) {
    if (!chips || Object.keys(chips).length === 0) {
      return '0 chips';
    }

    const sorted = Object.entries(chips)
      .filter(([_, count]) => count > 0)
      .sort(([a], [b]) => parseInt(b, 10) - parseInt(a, 10));

    const formatted = sorted.map(([denom, count]) => {
      return `${count}×${this.formatDenomination(parseInt(denom, 10))}`;
    }).join(' + ');

    const total = this.calculateTotal(chips);
    return `${formatted} = ${this.formatAmount(total)}`;
  }

  /**
   * 칩 단위를 포맷팅
   * @param {number} denomination - 칩 단위
   * @returns {string} 포맷된 단위
   */
  formatDenomination(denomination) {
    if (denomination >= 1000000) {
      return `${denomination / 1000000}M`;
    } else if (denomination >= 1000) {
      return `${denomination / 1000}K`;
    }
    return denomination.toString();
  }

  /**
   * 금액을 포맷팅
   * @param {number} amount - 금액
   * @returns {string} 포맷된 금액
   */
  formatAmount(amount) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: this.precision,
      maximumFractionDigits: this.precision
    }).format(amount);
  }

  /**
   * 칩 교환 시뮬레이션
   * @param {Object} chips - 현재 칩
   * @param {number} targetDenom - 목표 단위
   * @returns {Object} 교환 결과
   */
  exchangeChips(chips, targetDenom) {
    const total = this.calculateTotal(chips);
    const targetCount = Math.floor(total / targetDenom);
    const remainder = total % targetDenom;

    const result = {
      [targetDenom]: targetCount
    };

    if (remainder > 0) {
      const remainderChips = this.optimizeChips(remainder);
      Object.assign(result, remainderChips);
    }

    return result;
  }

  /**
   * 팟 사이즈 계산
   * @param {Array} bets - 베팅 배열
   * @returns {number} 총 팟 사이즈
   */
  calculatePot(bets) {
    return bets.reduce((pot, bet) => {
      if (typeof bet === 'number') {
        return pot + bet;
      } else if (typeof bet === 'object' && bet.amount) {
        return pot + bet.amount;
      }
      return pot;
    }, 0);
  }

  /**
   * 사이드 팟 계산
   * @param {Array} players - 플레이어 배열 [{chips, bet, active}]
   * @returns {Array} 사이드 팟 배열
   */
  calculateSidePots(players) {
    const activePlayers = players.filter(p => p.active);
    const pots = [];

    while (activePlayers.length > 0) {
      // 최소 베팅 찾기
      const minBet = Math.min(...activePlayers.map(p => p.bet));

      if (minBet > 0) {
        const potSize = minBet * activePlayers.length;
        const eligiblePlayers = activePlayers.map(p => p.id);

        pots.push({
          amount: potSize,
          eligiblePlayers
        });

        // 베팅 차감
        activePlayers.forEach(p => {
          p.bet -= minBet;
        });
      }

      // 올인한 플레이어 제거
      const remainingPlayers = activePlayers.filter(p => p.bet > 0);
      activePlayers.length = 0;
      activePlayers.push(...remainingPlayers);
    }

    return pots;
  }

  /**
   * 칩 통계 계산
   * @param {Array} history - 칩 히스토리
   * @returns {Object} 통계 정보
   */
  calculateStats(history) {
    if (!history || history.length === 0) {
      return {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        profit: 0
      };
    }

    const amounts = history.map(h => h.amount || 0);
    const total = amounts.reduce((sum, a) => sum + a, 0);
    const average = total / amounts.length;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);

    const initial = history[0]?.amount || 0;
    const final = history[history.length - 1]?.amount || 0;
    const profit = final - initial;

    return {
      total,
      average: Math.round(average),
      min,
      max,
      profit,
      profitRate: initial > 0 ? ((profit / initial) * 100).toFixed(2) + '%' : '0%'
    };
  }
}

// 싱글톤 인스턴스
export const defaultCalculator = new ChipCalculator();

export default ChipCalculator;