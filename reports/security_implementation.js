/**
 * 포커 핸드 로거 보안 구현 코드
 * Security Implementation for Poker Hand Logger
 */

// ============================================================================
// 1. 강화된 비밀번호 해싱 시스템
// ============================================================================

class SecurePasswordManager {
    constructor() {
        this.iterations = 100000; // PBKDF2 반복 횟수
        this.keyLength = 64; // 해시 길이
        this.algorithm = 'SHA-256';
    }

    async hashPassword(password, salt = null) {
        try {
            // 솔트 생성 (제공되지 않은 경우)
            if (!salt) {
                salt = crypto.getRandomValues(new Uint8Array(32));
            }

            // PBKDF2 키 유도
            const encoder = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(password),
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );

            const hashBuffer = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: this.iterations,
                    hash: this.algorithm
                },
                keyMaterial,
                this.keyLength * 8
            );

            // Base64로 인코딩하여 저장
            const hashArray = new Uint8Array(hashBuffer);
            const saltArray = new Uint8Array(salt);
            
            return {
                hash: this.arrayToBase64(hashArray),
                salt: this.arrayToBase64(saltArray),
                iterations: this.iterations,
                algorithm: this.algorithm
            };

        } catch (error) {
            throw new Error(`비밀번호 해싱 실패: ${error.message}`);
        }
    }

    async verifyPassword(password, storedHash, storedSalt, iterations = null) {
        try {
            const salt = this.base64ToArray(storedSalt);
            const iterationCount = iterations || this.iterations;

            const encoder = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(password),
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );

            const hashBuffer = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: iterationCount,
                    hash: this.algorithm
                },
                keyMaterial,
                this.keyLength * 8
            );

            const computedHash = this.arrayToBase64(new Uint8Array(hashBuffer));
            return this.secureCompare(computedHash, storedHash);

        } catch (error) {
            return false;
        }
    }

    // 타이밍 공격 방지를 위한 상수 시간 비교
    secureCompare(a, b) {
        if (a.length !== b.length) return false;
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    arrayToBase64(array) {
        return btoa(String.fromCharCode.apply(null, array));
    }

    base64ToArray(base64) {
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return array;
    }
}

// ============================================================================
// 2. 입력 검증 및 새니타이제이션
// ============================================================================

class InputValidator {
    constructor() {
        this.patterns = {
            username: /^[a-zA-Z0-9_]{3,20}$/,
            email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            playerName: /^[a-zA-Z0-9가-힣\s]{1,30}$/,
            chipAmount: /^[0-9]{1,10}$/,
            tableId: /^[a-zA-Z0-9_-]{1,20}$/
        };
        
        this.maxLengths = {
            username: 20,
            password: 128,
            playerName: 30,
            gameNote: 500,
            chipAmount: 10
        };
    }

    validateInput(type, value, options = {}) {
        try {
            // null/undefined 체크
            if (value === null || value === undefined) {
                throw new Error(`${type}은(는) 필수 입력값입니다.`);
            }

            // 문자열 변환 및 trim
            const stringValue = String(value).trim();

            // 길이 검사
            if (this.maxLengths[type] && stringValue.length > this.maxLengths[type]) {
                throw new Error(`${type}은(는) ${this.maxLengths[type]}자를 초과할 수 없습니다.`);
            }

            // 패턴 검사
            if (this.patterns[type] && !this.patterns[type].test(stringValue)) {
                throw new Error(`${type}의 형식이 올바르지 않습니다.`);
            }

            // 타입별 추가 검증
            switch (type) {
                case 'chipAmount':
                    return this.validateChipAmount(stringValue, options);
                case 'password':
                    return this.validatePassword(stringValue);
                case 'email':
                    return this.validateEmail(stringValue);
                default:
                    return this.sanitizeString(stringValue);
            }

        } catch (error) {
            throw new Error(`입력 검증 실패 - ${error.message}`);
        }
    }

    validateChipAmount(value, options = {}) {
        const numValue = parseInt(value, 10);
        
        if (isNaN(numValue)) {
            throw new Error('칩 금액은 숫자여야 합니다.');
        }

        // 음수 허용 여부 (부채 상황 처리)
        if (!options.allowNegative && numValue < 0) {
            throw new Error('칩 금액은 음수일 수 없습니다.');
        }

        // 최대값 제한
        if (numValue > 999999999) {
            throw new Error('칩 금액이 너무 큽니다.');
        }

        return numValue;
    }

