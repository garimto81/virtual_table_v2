/**
 * Virtual Data Poker Manager v2.0 - 메인 애플리케이션
 */

// 모듈 임포트 (브라우저 환경용으로 수정)
import { DataService } from './modules/DataService.js';
import { HandLogger } from './modules/HandLogger.js';
import { ChipCalculator } from './modules/ChipCalculator.js';
import { UIManager } from './modules/UIManager.js';

// 전역 상태
const app = {
    dataService: null,
    handLogger: null,
    chipCalculator: null,
    uiManager: null,
    currentUser: null,
    isAuthenticated: false,
    currentHand: null,
    selectedChips: {},
    currentAction: null
};

// 앱 초기화
async function initializeApp() {
    console.log('Initializing Virtual Data Poker Manager v2.0...');

    // 서비스 초기화
    app.dataService = new DataService({
        apiUrl: window.location.origin + '/api'
    });

    app.chipCalculator = new ChipCalculator();

    app.handLogger = new HandLogger(app.dataService, {
        autoSave: true,
        autoSaveInterval: 30000
    });

    app.uiManager = new UIManager();

    // 이벤트 리스너 설정
    setupEventListeners();

    // 로컬 스토리지 확인
    checkLocalStorage();

    // 인증 상태 확인
    await checkAuthStatus();

    // 로딩 화면 숨기기
    hideLoadingScreen();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 로그인/회원가입
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('showRegister').addEventListener('click', showRegisterForm);
    document.getElementById('showLogin').addEventListener('click', showLoginForm);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 탭 네비게이션
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // 핸드 관리
    document.getElementById('startHandBtn').addEventListener('click', startNewHand);
    document.getElementById('completeHandBtn').addEventListener('click', completeHand);
    document.getElementById('cancelHandBtn').addEventListener('click', cancelHand);

    // 칩 계산기
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => addChip(parseInt(e.target.dataset.value)));
    });
    document.getElementById('addCustomChip').addEventListener('click', addCustomChip);
    document.getElementById('clearChips').addEventListener('click', clearChips);

    // 액션 버튼
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => selectAction(e.target.dataset.action));
    });
    document.getElementById('confirmAction').addEventListener('click', confirmAction);

    // 필터 및 검색
    document.getElementById('applyFilter').addEventListener('click', applyHistoryFilter);

    // 설정
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('exportData').addEventListener('click', exportData);
    document.getElementById('importData').addEventListener('click', importData);
    document.getElementById('syncData').addEventListener('click', syncOfflineData);
    document.getElementById('clearData').addEventListener('click', clearAllData);

    // 사이드 메뉴
    document.getElementById('menuBtn').addEventListener('click', openSideMenu);
    document.getElementById('closeMenu').addEventListener('click', closeSideMenu);
    document.getElementById('overlay').addEventListener('click', closeSideMenu);

    // 메뉴 아이템
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            handleMenuAction(e.target.dataset.action);
        });
    });

    // 온라인/오프라인 이벤트
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

// 로그인 처리
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await app.dataService.login(email, password);

        if (response.success) {
            app.currentUser = response.data.user;
            app.isAuthenticated = true;

            showMainScreen();
            showToast('로그인 성공!', 'success');
            updateUserInfo();
            loadUserData();
        } else {
            showToast(response.error || '로그인 실패', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('로그인 중 오류가 발생했습니다', 'error');
    }
}

// 회원가입 처리
async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await app.dataService.register({ name, email, password });

        if (response.success) {
            app.currentUser = response.data.user;
            app.isAuthenticated = true;

            showMainScreen();
            showToast('회원가입 성공!', 'success');
            updateUserInfo();
        } else {
            showToast(response.error || '회원가입 실패', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showToast('회원가입 중 오류가 발생했습니다', 'error');
    }
}

// 로그아웃 처리
function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        app.dataService.logout();
        app.currentUser = null;
        app.isAuthenticated = false;

        showLoginScreen();
        showToast('로그아웃 되었습니다', 'success');
    }
}

// 새 핸드 시작
function startNewHand() {
    const dealerButton = parseInt(document.getElementById('dealerButton').value);
    const cameraPosition = parseInt(document.getElementById('cameraPosition').value);
    const initialChips = parseInt(document.getElementById('initialChips').value) || 1000;

    const settings = app.dataService.getSettings();

    const handId = app.handLogger.startNewHand({
        dealerButton,
        cameraPosition,
        initialChips,
        tableName: settings.tableName || 'Table 1',
        playerCount: settings.playerCount || 9,
        blinds: {
            small: settings.smallBlind || 1,
            big: settings.bigBlind || 2
        }
    });

    app.currentHand = handId;

    // UI 업데이트
    document.getElementById('startHandBtn').style.display = 'none';
    document.getElementById('chipCalculatorSection').style.display = 'block';
    document.getElementById('actionSection').style.display = 'block';
    document.getElementById('completeSection').style.display = 'block';

    showToast('새 핸드를 시작했습니다', 'success');
}

