# 포커 핸드 로거 보안 아키텍처

## 1. 다층 인증 시스템 (Multi-Factor Authentication)

```javascript
// JWT 기반 인증 토큰 관리
class AuthenticationManager {
    constructor() {
        this.tokenKey = 'poker_auth_token';
        this.refreshKey = 'poker_refresh_token';
        this.maxLoginAttempts = 5;
        this.lockoutDuration = 15 * 60 * 1000; // 15분
    }

    async login(username, password, mfaCode = null) {
        try {
            // 로그인 시도 횟수 체크
            if (this.isAccountLocked(username)) {
                throw new Error('계정이 일시적으로 잠금되었습니다. 15분 후 다시 시도하세요.');
            }

            const loginData = {
                username: this.sanitizeInput(username),
                password: password,
                mfaCode: mfaCode,
                deviceFingerprint: await this.generateDeviceFingerprint(),
                timestamp: Date.now()
            };

            const response = await this.secureApiCall('/auth/login', loginData);
            
            if (response.success) {
                this.clearLoginAttempts(username);
                this.storeTokens(response.accessToken, response.refreshToken);
                this.startTokenRefreshTimer();
                return response;
            }
        } catch (error) {
            this.recordLoginAttempt(username);
            throw error;
        }
    }

    generateDeviceFingerprint() {
        // 디바이스 고유 식별자 생성
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            canvas.toDataURL()
        ].join('|');
        
        return this.hashString(fingerprint);
    }
}
```

## 2. 데이터 암호화 전략

```python
# 서버 사이드 암호화 (Apps Script 구현 예시)
class DataEncryption:
    def __init__(self):
        self.encryption_key = self.get_encryption_key()
        self.field_encryption_map = {
            'player_chips': True,
            'game_results': True,
            'player_notes': True,
            'card_data': True
        }
    
    def encrypt_sensitive_data(self, data_dict):
        """민감한 데이터 필드별 암호화"""
        encrypted_data = {}
        
        for field, value in data_dict.items():
            if self.field_encryption_map.get(field, False):
                # AES-256-GCM 암호화
                encrypted_data[field] = self.aes_encrypt(str(value))
            else:
                encrypted_data[field] = value
                
        return encrypted_data
    
    def decrypt_sensitive_data(self, encrypted_dict):
        """민감한 데이터 복호화"""
        decrypted_data = {}
        
        for field, value in encrypted_dict.items():
            if self.field_encryption_map.get(field, False):
                decrypted_data[field] = self.aes_decrypt(value)
            else:
                decrypted_data[field] = value
                
        return decrypted_data
    
    def aes_encrypt(self, plaintext):
        """AES-256-GCM 암호화 구현"""
        # Google Apps Script에서 CryptoJS 라이브러리 사용
        # 실제 구현에서는 Google Cloud KMS 연동 권장
        pass
```

## 3. API 보안 강화

```javascript
// API 요청 보안 미들웨어
class SecureApiClient {
    constructor() {
        this.baseUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
        this.rateLimiter = new RateLimiter(100, 60000); // 분당 100회 제한
        this.requestQueue = [];
        this.circuitBreaker = new CircuitBreaker();
    }

    async secureRequest(endpoint, data, options = {}) {
        // Rate limiting 체크
        if (!this.rateLimiter.allowRequest()) {
            throw new Error('API 요청 한도 초과. 잠시 후 다시 시도하세요.');
        }

        // Circuit breaker 패턴
        if (this.circuitBreaker.isOpen()) {
            throw new Error('서비스 일시 중단. 잠시 후 다시 시도하세요.');
        }

        // 요청 서명 생성
        const timestamp = Date.now();
        const nonce = this.generateNonce();
        const signature = await this.signRequest(data, timestamp, nonce);

        const securePayload = {
            ...data,
            timestamp: timestamp,
            nonce: nonce,
            signature: signature,
            sessionToken: this.getSessionToken()
        };

        // CSRF 토큰 추가
        if (options.includeCsrf) {
            securePayload.csrfToken = this.getCsrfToken();
        }

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-Request-ID': this.generateRequestId(),
                    'X-Client-Version': APP_VERSION
                },
                body: JSON.stringify(securePayload)
            });

            this.circuitBreaker.recordSuccess();
            return await this.processResponse(response);

        } catch (error) {
            this.circuitBreaker.recordFailure();
            this.logSecurityEvent('API_REQUEST_FAILED', { endpoint, error: error.message });
            throw error;
        }
    }

    async signRequest(data, timestamp, nonce) {
        // HMAC-SHA256 서명 생성
        const message = JSON.stringify(data) + timestamp + nonce;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(this.getSigningKey()),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
        return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
```

