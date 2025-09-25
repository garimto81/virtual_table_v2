/**
 * ChipCalculator 테스트
 */

import { ChipCalculator } from '../src/components/ChipCalculator.js';

describe('ChipCalculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new ChipCalculator();
  });

  describe('calculateTotal', () => {
    test('칩 총합을 올바르게 계산해야 함', () => {
      const chips = {
        100: 5,
        500: 2,
        1000: 1
      };
      expect(calculator.calculateTotal(chips)).toBe(2500);
    });

    test('빈 객체는 0을 반환해야 함', () => {
      expect(calculator.calculateTotal({})).toBe(0);
    });

    test('null/undefined는 0을 반환해야 함', () => {
      expect(calculator.calculateTotal(null)).toBe(0);
      expect(calculator.calculateTotal(undefined)).toBe(0);
    });

    test('잘못된 입력값을 처리해야 함', () => {
      const chips = {
        100: 'invalid',
        500: 2
      };
      expect(calculator.calculateTotal(chips)).toBe(1000);
    });
  });

  describe('optimizeChips', () => {
    test('금액을 최적의 칩 조합으로 변환해야 함', () => {
      const result = calculator.optimizeChips(2750);
      expect(result).toEqual({
        1000: 2,
        500: 1,
        100: 2,
        25: 2
      });
    });

    test('정확한 단위로 떨어지는 금액을 처리해야 함', () => {
      const result = calculator.optimizeChips(5000);
      expect(result).toEqual({ 5000: 1 });
    });

    test('0 이하의 금액은 빈 객체를 반환해야 함', () => {
      expect(calculator.optimizeChips(0)).toEqual({});
      expect(calculator.optimizeChips(-100)).toEqual({});
    });

    test('최소 단위보다 작은 금액을 처리해야 함', () => {
      const result = calculator.optimizeChips(3);
      expect(result).toEqual({ 1: 3 });
    });
  });

  describe('addChips', () => {
    test('두 칩 세트를 올바르게 합산해야 함', () => {
      const chips1 = { 100: 5, 500: 2 };
      const chips2 = { 100: 3, 1000: 1 };
      const result = calculator.addChips(chips1, chips2);

      expect(result).toEqual({
        100: 8,
        500: 2,
        1000: 1
      });
    });

    test('빈 칩 세트를 처리해야 함', () => {
      const chips1 = { 100: 5 };
      const chips2 = {};
      const result = calculator.addChips(chips1, chips2);

      expect(result).toEqual({ 100: 5 });
    });
  });

  describe('subtractChips', () => {
    test('칩 세트에서 다른 칩 세트를 차감해야 함', () => {
      const chips1 = { 100: 10, 500: 5, 1000: 2 };
      const chips2 = { 100: 3, 500: 2 };
      const result = calculator.subtractChips(chips1, chips2);

      expect(result).toEqual({
        100: 7,
        500: 3,
        1000: 2
      });
    });

    test('0 이하가 된 칩은 제거해야 함', () => {
      const chips1 = { 100: 5, 500: 2 };
      const chips2 = { 100: 5, 500: 3 };
      const result = calculator.subtractChips(chips1, chips2);

      expect(result).toEqual({});
    });
  });

  describe('formatChips', () => {
    test('칩을 읽기 쉬운 형식으로 포맷팅해야 함', () => {
      const chips = { 1000: 2, 500: 1, 100: 3 };
      const formatted = calculator.formatChips(chips);

      expect(formatted).toContain('2×1K');
      expect(formatted).toContain('1×500');
      expect(formatted).toContain('3×100');
      expect(formatted).toContain('= 2,800');
    });

    test('빈 칩 세트는 "0 chips"를 반환해야 함', () => {
      expect(calculator.formatChips({})).toBe('0 chips');
      expect(calculator.formatChips(null)).toBe('0 chips');
    });
  });

  describe('formatDenomination', () => {
    test('큰 단위를 축약형으로 표시해야 함', () => {
      expect(calculator.formatDenomination(1000)).toBe('1K');
      expect(calculator.formatDenomination(5000)).toBe('5K');
      expect(calculator.formatDenomination(1000000)).toBe('1M');
    });

    test('작은 단위는 그대로 표시해야 함', () => {
      expect(calculator.formatDenomination(1)).toBe('1');
      expect(calculator.formatDenomination(100)).toBe('100');
      expect(calculator.formatDenomination(500)).toBe('500');
    });
  });

  describe('calculatePot', () => {
    test('베팅 배열의 총합을 계산해야 함', () => {
      const bets = [100, 200, 150, 300];
      expect(calculator.calculatePot(bets)).toBe(750);
    });

    test('객체 형태의 베팅을 처리해야 함', () => {
      const bets = [
        { amount: 100 },
        { amount: 200 },
        150,
        { amount: 300 }
      ];
      expect(calculator.calculatePot(bets)).toBe(750);
    });

    test('빈 배열은 0을 반환해야 함', () => {
      expect(calculator.calculatePot([])).toBe(0);
    });
  });

  describe('calculateSidePots', () => {
    test('사이드 팟을 올바르게 계산해야 함', () => {
      const players = [
        { id: 1, bet: 100, active: true },
        { id: 2, bet: 200, active: true },
        { id: 3, bet: 50, active: true }
      ];

      const pots = calculator.calculateSidePots(players);

      expect(pots).toHaveLength(2);
      expect(pots[0].amount).toBe(150); // 50 * 3
      expect(pots[0].eligiblePlayers).toEqual([1, 2, 3]);
      expect(pots[1].amount).toBe(100); // 50 * 2
      expect(pots[1].eligiblePlayers).toEqual([1, 2]);
    });

    test('단일 팟만 있는 경우를 처리해야 함', () => {
      const players = [
        { id: 1, bet: 100, active: true },
        { id: 2, bet: 100, active: true },
        { id: 3, bet: 100, active: true }
      ];

      const pots = calculator.calculateSidePots(players);

      expect(pots).toHaveLength(1);
      expect(pots[0].amount).toBe(300);
      expect(pots[0].eligiblePlayers).toEqual([1, 2, 3]);
    });

    test('비활성 플레이어를 제외해야 함', () => {
      const players = [
        { id: 1, bet: 100, active: true },
        { id: 2, bet: 200, active: false },
        { id: 3, bet: 150, active: true }
      ];

      const pots = calculator.calculateSidePots(players);

      expect(pots[0].eligiblePlayers).not.toContain(2);
    });
  });
});