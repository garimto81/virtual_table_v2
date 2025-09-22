-- ==================================================
-- 포커 핸드 로거 시스템 - 예측 모델 및 이상 탐지 SQL
-- ==================================================
-- 목표: 플레이어 행동 예측, 승률 계산, 이상 탐지 시스템 구현
-- 작성일: 2024-09-22

-- ==================================================
-- 1. 플레이어 행동 예측 함수
-- ==================================================

-- 1.1 다음 액션 예측 함수 (베이지안 접근법)
CREATE OR REPLACE FUNCTION predict_next_action(
    p_player_id UUID,
    p_current_street street_type,
    p_position position_type,
    p_pot_size DECIMAL(15,2),
    p_bet_to_call DECIMAL(15,2) DEFAULT 0,
    p_num_opponents INTEGER DEFAULT 1
) RETURNS TABLE(
    predicted_action action_type,
    confidence DECIMAL(5,2),
    expected_amount DECIMAL(10,2),
    reasoning TEXT
) AS $$
DECLARE
    player_style RECORD;
    situation_stats RECORD;
    base_probabilities RECORD;
BEGIN
    -- 플레이어 기본 스타일 정보 가져오기
    SELECT 
        calculate_vpip(p_player_id) as vpip,
        calculate_pfr(p_player_id) as pfr,
        calculate_aggression_factor(p_player_id) as af
    INTO player_style;
    
    -- 유사한 상황에서의 과거 행동 패턴 분석
    WITH similar_situations AS (
        SELECT 
            ha.action_type,
            ha.amount,
            COUNT(*) as frequency
        FROM hand_actions ha
        JOIN hand_players hp ON ha.hand_id = hp.hand_id AND ha.player_id = ha.player_id
        JOIN hands h ON ha.hand_id = h.hand_id
        WHERE ha.player_id = p_player_id
          AND ha.street = p_current_street
          AND hp.position = p_position
          AND h.started_at >= NOW() - INTERVAL '60 days'
          -- 팟 사이즈 유사성 (±50% 범위)
          AND ha.pot_size_before BETWEEN p_pot_size * 0.5 AND p_pot_size * 1.5
          -- 베팅 상황 유사성
          AND CASE 
              WHEN p_bet_to_call > 0 THEN ha.amount >= p_bet_to_call * 0.5
              ELSE ha.amount IS NULL OR ha.amount = 0
          END
        GROUP BY ha.action_type, ha.amount
    ),
    action_probabilities AS (
        SELECT 
            action_type,
            AVG(amount) as avg_amount,
            SUM(frequency) as total_frequency,
            SUM(frequency)::DECIMAL / (SELECT SUM(frequency) FROM similar_situations) * 100 as probability
        FROM similar_situations
        GROUP BY action_type
    )
    SELECT 
        ap.action_type,
        ap.avg_amount,
        ap.probability,
        ap.total_frequency
    INTO situation_stats
    FROM action_probabilities ap
    ORDER BY ap.probability DESC
    LIMIT 1;
    
    -- 기본 확률 계산 (플레이어 스타일 기반)
    SELECT 
        CASE 
            WHEN p_current_street = 'PREFLOP' THEN
                CASE 
                    WHEN player_style.vpip > 25 THEN 0.4  -- 루즈 플레이어
                    WHEN player_style.vpip > 15 THEN 0.25 -- 타이트 플레이어
                    ELSE 0.15  -- 매우 타이트
                END
            ELSE 0.3  -- 포스트플롭 기본 액션 확률
        END as action_prob,
        CASE 
            WHEN player_style.af > 3 THEN 'RAISE'::action_type
            WHEN player_style.af > 1 THEN 'BET'::action_type
            ELSE 'CALL'::action_type
        END as likely_action
    INTO base_probabilities;
    
    RETURN QUERY
    SELECT 
        COALESCE(situation_stats.action_type, base_probabilities.likely_action) as predicted_action,
        ROUND(COALESCE(situation_stats.probability, base_probabilities.action_prob * 100), 1) as confidence,
        ROUND(COALESCE(situation_stats.avg_amount, p_pot_size * 0.75), 2) as expected_amount,
        CASE 
            WHEN situation_stats.total_frequency >= 10 THEN 
                'Based on ' || situation_stats.total_frequency || ' similar situations'
            ELSE 
                'Based on player style (VPIP: ' || player_style.vpip || '%, AF: ' || player_style.af || ')'
        END as reasoning;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 2. 핸드 강도 및 승률 계산 시스템
