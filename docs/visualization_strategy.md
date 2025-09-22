# 포커 핸드 로거 시스템 - 데이터 시각화 전략

## 개요
포커 핸드 로거 시스템의 데이터를 효과적으로 시각화하여 사용자에게 직관적이고 실행 가능한 인사이트를 제공하는 종합적인 시각화 전략입니다.

## 1. 대시보드 아키텍처

### 1.1 대시보드 계층 구조
```
레벨 1: 경영진 대시보드 (Executive Dashboard)
├── 핵심 비즈니스 KPI
├── 수익성 트렌드
└── 시스템 상태 요약

레벨 2: 운영 대시보드 (Operations Dashboard)
├── 실시간 테이블 모니터링
├── 플레이어 활동 추적
└── 이상 탐지 알림

레벨 3: 분석 대시보드 (Analytics Dashboard)
├── 플레이어 행동 분석
├── 게임 패턴 인사이트
└── 예측 모델 결과

레벨 4: 개인 대시보드 (Player Dashboard)
├── 개인 성과 추적
├── 스타일 분석
└── 개선 권장사항
```

### 1.2 시각화 도구 스택
- **프론트엔드**: React + D3.js + Chart.js
- **실시간 데이터**: WebSocket + Redis
- **대시보드 플랫폼**: Grafana + Plotly Dash
- **모바일**: React Native + Victory Charts

## 2. 핵심 시각화 컴포넌트

### 2.1 실시간 모니터링 차트

#### A. 시스템 상태 대시보드
```json
{
  "layout": "grid-4x3",
  "components": [
    {
      "type": "metric-card",
      "title": "활성 플레이어",
      "data_source": "v_realtime_system_status.active_players",
      "threshold": {"warning": 50, "critical": 20},
      "trend": "24h"
    },
    {
      "type": "line-chart",
      "title": "시간당 핸드 수",
      "x_axis": "시간",
      "y_axis": "핸드 수",
      "data_source": "hourly_hands_aggregation",
      "update_interval": "5min"
    },
    {
      "type": "gauge-chart",
      "title": "시스템 상태",
      "value_source": "system_health_score",
      "ranges": [
        {"min": 0, "max": 50, "color": "red", "label": "Critical"},
        {"min": 50, "max": 80, "color": "yellow", "label": "Warning"},
        {"min": 80, "max": 100, "color": "green", "label": "Healthy"}
      ]
    },
    {
      "type": "heat-map",
      "title": "테이블 활동 히트맵",
      "x_axis": "시간",
      "y_axis": "테이블",
      "color_scale": "hands_per_hour",
      "update_interval": "1min"
    }
  ]
}
```

#### B. 수익성 트렌드 차트
```json
{
  "revenue_dashboard": {
    "main_chart": {
      "type": "multi-line-chart",
      "title": "수익 트렌드",
      "series": [
        {"name": "일일 수익", "data_source": "daily_revenue"},
        {"name": "누적 수익", "data_source": "cumulative_revenue"},
        {"name": "목표 대비", "data_source": "target_vs_actual"}
      ],
      "annotations": ["주요 이벤트", "시스템 업데이트"]
    },
    "breakdown_charts": [
      {
        "type": "pie-chart",
        "title": "테이블별 수익 분포",
        "data_source": "revenue_by_table"
      },
      {
        "type": "bar-chart",
        "title": "시간대별 수익",
        "data_source": "revenue_by_hour"
      }
    ]
  }
}
```

### 2.2 플레이어 분석 시각화

