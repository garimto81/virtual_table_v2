-- ==================================================
-- 포커 핸드 로거 시스템 - 고급 분석 메트릭 및 통계 함수
-- ==================================================
-- 목표: 포커 플레이어 분석을 위한 핵심 통계 지표 구현
-- 작성일: 2024-09-22

-- ==================================================
-- 1. 핵심 포커 메트릭 정의 및 함수
-- ==================================================

-- 1.1 VPIP (Voluntarily Put money In Pot) 계산 함수
-- 설명: 플레이어가 자발적으로 팟에 돈을 넣은 비율 (블라인드 제외)
CREATE OR REPLACE FUNCTION calculate_vpip(
    p_player_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_hands INTEGER;
    vpip_hands INTEGER;
BEGIN
    -- 전체 핸드 수 (블라인드 포지션 포함)
    SELECT COUNT(*)
    INTO total_hands
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE hp.player_id = p_player_id
      AND h.started_at BETWEEN p_start_date AND p_end_date;
    
    -- VPIP 핸드 수 (자발적 투자 핸드)
    SELECT COUNT(DISTINCT hp.hand_id)
    INTO vpip_hands
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    JOIN hand_actions ha ON h.hand_id = ha.hand_id AND ha.player_id = hp.player_id
    WHERE hp.player_id = p_player_id
      AND h.started_at BETWEEN p_start_date AND p_end_date
      AND ha.street = 'PREFLOP'
      AND ha.action_type IN ('BET', 'CALL', 'RAISE')
      -- 블라인드가 아닌 자발적 액션만 카운트
      AND NOT (hp.position IN ('SB', 'BB') AND ha.action_sequence <= 2);
    
    -- VPIP 비율 계산
    RETURN CASE 
        WHEN total_hands > 0 THEN ROUND((vpip_hands::DECIMAL / total_hands * 100), 2)
        ELSE 0 
    END;
END;
$$ LANGUAGE plpgsql;

-- 1.2 PFR (Pre-Flop Raise) 계산 함수
-- 설명: 프리플롭에서 레이즈한 비율
CREATE OR REPLACE FUNCTION calculate_pfr(
    p_player_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_hands INTEGER;
    pfr_hands INTEGER;
BEGIN
    -- 전체 핸드 수
    SELECT COUNT(*)
    INTO total_hands
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE hp.player_id = p_player_id
      AND h.started_at BETWEEN p_start_date AND p_end_date;
    
    -- PFR 핸드 수 (프리플롭 레이즈)
    SELECT COUNT(DISTINCT hp.hand_id)
    INTO pfr_hands
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    JOIN hand_actions ha ON h.hand_id = ha.hand_id AND ha.player_id = hp.player_id
    WHERE hp.player_id = p_player_id
      AND h.started_at BETWEEN p_start_date AND p_end_date
      AND ha.street = 'PREFLOP'
      AND ha.action_type IN ('BET', 'RAISE');
    
    -- PFR 비율 계산
    RETURN CASE 
        WHEN total_hands > 0 THEN ROUND((pfr_hands::DECIMAL / total_hands * 100), 2)
        ELSE 0 
    END;
END;
$$ LANGUAGE plpgsql;

-- 1.3 AF (Aggression Factor) 계산 함수
-- 설명: 공격성 지수 = (베팅 + 레이즈) / 콜
CREATE OR REPLACE FUNCTION calculate_aggression_factor(
    p_player_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    aggressive_actions INTEGER;
    passive_actions INTEGER;
BEGIN
    -- 공격적 액션 수 (베팅, 레이즈)
    SELECT COUNT(*)
    INTO aggressive_actions
    FROM hand_actions ha
    JOIN hands h ON ha.hand_id = h.hand_id
    WHERE ha.player_id = p_player_id
      AND h.started_at BETWEEN p_start_date AND p_end_date
      AND ha.action_type IN ('BET', 'RAISE')
      AND ha.street != 'PREFLOP';  -- 프리플롭 제외
    
    -- 수동적 액션 수 (콜)
    SELECT COUNT(*)
    INTO passive_actions
    FROM hand_actions ha
    JOIN hands h ON ha.hand_id = h.hand_id
    WHERE ha.player_id = p_player_id
      AND h.started_at BETWEEN p_start_date AND p_end_date
      AND ha.action_type = 'CALL'
      AND ha.street != 'PREFLOP';  -- 프리플롭 제외
    
    -- AF 계산
    RETURN CASE 
        WHEN passive_actions > 0 THEN ROUND((aggressive_actions::DECIMAL / passive_actions), 2)
        WHEN aggressive_actions > 0 THEN 999.99  -- 무한대를 나타내는 최대값
        ELSE 0 
    END;
END;
$$ LANGUAGE plpgsql;

-- 1.4 WTSD (Went To ShowDown) 계산 함수
-- 설명: 쇼다운까지 간 비율
CREATE OR REPLACE FUNCTION calculate_wtsd(
    p_player_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    flop_seen_hands INTEGER;
    showdown_hands INTEGER;
BEGIN
    -- 플롭을 본 핸드 수
    SELECT COUNT(DISTINCT hp.hand_id)
    INTO flop_seen_hands
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    JOIN hand_actions ha ON h.hand_id = ha.hand_id AND ha.player_id = hp.player_id
    WHERE hp.player_id = p_player_id
      AND h.started_at BETWEEN p_start_date AND p_end_date
      AND ha.street IN ('FLOP', 'TURN', 'RIVER', 'SHOWDOWN');
    
    -- 쇼다운까지 간 핸드 수
    SELECT COUNT(DISTINCT hp.hand_id)
    INTO showdown_hands
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE hp.player_id = p_player_id
      AND h.started_at BETWEEN p_start_date AND p_end_date
      AND hp.showed_cards = true;
    
    -- WTSD 비율 계산
    RETURN CASE 
        WHEN flop_seen_hands > 0 THEN ROUND((showdown_hands::DECIMAL / flop_seen_hands * 100), 2)
        ELSE 0 
    END;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 2. 고급 통계 메트릭 함수
-- ==================================================

-- 2.1 포지션별 수익률 계산 함수
CREATE OR REPLACE FUNCTION calculate_position_profitability(
    p_player_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(
    position position_type,
    hands_played INTEGER,
    total_winnings DECIMAL(15,2),
    avg_winnings_per_hand DECIMAL(10,2),
    win_rate DECIMAL(5,2),
    vpip DECIMAL(5,2),
    pfr DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH position_stats AS (
        SELECT 
            hp.position,
            COUNT(*) as hands_count,
            SUM(hp.net_winnings) as total_profit,
            AVG(hp.net_winnings) as avg_profit,
            COUNT(CASE WHEN hp.is_winner THEN 1 END) as wins,
            -- VPIP 계산
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'CALL', 'RAISE')
                      AND NOT (hp.position IN ('SB', 'BB') AND ha.action_sequence <= 2)
                ) THEN 1 
            END) as vpip_count,
            -- PFR 계산
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'RAISE')
                ) THEN 1 
            END) as pfr_count
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE hp.player_id = p_player_id
          AND h.started_at BETWEEN p_start_date AND p_end_date
          AND hp.position IS NOT NULL
        GROUP BY hp.position
    )
    SELECT 
        ps.position,
        ps.hands_count::INTEGER,
        ps.total_profit,
        ROUND(ps.avg_profit, 2),
        ROUND((ps.wins::DECIMAL / ps.hands_count * 100), 2) as win_rate,
        ROUND((ps.vpip_count::DECIMAL / ps.hands_count * 100), 2) as vpip,
        ROUND((ps.pfr_count::DECIMAL / ps.hands_count * 100), 2) as pfr
    FROM position_stats ps
    WHERE ps.hands_count >= 10  -- 최소 표본 크기
    ORDER BY ps.total_profit DESC;