-- ==================================================

-- 2.1 핸드 승률 계산 테이블 (프리컴퓨팅)
CREATE TABLE IF NOT EXISTS hand_equity_lookup (
    hole_cards VARCHAR(4) NOT NULL,
    num_opponents INTEGER NOT NULL,
    board_texture VARCHAR(10),  -- 'dry', 'wet', 'coordinated' 등
    equity_percentage DECIMAL(5,2) NOT NULL,
    sample_size INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (hole_cards, num_opponents, COALESCE(board_texture, 'preflop'))
);

-- 2.2 실시간 승률 계산 함수
CREATE OR REPLACE FUNCTION calculate_hand_equity(
    p_hole_cards VARCHAR(4),
    p_board_cards VARCHAR(10) DEFAULT NULL,
    p_num_opponents INTEGER DEFAULT 1
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    equity_result DECIMAL(5,2);
    board_type VARCHAR(20);
    historical_equity DECIMAL(5,2);
BEGIN
    -- 보드 타입 분류
    IF p_board_cards IS NULL OR LENGTH(p_board_cards) = 0 THEN
        board_type := 'preflop';
    ELSE
        -- 보드 텍스처 분석 (간단한 휴리스틱)
        board_type := CASE 
            WHEN p_board_cards ~ '.*[AKQJT].*[AKQJT].*[AKQJT].*' THEN 'high_card'
            WHEN p_board_cards ~ '.*(.).*\1.*' THEN 'paired'
            WHEN p_board_cards ~ '.*s.*s.*s.*' THEN 'flush_draw'
            ELSE 'rainbow'
        END;
    END IF;
    
    -- 룩업 테이블에서 기존 데이터 확인
    SELECT equity_percentage
    INTO historical_equity
    FROM hand_equity_lookup
    WHERE hole_cards = p_hole_cards
      AND num_opponents = p_num_opponents
      AND (board_texture = board_type OR (board_type = 'preflop' AND board_texture IS NULL));
    
    -- 기존 데이터가 있으면 반환
    IF historical_equity IS NOT NULL THEN
        RETURN historical_equity;
    END IF;
    
    -- 기존 데이터가 없으면 휴리스틱 계산
    equity_result := CASE 
        -- 프리미엄 핸드
        WHEN p_hole_cards ~ '^(AA|KK|QQ)' THEN 
            CASE p_num_opponents
                WHEN 1 THEN 85.0
                WHEN 2 THEN 75.0
                WHEN 3 THEN 65.0
                ELSE 55.0
            END
        -- 강한 핸드
        WHEN p_hole_cards ~ '^(JJ|TT|AK|AQ)' THEN 
            CASE p_num_opponents
                WHEN 1 THEN 70.0
                WHEN 2 THEN 55.0
                WHEN 3 THEN 45.0
                ELSE 35.0
            END
        -- 중간 핸드
        WHEN p_hole_cards ~ '^(99|88|77|AJ|KQ)' THEN 
            CASE p_num_opponents
                WHEN 1 THEN 60.0
                WHEN 2 THEN 45.0
                WHEN 3 THEN 35.0
                ELSE 25.0
            END
        -- 약한 핸드
        ELSE 
            CASE p_num_opponents
                WHEN 1 THEN 45.0
                WHEN 2 THEN 30.0
                WHEN 3 THEN 20.0
                ELSE 15.0
            END
    END;
    
    -- 보드 텍스처에 따른 조정
    IF board_type != 'preflop' THEN
        equity_result := equity_result * CASE board_type
            WHEN 'paired' THEN 0.9      -- 페어드 보드에서 약간 불리
            WHEN 'flush_draw' THEN 0.85  -- 플러시 드로우가 있는 보드
            WHEN 'high_card' THEN 1.1   -- 하이카드 보드에서 유리
            ELSE 1.0
        END;
    END IF;
    
    -- 룩업 테이블에 결과 저장 (캐싱)
    INSERT INTO hand_equity_lookup (hole_cards, num_opponents, board_texture, equity_percentage)
    VALUES (p_hole_cards, p_num_opponents, NULLIF(board_type, 'preflop'), equity_result)
    ON CONFLICT (hole_cards, num_opponents, COALESCE(board_texture, 'preflop'))
    DO UPDATE SET 
        equity_percentage = (hand_equity_lookup.equity_percentage + EXCLUDED.equity_percentage) / 2,
        sample_size = hand_equity_lookup.sample_size + 1,
        last_updated = NOW();
    
    RETURN ROUND(equity_result, 1);
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 3. 이상 행동 탐지 시스템
-- ==================================================

-- 3.1 이상 행동 로그 테이블
CREATE TABLE IF NOT EXISTS anomaly_detection_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(player_id),
    hand_id UUID NOT NULL,
    anomaly_type VARCHAR(50) NOT NULL,
    anomaly_score DECIMAL(5,2) NOT NULL,
    description TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 참고 데이터
    player_action action_type,
    action_amount DECIMAL(15,2),
    pot_size DECIMAL(15,2),
    position position_type,
    num_opponents INTEGER,
    
    INDEX idx_anomaly_player_time (player_id, detected_at DESC),
    INDEX idx_anomaly_score (anomaly_score DESC),
    INDEX idx_anomaly_type (anomaly_type)
);

