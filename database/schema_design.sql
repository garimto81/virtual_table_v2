-- ==================================================
-- 포커 핸드 로거 시스템 - 최적화된 데이터베이스 스키마
-- ==================================================
-- PostgreSQL 14+ 기준 설계 (다른 DB 호환성 고려)
-- 성능 최적화: 파티셔닝, 인덱싱, 정규화 균형

-- 1. 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE; -- 시계열 데이터 최적화

-- 2. 기본 ENUM 타입 정의
CREATE TYPE game_type AS ENUM ('CASH', 'TOURNAMENT', 'SIT_N_GO', 'SPIN_N_GO');
CREATE TYPE table_type AS ENUM ('FULL_RING', 'SHORT_HANDED', 'HEADS_UP');
CREATE TYPE action_type AS ENUM ('FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN');
CREATE TYPE street_type AS ENUM ('PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN');
CREATE TYPE position_type AS ENUM ('SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'MP', 'MP1', 'MP2', 'CO', 'BTN');

-- ==================================================
-- 3. 핵심 테이블 설계 (정규화 + 성능 최적화)
-- ==================================================

-- 3.1 플레이어 마스터 테이블
CREATE TABLE players (
    player_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    country_code CHAR(2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ,
    total_hands_played BIGINT DEFAULT 0,
    total_winnings DECIMAL(15,2) DEFAULT 0,
    
    -- 성능 최적화용 계산된 필드들
    avg_vpip DECIMAL(5,2), -- Voluntarily Put in Pot
    avg_pfr DECIMAL(5,2),  -- Pre-Flop Raise
    
    CONSTRAINT uk_players_username UNIQUE (username),
    CONSTRAINT uk_players_email UNIQUE (email)
);

-- 3.2 게임 테이블 (카시노/사이트별)
CREATE TABLE game_tables (
    table_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    site_name VARCHAR(50) NOT NULL,
    game_type game_type NOT NULL,
    table_type table_type NOT NULL,
    max_players SMALLINT NOT NULL CHECK (max_players BETWEEN 2 AND 10),
    small_blind DECIMAL(10,2) NOT NULL,
    big_blind DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- 복합 인덱스를 위한 컬럼 순서 최적화
    CONSTRAINT uk_game_tables_site_name UNIQUE (site_name, table_name)
);

-- 3.3 핸드 히스토리 (파티셔닝 적용)
CREATE TABLE hands (
    hand_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES game_tables(table_id),
    hand_number BIGINT NOT NULL, -- 사이트별 고유 핸드 번호
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    total_pot DECIMAL(15,2),
    rake DECIMAL(10,2),
    button_position position_type,
    num_players SMALLINT CHECK (num_players BETWEEN 2 AND 10),
    
    -- 성능 최적화를 위한 비정규화 필드
    winner_player_id UUID REFERENCES players(player_id),
    winning_hand VARCHAR(20),
    
    -- 검색 최적화용 필드
    year_month INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM started_at) * 100 + EXTRACT(MONTH FROM started_at)) STORED,
    
    CONSTRAINT uk_hands_table_number UNIQUE (table_id, hand_number)
) PARTITION BY RANGE (started_at);

-- 월별 파티셔닝 (자동 관리)
-- 현재 월부터 6개월 파티셔닝 생성
CREATE TABLE hands_2024_09 PARTITION OF hands 
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE hands_2024_10 PARTITION OF hands 
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE hands_2024_11 PARTITION OF hands 
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE hands_2024_12 PARTITION OF hands 
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE hands_2025_01 PARTITION OF hands 
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE hands_2025_02 PARTITION OF hands 
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- 3.4 핸드 참가자 (플레이어-핸드 관계)
CREATE TABLE hand_players (
    hand_player_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hand_id UUID NOT NULL, -- FK는 뷰에서 처리
    player_id UUID NOT NULL REFERENCES players(player_id),
    position position_type NOT NULL,
    starting_chips DECIMAL(15,2) NOT NULL,
    ending_chips DECIMAL(15,2),
    net_winnings DECIMAL(15,2), -- starting_chips - ending_chips
    hole_cards VARCHAR(4), -- 예: 'AhKs'
    showed_cards BOOLEAN DEFAULT false,
    
    -- 성능 최적화용 비정규화
    is_winner BOOLEAN DEFAULT false,
    final_action action_type,
    
    CONSTRAINT uk_hand_players UNIQUE (hand_id, player_id)
) PARTITION BY RANGE ((SELECT started_at FROM hands WHERE hands.hand_id = hand_players.hand_id));