    validatePassword(password) {
        const requirements = [];
        
        if (password.length < 8) {
            requirements.push('8자 이상');
        }
        if (!/[A-Z]/.test(password)) {
            requirements.push('대문자 포함');
        }
        if (!/[a-z]/.test(password)) {
            requirements.push('소문자 포함');
        }
        if (!/[0-9]/.test(password)) {
            requirements.push('숫자 포함');
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            requirements.push('특수문자 포함');
        }

        if (requirements.length > 0) {
            throw new Error(`비밀번호 요구사항 미충족: ${requirements.join(', ')}`);
        }

        return password;
    }

    validateEmail(email) {
        // 더 엄격한 이메일 검증
        const normalizedEmail = email.toLowerCase();
        
        // 연속된 점 확인
        if (normalizedEmail.includes('..')) {
            throw new Error('이메일에 연속된 점이 포함될 수 없습니다.');
        }

        // 도메인 유효성 검사
        const parts = normalizedEmail.split('@');
        if (parts.length !== 2) {
            throw new Error('올바른 이메일 형식이 아닙니다.');
        }

        const [localPart, domain] = parts;
        
        if (localPart.length > 64 || domain.length > 253) {
            throw new Error('이메일이 너무 깁니다.');
        }

        return normalizedEmail;
    }

    sanitizeString(input) {
        // HTML 태그 제거 및 이스케이프
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // script 태그 제거
            .replace(/[<>&"']/g, (match) => {
                switch (match) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case '"': return '&quot;';
                    case "'": return '&#x27;';
                    default: return match;
                }
            });
    }
}

// ============================================================================
// 3. 세션 관리 및 토큰 시스템
// ============================================================================

class SecureSessionManager {
    constructor() {
        this.tokenExpiry = 15 * 60 * 1000; // 15분
        this.refreshTokenExpiry = 7 * 24 * 60 * 60 * 1000; // 7일
        this.sessionKey = 'poker_session';
        this.refreshKey = 'poker_refresh';
        this.csrfKey = 'poker_csrf';
    }

    async createSession(userId, userAgent, ipAddress) {
        try {
            const sessionId = this.generateSecureId();
            const csrfToken = this.generateSecureId();
            const now = Date.now();

            const sessionData = {
                sessionId: sessionId,
                userId: userId,
                createdAt: now,
                expiresAt: now + this.tokenExpiry,
                userAgent: userAgent,
                ipAddress: ipAddress,
                csrfToken: csrfToken,
                isActive: true
            };

            // 세션 암호화 저장
            const encryptedSession = await this.encryptSessionData(sessionData);
            
            // 안전한 쿠키 설정
            this.setSecureCookie(this.sessionKey, encryptedSession, this.tokenExpiry);
            this.setSecureCookie(this.csrfKey, csrfToken, this.tokenExpiry);

            // 리프레시 토큰 생성
            const refreshToken = await this.createRefreshToken(userId, sessionId);
            this.setSecureCookie(this.refreshKey, refreshToken, this.refreshTokenExpiry);

            return sessionData;

        } catch (error) {
            throw new Error(`세션 생성 실패: ${error.message}`);
        }
    }

    async validateSession() {
        try {
            const encryptedSession = this.getCookie(this.sessionKey);
            const csrfToken = this.getCookie(this.csrfKey);

            if (!encryptedSession || !csrfToken) {
                throw new Error('세션 정보가 없습니다.');
            }

            const sessionData = await this.decryptSessionData(encryptedSession);
            
            // 세션 만료 확인
            if (Date.now() > sessionData.expiresAt) {
                this.destroySession();
                throw new Error('세션이 만료되었습니다.');
            }

            // CSRF 토큰 검증
            if (sessionData.csrfToken !== csrfToken) {
                this.destroySession();
                throw new Error('CSRF 토큰이 일치하지 않습니다.');
            }

            // IP 주소 변경 감지 (선택적)
            const currentIp = this.getCurrentIp();
            if (sessionData.ipAddress !== currentIp) {
                this.logSecurityEvent('IP_ADDRESS_CHANGED', {
                    oldIp: sessionData.ipAddress,
                    newIp: currentIp,
                    userId: sessionData.userId
                });
            }

            return sessionData;

        } catch (error) {
            throw new Error(`세션 검증 실패: ${error.message}`);
        }
    }