## 4. 실시간 통신 보안

```javascript
// WebSocket 보안 연결 관리
class SecureWebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.heartbeatInterval = null;
        this.encryptionKey = null;
    }

    async connect() {
        try {
            // WSS 사용 강제
            const wsUrl = `wss://your-secure-websocket-server.com/poker-logger`;
            
            this.ws = new WebSocket(wsUrl, ['poker-protocol-v1']);
            
            this.ws.onopen = () => {
                this.authenticate();
                this.startHeartbeat();
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                this.handleSecureMessage(event.data);
            };

            this.ws.onclose = (event) => {
                this.handleDisconnection(event);
            };

            this.ws.onerror = (error) => {
                this.logSecurityEvent('WEBSOCKET_ERROR', { error: error.message });
            };

        } catch (error) {
            this.logSecurityEvent('WEBSOCKET_CONNECTION_FAILED', { error: error.message });
        }
    }

    async handleSecureMessage(encryptedData) {
        try {
            // 메시지 복호화 및 검증
            const decryptedMessage = await this.decryptMessage(encryptedData);
            const isValid = await this.verifyMessageSignature(decryptedMessage);
            
            if (!isValid) {
                this.logSecurityEvent('INVALID_MESSAGE_SIGNATURE', { 
                    timestamp: Date.now() 
                });
                return;
            }

            this.processMessage(JSON.parse(decryptedMessage.data));

        } catch (error) {
            this.logSecurityEvent('MESSAGE_PROCESSING_ERROR', { 
                error: error.message 
            });
        }
    }

    async sendSecureMessage(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket 연결이 활성화되지 않았습니다.');
        }

        // 메시지 암호화 및 서명
        const timestamp = Date.now();
        const messageData = {
            data: data,
            timestamp: timestamp,
            userId: this.getCurrentUserId()
        };

        const signature = await this.signMessage(messageData);
        const encryptedMessage = await this.encryptMessage({
            ...messageData,
            signature: signature
        });

        this.ws.send(encryptedMessage);
    }
}
```

## 5. 감사 로깅 시스템

```python
# 종합적인 보안 로깅 시스템
class SecurityAuditLogger:
    def __init__(self):
        self.log_levels = {
            'INFO': 1,
            'WARNING': 2,
            'ERROR': 3,
            'CRITICAL': 4
        }
        self.sensitive_fields = ['password', 'token', 'key', 'secret']
    
    def log_security_event(self, event_type, details, level='INFO'):
        """보안 이벤트 로깅"""
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'level': level,
            'details': self.sanitize_log_data(details),
            'session_id': self.get_session_id(),
            'user_id': self.get_user_id(),
            'ip_address': self.get_client_ip(),
            'user_agent': self.get_user_agent(),
            'request_id': self.get_request_id()
        }
        
        # 로그 저장 (Google Cloud Logging 연동)
        self.store_log_entry(log_entry)
        
        # 심각한 보안 이벤트의 경우 즉시 알림
        if level in ['ERROR', 'CRITICAL']:
            self.send_security_alert(log_entry)
    
    def sanitize_log_data(self, data):
        """로그 데이터에서 민감 정보 제거"""
        if isinstance(data, dict):
            sanitized = {}
            for key, value in data.items():
                if any(sensitive in key.lower() for sensitive in self.sensitive_fields):
                    sanitized[key] = '[REDACTED]'
                else:
                    sanitized[key] = self.sanitize_log_data(value)
            return sanitized
        elif isinstance(data, list):
            return [self.sanitize_log_data(item) for item in data]
        else:
            return data
    
    def monitor_suspicious_activity(self):
        """의심스러운 활동 모니터링"""
        patterns = [
            'rapid_api_calls',
            'failed_login_attempts',
            'unusual_data_access',
            'large_data_exports',
            'off_hours_access'
        ]
        
        for pattern in patterns:
            if self.detect_pattern(pattern):
                self.log_security_event(
                    f'SUSPICIOUS_ACTIVITY_{pattern.upper()}',
                    {'pattern': pattern, 'severity': 'high'},
                    'WARNING'
                )
```