-- hand_players 파티셔닝 (hands와 동일)
CREATE TABLE hand_players_2024_09 PARTITION OF hand_players 
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE hand_players_2024_10 PARTITION OF hand_players 
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE hand_players_2024_11 PARTITION OF hand_players 
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE hand_players_2024_12 PARTITION OF hand_players 
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE hand_players_2025_01 PARTITION OF hand_players 
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE hand_players_2025_02 PARTITION OF hand_players 
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- 3.5 액션 로그 (고성능 시계열 데이터)
CREATE TABLE hand_actions (
    action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hand_id UUID NOT NULL,
    player_id UUID NOT NULL REFERENCES players(player_id),
    street street_type NOT NULL,
    action_type action_type NOT NULL,
    amount DECIMAL(15,2), -- NULL for FOLD/CHECK
    action_sequence SMALLINT NOT NULL, -- 액션 순서
    pot_size_before DECIMAL(15,2),
    pot_size_after DECIMAL(15,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 검색 최적화
    hand_action_key VARCHAR(50) GENERATED ALWAYS AS (hand_id::text || '_' || action_sequence) STORED,
    
    CONSTRAINT uk_hand_actions UNIQUE (hand_id, action_sequence)
) PARTITION BY RANGE (created_at);

-- 액션 로그 월별 파티셔닝
CREATE TABLE hand_actions_2024_09 PARTITION OF hand_actions 
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE hand_actions_2024_10 PARTITION OF hand_actions 
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE hand_actions_2024_11 PARTITION OF hand_actions 
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE hand_actions_2024_12 PARTITION OF hand_actions 
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE hand_actions_2025_01 PARTITION OF hand_actions 
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE hand_actions_2025_02 PARTITION OF hand_actions 
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- 3.6 보드 카드 (커뮤니티 카드)
CREATE TABLE board_cards (
    hand_id UUID PRIMARY KEY,
    flop_1 CHAR(2), -- 예: 'Ah'
    flop_2 CHAR(2),
    flop_3 CHAR(2),
    turn_card CHAR(2),
    river_card CHAR(2),
    
    -- 검색 최적화용 연결 문자열
    flop_str VARCHAR(6) GENERATED ALWAYS AS (flop_1 || flop_2 || flop_3) STORED,
    board_str VARCHAR(10) GENERATED ALWAYS AS (flop_1 || flop_2 || flop_3 || COALESCE(turn_card, '') || COALESCE(river_card, '')) STORED,
    
    FOREIGN KEY (hand_id) REFERENCES hands(hand_id) ON DELETE CASCADE
);

-- ==================================================
-- 4. 성능 최적화 인덱스 전략
-- ==================================================

-- 4.1 플레이어 테이블 인덱스
CREATE INDEX idx_players_username_lower ON players (lower(username));
CREATE INDEX idx_players_last_active ON players (last_active DESC);
CREATE INDEX idx_players_total_hands ON players (total_hands_played DESC);

-- 4.2 게임 테이블 인덱스
CREATE INDEX idx_game_tables_site_type ON game_tables (site_name, game_type, is_active);
CREATE INDEX idx_game_tables_blinds ON game_tables (small_blind, big_blind);

-- 4.3 핸드 테이블 인덱스 (파티셔닝 고려)
CREATE INDEX idx_hands_started_at ON hands (started_at DESC);
CREATE INDEX idx_hands_table_started ON hands (table_id, started_at DESC);
CREATE INDEX idx_hands_winner ON hands (winner_player_id) WHERE winner_player_id IS NOT NULL;
CREATE INDEX idx_hands_year_month ON hands (year_month);

-- 4.4 핸드 참가자 인덱스
CREATE INDEX idx_hand_players_player ON hand_players (player_id);
CREATE INDEX idx_hand_players_winner ON hand_players (player_id, is_winner) WHERE is_winner = true;
CREATE INDEX idx_hand_players_winnings ON hand_players (net_winnings DESC) WHERE net_winnings > 0;

-- 4.5 액션 로그 인덱스 (고성능 조회용)
CREATE INDEX idx_hand_actions_hand_seq ON hand_actions (hand_id, action_sequence);
CREATE INDEX idx_hand_actions_player_type ON hand_actions (player_id, action_type, created_at DESC);
CREATE INDEX idx_hand_actions_street ON hand_actions (street, action_type);

-- 4.6 보드 카드 인덱스
CREATE INDEX idx_board_cards_flop ON board_cards (flop_str);
CREATE INDEX idx_board_cards_full ON board_cards (board_str);

-- ==================================================
-- 5. 집계 테이블 (성능 최적화용 비정규화)
-- ==================================================

-- 5.1 플레이어 통계 (일일 집계)
CREATE TABLE player_daily_stats (
    stat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(player_id),
    stat_date DATE NOT NULL,
    hands_played INTEGER DEFAULT 0,
    total_winnings DECIMAL(15,2) DEFAULT 0,
    vpip_count INTEGER DEFAULT 0, -- Voluntarily Put in Pot 횟수
    pfr_count INTEGER DEFAULT 0,  -- Pre-Flop Raise 횟수
    aggression_factor DECIMAL(5,2),
    
    -- 계산된 통계
    vpip_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN hands_played > 0 THEN (vpip_count::DECIMAL / hands_played) * 100 ELSE 0 END
    ) STORED,
    pfr_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN hands_played > 0 THEN (pfr_count::DECIMAL / hands_played) * 100 ELSE 0 END
    ) STORED,
    
    CONSTRAINT uk_player_daily_stats UNIQUE (player_id, stat_date)
);

