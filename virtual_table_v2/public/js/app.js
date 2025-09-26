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
    currentAction: null,
    // Google Sheets 데이터
    sheetData: null,
    selectedTable: null,
    availablePlayers: []
};

// 전역 테스트 함수 - 브라우저 콘솔에서 사용 가능
window.testActionValidation = function() {
    console.log('🧪 액션 검증 테스트 실행 (콘솔 명령어: testActionValidation())');
    return ActionSystem.testActionValidation();
};

window.runHandTest = function() {
    console.log('🎮 핸드 테스트 시나리오 실행...');

    if (!app.selectedPlayers || app.selectedPlayers.length === 0) {
        console.log('❌ 먼저 플레이어를 선택하고 핸드를 시작해주세요');
        return false;
    }

    // 액션 검증 테스트 실행
    const validationResult = ActionSystem.testActionValidation();

    if (validationResult) {
        console.log('✅ 모든 검증 테스트 통과! 실제 액션을 테스트해보세요.');
        console.log('사용 가능한 액션: selectAction("FOLD"), selectAction("CHECK"), selectAction("CALL") 등');
    }

    return validationResult;
};

// 개발자 도구용 헬퍼 함수들
window.debugActionSystem = function() {
    console.log('📊 ActionSystem 상태:');
    console.log('- 현재 플레이어 인덱스:', ActionSystem.currentPlayerIndex);
    console.log('- 현재 라운드:', ActionSystem.currentRound);
    console.log('- 팟 금액:', ActionSystem.pot);
    console.log('- 현재 베팅:', ActionSystem.currentBet);
    console.log('- 이번 라운드 액션:', ActionSystem.actionsThisRound);
    console.log('- 선택된 플레이어 수:', app.selectedPlayers?.length || 0);
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

    // Google Sheets 연동
    document.getElementById('loadSheetsBtn').addEventListener('click', loadSheetData);
    document.getElementById('pokerRoom').addEventListener('change', onPokerRoomChanged);
    document.getElementById('tableSelect').addEventListener('change', onTableSelected);
    document.getElementById('autoLoadPlayers').addEventListener('click', loadPlayersFromTable);
    document.getElementById('addManualPlayer').addEventListener('click', addManualPlayer);
    document.getElementById('confirmPlayers').addEventListener('click', confirmPlayerSelection);

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
    // 선택된 테이블과 플레이어 확인
    if (!app.selectedTable) {
        showToast('먼저 테이블을 선택해주세요', 'error');
        return;
    }

    if (!app.selectedPlayers || app.selectedPlayers.length === 0) {
        showToast('먼저 플레이어를 선택해주세요', 'error');
        return;
    }

    const dealerButton = parseInt(document.getElementById('dealerButton').value);
    const cameraPosition = parseInt(document.getElementById('cameraPosition').value);
    const initialChips = parseInt(document.getElementById('initialChips').value) || 1000;

    const settings = app.dataService.getSettings();

    // 실제 Google Sheets 데이터를 사용한 핸드 데이터
    const handData = {
        // 테이블 정보
        tableInfo: {
            pokerRoom: app.selectedTable.pokerRoom,
            tableName: app.selectedTable.tableName,
            tableNo: app.selectedTable.tableNo,
            timestamp: new Date().toISOString()
        },

        // 선택된 실제 플레이어 정보
        players: app.selectedPlayers.map(player => ({
            seatNo: player.seatNo,
            name: player.name,
            nationality: player.nationality,
            startingChips: player.currentChips,
            currentChips: player.currentChips,
            isKeyPlayer: player.isKeyPlayer,
            position: getPlayerPosition(player.seatNo, dealerButton)
        })),

        // 핸드 설정
        dealerButton: dealerButton,
        cameraPosition: cameraPosition,
        initialChips: initialChips,

        // 게임 설정
        blinds: {
            small: settings.smallBlind || 1,
            big: settings.bigBlind || 2
        },

        // 액션 기록
        actions: [],

        // 핸드 상태
        status: 'active',
        startTime: new Date().toISOString()
    };

    const handId = app.handLogger.startNewHand(handData);
    app.currentHand = handId;

    // UI 업데이트
    document.getElementById('startHandBtn').style.display = 'none';
    document.getElementById('chipCalculatorSection').style.display = 'block';
    document.getElementById('actionSection').style.display = 'block';
    document.getElementById('completeSection').style.display = 'block';

    // 핸드 정보 표시
    displayHandInfo(handData);

    // ActionSystem 초기화 (Phase 5.2)
    ActionSystem.currentPlayerIndex = 0; // UTG부터 시작 (preflop의 경우)
    ActionSystem.currentRound = 'preflop';
    ActionSystem.pot = 0;
    ActionSystem.currentBet = settings.bigBlind || 2; // 빅블라인드가 첫 베팅
    ActionSystem.actionsThisRound = [];

    // 블라인드 자동 설정
    if (app.selectedPlayers.length >= 2) {
        // 스몰 블라인드 처리
        const sbPlayer = app.selectedPlayers.find(p => p.position === 'SB');
        if (sbPlayer) {
            sbPlayer.currentChips -= (settings.smallBlind || 1);
            ActionSystem.pot += (settings.smallBlind || 1);
        }

        // 빅 블라인드 처리
        const bbPlayer = app.selectedPlayers.find(p => p.position === 'BB');
        if (bbPlayer) {
            bbPlayer.currentChips -= (settings.bigBlind || 2);
            ActionSystem.pot += (settings.bigBlind || 2);
        }
    }

    // ActionSystem UI 업데이트 및 타이머 시작
    ActionSystem.startHandTimer();
    ActionSystem.updateActionUI();

    const playerCount = app.selectedPlayers.length;
    const keyPlayerCount = app.selectedPlayers.filter(p => p.isKeyPlayer).length;

    showToast(`새 핸드 시작 - ${app.selectedTable.pokerRoom} ${app.selectedTable.tableName} #${app.selectedTable.tableNo} (플레이어: ${playerCount}명, 키플레이어: ${keyPlayerCount}명)`, 'success');
}

