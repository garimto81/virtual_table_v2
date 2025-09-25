/**
 * SheetDataMapper 테스트
 */

import SheetDataMapper from '../server/services/SheetDataMapper.js';

describe('SheetDataMapper', () => {
  describe('toTypeSheet', () => {
    test('v2 핸드 데이터를 Type 시트 형식으로 변환해야 함', () => {
      const handData = {
        pokerRoom: 'Paradise City',
        tableName: '1/2 NLH',
        tableNo: 'T01',
        players: [
          {
            seatNo: 1,
            name: 'John Doe',
            nationality: 'USA',
            currentChips: 2000,
            isKeyPlayer: true
          },
          {
            seatNo: 2,
            name: 'Jane Smith',
            nationality: 'KOR',
            currentChips: 1500,
            isKeyPlayer: false
          }
        ]
      };

      const result = SheetDataMapper.toTypeSheet(handData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([
        'Paradise City',
        '1/2 NLH',
        'T01',
        1,
        'John Doe',
        'USA',
        2000,
        true
      ]);
      expect(result[1]).toEqual([
        'Paradise City',
        '1/2 NLH',
        'T01',
        2,
        'Jane Smith',
        'KOR',
        1500,
        false
      ]);
    });

    test('빈 플레이어 배열은 빈 결과를 반환해야 함', () => {
      const handData = {
        pokerRoom: 'Test Room',
        tableName: 'Test Table',
        tableNo: 'T99',
        players: []
      };

      const result = SheetDataMapper.toTypeSheet(handData);
      expect(result).toEqual([]);
    });

    test('null/undefined 데이터를 처리해야 함', () => {
      expect(SheetDataMapper.toTypeSheet(null)).toEqual([]);
      expect(SheetDataMapper.toTypeSheet(undefined)).toEqual([]);
      expect(SheetDataMapper.toTypeSheet({})).toEqual([]);
    });
  });

  describe('fromTypeSheet', () => {
    test('Type 시트 데이터를 v2 형식으로 변환해야 함', () => {
      const sheetData = [
        ['Paradise City', '1/2 NLH', 'T01', 1, 'John Doe', 'USA', 2000, true],
        ['Paradise City', '1/2 NLH', 'T01', 2, 'Jane Smith', 'KOR', 1500, false],
        ['Grand Seoul', '2/4 NLH', 'T02', 1, 'Kim Min-jun', 'KOR', 3000, true]
      ];

      const result = SheetDataMapper.fromTypeSheet(sheetData);

      expect(result).toHaveLength(2); // 2개 테이블
      expect(result[0].pokerRoom).toBe('Paradise City');
      expect(result[0].tableName).toBe('1/2 NLH');
      expect(result[0].tableNo).toBe('T01');
      expect(result[0].players).toHaveLength(2);

      expect(result[1].pokerRoom).toBe('Grand Seoul');
      expect(result[1].players).toHaveLength(1);
    });

    test('빈 배열이나 잘못된 데이터를 처리해야 함', () => {
      expect(SheetDataMapper.fromTypeSheet([])).toEqual([]);
      expect(SheetDataMapper.fromTypeSheet(null)).toEqual([]);
      expect(SheetDataMapper.fromTypeSheet(undefined)).toEqual([]);
    });

    test('불완전한 행 데이터를 건너뛰어야 함', () => {
      const sheetData = [
        ['Paradise City', '1/2 NLH', 'T01', 1, 'John Doe', 'USA', 2000, true],
        ['Incomplete'], // 불완전한 데이터
        ['Grand Seoul', '2/4 NLH', 'T02', 1, 'Kim Min-jun', 'KOR', 3000, true]
      ];

      const result = SheetDataMapper.fromTypeSheet(sheetData);
      expect(result).toHaveLength(2);
    });
  });

  describe('validateHandData', () => {
    test('유효한 핸드 데이터를 승인해야 함', () => {
      const handData = {
        pokerRoom: 'Paradise City',
        tableName: '1/2 NLH',
        tableNo: 'T01',
        players: [
          {
            seatNo: 1,
            name: 'John Doe',
            nationality: 'USA',
            currentChips: 2000,
            isKeyPlayer: true
          }
        ]
      };

      const validation = SheetDataMapper.validateHandData(handData);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('필수 필드 누락 시 에러를 반환해야 함', () => {
      const handData = {
        // pokerRoom 누락
        tableName: '1/2 NLH',
        players: [
          {
            seatNo: 1,
            name: 'John Doe',
            currentChips: 2000
          }
        ]
      };

      const validation = SheetDataMapper.validateHandData(handData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('포커룸이 지정되지 않았습니다.');
    });

    test('잘못된 좌석 번호를 검증해야 함', () => {
      const handData = {
        pokerRoom: 'Paradise City',
        tableName: '1/2 NLH',
        players: [
          {
            seatNo: 10, // 1-9 범위 초과
            name: 'John Doe',
            currentChips: 2000
          }
        ]
      };

      const validation = SheetDataMapper.validateHandData(handData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('좌석 번호는 1-9 사이여야 합니다. (현재: 10)');
    });

    test('음수 칩을 검증해야 함', () => {
      const handData = {
        pokerRoom: 'Paradise City',
        tableName: '1/2 NLH',
        players: [
          {
            seatNo: 1,
            name: 'John Doe',
            currentChips: -100 // 음수 칩
          }
        ]
      };

      const validation = SheetDataMapper.validateHandData(handData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('칩 수량은 0 이상이어야 합니다. (플레이어: John Doe)');
    });
  });

  describe('createPlayerIndex', () => {
    test('플레이어 인덱스를 올바르게 생성해야 함', () => {
      const sheetData = [
        ['Paradise City', '1/2 NLH', 'T01', 1, 'John Doe', 'USA', 2000, true],
        ['Paradise City', '1/2 NLH', 'T01', 2, 'John Doe', 'USA', 1800, false], // 같은 플레이어
        ['Grand Seoul', '2/4 NLH', 'T02', 1, 'Jane Smith', 'KOR', 3000, true]
      ];

      const playerIndex = SheetDataMapper.createPlayerIndex(sheetData);

      expect(playerIndex.has('John Doe')).toBe(true);
      expect(playerIndex.has('Jane Smith')).toBe(true);
      expect(playerIndex.get('John Doe')).toHaveLength(2); // 2개 엔트리
      expect(playerIndex.get('Jane Smith')).toHaveLength(1);
    });

    test('빈 플레이어명을 건너뛰어야 함', () => {
      const sheetData = [
        ['Paradise City', '1/2 NLH', 'T01', 1, '', 'USA', 2000, true], // 빈 이름
        ['Paradise City', '1/2 NLH', 'T01', 2, 'Jane Smith', 'KOR', 1500, false]
      ];

      const playerIndex = SheetDataMapper.createPlayerIndex(sheetData);
      expect(playerIndex.has('')).toBe(false);
      expect(playerIndex.has('Jane Smith')).toBe(true);
    });
  });

  describe('detectChanges', () => {
    test('플레이어 추가를 감지해야 함', () => {
      const oldData = {
        players: [
          { seatNo: 1, name: 'John Doe', currentChips: 2000 }
        ]
      };

      const newData = {
        players: [
          { seatNo: 1, name: 'John Doe', currentChips: 2000 },
          { seatNo: 2, name: 'Jane Smith', currentChips: 1500 } // 새 플레이어
        ]
      };

      const changes = SheetDataMapper.detectChanges(oldData, newData);
      expect(changes.added).toHaveLength(1);
      expect(changes.added[0].name).toBe('Jane Smith');
    });

    test('칩 수량 변경을 감지해야 함', () => {
      const oldData = {
        players: [
          { seatNo: 1, name: 'John Doe', currentChips: 2000, nationality: 'USA', isKeyPlayer: false }
        ]
      };

      const newData = {
        players: [
          { seatNo: 1, name: 'John Doe', currentChips: 2500, nationality: 'USA', isKeyPlayer: false } // 칩 증가
        ]
      };

      const changes = SheetDataMapper.detectChanges(oldData, newData);
      expect(changes.modified).toHaveLength(1);
      expect(changes.modified[0].name).toBe('John Doe');
    });

    test('플레이어 제거를 감지해야 함', () => {
      const oldData = {
        players: [
          { seatNo: 1, name: 'John Doe', currentChips: 2000 },
          { seatNo: 2, name: 'Jane Smith', currentChips: 1500 }
        ]
      };

      const newData = {
        players: [
          { seatNo: 1, name: 'John Doe', currentChips: 2000 }
        ]
      };

      const changes = SheetDataMapper.detectChanges(oldData, newData);
      expect(changes.removed).toHaveLength(1);
      expect(changes.removed[0].name).toBe('Jane Smith');
    });
  });

  describe('prepareBatchUpdate', () => {
    test('배치 업데이트 데이터를 올바르게 준비해야 함', () => {
      const handDataArray = [
        {
          pokerRoom: 'Paradise City',
          tableName: '1/2 NLH',
          tableNo: 'T01',
          players: [
            { seatNo: 1, name: 'John Doe', nationality: 'USA', currentChips: 2000, isKeyPlayer: true }
          ]
        },
        {
          pokerRoom: 'Grand Seoul',
          tableName: '2/4 NLH',
          tableNo: 'T02',
          players: [
            { seatNo: 1, name: 'Jane Smith', nationality: 'KOR', currentChips: 3000, isKeyPlayer: false }
          ]
        }
      ];

      const batchData = SheetDataMapper.prepareBatchUpdate(handDataArray);

      expect(batchData.values).toHaveLength(2);
      expect(batchData.ranges).toHaveLength(2);
      expect(batchData.totalRows).toBe(2);
      expect(batchData.ranges[0].range).toBe('A2:H2');
      expect(batchData.ranges[1].range).toBe('A11:H11');
    });
  });
});