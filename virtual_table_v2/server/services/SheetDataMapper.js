/**
 * Google Sheets 데이터 매핑 서비스
 * Type 시트 (8개 컬럼) 구조와 v2 시스템 간 데이터 변환
 */

class SheetDataMapper {
  /**
   * Type 시트 컬럼 정의
   */
  static TYPE_COLUMNS = {
    POKER_ROOM: 0,     // A: 포커룸 이름
    TABLE_NAME: 1,     // B: 테이블명
    TABLE_NO: 2,       // C: 테이블 번호
    SEAT_NO: 3,        // D: 좌석 번호
    PLAYERS: 4,        // E: 플레이어 이름
    NATIONALITY: 5,    // F: 국적
    CHIPS: 6,          // G: 칩 수량
    KEYPLAYER: 7       // H: 주요 플레이어
  };

  /**
   * v2 핸드 데이터를 Type 시트 형식으로 변환
   * @param {Object} handData - v2 시스템의 핸드 데이터
   * @returns {Array} Google Sheets 행 배열
   */
  static toTypeSheet(handData) {
    const rows = [];

    if (!handData || !handData.players) {
      return rows;
    }

    handData.players.forEach(player => {
      const row = new Array(8);
      row[this.TYPE_COLUMNS.POKER_ROOM] = handData.pokerRoom || '';
      row[this.TYPE_COLUMNS.TABLE_NAME] = handData.tableName || '';
      row[this.TYPE_COLUMNS.TABLE_NO] = handData.tableNo || '';
      row[this.TYPE_COLUMNS.SEAT_NO] = player.seatNo || '';
      row[this.TYPE_COLUMNS.PLAYERS] = player.name || '';
      row[this.TYPE_COLUMNS.NATIONALITY] = player.nationality || '';
      row[this.TYPE_COLUMNS.CHIPS] = player.currentChips || 0;
      row[this.TYPE_COLUMNS.KEYPLAYER] = player.isKeyPlayer || false;

      rows.push(row);
    });

    return rows;
  }

