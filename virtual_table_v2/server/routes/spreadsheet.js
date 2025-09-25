/**
 * 스프레드시트 메타데이터 및 정보 API
 * .env의 SPREADSHEET_ID 기반 시트 정보 제공
 */

import express from 'express';
import GoogleSheetsService from '../services/GoogleSheetsService.js';

const router = express.Router();
const sheetsService = new GoogleSheetsService();

/**
 * GET /api/spreadsheet/info
 * 스프레드시트 기본 정보 조회
 */
router.get('/info', async (req, res) => {
  try {
    const spreadsheetInfo = {
      id: process.env.SPREADSHEET_ID,
      appsScriptUrl: process.env.APPS_SCRIPT_URL,
      environment: process.env.NODE_ENV,
      lastConnected: null,
      sheets: []
    };

    // Google Sheets API로 메타데이터 가져오기
    if (sheetsService.sheets) {
      try {
        const metadata = await sheetsService.sheets.spreadsheets.get({
          spreadsheetId: process.env.SPREADSHEET_ID
        });

        spreadsheetInfo.title = metadata.data.properties.title;
        spreadsheetInfo.lastConnected = new Date().toISOString();
        spreadsheetInfo.sheets = metadata.data.sheets.map(sheet => ({
          name: sheet.properties.title,
          id: sheet.properties.sheetId,
          rowCount: sheet.properties.gridProperties.rowCount,
          columnCount: sheet.properties.gridProperties.columnCount,
          hidden: sheet.properties.hidden || false
        }));
      } catch (error) {
        spreadsheetInfo.error = `API 연결 실패: ${error.message}`;
      }
    }

    res.json({
      success: true,
      data: spreadsheetInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/spreadsheet/preview
 * Type 시트 미리보기 (처음 10행)
 */
router.get('/preview', async (req, res) => {
  try {
    const { sheet = 'Type', rows = 10 } = req.query;
    const range = `${sheet}!A1:H${parseInt(rows) + 1}`; // 헤더 포함

    const data = await sheetsService.readDirect(range);

    res.json({
      success: true,
      data: data,
      metadata: {
        sheetName: sheet,
        rowsRequested: rows,
        rowsReturned: data.length,
        spreadsheetId: process.env.SPREADSHEET_ID
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/spreadsheet/health
 * 스프레드시트 연결 상태 확인
 */
router.get('/health', async (req, res) => {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    spreadsheetId: process.env.SPREADSHEET_ID,
    checks: {}
  };

  try {
    // 1. Apps Script 연결 확인
    const appsScriptTest = await sheetsService.testConnection();
    healthCheck.checks.appsScript = {
      status: appsScriptTest.success ? 'healthy' : 'error',
      message: appsScriptTest.success ? '연결 성공' : appsScriptTest.error,
      url: process.env.APPS_SCRIPT_URL
    };

    // 2. Google Sheets API 직접 연결 확인
    if (sheetsService.sheets) {
      try {
        const apiTest = await sheetsService.sheets.spreadsheets.get({
          spreadsheetId: process.env.SPREADSHEET_ID
        });
        healthCheck.checks.sheetsApi = {
          status: 'healthy',
          message: '직접 API 연결 성공',
          title: apiTest.data.properties.title
        };
      } catch (error) {
        healthCheck.checks.sheetsApi = {
          status: 'error',
          message: error.message
        };
      }
    } else {
      healthCheck.checks.sheetsApi = {
        status: 'unavailable',
        message: '서비스 계정 인증 실패'
      };
    }

    // 3. 실제 데이터 읽기 테스트
    try {
      const dataTest = await sheetsService.readDirect('Type!A1:H2');
      healthCheck.checks.dataAccess = {
        status: 'healthy',
        message: `${dataTest.length}개 테이블 데이터 읽기 성공`
      };
    } catch (error) {
      healthCheck.checks.dataAccess = {
        status: 'error',
        message: error.message
      };
    }

    const allHealthy = Object.values(healthCheck.checks)
      .every(check => check.status === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      data: healthCheck
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      data: healthCheck
    });
  }
});

/**
 * POST /api/spreadsheet/reload
 * 스프레드시트 메타데이터 캐시 갱신
 */
router.post('/reload', async (req, res) => {
  try {
    // 서비스 재초기화
    await sheetsService.initializeAuth();

    // 연결 테스트
    const testResult = await sheetsService.testConnection();

    res.json({
      success: testResult.success,
      message: testResult.success ? '스프레드시트 재연결 성공' : '재연결 실패',
      error: testResult.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/spreadsheet/url
 * 브라우저에서 열 수 있는 스프레드시트 URL 생성
 */
router.get('/url', (req, res) => {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = req.query.sheet || 'Type';

  const urls = {
    spreadsheet: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    specificSheet: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0&range=${sheetName}!A1:H`,
    appsScript: process.env.APPS_SCRIPT_URL
  };

  res.json({
    success: true,
    data: {
      spreadsheetId,
      urls,
      instructions: [
        '1. spreadsheet: 전체 스프레드시트 열기',
        '2. specificSheet: 특정 시트로 직접 이동',
        '3. appsScript: Apps Script 웹앱 URL'
      ]
    }
  });
});

export default router;