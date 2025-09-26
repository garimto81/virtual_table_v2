/**
 * Google Sheets 데이터 실시간 뷰어
 * .env의 SPREADSHEET_ID 시트를 로드하여 표시
 */

export class SheetViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentData = null;
    this.autoRefresh = null;
    this.connectionTested = false; // 연결 테스트 상태 추적
    this.init();
  }

  async init() {
    this.sortBy = 'table'; // 기본 정렬: 테이블 번호
    this.filterBy = 'all'; // 기본 필터: 모두 표시
    this.createUI();
    await this.loadSheetData();
    this.startAutoRefresh();
  }

  createUI() {
    this.container.innerHTML = `
      <div class="sheet-viewer">
        <div class="sheet-header">
          <h3>📊 Type 시트 데이터</h3>
          <div class="sheet-controls">
            <button id="refresh-btn" class="btn-refresh">🔄 새로고침</button>
            <button id="sync-toggle" class="btn-sync">⏸️ 자동동기화</button>
            <span class="last-updated">마지막 업데이트: --</span>
          </div>
        </div>

        <div class="sheet-stats">
          <div class="stat-card">
            <span class="stat-label">테이블 수</span>
            <span class="stat-value" id="table-count">-</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">플레이어 수</span>
            <span class="stat-value" id="player-count">-</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">키플레이어</span>
            <span class="stat-value" id="keyplayer-count">-</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">연결 상태</span>
            <span class="stat-value" id="connection-status">🔍 확인중...</span>
          </div>
        </div>

        <!-- 필터 및 정렬 컨트롤 -->
        <div class="filter-controls">
          <div class="filter-group">
            <label>🔍 필터:</label>
            <select id="filter-select">
              <option value="all">모든 테이블</option>
              <option value="keyplayers">키플레이어 있는 테이블</option>
              <option value="high-stakes">고액 테이블 (>100K 평균)</option>
            </select>
          </div>
          <div class="sort-group">
            <label>📊 정렬:</label>
            <select id="sort-select">
              <option value="table">테이블 번호순</option>
              <option value="players">플레이어 수 많은순</option>
              <option value="chips">평균 칩 많은순</option>
              <option value="keyplayers">키플레이어 우선</option>
            </select>
          </div>
        </div>

        <div class="sheet-content">
          <div class="loading" id="loading">⏳ 시트 데이터 로딩 중...</div>
          <div class="sheet-tables" id="sheet-tables"></div>
        </div>
      </div>
    `;

    // 이벤트 리스너
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadSheetData(true);
    });

    document.getElementById('sync-toggle').addEventListener('click', () => {
      this.toggleAutoRefresh();
    });

    document.getElementById('filter-select').addEventListener('change', (e) => {
      this.filterBy = e.target.value;
      this.renderTables();
    });

    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.renderTables();
    });
  }

  async loadSheetData(forceRefresh = false, skipConnectionTest = false) {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    try {
      // 1. 연결 테스트 (첫 로드 또는 강제 새로고침 시에만)
      if (!skipConnectionTest && (forceRefresh || !this.connectionTested)) {
        try {
          const connectionTest = await fetch('/api/sheets/test');
          if (!connectionTest.ok) {
            throw new Error(`HTTP ${connectionTest.status}: ${connectionTest.statusText}`);
          }
          const testResult = await connectionTest.json();

          document.getElementById('connection-status').innerHTML =
            testResult.success ? '🟢 연결됨' : '🔴 오프라인';

          this.connectionTested = true;
        } catch (testError) {
          console.warn('Connection test failed:', testError);
          document.getElementById('connection-status').innerHTML = '🟡 테스트 실패';
        }
      }

      // 2. 실제 시트 데이터 로드
      const response = await fetch('/api/sheets/read?range=Type!A2:H');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();

      if (result.success) {
        this.currentData = result.data;
        this.renderTables();
        this.updateStats();

        document.querySelector('.last-updated').textContent =
          `마지막 업데이트: ${new Date().toLocaleTimeString()}`;
      } else {
        throw new Error(result.error || '시트 데이터 로드 실패');
      }

    } catch (error) {
      console.error('시트 로드 오류:', error);
      document.getElementById('sheet-tables').innerHTML = `
        <div class="error-message">
          ❌ 시트 데이터를 불러올 수 없습니다: ${error.message}
          <br><br>
          <div class="error-details">
            <strong>해결 방법:</strong>
            <ul>
              <li>1. Apps Script URL이 올바른지 확인</li>
              <li>2. Google Sheets 권한 설정 확인</li>
              <li>3. 스프레드시트 ID: <code>${this.getSpreadsheetId()}</code></li>
            </ul>
          </div>
        </div>
      `;
    } finally {
      loading.style.display = 'none';
    }
  }

  renderTables() {
    const tablesContainer = document.getElementById('sheet-tables');

    if (!this.currentData || this.currentData.length === 0) {
      tablesContainer.innerHTML = '<div class="empty-state">📋 표시할 테이블이 없습니다</div>';
      return;
    }

    // 데이터 복사 및 필터링
    let filteredData = [...this.currentData];

    // 필터 적용
    switch (this.filterBy) {
      case 'keyplayers':
        filteredData = filteredData.filter(table =>
          table.players.some(p => p.isKeyPlayer)
        );
        break;
      case 'high-stakes':
        filteredData = filteredData.filter(table => {
          const avgChips = table.players.reduce((sum, p) => sum + p.currentChips, 0) / table.players.length;
          return avgChips > 100000;
        });
        break;
    }

    // 정렬 적용
    switch (this.sortBy) {
      case 'players':
        filteredData.sort((a, b) => b.players.length - a.players.length);
        break;
      case 'chips':
        filteredData.sort((a, b) => {
          const avgA = a.players.reduce((sum, p) => sum + p.currentChips, 0) / a.players.length;
          const avgB = b.players.reduce((sum, p) => sum + p.currentChips, 0) / b.players.length;
          return avgB - avgA;
        });
        break;
      case 'keyplayers':
        filteredData.sort((a, b) => {
          const keyA = a.players.filter(p => p.isKeyPlayer).length;
          const keyB = b.players.filter(p => p.isKeyPlayer).length;
          return keyB - keyA;
        });
        break;
      default: // table
        filteredData.sort((a, b) => parseInt(a.tableNo) - parseInt(b.tableNo));
    }

    if (filteredData.length === 0) {
      tablesContainer.innerHTML = '<div class="empty-state">🔍 필터 조건에 맞는 테이블이 없습니다</div>';
      return;
    }

    const tablesHTML = filteredData.map((table, index) => {
      const avgChips = table.players.reduce((sum, p) => sum + p.currentChips, 0) / table.players.length;
      const keyPlayerCount = table.players.filter(p => p.isKeyPlayer).length;

      // 플레이어를 좌석 번호순으로 정렬
      const sortedPlayers = [...table.players].sort((a, b) => a.seatNo - b.seatNo);

      return `
        <div class="table-card ${avgChips > 100000 ? 'high-stakes' : ''}" data-table-index="${index}">
          <div class="table-header">
            <h4>🎰 ${table.pokerRoom} - ${table.tableName}</h4>
            <div class="table-info">
              <span class="table-id">테이블 #${table.tableNo}</span>
              <span class="player-count">👥 ${table.players.length}명</span>
              ${keyPlayerCount > 0 ? `<span class="key-count">⭐ ${keyPlayerCount}</span>` : ''}
              <span class="avg-chips">💰 평균: ${this.formatChips(avgChips)}</span>
            </div>
          </div>

          <div class="players-grid">
            ${sortedPlayers.map(player => `
              <div class="player-card ${player.isKeyPlayer ? 'key-player' : ''}"
                   data-chips="${player.currentChips}">
                <div class="player-seat">좌석 ${player.seatNo}</div>
                <div class="player-name">${player.name}</div>
                <div class="player-details">
                  <span class="nationality flag-${player.nationality}">${player.nationality}</span>
                  <span class="chips">💰 ${this.formatChips(player.currentChips)}</span>
                </div>
                ${player.isKeyPlayer ? '<div class="key-player-badge">⭐ KEY</div>' : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    tablesContainer.innerHTML = tablesHTML;

    // 애니메이션 효과 추가
    setTimeout(() => {
      document.querySelectorAll('.table-card').forEach((card, i) => {
        card.style.animation = `fadeInUp 0.4s ease ${i * 0.05}s forwards`;
        card.style.opacity = '0';
      });
    }, 10);
  }

  updateStats() {
    if (!this.currentData) return;

    const tableCount = this.currentData.length;
    const playerCount = this.currentData.reduce((sum, table) => sum + table.players.length, 0);
    const keyPlayerCount = this.currentData.reduce((sum, table) =>
      sum + table.players.filter(p => p.isKeyPlayer).length, 0
    );

    document.getElementById('table-count').textContent = tableCount;
    document.getElementById('player-count').textContent = playerCount;
    document.getElementById('keyplayer-count').textContent = keyPlayerCount;
  }

  formatChips(amount) {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toLocaleString();
  }

  startAutoRefresh() {
    this.autoRefresh = setInterval(() => {
      this.loadSheetData(false, true); // 자동 새로고침 시에는 연결 테스트 스킵
    }, 60000); // 60초마다 (API 호출량 92% 감소)
  }

  toggleAutoRefresh() {
    const button = document.getElementById('sync-toggle');

    if (this.autoRefresh) {
      clearInterval(this.autoRefresh);
      this.autoRefresh = null;
      button.innerHTML = '▶️ 자동동기화';
      button.classList.remove('active');
    } else {
      this.startAutoRefresh();
      button.innerHTML = '⏸️ 자동동기화';
      button.classList.add('active');
    }
  }

  getSpreadsheetId() {
    // 환경 변수는 클라이언트에서 직접 접근 불가하므로 서버에서 제공해야 함
    return 'SPREADSHEET_ID (서버 설정)';
  }

  destroy() {
    if (this.autoRefresh) {
      clearInterval(this.autoRefresh);
    }
  }
}

// CSS 스타일
const styles = `
.sheet-viewer {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;
}

.sheet-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-refresh, .btn-sync {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-refresh {
  background: #007bff;
  color: white;
}

.btn-refresh:hover {
  background: #0056b3;
}

.btn-sync {
  background: #28a745;
  color: white;
}

.btn-sync.active {
  background: #ffc107;
  color: black;
}

.sheet-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-label {
  display: block;
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
}

.table-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 5px solid #007bff;
  transition: all 0.3s;
}

.table-card.high-stakes {
  border-left-color: #dc3545;
  background: linear-gradient(to right, #fff5f5 0%, white 10%);
}

.table-card:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.player-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  position: relative;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.player-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.player-card.key-player {
  border-color: #ffd700;
  background: linear-gradient(135deg, #fff8dc 0%, #f8f9fa 100%);
}

.player-seat {
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.player-name {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 8px;
}

.player-details {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.nationality {
  background: #007bff;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.chips {
  color: #28a745;
  font-weight: bold;
}

.key-player-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ffd700;
  color: #333;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: bold;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #dc3545;
}

.error-details {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #f5c6cb;
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #999;
  font-size: 18px;
}

/* 필터 컨트롤 */
.filter-controls {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  flex-wrap: wrap;
}

.filter-group, .sort-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-group label, .sort-group label {
  font-weight: 600;
  color: #495057;
}

.filter-group select, .sort-group select {
  padding: 6px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

/* 애니메이션 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.last-updated {
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
}

@media (max-width: 768px) {
  .sheet-header {
    flex-direction: column;
    gap: 15px;
  }

  .filter-controls {
    flex-direction: column;
  }

  .players-grid {
    grid-template-columns: 1fr;
  }
}
`;

// 스타일 주입
if (!document.getElementById('sheet-viewer-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'sheet-viewer-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}