#### A. 플레이어 성과 대시보드
```python
# 플레이어 스타일 레이더 차트 설정
player_style_radar = {
    "type": "radar-chart",
    "dimensions": [
        {"name": "VPIP", "max": 100, "optimal_range": [18, 28]},
        {"name": "PFR", "max": 50, "optimal_range": [14, 22]},
        {"name": "Aggression Factor", "max": 10, "optimal_range": [2, 4]},
        {"name": "WTSD", "max": 50, "optimal_range": [25, 35]},
        {"name": "W$SD", "max": 100, "optimal_range": [50, 60]},
        {"name": "3-Bet", "max": 20, "optimal_range": [5, 10]}
    ],
    "series": [
        {"name": "현재 스타일", "color": "#ff6b35"},
        {"name": "최적 범위", "color": "#004e89", "type": "range"}
    ]
}

# 포지션별 수익성 히트맵
positional_heatmap = {
    "type": "heatmap",
    "x_axis": ["UTG", "UTG+1", "MP", "MP+1", "CO", "BTN", "SB", "BB"],
    "y_axis": ["AA-TT", "99-22", "AK-AJ", "KQ-K9", "Suited", "Offsuit"],
    "color_scale": "profit_per_hand",
    "tooltips": {
        "template": "포지션: {x}<br>핸드: {y}<br>수익: ${z:.2f}<br>샘플: {count}핸드"
    }
}
```

#### B. 시간대별 성과 분석
```json
{
  "temporal_analysis": {
    "hourly_performance": {
      "type": "line-chart-with-bands",
      "title": "시간대별 성과",
      "x_axis": "시간 (0-23)",
      "y_axis": "시간당 평균 수익",
      "confidence_bands": true,
      "overlays": [
        {"type": "average-line", "color": "blue"},
        {"type": "trend-line", "color": "red", "style": "dashed"}
      ]
    },
    "session_length_analysis": {
      "type": "scatter-plot",
      "title": "세션 길이 vs 수익성",
      "x_axis": "세션 길이 (분)",
      "y_axis": "세션 수익",
      "point_size": "핸드 수",
      "color_scale": "시간대",
      "regression_line": true
    }
  }
}
```

### 2.3 이상 탐지 시각화

#### A. 이상 행동 타임라인
```json
{
  "anomaly_timeline": {
    "type": "timeline-chart",
    "title": "이상 행동 탐지 타임라인",
    "events": [
      {
        "type": "anomaly",
        "severity": "high|medium|low",
        "icon": "warning|info|error",
        "details": "hover_tooltip"
      }
    ],
    "filters": ["플레이어", "이상 유형", "심각도"],
    "grouping": "플레이어별|시간별|유형별"
  }
}
```

#### B. 리스크 스코어 매트릭스
```python
risk_matrix = {
    "type": "bubble-chart",
    "title": "플레이어 리스크 매트릭스",
    "x_axis": "이상 빈도",
    "y_axis": "최대 이상 점수",
    "bubble_size": "총 핸드 수",
    "color_scale": "리스크 레벨",
    "quadrants": {
        "high_frequency_high_score": {"label": "즉시 조치 필요", "color": "red"},
        "low_frequency_high_score": {"label": "모니터링 필요", "color": "orange"},
        "high_frequency_low_score": {"label": "패턴 분석", "color": "yellow"},
        "low_frequency_low_score": {"label": "정상", "color": "green"}
    }
}
```

## 3. 인터랙티브 기능

### 3.1 필터링 및 드릴다운
```javascript
// 다차원 필터링 시스템
const filterSystem = {
  temporal: {
    type: "date-range-slider",
    presets: ["1일", "7일", "30일", "90일", "1년"],
    granularity: "시간|일|주|월"
  },
  player: {
    type: "multi-select-dropdown",
    search: true,
    categories: ["활성도", "스킬레벨", "지역"]
  },
  table: {
    type: "checkbox-group",
    options: ["사이트별", "블라인드별", "타입별"]
  },
  metrics: {
    type: "toggle-buttons",
    options: ["수익", "핸드수", "시간", "VPIP", "PFR"]
  }
};

// 드릴다운 네비게이션
const drilldownPath = [
  "전체 시스템 → 사이트별 → 테이블별 → 플레이어별 → 핸드별",
  "플레이어 목록 → 개별 플레이어 → 세션별 → 핸드별 → 액션별"
];
```