-- 3.2 실시간 이상 탐지 함수
CREATE OR REPLACE FUNCTION detect_anomalous_behavior(
    p_player_id UUID,
    p_hand_id UUID,
    p_action action_type,
    p_amount DECIMAL(15,2),
    p_pot_size DECIMAL(15,2),
    p_position position_type,
    p_street street_type
) RETURNS TABLE(
    anomaly_detected BOOLEAN,
    anomaly_type VARCHAR(50),
    anomaly_score DECIMAL(5,2),
    explanation TEXT
) AS $$
DECLARE
    player_baseline RECORD;
    situation_baseline RECORD;
    action_deviation DECIMAL(5,2);
    amount_deviation DECIMAL(5,2);
    final_score DECIMAL(5,2);
    anomaly_threshold DECIMAL(5,2) := 75.0;  -- 75% 이상이면 이상행동
BEGIN
    -- 플레이어 기본 통계 계산 (최근 30일)
    WITH player_stats AS (
        SELECT 
            COUNT(*) as total_actions,
            COUNT(CASE WHEN ha.action_type = p_action THEN 1 END)::DECIMAL / COUNT(*) * 100 as action_frequency,
            AVG(CASE WHEN ha.action_type = p_action THEN ha.amount END) as avg_action_amount,
            STDDEV(CASE WHEN ha.action_type = p_action THEN ha.amount END) as amount_stddev
        FROM hand_actions ha
        JOIN hands h ON ha.hand_id = h.hand_id
        WHERE ha.player_id = p_player_id
          AND h.started_at >= NOW() - INTERVAL '30 days'
          AND ha.street = p_street
    )
    SELECT * INTO player_baseline FROM player_stats;
    
    -- 유사한 상황에서의 통계 (포지션, 팟 사이즈 고려)
    WITH situation_stats AS (
        SELECT 
            COUNT(*) as situation_actions,
            COUNT(CASE WHEN ha.action_type = p_action THEN 1 END)::DECIMAL / COUNT(*) * 100 as situation_action_freq,
            AVG(CASE WHEN ha.action_type = p_action THEN ha.amount END) as situation_avg_amount
        FROM hand_actions ha
        JOIN hand_players hp ON ha.hand_id = hp.hand_id AND ha.player_id = hp.player_id
        JOIN hands h ON ha.hand_id = h.hand_id
        WHERE ha.player_id = p_player_id
          AND ha.street = p_street
          AND hp.position = p_position
          AND ha.pot_size_before BETWEEN p_pot_size * 0.7 AND p_pot_size * 1.3
          AND h.started_at >= NOW() - INTERVAL '60 days'
    )
    SELECT * INTO situation_baseline FROM situation_stats;
    
    -- 액션 빈도 이탈도 계산
    action_deviation := CASE 
        WHEN player_baseline.action_frequency = 0 AND p_action IN ('BET', 'RAISE') THEN 90.0  -- 평소 안하던 공격적 액션
        WHEN player_baseline.action_frequency > 50 AND p_action = 'FOLD' THEN 70.0          -- 평소 액티브한데 폴드
        WHEN ABS(COALESCE(situation_baseline.situation_action_freq, player_baseline.action_frequency) - 
                 player_baseline.action_frequency) > 30 THEN 60.0                             -- 상황별 편차
        ELSE 0.0
    END;
    
    -- 베팅 사이즈 이탈도 계산
    amount_deviation := CASE 
        WHEN p_action IN ('BET', 'RAISE') AND p_amount IS NOT NULL THEN
            CASE 
                WHEN player_baseline.amount_stddev > 0 THEN
                    LEAST(ABS(p_amount - COALESCE(player_baseline.avg_action_amount, 0)) / 
                          player_baseline.amount_stddev * 20, 100.0)
                WHEN p_amount > p_pot_size * 2 THEN 80.0  -- 팟의 2배 이상 베팅
                WHEN p_amount < p_pot_size * 0.1 THEN 60.0  -- 매우 작은 베팅
                ELSE 0.0
            END
        ELSE 0.0
    END;
    
    -- 최종 이상 점수 계산
    final_score := GREATEST(action_deviation, amount_deviation);
    
    -- 특수 상황 보정
    IF p_street = 'PREFLOP' AND p_action = 'RAISE' AND p_amount > p_pot_size * 5 THEN
        final_score := GREATEST(final_score, 85.0);  -- 매우 큰 프리플롭 레이즈
    END IF;
    
    IF p_street = 'RIVER' AND p_action = 'BET' AND p_amount > p_pot_size * 1.5 THEN
        final_score := GREATEST(final_score, 70.0);  -- 큰 리버 베팅
    END IF;
    
    -- 이상행동 로깅
    IF final_score >= anomaly_threshold THEN
        INSERT INTO anomaly_detection_log (
            player_id, hand_id, anomaly_type, anomaly_score, description,
            player_action, action_amount, pot_size, position, num_opponents
        ) VALUES (
            p_player_id, p_hand_id, 
            CASE 
                WHEN action_deviation > amount_deviation THEN 'ACTION_PATTERN'
                ELSE 'BET_SIZE'
            END,
            final_score,
            'Unusual ' || p_action || ' in ' || p_street || ' (Score: ' || final_score || ')',
            p_action, p_amount, p_pot_size, p_position, 
            (SELECT COUNT(DISTINCT player_id) - 1 FROM hand_players WHERE hand_id = p_hand_id)
        );
    END IF;
    
    RETURN QUERY
    SELECT 
        final_score >= anomaly_threshold as is_anomaly,
        CASE 
            WHEN action_deviation > amount_deviation THEN 'ACTION_PATTERN'
            WHEN amount_deviation > 0 THEN 'BET_SIZE'
            ELSE 'NORMAL'
        END as anom_type,
        final_score as score,
        CASE 
            WHEN final_score >= anomaly_threshold THEN 
                'Detected unusual behavior: ' || p_action || ' with score ' || final_score
            ELSE 'Normal behavior pattern'
        END as explain;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 4. 플레이어 성향 변화 탐지