// 플레이어 포지션 계산 헬퍼 함수
function getPlayerPosition(seatNo, dealerButton) {
    const positions = ['UTG', 'UTG+1', 'MP', 'MP+1', 'CO', 'BTN', 'SB', 'BB'];
    const offset = (seatNo - dealerButton + 8) % 8;
    return positions[offset] || `Seat ${seatNo}`;
}

// 핸드 정보 표시 함수
function displayHandInfo(handData) {
    const handInfoEl = document.querySelector('.hand-info');
    if (handInfoEl) {
        handInfoEl.innerHTML = `
            <h3>🎯 현재 핸드</h3>
            <div class="table-info">
                <strong>${handData.tableInfo.pokerRoom}</strong>
                ${handData.tableInfo.tableName} #${handData.tableInfo.tableNo}
            </div>
            <div class="player-count">
                👥 플레이어: ${handData.players.length}명
                ⭐ 키플레이어: ${handData.players.filter(p => p.isKeyPlayer).length}명
            </div>
            <div class="dealer-info">
                🎲 딜러 버튼: Seat ${handData.dealerButton}
            </div>
            <div class="start-time">
                🕒 시작: ${new Date(handData.startTime).toLocaleTimeString('ko-KR')}
            </div>
        `;
        handInfoEl.style.display = 'block';
    }
}

// 핸드 완료 (향상된 버전)
async function completeHand() {
    const result = document.getElementById('handResult').value;
    const finalChips = parseInt(document.getElementById('finalChips').value) || 0;
    const notes = document.getElementById('handNotes').value;

    // 타이머 정지
    ActionSystem.stopHandTimer();

    app.handLogger.completeHand({
        result,
        finalChips,
        notes
    });

    try {
        await app.handLogger.saveHand();
        showToast('✅ 핸드가 성공적으로 저장되었습니다', 'success');
    } catch (error) {
        console.error('Save hand error:', error);
        showToast('핸드 저장 중 오류 발생 (오프라인 저장됨)', 'warning');
    }

    resetHandUI();
    loadHistory();
    loadStatistics();
}