// 핸드 완료
async function completeHand() {
    const result = document.getElementById('handResult').value;
    const finalChips = parseInt(document.getElementById('finalChips').value) || 0;
    const notes = document.getElementById('handNotes').value;

    app.handLogger.completeHand({
        result,
        finalChips,
        notes
    });

    try {
        await app.handLogger.saveHand();
        showToast('핸드가 저장되었습니다', 'success');
    } catch (error) {
        console.error('Save hand error:', error);
        showToast('핸드 저장 중 오류 발생 (오프라인 저장됨)', 'warning');
    }

    resetHandUI();
    loadHistory();
    loadStatistics();
}

// 핸드 취소
function cancelHand() {
    if (confirm('현재 핸드를 취소하시겠습니까?')) {
        app.currentHand = null;
        app.handLogger.currentHand = null;
        resetHandUI();
        showToast('핸드가 취소되었습니다', 'warning');
    }
}

// 칩 추가
function addChip(value) {
    if (!app.selectedChips[value]) {
        app.selectedChips[value] = 0;
    }
    app.selectedChips[value]++;
    updateChipDisplay();
}

// 커스텀 칩 추가
function addCustomChip() {
    const amount = parseInt(document.getElementById('customChipAmount').value);
    if (amount > 0) {
        const optimized = app.chipCalculator.optimizeChips(amount);
        app.selectedChips = app.chipCalculator.addChips(app.selectedChips, optimized);
        updateChipDisplay();
        document.getElementById('customChipAmount').value = '';
    }
}

// 칩 초기화
function clearChips() {
    app.selectedChips = {};
    updateChipDisplay();
}

// 칩 디스플레이 업데이트
function updateChipDisplay() {
    const total = app.chipCalculator.calculateTotal(app.selectedChips);
    const formatted = app.chipCalculator.formatChips(app.selectedChips);

    document.getElementById('chipTotal').textContent = `총합: ${total}`;
    document.getElementById('chipBreakdown').innerHTML = formatted;
}

// 액션 선택
function selectAction(action) {
    app.currentAction = action;

    if (['BET', 'RAISE', 'CALL', 'ALL_IN'].includes(action)) {
        document.getElementById('actionAmountSection').style.display = 'block';
        document.getElementById('actionAmount').focus();
    } else {
        // 금액이 필요없는 액션
        app.handLogger.addAction({
            type: action,
            amount: 0
        });
        showToast(`액션: ${action}`, 'success');
    }
}

// 액션 확인
function confirmAction() {
    const amount = parseInt(document.getElementById('actionAmount').value) || 0;

    app.handLogger.addAction({
        type: app.currentAction,
        amount
    });

    showToast(`액션: ${app.currentAction} - ${amount}`, 'success');

    // UI 리셋
    document.getElementById('actionAmountSection').style.display = 'none';
    document.getElementById('actionAmount').value = '';
    app.currentAction = null;
}

// 히스토리 필터 적용
async function applyHistoryFilter() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const result = document.getElementById('filterResult').value;

    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (result) params.result = result;

    try {
        const response = await app.dataService.getHands(params);
        if (response.success) {
            displayHistory(response.data.hands);
        }
    } catch (error) {
        console.error('Filter error:', error);
    }
}

// 히스토리 표시
function displayHistory(hands) {
    const container = document.getElementById('historyList');
    container.innerHTML = '';

    if (!hands || hands.length === 0) {
        container.innerHTML = '<p>핸드 기록이 없습니다</p>';
        return;
    }

    hands.forEach(hand => {
        const item = document.createElement('div');
        item.className = `history-item ${hand.result}`;
        item.innerHTML = `
            <div><strong>${new Date(hand.timestamp).toLocaleString()}</strong></div>
            <div>결과: ${hand.result} | 수익: ${hand.profit || 0}</div>
            <div>지속시간: ${hand.duration || 0}초</div>
        `;
        container.appendChild(item);
    });
}

// 통계 로드
async function loadStatistics() {
    try {
        const response = await app.dataService.getHandStats();
        if (response.success) {
            const stats = response.data;
            document.getElementById('totalHands').textContent = stats.totalHands;
            document.getElementById('winRate').textContent = stats.winRate + '%';
            document.getElementById('totalProfit').textContent = stats.totalProfit;
            document.getElementById('avgProfit').textContent = stats.averageProfit;
            document.getElementById('vpip').textContent = (stats.vpip || 0) + '%';
            document.getElementById('pfr').textContent = (stats.pfr || 0) + '%';
        }
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// 설정 저장
function saveSettings() {
    const settings = {
        tableName: document.getElementById('tableName').value,
        playerCount: parseInt(document.getElementById('playerCount').value),
        smallBlind: parseInt(document.getElementById('smallBlind').value),
        bigBlind: parseInt(document.getElementById('bigBlind').value)
    };

    app.dataService.saveSettings(settings);
    showToast('설정이 저장되었습니다', 'success');
}

// 데이터 내보내기
async function exportData() {
    try {
        const hands = await app.dataService.getHands();
        const dataStr = JSON.stringify(hands, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `poker-data-${new Date().toISOString()}.json`;
        a.click();

        showToast('데이터를 내보냈습니다', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('내보내기 실패', 'error');
    }
}

// 데이터 가져오기
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // 데이터 처리 로직
                    showToast('데이터를 가져왔습니다', 'success');
                } catch (error) {
                    showToast('잘못된 파일 형식', 'error');
                }
            };
            reader.readAsText(file);
        }
    };

    input.click();
}