-- ==================================================

-- 4.1 플레이어 스타일 드리프트 탐지 뷰
CREATE OR REPLACE VIEW v_player_style_drift AS
WITH time_periods AS (
    SELECT 
        hp.player_id,
        -- 최근 7일과 이전 7일 비교
        CASE 
            WHEN h.started_at >= NOW() - INTERVAL '7 days' THEN 'recent'
            WHEN h.started_at >= NOW() - INTERVAL '14 days' THEN 'previous'
            ELSE 'older'
        END as period,
        
        COUNT(*) as hands,
        
        -- VPIP 계산
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'CALL', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as vpip,
        
        -- PFR 계산
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as pfr,
        
        -- 평균 수익률
        AVG(hp.net_winnings) as avg_winnings
        
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '14 days'
    GROUP BY hp.player_id, period
    HAVING COUNT(*) >= 30  -- 최소 표본 크기
),
style_comparison AS (
    SELECT 
        r.player_id,
        r.hands as recent_hands,
        r.vpip as recent_vpip,
        r.pfr as recent_pfr,
        r.avg_winnings as recent_winnings,
        p.hands as previous_hands,
        p.vpip as previous_vpip,
        p.pfr as previous_pfr,
        p.avg_winnings as previous_winnings
    FROM time_periods r
    JOIN time_periods p ON r.player_id = p.player_id
    WHERE r.period = 'recent' AND p.period = 'previous'
)
SELECT 
    pl.username,
    sc.recent_hands,
    sc.previous_hands,
    ROUND(sc.recent_vpip, 1) as recent_vpip,
    ROUND(sc.previous_vpip, 1) as previous_vpip,
    ROUND((sc.recent_vpip - sc.previous_vpip), 1) as vpip_change,
    ROUND(sc.recent_pfr, 1) as recent_pfr,
    ROUND(sc.previous_pfr, 1) as previous_pfr,
    ROUND((sc.recent_pfr - sc.previous_pfr), 1) as pfr_change,
    ROUND(sc.recent_winnings, 2) as recent_avg_winnings,
    ROUND(sc.previous_winnings, 2) as previous_avg_winnings,
    ROUND((sc.recent_winnings - sc.previous_winnings), 2) as winnings_change,
    
    -- 변화 유의성 평가
    CASE 
        WHEN ABS(sc.recent_vpip - sc.previous_vpip) > 10 THEN 'Significant VPIP Change'
        WHEN ABS(sc.recent_pfr - sc.previous_pfr) > 8 THEN 'Significant PFR Change'
        WHEN ABS(sc.recent_winnings - sc.previous_winnings) > 1 THEN 'Significant Performance Change'
        ELSE 'Stable'
    END as drift_type,
    
    -- 변화 방향
    CASE 
        WHEN sc.recent_vpip > sc.previous_vpip + 5 THEN 'Becoming Looser'
        WHEN sc.recent_vpip < sc.previous_vpip - 5 THEN 'Becoming Tighter'
        WHEN sc.recent_pfr > sc.previous_pfr + 5 THEN 'Becoming More Aggressive'
        WHEN sc.recent_pfr < sc.previous_pfr - 5 THEN 'Becoming More Passive'
        ELSE 'Stable Style'
    END as style_direction
    