### 3.2 실시간 업데이트
```javascript
// WebSocket 기반 실시간 데이터 스트리밍
const realtimeConfig = {
  connections: {
    system_status: {
      endpoint: "ws://api/realtime/system",
      update_frequency: "5s",
      components: ["active_players", "hands_per_minute", "system_health"]
    },
    player_activity: {
      endpoint: "ws://api/realtime/players",
      update_frequency: "10s",
      components: ["leaderboard", "active_sessions"]
    },
    anomaly_alerts: {
      endpoint: "ws://api/realtime/anomalies",
      update_frequency: "immediate",
      components: ["alert_feed", "risk_scores"]
    }
  },
  fallback: {
    strategy: "polling",
    interval: "30s"
  }
};
```

## 4. 모바일 최적화

### 4.1 반응형 레이아웃
```css
/* 모바일 우선 디자인 */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* 터치 친화적 인터페이스 */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  padding: 12px;
}
```

### 4.2 모바일 전용 컴포넌트
```json
{
  "mobile_widgets": [
    {
      "type": "swipe-cards",
      "title": "주요 메트릭",
      "cards": ["수익", "핸드수", "세션시간", "순위"]
    },
    {
      "type": "bottom-sheet",
      "title": "상세 분석",
      "collapsible": true,
      "content": "detailed_charts"
    },
    {
      "type": "floating-action-button",
      "actions": ["새로고침", "필터", "공유", "알림설정"]
    }
  ]
}
```

## 5. 접근성 및 사용성

### 5.1 색상 및 시각적 접근성
```javascript
// 색맹 친화적 색상 팔레트
const colorPalettes = {
  primary: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"],
  accessible: ["#0173b2", "#de8f05", "#029e73", "#cc78bc", "#ca9161"],
  high_contrast: ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"]
};

// 패턴 및 텍스처 지원
const visualPatterns = {
  line_styles: ["solid", "dashed", "dotted", "dash-dot"],
  fill_patterns: ["diagonal", "dots", "horizontal", "vertical"],
  symbols: ["circle", "square", "triangle", "diamond", "star"]
};
```

### 5.2 키보드 내비게이션
```javascript
// 키보드 단축키
const keyboardShortcuts = {
  "Ctrl+R": "새로고침",
  "Ctrl+F": "필터 열기",
  "Ctrl+D": "대시보드 변경",
  "Ctrl+E": "데이터 내보내기",
  "Esc": "모달 닫기",
  "Tab": "다음 요소로 이동",
  "Enter": "선택/활성화",
  "Space": "체크박스 토글"
};
```

## 6. 성능 최적화

### 6.1 데이터 로딩 전략
```javascript
// 지연 로딩 및 가상화
const performanceOptimizations = {
  lazy_loading: {
    enabled: true,
    threshold: "viewport + 200px",
    placeholder: "skeleton_loader"
  },
  virtualization: {
    enabled: true,
    row_height: 50,
    buffer_size: 5,
    apply_to: ["large_tables", "long_lists"]
  },
  caching: {
    strategy: "stale-while-revalidate",
    duration: "5m",
    invalidation: ["data_change", "manual_refresh"]
  }
};
```

### 6.2 차트 렌더링 최적화
```javascript
// Canvas vs SVG 선택 로직
const renderingStrategy = {
  point_threshold: 1000, // 1000개 이상 데이터 포인트시 Canvas 사용
  canvas_charts: ["scatter_plot", "heatmap", "large_timeseries"],
  svg_charts: ["bar_chart", "pie_chart", "small_line_chart"],
  webgl_charts: ["3d_scatter", "large_network_graph"]
};

// 데이터 샘플링
const dataSampling = {
  strategy: "adaptive",
  max_points: 5000,
  algorithms: ["lttb", "reservoir", "uniform"],
  preserve_peaks: true
};
```

## 7. 사용자 경험 개선