    async refreshSession() {
        try {
            const refreshToken = this.getCookie(this.refreshKey);
            if (!refreshToken) {
                throw new Error('리프레시 토큰이 없습니다.');
            }

            // 리프레시 토큰 검증 (서버 측에서)
            const validationResult = await this.validateRefreshToken(refreshToken);
            
            if (!validationResult.isValid) {
                this.destroySession();
                throw new Error('리프레시 토큰이 유효하지 않습니다.');
            }

            // 새 세션 생성
            return await this.createSession(
                validationResult.userId,
                navigator.userAgent,
                this.getCurrentIp()
            );

        } catch (error) {
            throw new Error(`세션 갱신 실패: ${error.message}`);
        }
    }

    destroySession() {
        this.deleteCookie(this.sessionKey);
        this.deleteCookie(this.refreshKey);
        this.deleteCookie(this.csrfKey);
        
        // 서버에 세션 무효화 요청
        this.notifyServerSessionDestroy();
    }

    generateSecureId() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    setSecureCookie(name, value, maxAge) {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict${secure}`;
    }

    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    deleteCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;`;
    }
}

// ============================================================================
// 4. Content Security Policy 및 XSS 방지
// ============================================================================

class XSSProtection {
    constructor() {
        this.allowedTags = ['b', 'i', 'u', 'strong', 'em'];
        this.blockedPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe/gi,
            /<object/gi,
            /<embed/gi
        ];
    }

    sanitizeHTML(html) {
        // 위험한 패턴 제거
        let sanitized = html;
        this.blockedPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });

        // 허용된 태그만 유지
        sanitized = sanitized.replace(/<(\/?)([\w-]+)([^>]*)>/gi, (match, slash, tag, attrs) => {
            if (this.allowedTags.includes(tag.toLowerCase())) {
                return `<${slash}${tag}>`;
            }
            return '';
        });

        return sanitized;
    }

    // DOM 조작 시 안전한 텍스트 삽입
    safeSetTextContent(element, content) {
        // textContent 사용으로 HTML 해석 방지
        element.textContent = content;
    }

    safeSetInnerHTML(element, content) {
        // 검증된 HTML만 삽입
        element.innerHTML = this.sanitizeHTML(content);
    }

    // CSP 헤더 설정 (서버 측)
    getCSPHeader() {
        return "default-src 'self'; " +
               "script-src 'self' 'unsafe-inline' https://apis.google.com https://script.google.com; " +
               "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
               "font-src 'self' https://fonts.gstatic.com; " +
               "img-src 'self' data: https:; " +
               "connect-src 'self' https://script.google.com https://sheets.googleapis.com; " +
               "frame-ancestors 'none'; " +
               "base-uri 'self'; " +
               "form-action 'self'";
    }
}

// ============================================================================
// 5. Rate Limiting 및 DDoS 방지
// ============================================================================

class RateLimiter {
    constructor(maxRequests = 100, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
        this.blockedIps = new Set();
        this.blockDuration = 15 * 60 * 1000; // 15분
    }

    isAllowed(identifier = null) {
        const key = identifier || this.getClientIdentifier();
        
        // 차단된 IP 확인
        if (this.blockedIps.has(key)) {
            return false;
        }

        const now = Date.now();
        const windowStart = now - this.windowMs;

        // 요청 기록 가져오기
        if (!this.requests.has(key)) {
            this.requests.set(key, []);
        }

        const userRequests = this.requests.get(key);
        
        // 만료된 요청 제거
        const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
        this.requests.set(key, validRequests);

        // 요청 수 확인
        if (validRequests.length >= this.maxRequests) {
            this.blockClient(key);
            return false;
        }

        // 새 요청 기록
        validRequests.push(now);
        return true;
    }

    blockClient(identifier) {
        this.blockedIps.add(identifier);
        
        // 차단 해제 타이머
        setTimeout(() => {
            this.blockedIps.delete(identifier);
            this.requests.delete(identifier);
        }, this.blockDuration);

        // 보안 이벤트 로깅
        this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
            identifier: identifier,
            timestamp: Date.now(),
            blockDuration: this.blockDuration
        });
    }

    getClientIdentifier() {
        // IP + User Agent의 해시값 사용
        const identifier = this.getCurrentIp() + navigator.userAgent;
        return this.hashString(identifier);
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit 정수로 변환
        }
        return hash.toString();
    }
}

// ============================================================================
// 6. 보안 이벤트 모니터링
// ============================================================================