// 오프라인 데이터 동기화
async function syncOfflineData() {
    try {
        const result = await app.handLogger.syncOfflineData();
        showToast(`동기화 완료: ${result.synced}개 성공, ${result.failed}개 실패`, 'success');
    } catch (error) {
        console.error('Sync error:', error);
        showToast('동기화 실패', 'error');
    }
}

// 모든 데이터 삭제
function clearAllData() {
    if (confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        localStorage.clear();
        app.handLogger.handHistory = [];
        showToast('모든 데이터가 삭제되었습니다', 'warning');
        loadHistory();
        loadStatistics();
    }
}

// UI 헬퍼 함수
function showLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'flex';
}

function hideLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'none';
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('mainScreen').style.display = 'none';
}

function showMainScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'flex';
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

function switchTab(tabName) {
    // 탭 버튼 업데이트
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // 탭 패널 업데이트
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

function openSideMenu() {
    document.getElementById('sideMenu').classList.add('open');
    document.getElementById('overlay').classList.add('open');
}

function closeSideMenu() {
    document.getElementById('sideMenu').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function resetHandUI() {
    app.currentHand = null;
    app.selectedChips = {};

    document.getElementById('startHandBtn').style.display = 'block';
    document.getElementById('chipCalculatorSection').style.display = 'none';
    document.getElementById('actionSection').style.display = 'none';
    document.getElementById('completeSection').style.display = 'none';
    document.getElementById('actionAmountSection').style.display = 'none';

    document.getElementById('finalChips').value = '';
    document.getElementById('handNotes').value = '';
    document.getElementById('actionAmount').value = '';

    updateChipDisplay();
}

function updateUserInfo() {
    if (app.currentUser) {
        document.getElementById('userName').textContent = app.currentUser.name;
    }
}

function updateConnectionStatus(online) {
    const indicator = document.getElementById('connectionStatus');
    indicator.style.color = online ? '#27ae60' : '#e74c3c';
}

// 로컬 스토리지 확인
function checkLocalStorage() {
    const settings = app.dataService.getSettings();
    if (settings.tableName) {
        document.getElementById('tableName').value = settings.tableName;
        document.getElementById('playerCount').value = settings.playerCount || 9;
        document.getElementById('smallBlind').value = settings.smallBlind || 1;
        document.getElementById('bigBlind').value = settings.bigBlind || 2;
    }
}

// 인증 상태 확인
async function checkAuthStatus() {
    const token = app.dataService.getAuthToken();
    const userData = app.dataService.getUserData();

    if (token && userData) {
        app.currentUser = userData;
        app.isAuthenticated = true;
        showMainScreen();
        updateUserInfo();
        loadUserData();
    } else {
        showLoginScreen();
    }
}

// 사용자 데이터 로드
async function loadUserData() {
    loadHistory();
    loadStatistics();
}

// 히스토리 로드
async function loadHistory() {
    try {
        const response = await app.dataService.getHands({ limit: 20 });
        if (response.success) {
            displayHistory(response.data.hands);
        }
    } catch (error) {
        console.error('Load history error:', error);
        // 오프라인일 경우 로컬 히스토리 표시
        displayHistory(app.handLogger.getHistory({ limit: 20 }));
    }
}

// 메뉴 액션 처리
function handleMenuAction(action) {
    closeSideMenu();

    switch(action) {
        case 'about':
            alert('Virtual Data Poker Manager v2.0\n차세대 포커 핸드 로깅 시스템');
            break;
        case 'help':
            window.open('https://github.com/yourusername/virtual-data-poker/wiki', '_blank');
            break;
        case 'feedback':
            window.open('https://github.com/yourusername/virtual-data-poker/issues', '_blank');
            break;
        case 'version':
            alert('Version 2.0.0\nLast Updated: 2024-02-01');
            break;
    }
}

// 온라인/오프라인 처리
function handleOnline() {
    updateConnectionStatus(true);
    showToast('온라인 상태입니다', 'success');
    syncOfflineData();
}

function handleOffline() {
    updateConnectionStatus(false);
    showToast('오프라인 모드로 전환되었습니다', 'warning');
}

// DOM 로드 완료 시 앱 시작
document.addEventListener('DOMContentLoaded', initializeApp);

// 서비스 워커 등록 (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('Service Worker registered:', reg))
        .catch(err => console.error('Service Worker registration failed:', err));
}