FROM style_comparison sc
JOIN players pl ON sc.player_id = pl.player_id
WHERE ABS(sc.recent_vpip - sc.previous_vpip) > 5 
   OR ABS(sc.recent_pfr - sc.previous_pfr) > 3
   OR ABS(sc.recent_winnings - sc.previous_winnings) > 0.5
ORDER BY ABS(sc.recent_vpip - sc.previous_vpip) + ABS(sc.recent_pfr - sc.previous_pfr) DESC;

-- ==================================================
-- 5. 승부 조작 및 콜루전 탐지
-- ==================================================

-- 5.1 의심스러운 플레이어 조합 탐지
CREATE OR REPLACE FUNCTION detect_potential_collusion(
    p_days_back INTEGER DEFAULT 30,
    p_min_hands_together INTEGER DEFAULT 100
) RETURNS TABLE(
    player1_name TEXT,
    player2_name TEXT,
    hands_together INTEGER,
    player1_winrate_together DECIMAL(5,2),
    player2_winrate_together DECIMAL(5,2),
    player1_baseline_winrate DECIMAL(5,2),
    player2_baseline_winrate DECIMAL(5,2),
    suspicion_score DECIMAL(5,2),
    red_flags TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH player_pairs AS (
        SELECT 
            hp1.player_id as p1_id,
            hp2.player_id as p2_id,
            COUNT(*) as hands_together,
            AVG(hp1.net_winnings) as p1_avg_together,
            AVG(hp2.net_winnings) as p2_avg_together,
            
            -- 의심스러운 패턴들
            COUNT(CASE WHEN hp1.is_winner AND hp2.is_winner THEN 1 END) as both_win_count,
            COUNT(CASE WHEN hp1.net_winnings > 0 AND hp2.net_winnings > 0 THEN 1 END) as both_profit_count,
            
            -- 폴드 패턴 (한 명이 강한 핸드를 가졌을 때 다른 한 명의 폴드율)
            AVG(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha1 
                    WHERE ha1.hand_id = hp1.hand_id AND ha1.player_id = hp1.player_id 
                      AND ha1.action_type IN ('BET', 'RAISE')
                ) THEN 
                    CASE WHEN EXISTS(
                        SELECT 1 FROM hand_actions ha2 
                        WHERE ha2.hand_id = hp2.hand_id AND ha2.player_id = hp2.player_id 
                          AND ha2.action_type = 'FOLD'
                          AND ha2.action_sequence > ANY(
                              SELECT action_sequence FROM hand_actions 
                              WHERE hand_id = hp1.hand_id AND player_id = hp1.player_id
                          )
                    ) THEN 1.0 ELSE 0.0 END
                ELSE NULL
            END) as p2_fold_when_p1_aggressive
            
        FROM hand_players hp1
        JOIN hand_players hp2 ON hp1.hand_id = hp2.hand_id AND hp1.player_id < hp2.player_id
        JOIN hands h ON hp1.hand_id = h.hand_id
        WHERE h.started_at >= NOW() - (p_days_back || ' days')::INTERVAL
        GROUP BY hp1.player_id, hp2.player_id
        HAVING COUNT(*) >= p_min_hands_together
    ),
    baseline_stats AS (
        SELECT 
            hp.player_id,
            AVG(hp.net_winnings) as baseline_avg,
            COUNT(CASE WHEN hp.is_winner THEN 1 END)::DECIMAL / COUNT(*) as baseline_winrate
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE h.started_at >= NOW() - (p_days_back || ' days')::INTERVAL
        GROUP BY hp.player_id
    ),
    collusion_analysis AS (
        SELECT 
            pp.*,
            bs1.baseline_avg as p1_baseline,
            bs2.baseline_avg as p2_baseline,
            bs1.baseline_winrate as p1_baseline_wr,
            bs2.baseline_winrate as p2_baseline_wr,
            
            -- 의심 점수 계산
            CASE 
                WHEN pp.both_profit_count::DECIMAL / pp.hands_together > 0.7 THEN 30
                WHEN pp.both_profit_count::DECIMAL / pp.hands_together > 0.6 THEN 20
                ELSE 0
            END +
            CASE 
                WHEN pp.p2_fold_when_p1_aggressive > 0.8 THEN 40
                WHEN pp.p2_fold_when_p1_aggressive > 0.7 THEN 25
                ELSE 0
            END +
            CASE 
                WHEN pp.p1_avg_together > bs1.baseline_avg * 1.5 AND 
                     pp.p2_avg_together > bs2.baseline_avg * 1.5 THEN 30
                ELSE 0
            END as suspicion_points
            
        FROM player_pairs pp
        JOIN baseline_stats bs1 ON pp.p1_id = bs1.player_id
        JOIN baseline_stats bs2 ON pp.p2_id = bs2.player_id
    )
    SELECT 
        p1.username,
        p2.username,
        ca.hands_together::INTEGER,
        ROUND((ca.both_profit_count::DECIMAL / ca.hands_together * 100), 1),
        ROUND((ca.both_profit_count::DECIMAL / ca.hands_together * 100), 1),
        ROUND(ca.p1_baseline_wr * 100, 1),
        ROUND(ca.p2_baseline_wr * 100, 1),
        ROUND(ca.suspicion_points, 1),
        ARRAY[
            CASE WHEN ca.both_profit_count::DECIMAL / ca.hands_together > 0.6 
                 THEN 'High mutual profitability' ELSE NULL END,
            CASE WHEN ca.p2_fold_when_p1_aggressive > 0.7 
                 THEN 'Suspicious folding pattern' ELSE NULL END,
            CASE WHEN ca.p1_avg_together > ca.p1_baseline * 1.3 AND 
                      ca.p2_avg_together > ca.p2_baseline * 1.3 
                 THEN 'Both perform unusually well together' ELSE NULL END
        ]::TEXT[]
    FROM collusion_analysis ca
    JOIN players p1 ON ca.p1_id = p1.player_id
    JOIN players p2 ON ca.p2_id = p2.player_id
    WHERE ca.suspicion_points >= 50  -- 의심 임계값
    ORDER BY ca.suspicion_points DESC;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 완료: 예측 모델 및 이상 탐지 시스템
-- ==================================================

-- 사용 예시:
/*
-- 다음 액션 예측
SELECT * FROM predict_next_action(
    '550e8400-e29b-41d4-a716-446655440000', 
    'FLOP', 
    'BTN', 
    100.00, 
    25.00, 
    2
);

-- 핸드 승률 계산
SELECT calculate_hand_equity('AA', 'Kh7c2d', 2);

-- 이상 행동 탐지
SELECT * FROM detect_anomalous_behavior(
    '550e8400-e29b-41d4-a716-446655440000',
    '123e4567-e89b-12d3-a456-426614174000',
    'RAISE',
    150.00,
    50.00,
    'BTN',
    'FLOP'
);

-- 플레이어 스타일 변화 확인
SELECT * FROM v_player_style_drift WHERE username = 'player123';

-- 콜루전 탐지
SELECT * FROM detect_potential_collusion(30, 100);
*/