class SecurityMonitor {
    constructor() {
        this.eventBuffer = [];
        this.bufferSize = 1000;
        this.alertThresholds = {
            failedLogins: 5,
            suspiciousActivity: 3,
            dataExfiltration: 1
        };
        this.monitoringInterval = 30000; // 30초마다 분석
        
        this.startMonitoring();
    }

    logEvent(eventType, details) {
        const event = {
            timestamp: Date.now(),
            type: eventType,
            details: details,
            sessionId: this.getCurrentSessionId(),
            userId: this.getCurrentUserId(),
            ipAddress: this.getCurrentIp(),
            userAgent: navigator.userAgent
        };

        this.eventBuffer.push(event);
        
        // 버퍼 크기 관리
        if (this.eventBuffer.length > this.bufferSize) {
            this.eventBuffer.shift();
        }

        // 즉시 대응이 필요한 이벤트
        if (this.isCriticalEvent(eventType)) {
            this.handleCriticalEvent(event);
        }

        // 서버로 이벤트 전송
        this.sendEventToServer(event);
    }

    startMonitoring() {
        setInterval(() => {
            this.analyzeEvents();
        }, this.monitoringInterval);
    }

    analyzeEvents() {
        const recentEvents = this.getRecentEvents(5 * 60 * 1000); // 최근 5분
        
        // 패턴 분석
        this.detectFailedLoginPattern(recentEvents);
        this.detectSuspiciousDataAccess(recentEvents);
        this.detectUnusualUserBehavior(recentEvents);
    }

    detectFailedLoginPattern(events) {
        const failedLogins = events.filter(e => e.type === 'LOGIN_FAILED');
        const ipGroups = this.groupByIp(failedLogins);

        for (const [ip, attempts] of ipGroups.entries()) {
            if (attempts.length >= this.alertThresholds.failedLogins) {
                this.triggerAlert('BRUTE_FORCE_ATTACK', {
                    ip: ip,
                    attempts: attempts.length,
                    timeSpan: '5분'
                });
            }
        }
    }

    detectSuspiciousDataAccess(events) {
        const dataEvents = events.filter(e => e.type.includes('DATA_ACCESS'));
        const userGroups = this.groupByUser(dataEvents);

        for (const [userId, accesses] of userGroups.entries()) {
            // 비정상적으로 많은 데이터 접근
            if (accesses.length > 100) {
                this.triggerAlert('SUSPICIOUS_DATA_ACCESS', {
                    userId: userId,
                    accessCount: accesses.length,
                    timeSpan: '5분'
                });
            }

            // 비정상 시간 접근
            const offHoursAccess = accesses.filter(this.isOffHours);
            if (offHoursAccess.length > 10) {
                this.triggerAlert('OFF_HOURS_ACCESS', {
                    userId: userId,
                    accessCount: offHoursAccess.length
                });
            }
        }
    }

    isCriticalEvent(eventType) {
        const criticalEvents = [
            'UNAUTHORIZED_ACCESS',
            'DATA_BREACH_ATTEMPT',
            'SYSTEM_COMPROMISE',
            'MALICIOUS_FILE_UPLOAD'
        ];
        return criticalEvents.includes(eventType);
    }

    handleCriticalEvent(event) {
        // 즉시 알림 발송
        this.sendImmediateAlert(event);
        
        // 세션 무효화 (필요한 경우)
        if (event.type === 'SYSTEM_COMPROMISE') {
            this.invalidateAllSessions();
        }
        
        // 자동 차단 (필요한 경우)
        if (event.type === 'UNAUTHORIZED_ACCESS') {
            this.autoBlockUser(event.details.userId);
        }
    }

    triggerAlert(alertType, details) {
        const alert = {
            type: alertType,
            severity: this.getAlertSeverity(alertType),
            timestamp: Date.now(),
            details: details
        };

        // 알림 발송
        this.sendAlert(alert);
        
        // 관리자 대시보드 업데이트
        this.updateSecurityDashboard(alert);
    }
}

// 전역 보안 관리자 인스턴스
window.SecurityManager = {
    passwordManager: new SecurePasswordManager(),
    inputValidator: new InputValidator(),
    sessionManager: new SecureSessionManager(),
    xssProtection: new XSSProtection(),
    rateLimiter: new RateLimiter(),
    securityMonitor: new SecurityMonitor()
};

// 사용 예시
console.log('🔒 포커 핸드 로거 보안 시스템 초기화 완료');