/**
 * DataService - 브라우저용 데이터 서비스 모듈
 */

export class DataService {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || '/api';
        this.cache = new Map();
        this.cacheTimeout = config.cacheTimeout || 300000;
        this.offlineMode = false;
        this.pendingRequests = [];

        this.storageKeys = {
            authToken: 'vdc_auth_token',
            refreshToken: 'vdc_refresh_token',
            userData: 'vdc_user_data',
            offlineData: 'vdc_offline_data',
            settings: 'vdc_settings'
        };

        // 온라인/오프라인 이벤트 리스너
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

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

        // GET 요청 캐시 확인
        if (!options.method || options.method === 'GET') {
            const cached = this.getFromCache(url);
            if (cached) return cached;
        }

        try {
            const response = await fetch(url, finalOptions);

            if (response.status === 401) {
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    finalOptions.headers.Authorization = `Bearer ${this.getAuthToken()}`;
                    return this.request(endpoint, options);
                } else {
                    this.logout();
                    throw new Error('Authentication failed');
                }
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // GET 요청 캐싱
            if (!options.method || options.method === 'GET') {
                this.setCache(url, data);
            }

            return data;
        } catch (error) {
            if (this.isNetworkError(error)) {
                this.handleOffline();
                return this.handleOfflineRequest(endpoint, options);
            }
            throw error;
        }
    }

    // Google Sheets 데이터 메서드
    async loadSheetData() {
        try {
            const response = await this.request('/sheets/read');
            if (response.success && response.data) {
                console.log('📊 Sheet 데이터 로드 성공:', response.data);
                return response.data;
            }
            return [];
        } catch (error) {
            console.error('Sheet 데이터 로드 실패:', error);
            return [];
        }
    }

    async testSheetConnection() {
        try {
            const response = await this.request('/sheets/test');
            return response;
        } catch (error) {
            console.error('Sheet 연결 테스트 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 인증 메서드
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

    // 핸드 관련 메서드
    async saveHand(handData) {
        return this.request('/hands', {
            method: 'POST',
            body: JSON.stringify(handData)
        });
    }

    async getHands(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/hands${queryString ? `?${queryString}` : ''}`);
    }

    async getHandStats() {
        return this.request('/hands/stats/summary');
    }

    // 로컬 스토리지 관리
    getAuthToken() {
        return localStorage.getItem(this.storageKeys.authToken);
    }

    setAuthToken(token) {
        localStorage.setItem(this.storageKeys.authToken, token);
    }

    clearAuthToken() {
        localStorage.removeItem(this.storageKeys.authToken);
    }

    getRefreshToken() {
        return localStorage.getItem(this.storageKeys.refreshToken);
    }

    setRefreshToken(token) {
        localStorage.setItem(this.storageKeys.refreshToken, token);
    }

    clearRefreshToken() {
        localStorage.removeItem(this.storageKeys.refreshToken);
    }

    getUserData() {
        const data = localStorage.getItem(this.storageKeys.userData);
        return data ? JSON.parse(data) : null;
    }

    setUserData(user) {
        localStorage.setItem(this.storageKeys.userData, JSON.stringify(user));
    }

    clearUserData() {
        localStorage.removeItem(this.storageKeys.userData);
    }

    getSettings() {
        const settings = localStorage.getItem(this.storageKeys.settings);
        return settings ? JSON.parse(settings) : {};
    }

    saveSettings(settings) {
        localStorage.setItem(this.storageKeys.settings, JSON.stringify(settings));
    }

    // 캐시 관리
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached) {
            const { data, timestamp } = cached;
            const age = Date.now() - timestamp;
            if (age < this.cacheTimeout) {
                return data;
            }
            this.cache.delete(key);
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    // 오프라인 지원
    handleOffline() {
        this.offlineMode = true;
    }

    handleOnline() {
        this.offlineMode = false;
        this.syncOfflineData();
    }

    handleOfflineRequest(endpoint, options) {
        this.pendingRequests.push({ endpoint, options, timestamp: Date.now() });

        const existing = JSON.parse(
            localStorage.getItem(this.storageKeys.offlineData) || '[]'
        );
        existing.push({ endpoint, options, timestamp: Date.now() });
        localStorage.setItem(this.storageKeys.offlineData, JSON.stringify(existing));

        return {
            success: true,
            offline: true,
            message: 'Request saved for sync when online'
        };
    }

    async syncOfflineData() {
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
            }
        }

        if (failed.length > 0) {
            localStorage.setItem(this.storageKeys.offlineData, JSON.stringify(failed));
        } else {
            localStorage.removeItem(this.storageKeys.offlineData);
        }

        return { synced: results.length, failed: failed.length };
    }

    isNetworkError(error) {
        return error.message.includes('network') ||
               error.message.includes('fetch') ||
               error.message === 'Failed to fetch';
    }
}

export default DataService;