  /**
   * Type 시트 데이터를 v2 형식으로 변환
   * @param {Array} sheetData - Google Sheets 데이터
   * @returns {Array} v2 테이블 객체 배열
   */
  static fromTypeSheet(sheetData) {
    console.log('🔄 SheetDataMapper.fromTypeSheet 시작');
    console.log('📊 입력 sheetData:', {
      type: typeof sheetData,
      isArray: Array.isArray(sheetData),
      length: Array.isArray(sheetData) ? sheetData.length : 'Not Array',
      data: sheetData
    });

    const tableMap = new Map();

    if (!Array.isArray(sheetData)) {
      console.log('❌ sheetData가 배열이 아님:', typeof sheetData);
      return [];
    }

    if (sheetData.length === 0) {
      console.log('⚠️ sheetData가 빈 배열입니다');
      return [];
    }

    console.log(`🔄 ${sheetData.length}개 행 처리 시작...`);

    sheetData.forEach((row, index) => {
      console.log(`📝 행 ${index + 1}:`, row);

      // 헤더 행 체크 및 스킵 (강화된 로직)
      if (row[0] === 'Poker Room' && row[1] === 'Table Name') {
        console.log('📋 헤더 행 감지 - 스킵');
        return;
      }

      // 추가 헤더 감지 로직 (다양한 케이스 대응)
      if (row[4] === 'Players' && row[5] === 'Nationality' && row[6] === 'Chips') {
        console.log('📋 헤더 행 감지 (Players/Nationality/Chips) - 스킵');
        return;
      }

      // 헤더 행의 특성: 모든 컬럼이 문자열이고 실제 데이터와 패턴이 다름
      if (typeof row[2] === 'string' && row[2] === 'Table No.' &&
          typeof row[3] === 'string' && row[3] === 'Seat No.') {
        console.log('📋 헤더 행 감지 (Table No./Seat No.) - 스킵');
        return;
      }

      // 최소 7개 컬럼 필요 (Keyplayer는 선택사항) - 하지만 undefined 값도 허용
      if (!row || row.length < 6) {
        console.log(`❌ 행 ${index + 1} 건너뜀: 컬럼 수 부족 (${row?.length || 0}/6 minimum)`);
        return;
      }

      // 7컬럼 또는 6컬럼인 경우 Keyplayer 기본값 추가하여 8컬럼으로 확장
      while (row.length < 8) {
        if (row.length === 7) {
          row.push(false); // Keyplayer 기본값 추가
          console.log(`🔧 행 ${index + 1}: Keyplayer 기본값(false) 추가 - ${row.length - 1}→8 컬럼으로 확장`);
        } else if (row.length === 6) {
          row.push(''); // Chips 기본값
          console.log(`🔧 행 ${index + 1}: Chips 기본값 추가 - ${row.length - 1}→${row.length} 컬럼으로 확장`);
        } else {
          row.push(''); // 기타 누락 컬럼 기본값
          console.log(`🔧 행 ${index + 1}: 기본값 추가 - ${row.length - 1}→${row.length} 컬럼으로 확장`);
        }
      }

      // 빈 행 또는 유효하지 않은 데이터 체크
      if (!row[0] || !row[1] || !row[4]) { // Poker Room, Table Name, Players 필수
        console.log(`⚠️ 행 ${index + 1} 건너뜀: 필수 필드 누락`);
        return;
      }

      const tableKey = `${row[0]}_${row[1]}_${row[2]}`;

      if (!tableMap.has(tableKey)) {
        tableMap.set(tableKey, {
          pokerRoom: row[this.TYPE_COLUMNS.POKER_ROOM],
          tableName: row[this.TYPE_COLUMNS.TABLE_NAME],
          tableNo: row[this.TYPE_COLUMNS.TABLE_NO],
          players: [],
          timestamp: new Date().toISOString()
        });
      }

      // 좌석 번호 파싱 개선 (#1 -> 1)
      let seatNo = 0;
      if (row[this.TYPE_COLUMNS.SEAT_NO]) {
        const seatStr = String(row[this.TYPE_COLUMNS.SEAT_NO]).replace('#', '');
        seatNo = parseInt(seatStr) || 0;
      }

      // 칩 수량 파싱 개선 (콤마 제거)
      let chips = 0;
      if (row[this.TYPE_COLUMNS.CHIPS]) {
        const chipsStr = String(row[this.TYPE_COLUMNS.CHIPS]).replace(/,/g, '');
        chips = parseFloat(chipsStr) || 0;
      }

      const playerData = {
        seatNo: seatNo,
        name: row[this.TYPE_COLUMNS.PLAYERS],
        nationality: row[this.TYPE_COLUMNS.NATIONALITY] || '',
        currentChips: chips,
        isKeyPlayer: row.length >= 8 && (
                     row[this.TYPE_COLUMNS.KEYPLAYER] === true ||
                     row[this.TYPE_COLUMNS.KEYPLAYER] === 'TRUE' ||
                     row[this.TYPE_COLUMNS.KEYPLAYER] === 'true' ||
                     row[this.TYPE_COLUMNS.KEYPLAYER] === '1')
      };

      console.log(`✅ 플레이어 추가됨 - 테이블: ${tableKey}, 플레이어:`, playerData);
      tableMap.get(tableKey).players.push(playerData);
    });

    const result = Array.from(tableMap.values());
    console.log('🎯 SheetDataMapper 최종 결과:', {
      tableCount: result.length,
      totalPlayers: result.reduce((sum, table) => sum + table.players.length, 0),
      tables: result
    });

    return result;
  }

  /**
   * 배치 업데이트를 위한 데이터 준비
   * @param {Array} handDataArray - 여러 핸드 데이터
   * @returns {Object} 배치 업데이트 객체
   */
  static prepareBatchUpdate(handDataArray) {
    const allRows = [];
    const updateRanges = [];

    handDataArray.forEach((handData, index) => {
      const rows = this.toTypeSheet(handData);
      allRows.push(...rows);

      // A1 표기법으로 범위 계산
      const startRow = index * 9 + 2; // 헤더 제외, 각 테이블당 최대 9명
      const endRow = startRow + rows.length - 1;
      updateRanges.push({
        range: `A${startRow}:H${endRow}`,
        values: rows
      });
    });

    return {
      values: allRows,
      ranges: updateRanges,
      totalRows: allRows.length
    };
  }