CREATE INDEX idx_player_daily_stats_date ON player_daily_stats (stat_date DESC);
CREATE INDEX idx_player_daily_stats_winnings ON player_daily_stats (total_winnings DESC);

-- 5.2 테이블별 시간당 통계
CREATE TABLE table_hourly_stats (
    stat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES game_tables(table_id),
    stat_hour TIMESTAMPTZ NOT NULL,
    hands_count INTEGER DEFAULT 0,
    total_pot DECIMAL(15,2) DEFAULT 0,
    total_rake DECIMAL(10,2) DEFAULT 0,
    avg_players DECIMAL(3,1),
    
    CONSTRAINT uk_table_hourly_stats UNIQUE (table_id, stat_hour)
);

CREATE INDEX idx_table_hourly_stats_hour ON table_hourly_stats (stat_hour DESC);

-- ==================================================
-- 6. 실시간 뷰 (복잡한 조인 최적화)
-- ==================================================

-- 6.1 플레이어 현재 상태 뷰
CREATE VIEW v_player_current_status AS
SELECT 
    p.player_id,
    p.username,
    p.total_hands_played,
    p.total_winnings,
    p.last_active,
    -- 최근 30일 통계
    COALESCE(recent.hands_30d, 0) as hands_last_30d,
    COALESCE(recent.winnings_30d, 0) as winnings_last_30d,
    COALESCE(recent.avg_vpip_30d, 0) as avg_vpip_last_30d
FROM players p
LEFT JOIN (
    SELECT 
        hp.player_id,
        COUNT(*) as hands_30d,
        SUM(hp.net_winnings) as winnings_30d,
        AVG(CASE WHEN pds.vpip_count > 0 THEN pds.vpip_percentage ELSE NULL END) as avg_vpip_30d
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    LEFT JOIN player_daily_stats pds ON hp.player_id = pds.player_id 
        AND pds.stat_date = h.started_at::date
    WHERE h.started_at >= NOW() - INTERVAL '30 days'
    GROUP BY hp.player_id
) recent ON p.player_id = recent.player_id;

