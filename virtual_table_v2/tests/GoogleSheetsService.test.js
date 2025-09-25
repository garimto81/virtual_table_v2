/**
 * GoogleSheetsService 테스트
 */

import GoogleSheetsService from '../server/services/GoogleSheetsService.js';
import axios from 'axios';

// axios 모킹
jest.mock('axios');
const mockedAxios = axios;

// google APIs 모킹
jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({
        getClient: jest.fn().mockResolvedValue({})
      }))
    },
    sheets: jest.fn().mockReturnValue({
      spreadsheets: {
        values: {
          get: jest.fn(),
          update: jest.fn(),
          batchUpdate: jest.fn()
        },
        get: jest.fn()
      }
    })
  }
}));

describe('GoogleSheetsService', () => {
  let sheetsService;

  beforeEach(() => {
    // 환경 변수 설정
    process.env.APPS_SCRIPT_URL = 'https://script.google.com/test';
    process.env.SPREADSHEET_ID = 'test-spreadsheet-id';
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE = './test-key.json';

    sheetsService = new GoogleSheetsService();
    jest.clearAllMocks();
  });

  describe('readViaAppsScript', () => {
    test('Apps Script를 통해 데이터를 읽어야 함', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            ['Paradise City', '1/2 NLH', 'T01', 1, 'John Doe', 'USA', 2000, true],
            ['Paradise City', '1/2 NLH', 'T01', 2, 'Jane Smith', 'KOR', 1500, false]
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await sheetsService.readViaAppsScript('Type!A2:H');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://script.google.com/test',
        {
          action: 'read',
          range: 'Type!A2:H'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      expect(result).toHaveLength(1); // 1개 테이블 (같은 테이블의 2명)
      expect(result[0].pokerRoom).toBe('Paradise City');
      expect(result[0].players).toHaveLength(2);
    });

    test('Apps Script 오류 시 에러를 던져야 함', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Sheet not found'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await expect(sheetsService.readViaAppsScript()).rejects.toThrow('Sheet not found');
    });

    test('네트워크 오류 시 에러를 던져야 함', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(sheetsService.readViaAppsScript()).rejects.toThrow('Network error');
    });
  });

  describe('writeViaAppsScript', () => {
    test('Apps Script를 통해 데이터를 써야 함', async () => {
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

      const mockResponse = {
        data: {
          success: true,
          updatedRows: 1
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await sheetsService.writeViaAppsScript(handData);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://script.google.com/test',
        {
          action: 'write',
          data: [['Paradise City', '1/2 NLH', 'T01', 1, 'John Doe', 'USA', 2000, true]],
          range: 'Type!A2:H'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      expect(result.success).toBe(true);
    });

    test('잘못된 데이터는 검증 오류를 던져야 함', async () => {
      const invalidHandData = {
        // pokerRoom 누락
        tableName: '1/2 NLH',
        players: []
      };

      await expect(sheetsService.writeViaAppsScript(invalidHandData))
        .rejects.toThrow('데이터 검증 실패');
    });
  });

  describe('searchPlayer', () => {
    test('플레이어를 검색해야 함', async () => {
      const mockSheetData = [
        ['Paradise City', '1/2 NLH', 'T01', 1, 'John Doe', 'USA', 2000, true],
        ['Paradise City', '1/2 NLH', 'T01', 2, 'Jane Smith', 'KOR', 1500, false],
        ['Grand Seoul', '2/4 NLH', 'T02', 1, 'John Doe', 'USA', 1800, false]
      ];

      // readDirect 메서드 모킹
      jest.spyOn(sheetsService, 'readDirect').mockResolvedValue([
        {
          pokerRoom: 'Paradise City',
          tableName: '1/2 NLH',
          tableNo: 'T01',
          players: [
            { seatNo: 1, name: 'John Doe', nationality: 'USA', currentChips: 2000, isKeyPlayer: true },
            { seatNo: 2, name: 'Jane Smith', nationality: 'KOR', currentChips: 1500, isKeyPlayer: false }
          ]
        },
        {
          pokerRoom: 'Grand Seoul',
          tableName: '2/4 NLH',
          tableNo: 'T02',
          players: [
            { seatNo: 1, name: 'John Doe', nationality: 'USA', currentChips: 1800, isKeyPlayer: false }
          ]
        }
      ]);

      const results = await sheetsService.searchPlayer('John Doe');

      expect(results).toHaveLength(2); // 2개의 결과
      expect(results[0].pokerRoom).toBe('Paradise City');
      expect(results[1].pokerRoom).toBe('Grand Seoul');
    });

    test('존재하지 않는 플레이어는 빈 배열을 반환해야 함', async () => {
      jest.spyOn(sheetsService, 'readDirect').mockResolvedValue([]);

      const results = await sheetsService.searchPlayer('NonExistent Player');

      expect(results).toEqual([]);
    });
  });

  describe('testConnection', () => {
    test('연결 테스트가 성공해야 함', async () => {
      // Apps Script 응답 모킹
      mockedAxios.post.mockResolvedValue({
        data: { success: true }
      });

      // Google API 응답 모킹
      if (sheetsService.sheets) {
        sheetsService.sheets.spreadsheets.get.mockResolvedValue({
          data: {
            properties: {
              title: 'Test Spreadsheet'
            }
          }
        });
      }

      const result = await sheetsService.testConnection();

      expect(result.success).toBe(true);
    });

    test('연결 실패 시 오류 정보를 반환해야 함', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Connection failed'));

      const result = await sheetsService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('startRealTimeSync', () => {
    test('실시간 동기화를 시작하고 정리 함수를 반환해야 함', (done) => {
      jest.spyOn(sheetsService, 'readDirect')
        .mockResolvedValueOnce([{ id: 1, data: 'initial' }])
        .mockResolvedValueOnce([{ id: 1, data: 'changed' }]);

      let callbackCount = 0;
      const cleanup = sheetsService.startRealTimeSync((data, changes) => {
        callbackCount++;
        if (callbackCount === 1) {
          expect(changes.hasChanges).toBe(true);
          cleanup();
          done();
        }
      });

      expect(typeof cleanup).toBe('function');
    });
  });

  describe('detectOverallChanges', () => {
    test('변경사항을 감지해야 함', () => {
      const oldData = [{ id: 1, name: 'John' }];
      const newData = [{ id: 1, name: 'Jane' }];

      const changes = sheetsService.detectOverallChanges(oldData, newData);

      expect(changes.hasChanges).toBe(true);
    });

    test('변경사항이 없으면 false를 반환해야 함', () => {
      const data = [{ id: 1, name: 'John' }];

      const changes = sheetsService.detectOverallChanges(data, data);

      expect(changes.hasChanges).toBe(false);
    });
  });
});