import express from 'express';
import GoogleSheetsService from '../services/GoogleSheetsService.js';
import SheetDataMapper from '../services/SheetDataMapper.js';

const router = express.Router();

// Google Sheets 서비스 인스턴스 (싱글톤)
const sheetsService = new GoogleSheetsService();

/**
 * CSV 형식으로 데이터 내보내기
 */
router.get('/csv', async (req, res) => {
  try {
    console.log('📊 CSV Export 요청됨');

    // 연결 테스트로 초기화 보장
    const connectionTest = await sheetsService.testConnection();
    if (!connectionTest.success) {
      throw new Error(`Google Sheets 연결 실패: ${connectionTest.error}`);
    }

    // Google Sheets에서 데이터 읽기 (readDirect는 이미 변환된 tables 배열을 반환)
    const tables = await sheetsService.readDirect('Type!A2:H');

    if (!tables || tables.length === 0) {
      return res.status(404).json({
        success: false,
        error: '내보낼 데이터가 없습니다.'
      });
    }

    // CSV 헤더
    const headers = ['Poker Room', 'Table Name', 'Table No.', 'Seat No.', 'Players', 'Nationality', 'Chips', 'Keyplayer'];
    const csvLines = [headers.join(',')];

    // 각 테이블과 플레이어를 CSV 라인으로 변환
    tables.forEach(table => {
      table.players.forEach(player => {
        const line = [
          table.pokerRoom || '',
          table.tableName || '',
          table.tableNo || '',
          `#${player.seatNo}`,
          player.name || '',
          player.nationality || '',
          player.currentChips || 0,
          player.isKeyPlayer ? 'TRUE' : ''
        ].map(field => {
          // 쉼표나 따옴표가 있는 경우 따옴표로 감싸기
          const str = String(field);
          if (str.includes(',') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',');

        csvLines.push(line);
      });
    });

    // CSV 파일로 다운로드
    const csv = csvLines.join('\n');
    const filename = `poker_tables_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csv); // UTF-8 BOM 추가

    console.log(`✅ CSV Export 성공: ${csvLines.length - 1}개 행`);
  } catch (error) {
    console.error('❌ CSV Export 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'CSV 내보내기 실패'
    });
  }
});

/**
 * JSON 형식으로 데이터 내보내기
 */
router.get('/json', async (req, res) => {
  try {
    console.log('📊 JSON Export 요청됨');

    // 연결 테스트로 초기화 보장
    const connectionTest = await sheetsService.testConnection();
    if (!connectionTest.success) {
      throw new Error(`Google Sheets 연결 실패: ${connectionTest.error}`);
    }

    // Google Sheets에서 데이터 읽기 (readDirect는 이미 변환된 tables 배열을 반환)
    const tables = await sheetsService.readDirect('Type!A2:H');

    if (!tables || tables.length === 0) {
      return res.status(404).json({
        success: false,
        error: '내보낼 데이터가 없습니다.'
      });
    }

    // 메타데이터 추가
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '2.0',
        tableCount: tables.length,
        totalPlayers: tables.reduce((sum, table) => sum + table.players.length, 0),
        keyPlayerCount: tables.reduce((sum, table) =>
          sum + table.players.filter(p => p.isKeyPlayer).length, 0)
      },
      tables: tables
    };

    // JSON 파일로 다운로드
    const filename = `poker_tables_${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);

    console.log(`✅ JSON Export 성공: ${tables.length}개 테이블`);
  } catch (error) {
    console.error('❌ JSON Export 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'JSON 내보내기 실패'
    });
  }
});

/**
 * Excel 형식으로 데이터 내보내기 (선택사항)
 */
router.get('/excel', async (req, res) => {
  try {
    console.log('📊 Excel Export 요청됨');

    // 현재는 CSV로 대체
    res.redirect('/api/sheets/export/csv');
  } catch (error) {
    console.error('❌ Excel Export 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Excel 내보내기는 현재 지원되지 않습니다. CSV를 사용해주세요.'
    });
  }
});

export default router;