-- 6.2 핸드 상세 정보 뷰
CREATE VIEW v_hand_details AS
SELECT 
    h.hand_id,
    h.hand_number,
    h.started_at,
    h.total_pot,
    gt.table_name,
    gt.site_name,
    gt.small_blind,
    gt.big_blind,
    p.username as winner_username,
    bc.flop_str,
    bc.turn_card,
    bc.river_card,
    COUNT(hp.player_id) as player_count
FROM hands h
JOIN game_tables gt ON h.table_id = gt.table_id
LEFT JOIN players p ON h.winner_player_id = p.player_id
LEFT JOIN board_cards bc ON h.hand_id = bc.hand_id
LEFT JOIN hand_players hp ON h.hand_id = hp.hand_id
GROUP BY h.hand_id, h.hand_number, h.started_at, h.total_pot, 
         gt.table_name, gt.site_name, gt.small_blind, gt.big_blind,
         p.username, bc.flop_str, bc.turn_card, bc.river_card;

-- ==================================================
-- 7. 파티션 자동 관리 함수
-- ==================================================

-- 7.1 월별 파티션 자동 생성 함수
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    table_name text;
    partition_name text;
BEGIN
    -- 다음 달 파티션 생성
    start_date := date_trunc('month', CURRENT_DATE + interval '1 month');
    end_date := start_date + interval '1 month';
    partition_name := 'hands_' || to_char(start_date, 'YYYY_MM');
    
    -- hands 파티션 생성
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF hands FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
    
    -- hand_players 파티션 생성
    partition_name := 'hand_players_' || to_char(start_date, 'YYYY_MM');
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF hand_players FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
    
    -- hand_actions 파티션 생성
    partition_name := 'hand_actions_' || to_char(start_date, 'YYYY_MM');
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF hand_actions FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
    
    RAISE NOTICE '파티션 생성 완료: %', to_char(start_date, 'YYYY-MM');
END;
$$ LANGUAGE plpgsql;

-- 7.2 오래된 파티션 삭제 함수 (데이터 보관 기간: 2년)
CREATE OR REPLACE FUNCTION drop_old_partitions()
RETURNS void AS $$
DECLARE
    old_date date;
    partition_name text;
BEGIN
    old_date := date_trunc('month', CURRENT_DATE - interval '2 years');
    
    -- 2년 이상 된 파티션들 삭제
    FOR partition_name IN 
        SELECT schemaname||'.'||tablename 
        FROM pg_tables 
        WHERE tablename ~ '^(hands|hand_players|hand_actions)_[0-9]{4}_[0-9]{2}$'
        AND tablename <= 'hands_' || to_char(old_date, 'YYYY_MM')
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || partition_name;
        RAISE NOTICE '파티션 삭제 완료: %', partition_name;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 8. 성능 모니터링 및 유지보수
-- ==================================================

-- 8.1 통계 정보 업데이트 스케줄
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    -- 주요 테이블 통계 정보 갱신
    ANALYZE players;
    ANALYZE game_tables;
    ANALYZE hands;
    ANALYZE hand_players;
    ANALYZE hand_actions;
    ANALYZE board_cards;
    ANALYZE player_daily_stats;
    
    RAISE NOTICE '통계 정보 갱신 완료: %', NOW();
END;
$$ LANGUAGE plpgsql;

-- 8.2 인덱스 사용률 모니터링 뷰
CREATE VIEW v_index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ==================================================
-- 완료: 포커 핸드 로거 최적화 스키마
-- ==================================================

-- 주요 최적화 포인트:
-- 1. 파티셔닝: 시간 기반 자동 파티셔닝으로 쿼리 성능 향상
-- 2. 인덱싱: 복합 인덱스와 부분 인덱스로 검색 최적화
-- 3. 비정규화: 집계 테이블과 계산된 컬럼으로 복잡한 쿼리 성능 향상
-- 4. 뷰: 복잡한 조인을 단순화하여 애플리케이션 개발 효율성 증대
-- 5. 자동화: 파티션 관리와 통계 갱신 자동화