// 핸드 취소 (향상된 버전)
function cancelHand() {
    if (confirm('현재 핸드를 취소하시겠습니까?')) {
        // 타이머 정지
        ActionSystem.stopHandTimer();

        app.currentHand = null;
        app.handLogger.currentHand = null;
        resetHandUI();
        showToast('❌ 핸드가 취소되었습니다', 'warning');
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

// 액션 기록 시스템 - Phase 5.2 구현
const ActionSystem = {
    currentPlayerIndex: 0,
    currentRound: 'preflop', // preflop, flop, turn, river
    pot: 0,
    currentBet: 0,
    actionsThisRound: [],

    // 액션 가능 여부 확인
    validateAction(action, amount = 0) {
        if (!app.currentHand || !app.selectedPlayers) {
            return { valid: false, message: '활성화된 핸드가 없습니다' };
        }

        const currentPlayer = app.selectedPlayers[this.currentPlayerIndex];
        if (!currentPlayer) {
            return { valid: false, message: '현재 플레이어를 찾을 수 없습니다' };
        }

        switch (action) {
            case 'FOLD':
                return { valid: true };

            case 'CHECK':
                if (this.currentBet > 0) {
                    return { valid: false, message: '베팅이 있을 때는 체크할 수 없습니다' };
                }
                return { valid: true };

            case 'CALL':
                if (this.currentBet === 0) {
                    return { valid: false, message: '콜할 베팅이 없습니다' };
                }
                const callAmount = this.currentBet;
                if (currentPlayer.currentChips < callAmount) {
                    return { valid: false, message: '칩이 부족합니다' };
                }
                return { valid: true, amount: callAmount };

            case 'BET':
                if (this.currentBet > 0) {
                    return { valid: false, message: '이미 베팅이 있습니다' };
                }
                if (amount <= 0) {
                    return { valid: false, message: '베팅 금액을 입력해주세요' };
                }
                if (currentPlayer.currentChips < amount) {
                    return { valid: false, message: '칩이 부족합니다' };
                }
                return { valid: true };

            case 'RAISE':
                if (this.currentBet === 0) {
                    return { valid: false, message: '레이즈할 베팅이 없습니다' };
                }
                const minRaise = this.currentBet * 2;
                if (amount < minRaise) {
                    return { valid: false, message: `최소 레이즈 금액: ${minRaise}` };
                }
                if (currentPlayer.currentChips < amount) {
                    return { valid: false, message: '칩이 부족합니다' };
                }
                return { valid: true };

            case 'ALL_IN':
                return { valid: true, amount: currentPlayer.currentChips };

            default:
                return { valid: false, message: '알 수 없는 액션입니다' };
        }
    },

    // 다음 플레이어 찾기
    getNextPlayerIndex() {
        let nextIndex = (this.currentPlayerIndex + 1) % app.selectedPlayers.length;

        // 폴드한 플레이어들 스킵
        while (nextIndex !== this.currentPlayerIndex) {
            const player = app.selectedPlayers[nextIndex];
            if (player && !player.folded && player.currentChips > 0) {
                return nextIndex;
            }
            nextIndex = (nextIndex + 1) % app.selectedPlayers.length;
        }

        return this.currentPlayerIndex; // 모든 플레이어가 폴드한 경우
    },

    // UI 업데이트 (향상된 버전)
    updateActionUI() {
        // 라운드 정보 업데이트
        this.updateRoundInfo();

        // 현재 플레이어 표시
        const currentPlayer = app.selectedPlayers[this.currentPlayerIndex];
        const playerInfo = document.getElementById('currentPlayerInfo');
        if (playerInfo && currentPlayer) {
            playerInfo.innerHTML = `
                <div class="current-player">
                    <strong>${currentPlayer.name}</strong> (${currentPlayer.position})
                    <br>칩: ${currentPlayer.currentChips.toLocaleString()}
                    <br>좌석: #${currentPlayer.seatNo}
                    ${currentPlayer.isKeyPlayer ? '<br><span style="color:#ffc107;">⭐ KEY</span>' : ''}
                </div>
            `;
        }

        // 팟 금액 표시
        const potInfo = document.getElementById('potInfo');
        if (potInfo) {
            potInfo.innerHTML = `
                <div class="pot-info">
                    <strong>팟: ${this.pot.toLocaleString()}</strong>
                    ${this.currentBet > 0 ? `<br>현재 베팅: ${this.currentBet.toLocaleString()}` : ''}
                </div>
            `;
        }

        // 플레이어 그리드 업데이트
        this.updatePlayersGrid();

        // 액션 히스토리 표시
        this.updateActionHistory();

        // 핸드 타이머 업데이트
        this.updateHandTimer();
    },

    // 라운드 정보 업데이트
    updateRoundInfo() {
        const roundElement = document.getElementById('currentRound');
        if (roundElement) {
            const roundDisplay = {
                'preflop': 'PRE-FLOP',
                'flop': 'FLOP',
                'turn': 'TURN',
                'river': 'RIVER'
            };

            const currentRoundText = roundDisplay[this.currentRound] || 'UNKNOWN';

            if (roundElement.textContent !== currentRoundText) {
                roundElement.classList.add('changing');
                setTimeout(() => {
                    roundElement.textContent = currentRoundText;
                    roundElement.classList.remove('changing');
                }, 500);
            }
        }
    },

    // 플레이어 그리드 업데이트
    updatePlayersGrid() {
        const playersGrid = document.getElementById('playersGrid');
        if (!playersGrid || !app.selectedPlayers) return;

        playersGrid.innerHTML = '';

        app.selectedPlayers.forEach((player, index) => {
            const isActive = index === this.currentPlayerIndex;
            const lastAction = this.actionsThisRound
                .filter(a => a.playerId === player.seatNo)
                .slice(-1)[0];

            const playerCard = document.createElement('div');
            playerCard.className = `player-card ${isActive ? 'active' : ''} ${player.folded ? 'folded' : ''} ${player.allIn ? 'all-in' : ''}`;

            playerCard.innerHTML = `
                <div class="player-card-name">${player.name}</div>
                <div class="player-card-position">${player.position}</div>
                <div class="player-card-chips">${player.currentChips.toLocaleString()}</div>
                ${lastAction ? `<div class="player-card-action ${lastAction.type.toLowerCase()}">${this.getActionDisplayName(lastAction.type)}</div>` : ''}
                ${player.isKeyPlayer ? '<div style="color:#ffc107; font-size:10px;">⭐</div>' : ''}
            `;

            playersGrid.appendChild(playerCard);
        });
    },

    // 핸드 타이머 업데이트
    updateHandTimer() {
        if (!this.handStartTime) {
            this.handStartTime = Date.now();
        }

        const timerElement = document.getElementById('handTimer');
        if (timerElement) {
            const elapsed = Date.now() - this.handStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    },

    // 타이머 시작
    startHandTimer() {
        this.handStartTime = Date.now();
        this.timerInterval = setInterval(() => {
            this.updateHandTimer();
        }, 1000);
    },

    // 타이머 정지
    stopHandTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    // 액션 히스토리 업데이트
    updateActionHistory() {
        const historyElement = document.getElementById('actionHistory');
        if (!historyElement) return;

        const recentActions = this.actionsThisRound.slice(-5); // 최근 5개 액션만
        historyElement.innerHTML = recentActions.map(action => `
            <div class="action-item">
                <span class="player-name">${action.playerName}</span>
                <span class="action-type">${this.getActionDisplayName(action.type)}</span>
                ${action.amount > 0 ? `<span class="action-amount">${action.amount}</span>` : ''}
            </div>
        `).join('');
    },

    // 액션 표시명 변환
    getActionDisplayName(actionType) {
        const names = {
            'FOLD': '폴드',
            'CHECK': '체크',
            'CALL': '콜',
            'BET': '벳',
            'RAISE': '레이즈',
            'ALL_IN': '올인'
        };
        return names[actionType] || actionType;
    },

    // 액션 검증 테스트 함수 (Phase 5.2 - Testing)
    testActionValidation() {
        console.log('🧪 액션 검증 로직 테스트 시작...');

        if (!app.selectedPlayers || app.selectedPlayers.length === 0) {
            console.log('❌ 테스트 실패: 선택된 플레이어가 없습니다');
            return false;
        }

        const testPlayer = app.selectedPlayers[0];
        const originalChips = testPlayer.currentChips;
        const originalBet = this.currentBet;
        let testsPassed = 0;
        let totalTests = 0;

        console.log(`🎯 테스트 플레이어: ${testPlayer.name} (칩: ${testPlayer.currentChips})`);

        // 테스트 1: FOLD (항상 유효해야 함)
        totalTests++;
        const foldTest = this.validateAction('FOLD');
        if (foldTest.valid) {
            console.log('✅ FOLD 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ FOLD 테스트 실패:', foldTest.message);
        }

        // 테스트 2: CHECK (베팅이 없을 때만 유효)
        totalTests++;
        this.currentBet = 0;
        const checkTestValid = this.validateAction('CHECK');
        if (checkTestValid.valid) {
            console.log('✅ CHECK (베팅 없음) 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ CHECK (베팅 없음) 테스트 실패:', checkTestValid.message);
        }

        totalTests++;
        this.currentBet = 100;
        const checkTestInvalid = this.validateAction('CHECK');
        if (!checkTestInvalid.valid) {
            console.log('✅ CHECK (베팅 있음) 무효성 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ CHECK (베팅 있음) 무효성 테스트 실패');
        }

        // 테스트 3: CALL (베팅이 있고 칩이 충분할 때만 유효)
        totalTests++;
        this.currentBet = 500;
        const callTestValid = this.validateAction('CALL');
        if (callTestValid.valid && callTestValid.amount === 500) {
            console.log('✅ CALL (유효한 베팅) 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ CALL (유효한 베팅) 테스트 실패:', callTestValid.message);
        }

        totalTests++;
        this.currentBet = 0;
        const callTestInvalid = this.validateAction('CALL');
        if (!callTestInvalid.valid) {
            console.log('✅ CALL (베팅 없음) 무효성 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ CALL (베팅 없음) 무효성 테스트 실패');
        }

        // 테스트 4: BET (베팅이 없고 금액이 유효할 때만 유효)
        totalTests++;
        this.currentBet = 0;
        const betTestValid = this.validateAction('BET', 1000);
        if (betTestValid.valid) {
            console.log('✅ BET (유효한 금액) 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ BET (유효한 금액) 테스트 실패:', betTestValid.message);
        }

        totalTests++;
        const betTestInvalidAmount = this.validateAction('BET', 0);
        if (!betTestInvalidAmount.valid) {
            console.log('✅ BET (무효한 금액) 무효성 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ BET (무효한 금액) 무효성 테스트 실패');
        }

        totalTests++;
        this.currentBet = 500;
        const betTestInvalidExistingBet = this.validateAction('BET', 1000);
        if (!betTestInvalidExistingBet.valid) {
            console.log('✅ BET (기존 베팅 있음) 무효성 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ BET (기존 베팅 있음) 무효성 테스트 실패');
        }

        // 테스트 5: RAISE (베팅이 있고 최소 레이즈 금액 이상일 때만 유효)
        totalTests++;
        this.currentBet = 500;
        const raiseTestValid = this.validateAction('RAISE', 1000);
        if (raiseTestValid.valid) {
            console.log('✅ RAISE (유효한 금액) 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ RAISE (유효한 금액) 테스트 실패:', raiseTestValid.message);
        }

        totalTests++;
        const raiseTestInvalidAmount = this.validateAction('RAISE', 600);
        if (!raiseTestInvalidAmount.valid) {
            console.log('✅ RAISE (최소 금액 미달) 무효성 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ RAISE (최소 금액 미달) 무효성 테스트 실패');
        }

        totalTests++;
        this.currentBet = 0;
        const raiseTestNoBet = this.validateAction('RAISE', 1000);
        if (!raiseTestNoBet.valid) {
            console.log('✅ RAISE (베팅 없음) 무효성 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ RAISE (베팅 없음) 무효성 테스트 실패');
        }

        // 테스트 6: ALL_IN (항상 유효하고 모든 칩을 사용)
        totalTests++;
        const allInTest = this.validateAction('ALL_IN');
        if (allInTest.valid && allInTest.amount === testPlayer.currentChips) {
            console.log('✅ ALL_IN 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ ALL_IN 테스트 실패:', allInTest.message);
        }

        // 테스트 7: 칩 부족 상황
        totalTests++;
        testPlayer.currentChips = 100;
        this.currentBet = 500;
        const insufficientChipsTest = this.validateAction('CALL');
        if (!insufficientChipsTest.valid) {
            console.log('✅ 칩 부족 테스트 통과');
            testsPassed++;
        } else {
            console.log('❌ 칩 부족 테스트 실패');
        }

        // 원래 상태 복원
        testPlayer.currentChips = originalChips;
        this.currentBet = originalBet;

        // 테스트 결과 출력
        console.log(`\n🎯 테스트 완료: ${testsPassed}/${totalTests} 통과`);
        if (testsPassed === totalTests) {
            console.log('🎉 모든 액션 검증 테스트 성공!');
            showToast('🎉 액션 검증 테스트 완료: 모든 테스트 통과!', 'success');
            return true;
        } else {
            console.log('⚠️ 일부 테스트 실패');
            showToast(`⚠️ 액션 검증 테스트: ${testsPassed}/${totalTests} 통과`, 'warning');
            return false;
        }
    }
};

// 액션 선택 (향상된 버전)
function selectAction(action) {
    console.log(`🎯 액션 선택됨: ${action}`);

    // 액션 검증
    const validation = ActionSystem.validateAction(action);
    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }

    app.currentAction = action;

    // 금액이 필요한 액션인지 확인
    if (['BET', 'RAISE'].includes(action)) {
        document.getElementById('actionAmountSection').style.display = 'block';
        const amountInput = document.getElementById('actionAmount');

        // 기본값 설정
        if (action === 'RAISE' && ActionSystem.currentBet > 0) {
            amountInput.value = ActionSystem.currentBet * 2; // 최소 레이즈
        } else if (action === 'BET') {
            amountInput.value = Math.min(1000, app.selectedPlayers[ActionSystem.currentPlayerIndex]?.currentChips || 0);
        }

        amountInput.focus();
        amountInput.select();
    } else if (action === 'CALL') {
        // 콜의 경우 즉시 실행 (금액 자동 계산)
        executeAction(action, ActionSystem.currentBet);
    } else if (action === 'ALL_IN') {
        // 올인의 경우 즉시 실행 (모든 칩)
        const currentPlayer = app.selectedPlayers[ActionSystem.currentPlayerIndex];
        executeAction(action, currentPlayer?.currentChips || 0);
    } else {
        // 폴드, 체크는 즉시 실행
        executeAction(action, 0);
    }
}

// 액션 확인 (향상된 버전)
function confirmAction() {
    const amount = parseInt(document.getElementById('actionAmount').value) || 0;

    // 다시 한번 검증
    const validation = ActionSystem.validateAction(app.currentAction, amount);
    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }

    executeAction(app.currentAction, amount);

    // UI 리셋
    document.getElementById('actionAmountSection').style.display = 'none';
    document.getElementById('actionAmount').value = '';
    app.currentAction = null;
}

// 액션 실행 (새로운 함수)
function executeAction(actionType, amount) {
    const currentPlayer = app.selectedPlayers[ActionSystem.currentPlayerIndex];
    if (!currentPlayer) {
        showToast('현재 플레이어를 찾을 수 없습니다', 'error');
        return;
    }

    console.log(`🎮 액션 실행: ${currentPlayer.name} - ${actionType} ${amount > 0 ? amount : ''}`);

    // 액션 데이터 생성
    const actionData = {
        playerId: currentPlayer.seatNo,
        playerName: currentPlayer.name,
        type: actionType,
        amount: amount,
        timestamp: new Date().toISOString(),
        round: ActionSystem.currentRound,
        position: currentPlayer.position
    };

    // 플레이어 상태 업데이트
    switch (actionType) {
        case 'FOLD':
            currentPlayer.folded = true;
            break;
        case 'CALL':
        case 'BET':
        case 'RAISE':
        case 'ALL_IN':
            currentPlayer.currentChips -= amount;
            ActionSystem.pot += amount;
            if (actionType === 'BET' || actionType === 'RAISE') {
                ActionSystem.currentBet = amount;
            }
            if (currentPlayer.currentChips === 0) {
                currentPlayer.allIn = true;
            }
            break;
    }

    // 액션 기록
    ActionSystem.actionsThisRound.push(actionData);

    // HandLogger에 액션 추가
    if (app.handLogger && app.handLogger.addAction) {
        app.handLogger.addAction(actionData);
    }

    // UI 업데이트
    ActionSystem.updateActionUI();

    // 성공 메시지
    const actionMsg = ActionSystem.getActionDisplayName(actionType);
    const amountMsg = amount > 0 ? ` (${amount})` : '';
    showToast(`${currentPlayer.name}: ${actionMsg}${amountMsg}`, 'success');

    // 다음 플레이어로 넘어가기
    setTimeout(() => {
        ActionSystem.currentPlayerIndex = ActionSystem.getNextPlayerIndex();
        ActionSystem.updateActionUI();

        // 라운드 종료 확인
        checkRoundCompletion();
    }, 1500);
}

// 라운드 완료 확인
function checkRoundCompletion() {
    const activePlayers = app.selectedPlayers.filter(p => !p.folded && p.currentChips > 0);

    if (activePlayers.length <= 1) {
        // 핸드 종료
        showToast('핸드가 종료되었습니다', 'info');
        document.getElementById('actionSection').style.display = 'none';
        document.getElementById('completeSection').style.display = 'block';
        return;
    }

    // 모든 플레이어가 같은 금액을 베팅했는지 확인
    const needMoreActions = activePlayers.some(p => {
        const lastAction = ActionSystem.actionsThisRound
            .filter(a => a.playerId === p.seatNo)
            .slice(-1)[0];

        if (!lastAction) return true;
        if (lastAction.type === 'FOLD') return false;

        // 베팅 라운드가 끝났는지 확인하는 로직
        return false; // 단순화된 로직
    });

    if (!needMoreActions) {
        // 다음 라운드로 진행
        nextRound();
    }
}

// 다음 라운드 진행 (향상된 버전)
function nextRound() {
    const rounds = ['preflop', 'flop', 'turn', 'river'];
    const currentIndex = rounds.indexOf(ActionSystem.currentRound);

    if (currentIndex < rounds.length - 1) {
        const nextRound = rounds[currentIndex + 1];

        // 라운드 전환 애니메이션
        const roundElement = document.getElementById('currentRound');
        if (roundElement) {
            roundElement.classList.add('changing');
        }

        // 라운드 상태 업데이트
        ActionSystem.currentRound = nextRound;
        ActionSystem.currentBet = 0;
        ActionSystem.actionsThisRound = [];
        ActionSystem.currentPlayerIndex = 0; // SB부터 시작

        // UI 업데이트
        setTimeout(() => {
            ActionSystem.updateActionUI();
            if (roundElement) {
                roundElement.classList.remove('changing');
            }
        }, 500);

        const roundNames = {
            'flop': 'FLOP (3장 공개)',
            'turn': 'TURN (4번째 카드)',
            'river': 'RIVER (5번째 카드)'
        };

        showToast(`${roundNames[nextRound] || nextRound.toUpperCase()} 라운드 시작`, 'info');
    } else {
        // 쇼다운
        ActionSystem.stopHandTimer();
        showToast('🏆 쇼다운! 핸드 완료', 'success');
        document.getElementById('actionSection').style.display = 'none';
        document.getElementById('completeSection').style.display = 'block';
    }
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

// Google Sheets 데이터 로드
async function loadSheetData() {
    try {
        showToast('Sheet 데이터 로딩 중...', 'info');

        // 연결 테스트
        const testResult = await app.dataService.testSheetConnection();
        if (!testResult.success) {
            showToast('Sheet 연결 실패: ' + testResult.error, 'error');
            updateSyncStatus('offline');
            return;
        }

        // 데이터 로드
        const tables = await app.dataService.loadSheetData();

        if (tables && tables.length > 0) {
            app.sheetData = tables;
            updateSyncStatus('online');

            // 포커룸 목록 추출 (중복 제거)
            const pokerRooms = [...new Set(tables.map(t => t.pokerRoom))];

            // 테이블 드롭다운 업데이트
            const tableSelect = document.getElementById('tableSelect');
            tableSelect.innerHTML = '<option value="">-- 테이블 선택 --</option>';

            // 현재 선택된 포커룸의 테이블만 표시
            const selectedPokerRoom = document.getElementById('pokerRoom').value;
            const filteredTables = selectedPokerRoom
                ? tables.filter(t => t.pokerRoom === selectedPokerRoom)
                : tables;

            filteredTables.forEach((table, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${table.tableName} (${table.tableChip})`;
                option.dataset.tableData = JSON.stringify(table);
                tableSelect.appendChild(option);
            });

            showToast(`${tables.length}개 테이블 로드 완료`, 'success');
        } else {
            showToast('로드된 테이블이 없습니다', 'warning');
            updateSyncStatus('online');
        }
    } catch (error) {
        console.error('Sheet 로드 실패:', error);
        showToast('Sheet 로드 실패', 'error');
        updateSyncStatus('offline');
    }
}

// 테이블 선택 시 처리
function onTableSelected() {
    const tableSelect = document.getElementById('tableSelect');
    const selectedOption = tableSelect.selectedOptions[0];

    if (selectedOption && selectedOption.value) {
        const tableData = JSON.parse(selectedOption.dataset.tableData);
        app.selectedTable = tableData;

        // 테이블 정보 표시
        document.getElementById('tableInfo').style.display = 'block';
        document.getElementById('playerCount').textContent = tableData.players ? tableData.players.length : 0;
        document.getElementById('avgChips').textContent = tableData.tableChip || '0';

        // 플레이어 선택 섹션 표시
        document.getElementById('playerSelectionSection').style.display = 'block';

        showToast(`${tableData.tableName} 테이블 선택됨`, 'info');
    } else {
        document.getElementById('tableInfo').style.display = 'none';
        document.getElementById('playerSelectionSection').style.display = 'none';
        app.selectedTable = null;
    }
}

// 테이블에서 플레이어 자동 로드
function loadPlayersFromTable() {
    if (!app.selectedTable) {
        showToast('먼저 테이블을 선택해주세요', 'warning');
        return;
    }

    if (!app.selectedTable.players || app.selectedTable.players.length === 0) {
        showToast('선택된 테이블에 플레이어가 없습니다', 'warning');
        return;
    }

    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';

    app.selectedTable.players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <label>
                <input type="checkbox" value="${player.name}" checked>
                ${player.name} (${player.nationality || 'Unknown'}) - ${player.currentChips || 0} chips
            </label>
        `;
        playerList.appendChild(playerItem);
    });

    showToast(`${app.selectedTable.players.length}명의 플레이어 로드됨`, 'success');
}

// 동기화 상태 업데이트
function updateSyncStatus(status) {
    const syncStatus = document.getElementById('syncStatus');
    const statusDot = syncStatus.querySelector('.status-dot');

    if (status === 'online') {
        syncStatus.innerHTML = '<span class="status-dot" style="background: #28a745;"></span>온라인';
        syncStatus.classList.add('online');
        syncStatus.classList.remove('offline');
    } else {
        syncStatus.innerHTML = '<span class="status-dot" style="background: #dc3545;"></span>오프라인';
        syncStatus.classList.add('offline');
        syncStatus.classList.remove('online');
    }
}

// 포커룸 변경 시 테이블 필터링
function onPokerRoomChanged() {
    if (!app.sheetData || app.sheetData.length === 0) {
        showToast('먼저 Sheet 데이터를 로드해주세요', 'warning');
        return;
    }

    if (app.sheetData && app.sheetData.length > 0) {
        const tableSelect = document.getElementById('tableSelect');
        const selectedPokerRoom = document.getElementById('pokerRoom').value;

        tableSelect.innerHTML = '<option value="">-- 테이블 선택 --</option>';

        const filteredTables = selectedPokerRoom
            ? app.sheetData.filter(t => t.pokerRoom === selectedPokerRoom)
            : app.sheetData;

        filteredTables.forEach((table, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${table.tableName} (${table.tableChip})`;
            option.dataset.tableData = JSON.stringify(table);
            tableSelect.appendChild(option);
        });

        if (filteredTables.length > 0) {
            showToast(`${filteredTables.length}개 테이블 필터됨`, 'info');
        } else {
            showToast('해당 포커룸에 테이블이 없습니다', 'warning');
        }
    }
}

// 플레이어 확정
function confirmPlayerSelection() {
    const checkedPlayers = [];
    document.querySelectorAll('#playerList input[type="checkbox"]:checked').forEach(checkbox => {
        checkedPlayers.push(checkbox.value);
    });

    if (checkedPlayers.length > 0) {
        app.selectedPlayers = checkedPlayers;
        showToast(`${checkedPlayers.length}명 플레이어 확정`, 'success');

        // 핸드 시작 가능하도록 설정
        document.getElementById('startHandBtn').disabled = false;
    } else {
        showToast('최소 1명의 플레이어를 선택하세요', 'warning');
    }
}

// 수동 플레이어 추가
function addManualPlayer() {
    const playerName = document.getElementById('manualPlayerName').value.trim();

    if (playerName) {
        const playerList = document.getElementById('playerList');
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <label>
                <input type="checkbox" value="${playerName}" checked>
                ${playerName} (수동 추가)
            </label>
        `;
        playerList.appendChild(playerItem);

        document.getElementById('manualPlayerName').value = '';
        showToast(`${playerName} 추가됨`, 'success');
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