END;
$$ LANGUAGE plpgsql;

-- 2.2 핸드 강도별 수익성 분석 함수
CREATE OR REPLACE FUNCTION analyze_hand_strength_profitability(
    p_player_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(
    hand_category TEXT,
    hands_played INTEGER,
    total_profit DECIMAL(15,2),
    avg_profit DECIMAL(10,2),
    win_rate DECIMAL(5,2),
    std_deviation DECIMAL(10,2),
    roi DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH hand_strength_analysis AS (
        SELECT 
            hp.hole_cards,
            hp.net_winnings,
            hp.starting_chips,
            -- 핸드 강도 분류
            CASE 
                WHEN hp.hole_cards ~ '^(AA|KK|QQ|JJ)' THEN 'Premium Pairs'
                WHEN hp.hole_cards ~ '^(TT|99|88|77)' THEN 'Medium Pairs'
                WHEN hp.hole_cards ~ '^(66|55|44|33|22)' THEN 'Small Pairs'
                WHEN hp.hole_cards ~ '^(AK|AQ|AJ|AT)' THEN 'Ace High'
                WHEN hp.hole_cards ~ '^(KQ|KJ|KT|QJ|QT|JT)' THEN 'Broadway'
                WHEN hp.hole_cards ~ 's$' THEN 'Suited Connectors'
                ELSE 'Other'
            END as hand_cat
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE hp.player_id = p_player_id
          AND h.started_at BETWEEN p_start_date AND p_end_date
          AND hp.hole_cards IS NOT NULL
    ),
    aggregated_stats AS (
        SELECT 
            hand_cat,
            COUNT(*) as hands_count,
            SUM(net_winnings) as total_winnings,
            AVG(net_winnings) as avg_winnings,
            COUNT(CASE WHEN net_winnings > 0 THEN 1 END) as winning_hands,
            STDDEV(net_winnings) as profit_stddev,
            AVG(starting_chips) as avg_investment
        FROM hand_strength_analysis
        GROUP BY hand_cat
        HAVING COUNT(*) >= 20  -- 최소 표본 크기
    )
    SELECT 
        agg.hand_cat,
        agg.hands_count::INTEGER,
        agg.total_winnings,
        ROUND(agg.avg_winnings, 2),
        ROUND((agg.winning_hands::DECIMAL / agg.hands_count * 100), 2),
        ROUND(agg.profit_stddev, 2),
        ROUND((agg.avg_winnings / NULLIF(agg.avg_investment, 0) * 100), 2)
    FROM aggregated_stats agg
    ORDER BY agg.total_winnings DESC;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 3. 플레이어 스타일 분류 함수
-- ==================================================

-- 3.1 플레이어 스타일 분류 함수
CREATE OR REPLACE FUNCTION classify_player_style(
    p_player_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(
    player_style TEXT,
    vpip DECIMAL(5,2),
    pfr DECIMAL(5,2),
    aggression_factor DECIMAL(5,2),
    wtsd DECIMAL(5,2),
    total_hands INTEGER,
    confidence_level TEXT
) AS $$
DECLARE
    v_vpip DECIMAL(5,2);
    v_pfr DECIMAL(5,2);
    v_af DECIMAL(5,2);
    v_wtsd DECIMAL(5,2);
    v_hands INTEGER;
    v_style TEXT;
    v_confidence TEXT;
BEGIN
    -- 통계 계산
    v_vpip := calculate_vpip(p_player_id, p_start_date, p_end_date);
    v_pfr := calculate_pfr(p_player_id, p_start_date, p_end_date);
    v_af := calculate_aggression_factor(p_player_id, p_start_date, p_end_date);
    v_wtsd := calculate_wtsd(p_player_id, p_start_date, p_end_date);
    
    -- 총 핸드 수 계산
    SELECT COUNT(*)
    INTO v_hands
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE hp.player_id = p_player_id
      AND h.started_at BETWEEN p_start_date AND p_end_date;
    
    -- 스타일 분류
    v_style := CASE 
        WHEN v_vpip > 25 AND v_pfr > 18 THEN 'Loose Aggressive (LAG)'
        WHEN v_vpip > 25 AND v_pfr <= 18 THEN 'Loose Passive (Fish)'
        WHEN v_vpip <= 25 AND v_pfr > 18 THEN 'Tight Aggressive (TAG)'
        WHEN v_vpip <= 25 AND v_pfr <= 18 THEN 'Tight Passive (Rock)'
        ELSE 'Undefined'
    END;
    
    -- 신뢰도 계산
    v_confidence := CASE 
        WHEN v_hands >= 1000 THEN 'High'
        WHEN v_hands >= 500 THEN 'Medium'
        WHEN v_hands >= 100 THEN 'Low'
        ELSE 'Very Low'
    END;
    
    RETURN QUERY
    SELECT v_style, v_vpip, v_pfr, v_af, v_wtsd, v_hands, v_confidence;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 4. 시간대별 성과 분석 함수
-- ==================================================

-- 4.1 시간대별 성과 분석 함수
CREATE OR REPLACE FUNCTION analyze_hourly_performance(
    p_player_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(
    hour_of_day INTEGER,
    hands_played INTEGER,
    avg_winnings DECIMAL(10,2),
    total_winnings DECIMAL(15,2),
    win_rate DECIMAL(5,2),
    vpip DECIMAL(5,2),
    performance_rating TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH hourly_stats AS (
        SELECT 
            EXTRACT(HOUR FROM h.started_at)::INTEGER as hour_num,
            COUNT(*) as hands_count,
            AVG(hp.net_winnings) as avg_profit,
            SUM(hp.net_winnings) as total_profit,
            COUNT(CASE WHEN hp.is_winner THEN 1 END) as wins,
            -- VPIP 계산
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'CALL', 'RAISE')
                ) THEN 1 
            END) as vpip_count
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE hp.player_id = p_player_id
          AND h.started_at BETWEEN p_start_date AND p_end_date
        GROUP BY EXTRACT(HOUR FROM h.started_at)
        HAVING COUNT(*) >= 10  -- 최소 표본 크기
    )
    SELECT 
        hs.hour_num,
        hs.hands_count::INTEGER,
        ROUND(hs.avg_profit, 2),
        hs.total_profit,
        ROUND((hs.wins::DECIMAL / hs.hands_count * 100), 2),
        ROUND((hs.vpip_count::DECIMAL / hs.hands_count * 100), 2),
        -- 성과 등급
        CASE 
            WHEN hs.avg_profit > 0 AND hs.wins::DECIMAL / hs.hands_count > 0.6 THEN 'Excellent'
            WHEN hs.avg_profit > 0 THEN 'Good'
            WHEN hs.avg_profit > -0.5 THEN 'Average'
            ELSE 'Poor'
        END as rating
    FROM hourly_stats hs
    ORDER BY hs.hour_num;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 5. 배치 통계 업데이트 함수
-- ==================================================

-- 5.1 플레이어 통계 일괄 업데이트 함수
CREATE OR REPLACE FUNCTION update_player_statistics(
    p_target_date DATE DEFAULT CURRENT_DATE - 1
) RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    player_rec RECORD;
BEGIN
    -- 모든 활성 플레이어에 대해 통계 업데이트
    FOR player_rec IN (
        SELECT DISTINCT hp.player_id
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE h.started_at::date = p_target_date
    ) LOOP
        -- 플레이어 일일 통계 업데이트
        INSERT INTO player_daily_stats (
            player_id, stat_date, hands_played, total_winnings,
            vpip_count, pfr_count, aggression_factor
        )
        SELECT 
            player_rec.player_id,
            p_target_date,
            COUNT(*) as hands_played,
            SUM(hp.net_winnings) as total_winnings,
            -- VPIP 계산
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'CALL', 'RAISE')
                      AND NOT (hp.position IN ('SB', 'BB') AND ha.action_sequence <= 2)
                ) THEN 1 
            END) as vpip_count,
            -- PFR 계산
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'RAISE')
                ) THEN 1 
            END) as pfr_count,
            -- 공격성 지수 계산
            calculate_aggression_factor(
                player_rec.player_id, 
                p_target_date::timestamptz, 
                (p_target_date + 1)::timestamptz
            ) as aggression_factor
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE hp.player_id = player_rec.player_id
          AND h.started_at::date = p_target_date
        GROUP BY hp.player_id
        ON CONFLICT (player_id, stat_date) 
        DO UPDATE SET
            hands_played = EXCLUDED.hands_played,
            total_winnings = EXCLUDED.total_winnings,
            vpip_count = EXCLUDED.vpip_count,
            pfr_count = EXCLUDED.pfr_count,
            aggression_factor = EXCLUDED.aggression_factor;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 6. 성능 최적화를 위한 인덱스 추가
-- ==================================================

-- 메트릭 계산 최적화를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_hand_actions_player_street_action 
ON hand_actions (player_id, street, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hand_players_position_winnings 
ON hand_players (player_id, position, net_winnings DESC);

CREATE INDEX IF NOT EXISTS idx_hands_started_hour 
ON hands (EXTRACT(HOUR FROM started_at), started_at DESC);

-- ==================================================
-- 완료: 포커 분석 메트릭 및 통계 함수
-- ==================================================

-- 사용 예시:
/*
-- 플레이어 VPIP 계산
SELECT calculate_vpip('550e8400-e29b-41d4-a716-446655440000');

-- 플레이어 스타일 분류
SELECT * FROM classify_player_style('550e8400-e29b-41d4-a716-446655440000');

-- 포지션별 수익성 분석
SELECT * FROM calculate_position_profitability('550e8400-e29b-41d4-a716-446655440000');

-- 시간대별 성과 분석
SELECT * FROM analyze_hourly_performance('550e8400-e29b-41d4-a716-446655440000');

-- 일일 통계 업데이트
SELECT update_player_statistics('2024-09-21');
*/