### 7.1 상황별 도움말
```json
{
  "contextual_help": {
    "tooltips": {
      "trigger": "hover|click|focus",
      "content": "dynamic|static",
      "position": "auto|top|bottom|left|right"
    },
    "guided_tour": {
      "new_user": "기본 기능 소개",
      "feature_announcement": "새 기능 하이라이트",
      "advanced_features": "고급 분석 기능"
    },
    "help_panel": {
      "searchable": true,
      "categories": ["기본사용법", "분석방법", "문제해결"],
      "video_tutorials": true
    }
  }
}
```

### 7.2 개인화 설정
```javascript
// 사용자 커스터마이제이션
const personalization = {
  dashboard_layout: {
    drag_and_drop: true,
    resize_widgets: true,
    save_layouts: true,
    templates: ["beginner", "advanced", "analyst", "manager"]
  },
  preferences: {
    theme: ["light", "dark", "auto"],
    language: ["ko", "en", "ja", "zh"],
    timezone: "auto_detect",
    number_format: "locale_specific"
  },
  notifications: {
    channels: ["email", "sms", "push", "in_app"],
    frequency: ["real_time", "hourly", "daily", "weekly"],
    thresholds: "user_configurable"
  }
};
```

## 8. 내보내기 및 공유

### 8.1 리포트 생성
```python
# 자동 리포트 생성 설정
report_templates = {
    "executive_summary": {
        "frequency": "weekly",
        "format": "pdf",
        "sections": ["key_metrics", "trends", "recommendations"],
        "distribution": ["email", "dashboard_download"]
    },
    "player_analysis": {
        "frequency": "on_demand",
        "format": ["pdf", "excel", "csv"],
        "customizable": True,
        "sections": ["performance", "style_analysis", "recommendations"]
    },
    "operational_report": {
        "frequency": "daily",
        "format": "excel",
        "sections": ["system_status", "anomalies", "revenue"],
        "automation": True
    }
}
```

### 8.2 데이터 내보내기
```javascript
// 유연한 데이터 내보내기
const exportOptions = {
  formats: ["csv", "excel", "json", "pdf"],
  scope: ["current_view", "filtered_data", "all_data"],
  customization: {
    columns: "user_selectable",
    date_range: "configurable",
    formatting: "locale_aware"
  },
  scheduling: {
    enabled: true,
    frequencies: ["daily", "weekly", "monthly"],
    delivery: ["email", "ftp", "api"]
  }
};
```

## 9. 구현 우선순위

### Phase 1 (MVP) - 4주
1. 기본 실시간 대시보드
2. 플레이어 성과 차트
3. 시스템 상태 모니터링
4. 기본 필터링

### Phase 2 (Enhancement) - 6주
1. 고급 분석 차트
2. 이상 탐지 시각화
3. 모바일 최적화
4. 개인화 기능

### Phase 3 (Advanced) - 8주
1. 예측 모델 시각화
2. 고급 인터랙션
3. 자동 리포트
4. API 통합

## 10. 기술 스택 상세

### 프론트엔드
- **React 18** + TypeScript
- **D3.js v7** (커스텀 시각화)
- **Chart.js v4** (표준 차트)
- **Plotly.js** (3D 및 고급 차트)
- **Material-UI v5** (UI 컴포넌트)

### 백엔드 & 데이터
- **PostgreSQL** (메인 데이터베이스)
- **Redis** (캐싱 및 실시간 데이터)
- **WebSocket** (실시간 통신)
- **FastAPI** (API 서버)

### 모니터링 & 배포
- **Grafana** (운영 대시보드)
- **Prometheus** (메트릭 수집)
- **Docker** (컨테이너화)
- **Nginx** (리버스 프록시)

이 시각화 전략을 통해 포커 핸드 로거 시스템의 복잡한 데이터를 직관적이고 실행 가능한 인사이트로 변환하여 사용자에게 제공할 수 있습니다.