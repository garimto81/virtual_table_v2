/**
 * DataService - 데이터 관리 서비스
 * API 통신, 캐싱, 오프라인 지원을 담당하는 데이터 계층
 */

export class DataService {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || '/api';
    this.cache = new Map();
    this.cacheTimeout = config.cacheTimeout || 300000; // 5분
    this.offlineMode = false;
    this.pendingRequests = [];
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;

    // 로컬 스토리지 키
    this.storageKeys = {
      authToken: 'vdc_auth_token',
      refreshToken: 'vdc_refresh_token',
      userData: 'vdc_user_data',
      offlineData: 'vdc_offline_data',
      settings: 'vdc_settings'
    };

    // 온라인/오프라인 이벤트 리스너
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  /**
   * API 요청 수행
   * @param {string} endpoint - API 엔드포인트
   * @param {Object} options - fetch 옵션
   * @returns {Promise} API 응답
   */
  async request(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const token = this.getAuthToken();

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    // 캐시 확인 (GET 요청만)
    if (options.method === 'GET' || !options.method) {
      const cached = this.getFromCache(url);
      if (cached) {
        return cached;
      }
    }

    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        const response = await fetch(url, finalOptions);

        // 토큰 만료 처리
        if (response.status === 401) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // 토큰 갱신 후 재시도
            finalOptions.headers.Authorization = `Bearer ${this.getAuthToken()}`;
            continue;
          } else {
            // 로그아웃 처리
            this.logout();
            throw new Error('Authentication failed');
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // 성공한 GET 요청 캐싱
        if (options.method === 'GET' || !options.method) {
          this.setCache(url, data);
        }

        return data;
      } catch (error) {
        retries++;

        if (retries >= this.maxRetries) {
          // 오프라인 모드 처리
          if (this.isNetworkError(error)) {
            this.handleOffline();
            return this.handleOfflineRequest(endpoint, options);
          }
          throw error;
        }

        // 재시도 전 대기
        await this.delay(this.retryDelay * retries);
      }
    }
  }

  /**
   * 인증 관련 메서드
   */
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (response.success) {
      this.setAuthToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
      this.setUserData(response.data.user);
    }

    return response;
  }

  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (response.success) {
      this.setAuthToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
      this.setUserData(response.data.user);
    }

    return response;
  }

  async refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await this.request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      });

      if (response.success) {
        this.setAuthToken(response.data.accessToken);
        this.setRefreshToken(response.data.refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  logout() {
    this.clearAuthToken();
    this.clearRefreshToken();
    this.clearUserData();
    this.cache.clear();
  }

  /**
   * 핸드 관련 메서드
   */
  async saveHand(handData) {
    return this.request('/hands', {
      method: 'POST',
      body: JSON.stringify(handData)
    });
  }

  async getHand(handId) {
    return this.request(`/hands/${handId}`);
  }

  async getHands(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/hands${queryString ? `?${queryString}` : ''}`);
  }

  async updateHand(handId, updates) {
    return this.request(`/hands/${handId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteHand(handId) {
    return this.request(`/hands/${handId}`, {
      method: 'DELETE'
    });
  }

  async addHandAction(handId, action) {
    return this.request(`/hands/${handId}/actions`, {
      method: 'POST',
      body: JSON.stringify(action)
    });
  }

  async completeHand(handId, result) {
    return this.request(`/hands/${handId}/complete`, {
      method: 'PUT',
      body: JSON.stringify(result)
    });
  }

  async getHandStats() {
    return this.request('/hands/stats/summary');
  }

  /**
   * Google Sheets 관련 메서드
   */
  async readSheet(range) {
    return this.request(`/sheets/read?range=${encodeURIComponent(range)}`);
  }

  async appendToSheet(range, values) {
    return this.request('/sheets/append', {
      method: 'POST',
      body: JSON.stringify({ range, values })
    });
  }

  async updateSheet(range, values) {
    return this.request('/sheets/update', {
      method: 'PUT',
      body: JSON.stringify({ range, values })
    });
  }

  async clearSheet(range) {
    return this.request(`/sheets/clear?range=${encodeURIComponent(range)}`, {
      method: 'DELETE'
    });
  }

  async batchUpdateSheet(requests) {
    return this.request('/sheets/batch', {
      method: 'POST',
      body: JSON.stringify({ requests })
    });
  }

  /**
   * 캐시 관리 메서드
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached) {
      const { data, timestamp } = cached;
      const age = Date.now() - timestamp;

      if (age < this.cacheTimeout) {
        return data;
      } else {
        this.cache.delete(key);
      }
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // 캐시 크기 제한 (100개)
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * 로컬 스토리지 관리
   */
  getAuthToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.storageKeys.authToken);
  }

  setAuthToken(token) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.storageKeys.authToken, token);
  }

  clearAuthToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.storageKeys.authToken);
  }

  getRefreshToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.storageKeys.refreshToken);
  }

  setRefreshToken(token) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.storageKeys.refreshToken, token);
  }

  clearRefreshToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.storageKeys.refreshToken);
  }

  getUserData() {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(this.storageKeys.userData);
    return data ? JSON.parse(data) : null;
  }

  setUserData(user) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.storageKeys.userData, JSON.stringify(user));
  }

  clearUserData() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.storageKeys.userData);
  }

  getSettings() {
    if (typeof window === 'undefined') return {};
    const settings = localStorage.getItem(this.storageKeys.settings);
    return settings ? JSON.parse(settings) : {};
  }

  saveSettings(settings) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.storageKeys.settings, JSON.stringify(settings));
  }

  /**
   * 오프라인 지원
   */
  handleOffline() {
    this.offlineMode = true;
    console.log('Switched to offline mode');
  }

  handleOnline() {
    this.offlineMode = false;
    console.log('Back online, syncing data...');
    this.syncOfflineData();
  }

  handleOfflineRequest(endpoint, options) {
    // 오프라인 요청 큐에 추가
    this.pendingRequests.push({ endpoint, options, timestamp: Date.now() });

    // 로컬 스토리지에 저장
    if (typeof window !== 'undefined') {
      const existing = JSON.parse(
        localStorage.getItem(this.storageKeys.offlineData) || '[]'
      );
      existing.push({ endpoint, options, timestamp: Date.now() });
      localStorage.setItem(this.storageKeys.offlineData, JSON.stringify(existing));
    }

    // 오프라인 응답 반환
    return {
      success: true,
      offline: true,
      message: 'Request saved for sync when online'
    };
  }

  async syncOfflineData() {
    if (typeof window === 'undefined') return;

    const offlineData = JSON.parse(
      localStorage.getItem(this.storageKeys.offlineData) || '[]'
    );

    if (offlineData.length === 0) return;

    const results = [];
    const failed = [];

    for (const request of offlineData) {
      try {
        const result = await this.request(request.endpoint, request.options);
        results.push(result);
      } catch (error) {
        failed.push(request);
        console.error('Sync failed for:', request, error);
      }
    }

    // 실패한 요청만 다시 저장
    if (failed.length > 0) {
      localStorage.setItem(this.storageKeys.offlineData, JSON.stringify(failed));
    } else {
      localStorage.removeItem(this.storageKeys.offlineData);
    }

    console.log(`Synced ${results.length} requests, ${failed.length} failed`);
    return { synced: results.length, failed: failed.length };
  }

  /**
   * 유틸리티 메서드
   */
  isNetworkError(error) {
    return error.message.includes('network') ||
           error.message.includes('fetch') ||
           error.code === 'NETWORK_ERROR';
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 정리
   */
  destroy() {
    this.cache.clear();
    this.pendingRequests = [];

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => this.handleOnline());
      window.removeEventListener('offline', () => this.handleOffline());
    }
  }
}

// 싱글톤 인스턴스
let instance = null;

export const getDataService = (config) => {
  if (!instance) {
    instance = new DataService(config);
  }
  return instance;
};

export default DataService;