  /**
   * 플레이어 검색을 위한 인덱스 생성
   * @param {Array} sheetData - Type 시트 데이터
   * @returns {Map} 플레이어명 -> 데이터 매핑
   */
  static createPlayerIndex(sheetData) {
    const playerIndex = new Map();

    sheetData.forEach(row => {
      if (!row || row.length < 8) return;

      const playerName = row[this.TYPE_COLUMNS.PLAYERS];
      if (!playerName) return;

      if (!playerIndex.has(playerName)) {
        playerIndex.set(playerName, []);
      }

      playerIndex.get(playerName).push({
        pokerRoom: row[this.TYPE_COLUMNS.POKER_ROOM],
        tableName: row[this.TYPE_COLUMNS.TABLE_NAME],
        tableNo: row[this.TYPE_COLUMNS.TABLE_NO],
        seatNo: row[this.TYPE_COLUMNS.SEAT_NO],
        nationality: row[this.TYPE_COLUMNS.NATIONALITY],
        chips: row[this.TYPE_COLUMNS.CHIPS],
        isKeyPlayer: row[this.TYPE_COLUMNS.KEYPLAYER]
      });
    });

    return playerIndex;
  }

  /**
   * 데이터 유효성 검증
   * @param {Object} handData - 검증할 핸드 데이터
   * @returns {Object} 검증 결과
   */
  static validateHandData(handData) {
    const errors = [];
    const warnings = [];

    if (!handData) {
      errors.push('핸드 데이터가 없습니다.');
      return { valid: false, errors, warnings };
    }

    if (!handData.pokerRoom) {
      errors.push('포커룸이 지정되지 않았습니다.');
    }

    if (!handData.tableName) {
      errors.push('테이블명이 지정되지 않았습니다.');
    }

    if (!handData.tableNo) {
      warnings.push('테이블 번호가 없습니다.');
    }

    if (!handData.players || !Array.isArray(handData.players)) {
      errors.push('플레이어 데이터가 올바르지 않습니다.');
    } else {
      handData.players.forEach((player, index) => {
        if (!player.name) {
          warnings.push(`플레이어 ${index + 1}의 이름이 없습니다.`);
        }
        if (player.seatNo < 1 || player.seatNo > 9) {
          errors.push(`좌석 번호는 1-9 사이여야 합니다. (현재: ${player.seatNo})`);
        }
        if (player.currentChips < 0) {
          errors.push(`칩 수량은 0 이상이어야 합니다. (플레이어: ${player.name})`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 변경사항 감지
   * @param {Object} oldData - 이전 데이터
   * @param {Object} newData - 새 데이터
   * @returns {Object} 변경사항
   */
  static detectChanges(oldData, newData) {
    const changes = {
      added: [],
      modified: [],
      removed: []
    };

    if (!oldData || !oldData.players) {
      // 모든 것이 새로운 데이터
      if (newData && newData.players) {
        changes.added = newData.players;
      }
      return changes;
    }

    const oldPlayerMap = new Map(
      oldData.players.map(p => [`${p.seatNo}_${p.name}`, p])
    );
    const newPlayerMap = new Map(
      newData.players.map(p => [`${p.seatNo}_${p.name}`, p])
    );

    // 추가된 플레이어
    newPlayerMap.forEach((player, key) => {
      if (!oldPlayerMap.has(key)) {
        changes.added.push(player);
      }
    });

    // 제거된 플레이어
    oldPlayerMap.forEach((player, key) => {
      if (!newPlayerMap.has(key)) {
        changes.removed.push(player);
      }
    });

    // 수정된 플레이어
    newPlayerMap.forEach((newPlayer, key) => {
      if (oldPlayerMap.has(key)) {
        const oldPlayer = oldPlayerMap.get(key);
        if (
          oldPlayer.chips !== newPlayer.currentChips ||
          oldPlayer.nationality !== newPlayer.nationality ||
          oldPlayer.isKeyPlayer !== newPlayer.isKeyPlayer
        ) {
          changes.modified.push(newPlayer);
        }
      }
    });

    return changes;
  }
}

export default SheetDataMapper;