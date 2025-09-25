/**
 * Google Sheets 데이터 실시간 뷰어
 * .env의 SPREADSHEET_ID 시트를 로드하여 표시
 */

export class SheetViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentData = null;
    this.autoRefresh = null;
    this.init();
  }

  async init() {
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
            <span class="stat-label">연결 상태</span>
            <span class="stat-value" id="connection-status">🔍 확인중...</span>
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
  }

  async loadSheetData(forceRefresh = false) {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    try {
      // 1. 연결 테스트
      const connectionTest = await fetch('/api/sheets/test');
      const testResult = await connectionTest.json();

      document.getElementById('connection-status').innerHTML =
        testResult.success ? '🟢 연결됨' : '🔴 오프라인';

      // 2. 실제 시트 데이터 로드
      const response = await fetch('/api/sheets/read?range=Type!A2:H');
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

    const tablesHTML = this.currentData.map((table, index) => `
      <div class="table-card" data-table-index="${index}">
        <div class="table-header">
          <h4>🎰 ${table.pokerRoom} - ${table.tableName}</h4>
          <span class="table-id">테이블: ${table.tableNo}</span>
        </div>

        <div class="players-grid">
          ${table.players.map(player => `
            <div class="player-card ${player.isKeyPlayer ? 'key-player' : ''}">
              <div class="player-seat">좌석 ${player.seatNo}</div>
              <div class="player-name">${player.name}</div>
              <div class="player-details">
                <span class="nationality">${player.nationality}</span>
                <span class="chips">💰 ${this.formatChips(player.currentChips)}</span>
              </div>
              ${player.isKeyPlayer ? '<div class="key-player-badge">⭐ 주요플레이어</div>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    tablesContainer.innerHTML = tablesHTML;
  }

  updateStats() {
    if (!this.currentData) return;

    const tableCount = this.currentData.length;
    const playerCount = this.currentData.reduce((sum, table) => sum + table.players.length, 0);

    document.getElementById('table-count').textContent = tableCount;
    document.getElementById('player-count').textContent = playerCount;
  }

  formatChips(amount) {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toLocaleString();
  }

  startAutoRefresh() {
    this.autoRefresh = setInterval(() => {
      this.loadSheetData();
    }, 5000); // 5초마다
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
  max-width: 1200px;
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
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  border-left: 4px solid #007bff;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.table-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 5px solid #007bff;
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

@media (max-width: 768px) {
  .sheet-header {
    flex-direction: column;
    gap: 15px;
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