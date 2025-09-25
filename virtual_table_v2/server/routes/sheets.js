/**
 * Google Sheets API 라우트
 * Type 시트와 연동하는 엔드포인트
 */

import express from 'express';
import GoogleSheetsService from '../services/GoogleSheetsService.js';
import SheetDataMapper from '../services/SheetDataMapper.js';

const router = express.Router();

// Google Sheets 서비스 인스턴스
const sheetsService = new GoogleSheetsService();

/**
 * GET /api/sheets/test
 * 연결 테스트
 */
router.get('/test', async (req, res) => {
  try {
    const result = await sheetsService.testConnection();
    res.json({
      success: result.success,
      message: result.success ? 'Google Sheets 연결 성공' : '연결 실패',
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sheets/read
 * Type 시트 데이터 읽기
 */
router.get('/read', async (req, res) => {
  try {
    const { range = 'Type!A2:H' } = req.query;

    console.log('🔄 /api/sheets/read 엔드포인트 호출됨');
    console.log('📊 요청 range:', range);

    // 🔍 1단계: Apps Script POST 방식으로 먼저 시도
    let appsScriptData = [];
    let appsScriptError = null;

    try {
      console.log('🚀 Apps Script 데이터 요청 시작...');
      appsScriptData = await sheetsService.readViaAppsScript(range);
      console.log('✅ Apps Script 성공! 데이터 길이:', appsScriptData.length);
      console.log('🎯 Apps Script 원시 응답:', JSON.stringify(appsScriptData, null, 2));

      // SheetDataMapper로 변환 테스트
      if (appsScriptData && appsScriptData.length > 0) {
        console.log('🔄 SheetDataMapper로 데이터 변환 테스트...');
        const v2Data = SheetDataMapper.fromTypeSheet(appsScriptData);
        console.log('🎯 변환된 v2 데이터:', JSON.stringify(v2Data, null, 2));
      }

    } catch (error) {
      appsScriptError = error.message;
      console.error('❌ Apps Script 실패:', error.message);
    }

    // 🔍 2단계: Google Direct API를 보조로 시도
    let directData = [];
    let directError = null;

    try {
      console.log('🚀 Google Direct API 데이터 요청 시작...');
      directData = await sheetsService.readDirect(range);
      console.log('✅ Direct API 성공! 데이터 길이:', directData.length);
      console.log('🎯 Direct API 원시 응답:', JSON.stringify(directData, null, 2));
    } catch (error) {
      directError = error.message;
      console.log('❌ Direct API 실패:', error.message);
    }

    // 응답 반환 - Apps Script 데이터 우선 사용
    const finalData = appsScriptData.length > 0 ? appsScriptData : directData;

    res.json({
      success: true,
      data: finalData,
      count: finalData.length,
      timestamp: new Date().toISOString(),
      debug: {
        appsScript: {
          success: appsScriptData.length > 0,
          count: appsScriptData.length,
          error: appsScriptError
        },
        directApi: {
          success: directData.length > 0,
          count: directData.length,
          error: directError
        },
        primarySource: appsScriptData.length > 0 ? 'Apps Script' : 'Direct API'
      }
    });

  } catch (error) {
    console.error('🚨 시트 읽기 전체 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sheets/write
 * Type 시트에 데이터 쓰기
 */
router.post('/write', async (req, res) => {
  try {
    const handData = req.body;

    // 데이터 유효성 검증
    const validation = SheetDataMapper.validateHandData(handData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // 시트에 쓰기
    const result = await sheetsService.writeDirect(handData);

    res.json({
      success: true,
      message: '데이터 저장 완료',
      result: result
    });
  } catch (error) {
    console.error('시트 쓰기 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sheets/batch-update
 * 여러 테이블 데이터 일괄 업데이트
 */
router.post('/batch-update', async (req, res) => {
  try {
    const { tables } = req.body;

    if (!Array.isArray(tables)) {
      return res.status(400).json({
        success: false,
        error: '테이블 배열이 필요합니다.'
      });
    }

    // 각 테이블 유효성 검증
    const validationErrors = [];
    tables.forEach((table, index) => {
      const validation = SheetDataMapper.validateHandData(table);
      if (!validation.valid) {
        validationErrors.push({
          table: index,
          errors: validation.errors
        });
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        validationErrors
      });
    }

    // 배치 업데이트 실행
    const result = await sheetsService.batchUpdate(tables);

    res.json({
      success: true,
      message: `${tables.length}개 테이블 업데이트 완료`,
      result: result
    });
  } catch (error) {
    console.error('배치 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sheets/search-player
 * 플레이어 검색
 */
router.get('/search-player', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: '플레이어 이름이 필요합니다.'
      });
    }

    const results = await sheetsService.searchPlayer(name);

    res.json({
      success: true,
      player: name,
      results: results,
      count: results.length
    });
  } catch (error) {
    console.error('플레이어 검색 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sheets/sync
 * 실시간 동기화 시작/중지
 */
let syncInterval = null;
router.post('/sync', async (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'start') {
      if (syncInterval) {
        return res.json({
          success: false,
          message: '동기화가 이미 실행 중입니다.'
        });
      }

      syncInterval = sheetsService.startRealTimeSync((data, changes) => {
        // WebSocket이나 SSE로 클라이언트에 푸시
        console.log('데이터 변경 감지:', changes);
      });

      res.json({
        success: true,
        message: '실시간 동기화 시작됨 (5초 간격)'
      });
    } else if (action === 'stop') {
      if (syncInterval) {
        syncInterval();
        syncInterval = null;
      }

      res.json({
        success: true,
        message: '실시간 동기화 중지됨'
      });
    } else {
      res.status(400).json({
        success: false,
        error: '유효하지 않은 액션: start 또는 stop'
      });
    }
  } catch (error) {
    console.error('동기화 설정 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sheets/convert-to-v2
 * 시트 데이터를 v2 형식으로 변환
 */
router.post('/convert-to-v2', async (req, res) => {
  try {
    const { sheetData } = req.body;

    if (!Array.isArray(sheetData)) {
      return res.status(400).json({
        success: false,
        error: '시트 데이터 배열이 필요합니다.'
      });
    }

    const v2Data = SheetDataMapper.fromTypeSheet(sheetData);

    res.json({
      success: true,
      data: v2Data,
      tableCount: v2Data.length,
      playerCount: v2Data.reduce((sum, table) => sum + table.players.length, 0)
    });
  } catch (error) {
    console.error('데이터 변환 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sheets/convert-to-sheet
 * v2 데이터를 시트 형식으로 변환
 */
router.post('/convert-to-sheet', async (req, res) => {
  try {
    const handData = req.body;

    // 데이터 유효성 검증
    const validation = SheetDataMapper.validateHandData(handData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const sheetData = SheetDataMapper.toTypeSheet(handData);

    res.json({
      success: true,
      data: sheetData,
      rowCount: sheetData.length
    });
  } catch (error) {
    console.error('데이터 변환 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;