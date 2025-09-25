/**
 * Type 시트 구조 호환성 검증 테스트
 * 기존 Apps Script 코드와 완벽한 호환성 확인
 */

import SheetDataMapper from '../server/services/SheetDataMapper.js';

describe('Type 시트 구조 호환성 검증', () => {
  // 실제 Type 시트에서 나올 수 있는 데이터 샘플
  const realTypeSheetData = [
    ['Paradise City', '1/2 NLH', 'T01', 1, 'John Doe', 'USA', 2000, true],
    ['Paradise City', '1/2 NLH', 'T01', 2, 'Jane Smith', 'KOR', 1500, false],
    ['Paradise City', '1/2 NLH', 'T01', 3, '김민준', 'KOR', 1800, true],
    ['Grand Seoul', '2/4 NLH', 'T02', 1, 'Chen Wei', 'CHN', 3000, false],
    ['Grand Seoul', '2/4 NLH', 'T02', 4, 'Tanaka', 'JPN', 2500, true]
  ];

  test('Apps Script TYPE_COLUMNS와 완벽히 일치해야 함', () => {
    // Apps Script의 TYPE_COLUMNS 구조
    const appsScriptColumns = {
      POKER_ROOM: 0,   // A: Poker Room
      TABLE_NAME: 1,   // B: Table Name
      TABLE_NO: 2,     // C: Table No
      SEAT_NO: 3,      // D: Seat No
      PLAYERS: 4,      // E: Players
      NATIONALITY: 5,  // F: Nationality
      CHIPS: 6,        // G: Chips
      KEYPLAYER: 7     // H: Keyplayer
    };

    // v2의 TYPE_COLUMNS와 비교
    expect(SheetDataMapper.TYPE_COLUMNS).toEqual(appsScriptColumns);
  });

  test('실제 Type 시트 데이터를 v2 형식으로 변환', () => {
    const result = SheetDataMapper.fromTypeSheet(realTypeSheetData);

    // 2개 테이블로 그룹화되어야 함
    expect(result).toHaveLength(2);

    // Paradise City 테이블 검증
    const paradiseTable = result.find(t => t.pokerRoom === 'Paradise City');
    expect(paradiseTable.tableName).toBe('1/2 NLH');
    expect(paradiseTable.tableNo).toBe('T01');
    expect(paradiseTable.players).toHaveLength(3);

    // 플레이어 데이터 구조 검증
    const johnDoe = paradiseTable.players.find(p => p.name === 'John Doe');
    expect(johnDoe.seatNo).toBe(1);
    expect(johnDoe.nationality).toBe('USA');
    expect(johnDoe.currentChips).toBe(2000);
    expect(johnDoe.isKeyPlayer).toBe(true);

    // Grand Seoul 테이블 검증
    const grandTable = result.find(t => t.pokerRoom === 'Grand Seoul');
    expect(grandTable.players).toHaveLength(2);
  });

  test('v2 데이터를 Type 시트 형식으로 변환', () => {
    const v2HandData = {
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

    const result = SheetDataMapper.toTypeSheet(v2HandData);

    // 예상되는 Type 시트 형식
    const expected = [
      ['Paradise City', '1/2 NLH', 'T01', 1, 'John Doe', 'USA', 2000, true],
      ['Paradise City', '1/2 NLH', 'T01', 2, 'Jane Smith', 'KOR', 1500, false]
    ];

    expect(result).toEqual(expected);
  });

  test('Apps Script PlayerIndex와 호환되는 플레이어 인덱스 생성', () => {
    const playerIndex = SheetDataMapper.createPlayerIndex(realTypeSheetData);

    // John Doe는 1개 위치에만 있어야 함
    expect(playerIndex.get('John Doe')).toHaveLength(1);
    expect(playerIndex.get('John Doe')[0].pokerRoom).toBe('Paradise City');

    // 김민준 검색 (한글 지원)
    expect(playerIndex.has('김민준')).toBe(true);
    expect(playerIndex.get('김민준')[0].nationality).toBe('KOR');

    // Chen Wei 검색
    expect(playerIndex.get('Chen Wei')[0].chips).toBe(3000);
  });

  test('키플레이어 값 다양한 형식 처리', () => {
    const mixedKeyplayerData = [
      ['Room1', 'Table1', 'T01', 1, 'Player1', 'USA', 1000, true],      // boolean
      ['Room1', 'Table1', 'T01', 2, 'Player2', 'KOR', 1500, 'TRUE'],   // string
      ['Room1', 'Table1', 'T01', 3, 'Player3', 'JPN', 2000, 'true'],   // lowercase
      ['Room1', 'Table1', 'T01', 4, 'Player4', 'CHN', 2500, false],    // boolean false
      ['Room1', 'Table1', 'T01', 5, 'Player5', 'USA', 3000, '']        // empty string
    ];

    const result = SheetDataMapper.fromTypeSheet(mixedKeyplayerData);
    const players = result[0].players;

    expect(players[0].isKeyPlayer).toBe(true);   // true
    expect(players[1].isKeyPlayer).toBe(true);   // 'TRUE'
    expect(players[2].isKeyPlayer).toBe(true);   // 'true'
    expect(players[3].isKeyPlayer).toBe(false);  // false
    expect(players[4].isKeyPlayer).toBe(false);  // ''
  });

  test('실제 Apps Script 응답 형식과 호환성 확인', () => {
    // Apps Script에서 올 수 있는 응답 형식
    const appsScriptResponse = {
      success: true,
      data: realTypeSheetData,
      timestamp: '2025-09-25T12:00:00Z'
    };

    // v2로 변환
    const converted = SheetDataMapper.fromTypeSheet(appsScriptResponse.data);

    // 다시 Type 시트 형식으로 역변환
    const backConverted = converted.flatMap(table =>
      SheetDataMapper.toTypeSheet(table)
    );

    // 원본과 동일해야 함 (순서는 다를 수 있음)
    expect(backConverted).toHaveLength(realTypeSheetData.length);

    // 첫 번째 데이터 확인
    const firstRow = backConverted[0];
    expect(firstRow[0]).toBe('Paradise City'); // Poker Room
    expect(firstRow[1]).toBe('1/2 NLH');       // Table Name
    expect(firstRow[4]).toBe('John Doe');      // Players
  });

  test('빈 데이터 및 null 처리', () => {
    // Apps Script에서 빈 응답이 올 경우
    expect(SheetDataMapper.fromTypeSheet([])).toEqual([]);
    expect(SheetDataMapper.fromTypeSheet(null)).toEqual([]);
    expect(SheetDataMapper.fromTypeSheet(undefined)).toEqual([]);

    // 불완전한 행 데이터
    const incompleteData = [
      ['Paradise City', '1/2 NLH', 'T01', 1, 'John Doe', 'USA', 2000, true],
      ['Incomplete'], // 컬럼 부족
      null,           // null 행
      []              // 빈 행
    ];

    const result = SheetDataMapper.fromTypeSheet(incompleteData);
    expect(result).toHaveLength(1); // 유효한 데이터만 1개
  });

  test('대용량 데이터 배치 처리 호환성', () => {
    // 100명 플레이어 시뮬레이션
    const largePlayers = Array.from({length: 100}, (_, i) => ({
      seatNo: (i % 9) + 1,
      name: `Player${i + 1}`,
      nationality: ['USA', 'KOR', 'JPN', 'CHN'][i % 4],
      currentChips: Math.floor(Math.random() * 5000) + 1000,
      isKeyPlayer: Math.random() > 0.8
    }));

    // 여러 테이블로 분산
    const tables = [];
    for (let i = 0; i < largePlayers.length; i += 9) {
      tables.push({
        pokerRoom: `Room${Math.floor(i / 9) + 1}`,
        tableName: '1/2 NLH',
        tableNo: `T${String(Math.floor(i / 9) + 1).padStart(2, '0')}`,
        players: largePlayers.slice(i, i + 9)
      });
    }

    // 배치 업데이트 준비
    const batchData = SheetDataMapper.prepareBatchUpdate(tables);

    expect(batchData.totalRows).toBe(100);
    expect(batchData.ranges.length).toBe(tables.length);

    // 각 범위가 올바른 A1 표기법을 사용하는지 확인
    expect(batchData.ranges[0].range).toMatch(/^A\d+:H\d+$/);
  });
});