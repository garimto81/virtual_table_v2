/**
 * 시트 데이터 캐싱 및 스마트 업데이트 시스템
 * 성능 향상을 위한 메모리/디스크 캐시 혼합 구조
 */

import fs from 'fs/promises';
import path from 'path';
import GoogleSheetsService from './GoogleSheetsService.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SheetCache {
  constructor() {
    this.memoryCache = new Map();
    this.cacheDir = path.join(__dirname, '../../cache');
    this.sheetsService = new GoogleSheetsService();
    this.refreshInterval = null;
    this.lastModified = new Map();

    this.ensureCacheDir();
  }

  async ensureCacheDir() {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 캐시 키 생성
   */
  getCacheKey(range, options = {}) {
    const key = `${process.env.SPREADSHEET_ID}_${range}_${JSON.stringify(options)}`;
    return key.replace(/[^\w-]/g, '_');
  }

  /**
   * 메모리에서 캐시 조회
   */
  getFromMemory(cacheKey) {
    const cached = this.memoryCache.get(cacheKey);
    if (!cached) return null;

    // TTL 확인 (기본 5분)
    const ttl = cached.options?.ttl || 5 * 60 * 1000;
    if (Date.now() - cached.timestamp > ttl) {
      this.memoryCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  /**
   * 메모리에 캐시 저장
   */
  setInMemory(cacheKey, data, options = {}) {
    this.memoryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      options
    });

    // 메모리 캐시 크기 제한 (최대 50개)
    if (this.memoryCache.size > 50) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
  }

  /**
   * 디스크에서 캐시 조회
   */
  async getFromDisk(cacheKey) {
    try {
      const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const cached = JSON.parse(fileContent);

      // TTL 확인 (기본 1시간)
      const ttl = cached.options?.diskTTL || 60 * 60 * 1000;
      if (Date.now() - cached.timestamp > ttl) {
        await this.removeFromDisk(cacheKey);
        return null;
      }

      return cached.data;
    } catch {
      return null;
    }
  }

  /**
   * 디스크에 캐시 저장
   */
  async setOnDisk(cacheKey, data, options = {}) {
    try {
      const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
      const cacheData = {
        data,
        timestamp: Date.now(),
        options,
        spreadsheetId: process.env.SPREADSHEET_ID,
        version: '2.0.0'
      };

      await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('디스크 캐시 저장 실패:', error.message);
    }
  }

  /**
   * 디스크에서 캐시 제거
   */
  async removeFromDisk(cacheKey) {
    try {
      const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
      await fs.unlink(filePath);
    } catch {
      // 파일이 없는 경우 무시
    }
  }

  /**
   * 스마트 데이터 조회 (캐시 우선, 없으면 API)
   */
  async get(range = 'Type!A2:H', options = {}) {
    const cacheKey = this.getCacheKey(range, options);

    // 1. 메모리 캐시 확인
    let data = this.getFromMemory(cacheKey);
    if (data && !options.forceRefresh) {
      return {
        data,
        source: 'memory',
        cached: true,
        timestamp: Date.now()
      };
    }

    // 2. 디스크 캐시 확인
    if (!options.forceRefresh) {
      data = await this.getFromDisk(cacheKey);
      if (data) {
        // 메모리에도 복사
        this.setInMemory(cacheKey, data, options);
        return {
          data,
          source: 'disk',
          cached: true,
          timestamp: Date.now()
        };
      }
    }

    // 3. API에서 새로 가져오기
    try {
      data = await this.sheetsService.readDirect(range);

      // 캐시에 저장
      this.setInMemory(cacheKey, data, options);
      await this.setOnDisk(cacheKey, data, options);

      return {
        data,
        source: 'api',
        cached: false,
        timestamp: Date.now()
      };
    } catch (error) {
      // API 실패 시 만료된 캐시라도 반환
      const staleData = await this.getFromDisk(cacheKey);
      if (staleData) {
        return {
          data: staleData,
          source: 'stale',
          cached: true,
          error: error.message,
          timestamp: Date.now()
        };
      }
      throw error;
    }
  }

  /**
   * 특정 플레이어 검색 (캐시 활용)
   */
  async searchPlayer(playerName, options = {}) {
    const cacheKey = this.getCacheKey('player_search', { player: playerName });

    // 캐시 확인
    let result = this.getFromMemory(cacheKey);
    if (result && !options.forceRefresh) {
      return { ...result, cached: true };
    }

    // 전체 데이터에서 검색
    const { data: allTables } = await this.get('Type!A2:H', options);

    // 플레이어 검색 실행
    const playerMatches = [];
    allTables.forEach(table => {
      table.players.forEach(player => {
        if (player.name.toLowerCase().includes(playerName.toLowerCase())) {
          playerMatches.push({
            ...player,
            pokerRoom: table.pokerRoom,
            tableName: table.tableName,
            tableNo: table.tableNo
          });
        }
      });
    });

    result = { matches: playerMatches, count: playerMatches.length };

    // 검색 결과 캐시 (1분)
    this.setInMemory(cacheKey, result, { ttl: 60 * 1000 });

    return { ...result, cached: false };
  }

  /**
   * 통계 데이터 조회 (캐시 활용)
   */
  async getStats(options = {}) {
    const cacheKey = this.getCacheKey('stats');

    let stats = this.getFromMemory(cacheKey);
    if (stats && !options.forceRefresh) {
      return { ...stats, cached: true };
    }

    const { data: tables } = await this.get('Type!A2:H', options);

    stats = {
      totalTables: tables.length,
      totalPlayers: tables.reduce((sum, table) => sum + table.players.length, 0),
      pokerRooms: [...new Set(tables.map(t => t.pokerRoom))],
      keyPlayers: tables.reduce((sum, table) =>
        sum + table.players.filter(p => p.isKeyPlayer).length, 0
      ),
      averageChips: Math.round(
        tables.reduce((sum, table) =>
          sum + table.players.reduce((pSum, p) => pSum + p.currentChips, 0), 0
        ) / tables.reduce((sum, table) => sum + table.players.length, 0) || 0
      ),
      nationalities: this.getNationalityStats(tables),
      lastUpdated: new Date().toISOString()
    };

    // 통계는 2분 캐시
    this.setInMemory(cacheKey, stats, { ttl: 2 * 60 * 1000 });

    return { ...stats, cached: false };
  }

  /**
   * 국가별 통계 계산
   */
  getNationalityStats(tables) {
    const nationalities = {};
    tables.forEach(table => {
      table.players.forEach(player => {
        const nat = player.nationality || 'Unknown';
        nationalities[nat] = (nationalities[nat] || 0) + 1;
      });
    });

    return Object.entries(nationalities)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10) // 상위 10개국
      .map(([country, count]) => ({ country, count }));
  }

  /**
   * 자동 갱신 시작
   */
  startAutoRefresh(intervalMinutes = 5) {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      try {
        console.log(`🔄 자동 캐시 갱신 시작...`);

        // 주요 데이터만 미리 갱신
        await this.get('Type!A2:H', { forceRefresh: true });
        await this.getStats({ forceRefresh: true });

        console.log(`✅ 캐시 갱신 완료`);
      } catch (error) {
        console.error(`❌ 캐시 갱신 실패:`, error.message);
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`🕐 자동 캐시 갱신 시작: ${intervalMinutes}분 간격`);
  }

  /**
   * 자동 갱신 중지
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏹️ 자동 캐시 갱신 중지');
    }
  }

  /**
   * 캐시 상태 조회
   */
  async getCacheStatus() {
    const memoryKeys = Array.from(this.memoryCache.keys());

    let diskFiles = [];
    try {
      const files = await fs.readdir(this.cacheDir);
      diskFiles = files.filter(f => f.endsWith('.json'));
    } catch {
      diskFiles = [];
    }

    return {
      memory: {
        count: memoryKeys.length,
        keys: memoryKeys
      },
      disk: {
        count: diskFiles.length,
        files: diskFiles
      },
      autoRefresh: !!this.refreshInterval,
      cacheDir: this.cacheDir,
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * 캐시 초기화
   */
  async clearCache(type = 'all') {
    if (type === 'all' || type === 'memory') {
      this.memoryCache.clear();
      console.log('🗑️ 메모리 캐시 초기화');
    }

    if (type === 'all' || type === 'disk') {
      try {
        const files = await fs.readdir(this.cacheDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(this.cacheDir, file));
          }
        }
        console.log('🗑️ 디스크 캐시 초기화');
      } catch (error) {
        console.error('디스크 캐시 초기화 실패:', error.message);
      }
    }
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.stopAutoRefresh();
    this.memoryCache.clear();
  }
}

// 싱글톤 인스턴스
let sheetCacheInstance = null;

export function getSheetCache() {
  if (!sheetCacheInstance) {
    sheetCacheInstance = new SheetCache();
  }
  return sheetCacheInstance;
}

export default SheetCache;