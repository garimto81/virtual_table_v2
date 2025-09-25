/**
 * Google Sheets API 서비스
 * Apps Script 프록시 및 직접 API 통신 처리
 */

import axios from 'axios';
import { google } from 'googleapis';
import SheetDataMapper from './SheetDataMapper.js';

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this._initialized = false;

    // 환경변수는 lazy loading으로 처리
    this._appsScriptUrl = null;
    this._spreadsheetId = null;
  }

  /**
   * 환경변수 lazy loading 및 초기화
   */
  _ensureInitialized() {
    if (this._initialized) return;

    // Apps Script 웹 앱 URL (CORS 우회용)
    this._appsScriptUrl = process.env.APPS_SCRIPT_URL;
    // Google Sheets API 직접 연결용
    this._spreadsheetId = process.env.SPREADSHEET_ID;

    // 🔍 디버깅: 환경변수 상태 확인
    console.log('🔍 GoogleSheetsService 환경변수 초기화:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- SPREADSHEET_ID:', this._spreadsheetId);
    console.log('- APPS_SCRIPT_URL:', this._appsScriptUrl?.substring(0, 50) + '...');
    console.log('- APPS_SCRIPT_URL length:', this._appsScriptUrl?.length);

    if (!this._appsScriptUrl) {
      console.warn('⚠️ APPS_SCRIPT_URL이 설정되지 않았습니다');
    }
    if (!this._spreadsheetId) {
      console.warn('⚠️ SPREADSHEET_ID가 설정되지 않았습니다');
    }

    this._initialized = true;

    // 초기화
    this.initializeAuth();
  }

  get appsScriptUrl() {
    this._ensureInitialized();
    return this._appsScriptUrl;
  }

  get spreadsheetId() {
    this._ensureInitialized();
    return this._spreadsheetId;
  }

  /**
   * Google API 인증 초기화
   */
  async initializeAuth() {
    console.log('🔍 Google API 인증 초기화 시작...');

    try {
      // 🔍 환경변수 검증
      const requiredEnvVars = ['GOOGLE_PROJECT_ID', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SERVICE_ACCOUNT_EMAIL'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

      if (missingVars.length > 0) {
        throw new Error(`필수 환경변수 누락: ${missingVars.join(', ')}`);
      }

      console.log('✅ 모든 필수 환경변수 존재 확인');
      console.log('📊 환경변수 상태:');
      console.log('- GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID);
      console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
      console.log('- GOOGLE_PRIVATE_KEY length:', process.env.GOOGLE_PRIVATE_KEY?.length);
      console.log('- GOOGLE_PRIVATE_KEY starts with:', process.env.GOOGLE_PRIVATE_KEY?.substring(0, 30) + '...');

      // 환경변수에서 직접 서비스 계정 정보 사용
      const credentials = {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: 'key-id', // 임시값
        private_key: process.env.GOOGLE_PRIVATE_KEY,
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        client_id: 'client-id', // 임시값
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)}`
      };

      console.log('🔍 credentials 객체 구성 완료');
      console.log('📋 credentials 검증:');
      console.log('- type:', credentials.type);
      console.log('- project_id:', credentials.project_id);
      console.log('- client_email:', credentials.client_email);
      console.log('- private_key 형식 검증:', credentials.private_key?.includes('BEGIN PRIVATE KEY'));

      console.log('🔄 Google Auth 객체 생성 중...');
      // 서비스 계정 인증
      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      console.log('🔄 Auth Client 생성 중...');
      this.auth = await auth.getClient();
      console.log('✅ Auth Client 생성 성공');

      console.log('🔄 Google Sheets API 클라이언트 생성 중...');
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      console.log('✅ Google Sheets API 인증 완전 성공 (환경변수 사용)');
      console.log('🎯 this.sheets 상태:', this.sheets ? 'OK' : 'NULL');
    } catch (error) {
      console.error('❌ Google Sheets API 인증 상세 실패 정보:');
      console.error('- 에러 메시지:', error.message);
      console.error('- 에러 타입:', error.constructor.name);
      console.error('- 에러 코드:', error.code);
      console.error('- 스택 트레이스:', error.stack);

      if (error.response) {
        console.error('- HTTP 응답 상태:', error.response.status);
        console.error('- HTTP 응답 데이터:', error.response.data);
      }

      // Apps Script 프록시만 사용
      console.warn('⚠️ Google Sheets Direct API 사용 불가, Apps Script 프록시만 사용');
      this.sheets = null;
    }
  }

  /**
   * Apps Script 프록시를 통한 데이터 읽기
   * @param {String} range - 시트 범위 (예: 'Type!A2:H')
   */
  async readViaAppsScript(range = 'Type!A2:H') {
    try {
      // POST 방식으로 요청 (Apps Script가 POST만 처리할 가능성 높음)
      console.log(`🔄 Apps Script POST 요청 시작: ${this.appsScriptUrl}`);
      console.log(`📊 요청 데이터: { action: "read", range: "${range}" }`);
      const startTime = Date.now();

      const response = await axios.post(this.appsScriptUrl, {
        action: 'read',
        range: range
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'User-Agent': 'VirtualDataClaude/2.0'
        },
        timeout: 30000, // 30초로 타임아웃 증가
        maxRedirects: 10,
        validateStatus: function (status) {
          return status >= 200 && status < 300;
        }
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Apps Script 응답 완료 (${duration}ms):`, {
        status: response.status,
        dataLength: JSON.stringify(response.data).length
      });

      // 🔍 원시 응답 데이터 상세 분석
      console.log('📊 Apps Script 원시 응답 전체:', JSON.stringify(response.data, null, 2));
      console.log('📊 응답 데이터 타입:', typeof response.data);
      console.log('📊 success 필드:', response.data?.success);
      console.log('📊 data 필드:', response.data?.data);
      console.log('📊 data 필드 타입:', typeof response.data?.data);
      console.log('📊 data 필드 길이:', Array.isArray(response.data?.data) ? response.data.data.length : 'Not Array');

      if (response.data && response.data.success) {
        console.log('🔄 SheetDataMapper 변환 시작...');
        const result = SheetDataMapper.fromTypeSheet(response.data.data);
        console.log('🎯 SheetDataMapper 변환 결과:', {
          resultType: typeof result,
          resultLength: Array.isArray(result) ? result.length : 'Not Array',
          result: result
        });
        return result;
      } else {
        throw new Error(response.data?.error || 'Apps Script 읽기 실패');
      }
    } catch (error) {
      console.error('❌ Apps Script 읽기 오류:', error.message);
      console.error('   - 오류 코드:', error.code);
      console.error('   - 요청 URL:', error.config?.url);
      console.error('   - 타임아웃:', error.config?.timeout);

      if (error.response) {
        console.error('   - 응답 상태:', error.response.status);
        console.error('   - 응답 헤더:', error.response.headers);
        console.error('   - 응답 데이터:', error.response.data);
      }

      // Apps Script가 응답하지 않는 경우 빈 데이터 반환
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.warn('⚠️ Apps Script 타임아웃 - 빈 데이터 반환');
        return []; // 빈 테이블 배열 반환
      }

      throw error;
    }
  }

  /**
   * Apps Script 프록시를 통한 데이터 쓰기
   * @param {Object} handData - v2 핸드 데이터
   */
  async writeViaAppsScript(handData) {
    try {
      // 데이터 유효성 검증
      const validation = SheetDataMapper.validateHandData(handData);
      if (!validation.valid) {
        throw new Error(`데이터 검증 실패: ${validation.errors.join(', ')}`);
      }

      // Type 시트 형식으로 변환
      const sheetData = SheetDataMapper.toTypeSheet(handData);

      const response = await axios.post(this.appsScriptUrl, {
        action: 'write',
        data: sheetData,
        range: 'Type!A2:H' // 헤더 제외
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        console.log(`✅ ${sheetData.length}개 행 저장 완료`);
        return response.data;
      } else {
        throw new Error(response.data.error || 'Apps Script 쓰기 실패');
      }
    } catch (error) {
      console.error('Apps Script 쓰기 오류:', error.message);
      throw error;
    }
  }

  /**
   * Google Sheets API 직접 읽기 (Apps Script 우회)
   * @param {String} range - 시트 범위
   */
  async readDirect(range = 'Type!A2:H') {
    console.log('🔄 Google Sheets Direct API 요청 시작...');

    if (!this.sheets) {
      throw new Error('Google Sheets API가 초기화되지 않았습니다. 환경변수를 확인하세요.');
    }

    try {
      console.log(`📊 Direct API 요청: spreadsheetId=${this.spreadsheetId}, range=${range}`);
      const startTime = Date.now();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range
      });

      const duration = Date.now() - startTime;
      const rows = response.data.values || [];

      console.log(`✅ Direct API 응답 완료 (${duration}ms):`, {
        rowCount: rows.length,
        hasData: rows.length > 0
      });

      if (rows.length === 0) {
        console.log('⚠️ Direct API: 빈 데이터 응답 (시트에 데이터가 없거나 범위가 잘못됨)');
        return [];
      }

      console.log('📝 Direct API 원시 데이터 샘플:', rows.slice(0, 3));
      const result = SheetDataMapper.fromTypeSheet(rows);
      console.log('🎯 Direct API 최종 변환 결과:', {
        tableCount: result.length,
        totalPlayers: result.reduce((sum, table) => sum + table.players.length, 0)
      });

      return result;
    } catch (error) {
      console.error('❌ Direct API 읽기 오류:', {
        message: error.message,
        code: error.code,
        status: error.status
      });
      throw new Error(`Google Sheets Direct API 오류: ${error.message}`);
    }
  }

  /**
   * Google Sheets API 직접 쓰기
   * @param {Object} handData - v2 핸드 데이터
   */
  async writeDirect(handData) {
    if (!this.sheets) {
      // API 인증 실패 시 Apps Script 사용
      return this.writeViaAppsScript(handData);
    }

    try {
      // 데이터 유효성 검증
      const validation = SheetDataMapper.validateHandData(handData);
      if (!validation.valid) {
        throw new Error(`데이터 검증 실패: ${validation.errors.join(', ')}`);
      }

      // Type 시트 형식으로 변환
      const values = SheetDataMapper.toTypeSheet(handData);

      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'Type!A2:H',
        valueInputOption: 'RAW',
        resource: {
          values: values
        }
      });

      console.log(`✅ ${response.data.updatedRows}개 행 업데이트 완료`);
      return response.data;
    } catch (error) {
      console.error('Direct API 쓰기 오류:', error.message);
      // 폴백: Apps Script 사용
      return this.writeViaAppsScript(handData);
    }
  }

  /**
   * 배치 업데이트 (대량 데이터)
   * @param {Array} handDataArray - 여러 핸드 데이터
   */
  async batchUpdate(handDataArray) {
    if (!this.sheets) {
      // Apps Script로는 개별 처리
      const results = [];
      for (const handData of handDataArray) {
        results.push(await this.writeViaAppsScript(handData));
      }
      return results;
    }

    try {
      const batchData = SheetDataMapper.prepareBatchUpdate(handDataArray);

      const response = await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: batchData.ranges
        }
      });

      console.log(`✅ 배치 업데이트: ${batchData.totalRows}개 행`);
      return response.data;
    } catch (error) {
      console.error('배치 업데이트 오류:', error.message);
      throw error;
    }
  }

  /**
   * 플레이어 검색
   * @param {String} playerName - 플레이어 이름
   */
  async searchPlayer(playerName) {
    try {
      // 전체 데이터 읽기
      const allData = await this.readDirect();

      // 플레이어 인덱스 생성
      const sheetRows = SheetDataMapper.toTypeSheet({
        players: allData.flatMap(table => table.players),
        pokerRoom: '',
        tableName: '',
        tableNo: ''
      });

      const playerIndex = SheetDataMapper.createPlayerIndex(sheetRows);

      // 플레이어 검색
      return playerIndex.get(playerName) || [];
    } catch (error) {
      console.error('플레이어 검색 오류:', error.message);
      throw error;
    }
  }

  /**
   * 실시간 동기화 (5초마다)
   * @param {Function} callback - 데이터 변경 시 콜백
   */
  startRealTimeSync(callback) {
    let lastData = null;

    const syncInterval = setInterval(async () => {
      try {
        const currentData = await this.readDirect();

        // 변경사항 감지
        if (lastData) {
          const changes = this.detectOverallChanges(lastData, currentData);
          if (changes.hasChanges) {
            callback(currentData, changes);
          }
        }

        lastData = currentData;
      } catch (error) {
        console.error('실시간 동기화 오류:', error.message);
      }
    }, 5000); // 5초마다

    // 정리 함수 반환
    return () => clearInterval(syncInterval);
  }

  /**
   * 전체 데이터 변경사항 감지
   */
  detectOverallChanges(oldData, newData) {
    let hasChanges = false;
    const changes = {
      addedTables: [],
      removedTables: [],
      modifiedTables: []
    };

    // 간단한 비교 (실제로는 더 정교한 비교 필요)
    if (JSON.stringify(oldData) !== JSON.stringify(newData)) {
      hasChanges = true;
    }

    return { hasChanges, ...changes };
  }

  /**
   * 연결 테스트
   */
  async testConnection() {
    try {
      console.log('🔄 Google Sheets 연결 테스트 중...');

      // Apps Script 테스트
      if (this.appsScriptUrl) {
        const appsResponse = await axios.post(this.appsScriptUrl, {
          action: 'test'
        });
        console.log('✅ Apps Script 프록시 연결 성공');
      }

      // Direct API 테스트
      if (this.sheets) {
        const apiResponse = await this.sheets.spreadsheets.get({
          spreadsheetId: this.spreadsheetId
        });
        console.log('✅ Google Sheets API 직접 연결 성공');
        console.log(`   시트 이름: ${apiResponse.data.properties.title}`);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ 연결 테스트 실패:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default GoogleSheetsService;