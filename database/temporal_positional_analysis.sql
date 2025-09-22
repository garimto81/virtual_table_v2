-- ==================================================
-- 포커 핸드 로거 시스템 - 시간대별/포지션별 패턴 분석 쿼리
-- ==================================================
-- 목표: 시간, 요일, 포지션에 따른 플레이어 성과 및 패턴 분석
-- 작성일: 2024-09-22

-- ==================================================
-- 1. 시간대별 성과 분석
-- ==================================================

-- 1.1 시간대별 플레이어 성과 상세 분석 뷰
CREATE OR REPLACE VIEW v_hourly_performance_analysis AS
WITH hourly_stats AS (
    SELECT 
        p.player_id,
        p.username,
        EXTRACT(HOUR FROM h.started_at)::INTEGER as hour_of_day,
        EXTRACT(DOW FROM h.started_at)::INTEGER as day_of_week,  -- 0=일요일, 6=토요일
        
        COUNT(*) as hands_played,
        AVG(hp.net_winnings) as avg_winnings,
        SUM(hp.net_winnings) as total_winnings,
        STDDEV(hp.net_winnings) as winnings_stddev,
        
        -- 플레이 스타일 변화
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'CALL', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as vpip,
        
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as pfr,
        
        -- 집중도 지표 (결정 시간 기반, 가정)
        COUNT(CASE WHEN hp.is_winner THEN 1 END)::DECIMAL / COUNT(*) * 100 as win_rate,
        
        -- 리스크 지표
        COUNT(CASE 
            WHEN hp.net_winnings > (SELECT AVG(net_winnings) * 2 FROM hand_players WHERE player_id = hp.player_id) 
            THEN 1 
        END) as big_wins,
        COUNT(CASE 
            WHEN hp.net_winnings < (SELECT AVG(net_winnings) * -2 FROM hand_players WHERE player_id = hp.player_id) 
            THEN 1 
        END) as big_losses
        
    FROM players p
    JOIN hand_players hp ON p.player_id = hp.player_id
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '90 days'  -- 3개월 데이터
    GROUP BY p.player_id, p.username, 
             EXTRACT(HOUR FROM h.started_at), 
             EXTRACT(DOW FROM h.started_at)
    HAVING COUNT(*) >= 20  -- 최소 표본 크기
)
SELECT 
    player_id,
    username,
    hour_of_day,
    CASE day_of_week
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END as day_name,
    hands_played,
    ROUND(avg_winnings, 2) as avg_winnings_per_hand,
    total_winnings,
    ROUND(winnings_stddev, 2) as volatility,
    ROUND(vpip, 1) as vpip_percentage,
    ROUND(pfr, 1) as pfr_percentage,
    ROUND(win_rate, 1) as win_rate_percentage,
    big_wins,
    big_losses,
    
    -- 시간대 성과 등급
    CASE 
        WHEN avg_winnings > 1 AND win_rate > 55 THEN 'Peak Performance'
        WHEN avg_winnings > 0 AND win_rate > 50 THEN 'Good Performance'
        WHEN avg_winnings > -0.5 AND win_rate > 45 THEN 'Average Performance'
        ELSE 'Poor Performance'
    END as performance_grade,
    
    -- 플레이 스타일 변화
    CASE 
        WHEN vpip > 30 OR pfr > 25 THEN 'More Aggressive'
        WHEN vpip < 15 OR pfr < 10 THEN 'More Conservative'
        ELSE 'Standard'
    END as style_shift
    
FROM hourly_stats
ORDER BY username, day_of_week, hour_of_day;

-- 1.2 최적 플레이 시간 추천 함수
CREATE OR REPLACE FUNCTION recommend_optimal_playtime(
    p_player_id UUID,
    p_days_back INTEGER DEFAULT 90
) RETURNS TABLE(
    recommendation_type TEXT,
    time_period TEXT,
    avg_hourly_profit DECIMAL(10,2),
    confidence_score DECIMAL(5,2),
    sample_size INTEGER,
    reasoning TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH time_analysis AS (
        SELECT 
            EXTRACT(HOUR FROM h.started_at)::INTEGER as hour_of_day,
            EXTRACT(DOW FROM h.started_at)::INTEGER as day_of_week,
            COUNT(*) as sessions,
            AVG(hp.net_winnings) as avg_profit,
            STDDEV(hp.net_winnings) as profit_stddev,
            COUNT(CASE WHEN hp.net_winnings > 0 THEN 1 END)::DECIMAL / COUNT(*) as win_rate
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE hp.player_id = p_player_id
          AND h.started_at >= NOW() - (p_days_back || ' days')::INTERVAL
        GROUP BY EXTRACT(HOUR FROM h.started_at), EXTRACT(DOW FROM h.started_at)
        HAVING COUNT(*) >= 10
    ),
    best_hours AS (
        SELECT 
            'Peak Hour' as rec_type,
            hour_of_day || ':00 - ' || (hour_of_day + 1) || ':00' as time_desc,
            avg_profit,
            CASE 
                WHEN sessions >= 50 THEN 95.0
                WHEN sessions >= 30 THEN 85.0
                WHEN sessions >= 20 THEN 75.0
                ELSE 60.0
            END as confidence,
            sessions,
            'Historically most profitable hour with ' || sessions || ' sessions averaging ' || 
            ROUND(avg_profit, 2) || ' profit per hand' as reason
        FROM time_analysis
        WHERE avg_profit = (SELECT MAX(avg_profit) FROM time_analysis)
    ),
    best_days AS (
        SELECT 
            'Peak Day' as rec_type,
            CASE day_of_week
                WHEN 0 THEN 'Sunday'
                WHEN 1 THEN 'Monday'
                WHEN 2 THEN 'Tuesday'
                WHEN 3 THEN 'Wednesday'
                WHEN 4 THEN 'Thursday'
                WHEN 5 THEN 'Friday'
                WHEN 6 THEN 'Saturday'
            END as time_desc,
            AVG(avg_profit) as avg_profit,
            CASE 
                WHEN SUM(sessions) >= 100 THEN 90.0
                WHEN SUM(sessions) >= 50 THEN 80.0
                ELSE 70.0
            END as confidence,
            SUM(sessions)::INTEGER as sessions,
            'Best performing day with average profit of ' || 
            ROUND(AVG(avg_profit), 2) || ' per hand' as reason
        FROM time_analysis
        GROUP BY day_of_week
        ORDER BY AVG(avg_profit) DESC
        LIMIT 1
    ),
    avoid_times AS (
        SELECT 
            'Avoid Time' as rec_type,
            hour_of_day || ':00 - ' || (hour_of_day + 1) || ':00' as time_desc,
            avg_profit,
            CASE 
                WHEN sessions >= 30 THEN 85.0
                WHEN sessions >= 20 THEN 75.0
                ELSE 65.0
            END as confidence,
            sessions,
            'Worst performing hour - consider avoiding. Average loss: ' || 
            ROUND(ABS(avg_profit), 2) || ' per hand' as reason
        FROM time_analysis
        WHERE avg_profit = (SELECT MIN(avg_profit) FROM time_analysis)
          AND avg_profit < -0.5  -- 상당한 손실이 있는 경우만
    )
    
    SELECT * FROM best_hours
    UNION ALL
    SELECT * FROM best_days
    UNION ALL
    SELECT * FROM avoid_times
    ORDER BY avg_hourly_profit DESC;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 2. 포지션별 상세 분석
-- ==================================================

-- 2.1 포지션별 수익성 매트릭스 뷰
CREATE OR REPLACE VIEW v_positional_profitability_matrix AS
WITH position_stats AS (
    SELECT 
        p.player_id,
        p.username,
        hp.position,
        
        -- 기본 통계
        COUNT(*) as hands_played,
        AVG(hp.net_winnings) as avg_winnings,
        SUM(hp.net_winnings) as total_winnings,
        STDDEV(hp.net_winnings) as winnings_stddev,
        
        -- 플레이 빈도
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'CALL', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as vpip,
        
        -- 어그레션
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as pfr,
        
        -- 3-Bet 빈도
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type = 'RAISE'
                  AND ha.action_sequence >= 3
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as three_bet_ratio,
        
        -- 쇼다운 참여율
        COUNT(CASE WHEN hp.showed_cards = true THEN 1 END)::DECIMAL / COUNT(*) * 100 as showdown_rate,
        
        -- 승률
        COUNT(CASE WHEN hp.is_winner THEN 1 END)::DECIMAL / COUNT(*) * 100 as win_rate
        
    FROM players p
    JOIN hand_players hp ON p.player_id = hp.player_id
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '60 days'
      AND hp.position IS NOT NULL
    GROUP BY p.player_id, p.username, hp.position
    HAVING COUNT(*) >= 30  -- 최소 표본 크기
),
position_ranking AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY avg_winnings DESC) as profit_rank,
        ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY vpip DESC) as looseness_rank,
        
        -- 포지션별 기대값 vs 실제 성과
        CASE position
            WHEN 'BTN' THEN 2.0    -- 버튼 기대 수익률
            WHEN 'CO' THEN 1.5     -- 컷오프
            WHEN 'MP' THEN 0.5     -- 미들
            WHEN 'MP1' THEN 0.3
            WHEN 'MP2' THEN 0.1
            WHEN 'UTG' THEN -0.2   -- 언더더건
            WHEN 'UTG1' THEN -0.1
            WHEN 'UTG2' THEN 0.0
            WHEN 'SB' THEN -0.5    -- 스몰 블라인드
            WHEN 'BB' THEN -0.3    -- 빅 블라인드
            ELSE 0.0
        END as expected_profit
    FROM position_stats
)
SELECT 
    player_id,
    username,
    position,
    hands_played,
    ROUND(avg_winnings, 2) as avg_profit_per_hand,
    total_winnings,
    ROUND(winnings_stddev, 2) as volatility,
    ROUND(vpip, 1) as vpip_percentage,
    ROUND(pfr, 1) as pfr_percentage,
    ROUND(three_bet_ratio, 1) as three_bet_percentage,
    ROUND(showdown_rate, 1) as showdown_percentage,
    ROUND(win_rate, 1) as win_rate_percentage,
    profit_rank,
    ROUND(expected_profit, 2) as expected_profit_per_hand,
    ROUND((avg_winnings - expected_profit), 2) as vs_expectation,
    
    -- 포지션 마스터리 등급
    CASE 
        WHEN avg_winnings > expected_profit + 1 THEN 'Master'
        WHEN avg_winnings > expected_profit + 0.5 THEN 'Advanced'
        WHEN avg_winnings > expected_profit - 0.5 THEN 'Competent'
        WHEN avg_winnings > expected_profit - 1 THEN 'Learning'
        ELSE 'Struggling'
    END as position_mastery,
    
    -- 플레이 스타일 적합성
    CASE 
        WHEN position IN ('BTN', 'CO') AND vpip BETWEEN 25 AND 40 AND pfr >= 18 THEN 'Optimal Aggression'
        WHEN position IN ('UTG', 'UTG1', 'UTG2') AND vpip <= 20 AND pfr >= 15 THEN 'Optimal Tightness'
        WHEN position IN ('SB', 'BB') AND vpip <= 25 THEN 'Good Defense'
        ELSE 'Suboptimal'
    END as style_fit
    
FROM position_ranking
ORDER BY username, profit_rank;

-- ==================================================
-- 3. 테이블 다이나믹스 분석
-- ==================================================

-- 3.1 테이블 구성에 따른 성과 분석
CREATE OR REPLACE FUNCTION analyze_table_dynamics(
    p_player_id UUID,
    p_days_back INTEGER DEFAULT 60
) RETURNS TABLE(
    table_size INTEGER,
    avg_opponent_vpip DECIMAL(5,2),
    avg_opponent_aggression DECIMAL(5,2),
    player_profit DECIMAL(10,2),
    player_vpip_adjustment DECIMAL(5,2),
    player_aggression_adjustment DECIMAL(5,2),
    profitability_vs_baseline DECIMAL(10,2),
    sample_size INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH table_compositions AS (
        SELECT 
            h.hand_id,
            h.num_players as table_size,
            hp_target.net_winnings as target_profit,
            
            -- 타겟 플레이어의 액션 통계
            EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = h.hand_id 
                  AND ha.player_id = p_player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'CALL', 'RAISE')
            ) as target_vpip_action,
            
            COUNT(CASE 
                WHEN ha_target.action_type IN ('BET', 'RAISE') THEN 1 
            END)::DECIMAL / NULLIF(COUNT(CASE 
                WHEN ha_target.action_type = 'CALL' THEN 1 
            END), 0) as target_aggression,
            
            -- 상대방들의 평균 통계
            AVG(CASE 
                WHEN hp_others.player_id != p_player_id AND EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = h.hand_id 
                      AND ha.player_id = hp_others.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'CALL', 'RAISE')
                ) THEN 1.0 ELSE 0.0 
            END) * 100 as avg_opp_vpip,
            
            AVG(
                CASE 
                    WHEN hp_others.player_id != p_player_id THEN
                        (SELECT COUNT(CASE WHEN ha.action_type IN ('BET', 'RAISE') THEN 1 END)::DECIMAL / 
                         NULLIF(COUNT(CASE WHEN ha.action_type = 'CALL' THEN 1 END), 0)
                         FROM hand_actions ha 
                         WHERE ha.hand_id = h.hand_id AND ha.player_id = hp_others.player_id)
                    ELSE NULL 
                END
            ) as avg_opp_aggression
            
        FROM hands h
        JOIN hand_players hp_target ON h.hand_id = hp_target.hand_id AND hp_target.player_id = p_player_id
        JOIN hand_players hp_others ON h.hand_id = hp_others.hand_id
        LEFT JOIN hand_actions ha_target ON h.hand_id = ha_target.hand_id AND ha_target.player_id = p_player_id
        WHERE h.started_at >= NOW() - (p_days_back || ' days')::INTERVAL
        GROUP BY h.hand_id, h.num_players, hp_target.net_winnings
    ),
    baseline_stats AS (
        SELECT 
            AVG(target_profit) as baseline_profit,
            AVG(CASE WHEN target_vpip_action THEN 100.0 ELSE 0.0 END) as baseline_vpip,
            AVG(target_aggression) as baseline_aggression
        FROM table_compositions
    ),
    aggregated_analysis AS (
        SELECT 
            tc.table_size,
            AVG(tc.avg_opp_vpip) as avg_opponent_vpip,
            AVG(tc.avg_opp_aggression) as avg_opponent_aggression,
            AVG(tc.target_profit) as player_avg_profit,
            AVG(CASE WHEN tc.target_vpip_action THEN 100.0 ELSE 0.0 END) as player_vpip,
            AVG(tc.target_aggression) as player_aggression,
            COUNT(*) as hands_count
        FROM table_compositions tc
        WHERE tc.table_size IS NOT NULL
        GROUP BY tc.table_size
        HAVING COUNT(*) >= 20
    )
    SELECT 
        aa.table_size::INTEGER,
        ROUND(aa.avg_opponent_vpip, 2),
        ROUND(aa.avg_opponent_aggression, 2),
        ROUND(aa.player_avg_profit, 2),
        ROUND((aa.player_vpip - bs.baseline_vpip), 2),
        ROUND((aa.player_aggression - bs.baseline_aggression), 2),
        ROUND((aa.player_avg_profit - bs.baseline_profit), 2),
        aa.hands_count::INTEGER
    FROM aggregated_analysis aa, baseline_stats bs
    ORDER BY aa.player_avg_profit DESC;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 4. 세션 길이 및 피로도 분석
-- ==================================================

-- 4.1 세션 길이에 따른 성과 변화 분석
CREATE OR REPLACE VIEW v_session_fatigue_analysis AS
WITH session_identification AS (
    SELECT 
        hp.player_id,
        hp.hand_id,
        h.started_at,
        hp.net_winnings,
        
        -- 세션 구분 (1시간 이상 간격이면 새 세션)
        LAG(h.started_at) OVER (PARTITION BY hp.player_id ORDER BY h.started_at) as prev_hand_time,
        CASE 
            WHEN LAG(h.started_at) OVER (PARTITION BY hp.player_id ORDER BY h.started_at) IS NULL OR
                 h.started_at - LAG(h.started_at) OVER (PARTITION BY hp.player_id ORDER BY h.started_at) > INTERVAL '1 hour'
            THEN 1 ELSE 0 
        END as session_start
        
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '90 days'
),
session_numbering AS (
    SELECT 
        *,
        SUM(session_start) OVER (PARTITION BY player_id ORDER BY started_at) as session_id
    FROM session_identification
),
session_stats AS (
    SELECT 
        player_id,
        session_id,
        MIN(started_at) as session_start,
        MAX(started_at) as session_end,
        COUNT(*) as hands_in_session,
        SUM(net_winnings) as session_profit,
        AVG(net_winnings) as avg_profit_per_hand,
        
        -- 세션 내 핸드 순서별 성과
        AVG(CASE WHEN ROW_NUMBER() OVER (PARTITION BY player_id, session_id ORDER BY started_at) <= 50 THEN net_winnings END) as early_session_avg,
        AVG(CASE WHEN ROW_NUMBER() OVER (PARTITION BY player_id, session_id ORDER BY started_at) > 50 THEN net_winnings END) as late_session_avg,
        
        -- 세션 길이 (분)
        EXTRACT(EPOCH FROM (MAX(started_at) - MIN(started_at))) / 60 as session_length_minutes
        
    FROM session_numbering
    GROUP BY player_id, session_id
    HAVING COUNT(*) >= 20  -- 최소 20핸드 세션
),
session_length_categories AS (
    SELECT 
        *,
        CASE 
            WHEN session_length_minutes <= 60 THEN 'Short (0-1h)'
            WHEN session_length_minutes <= 180 THEN 'Medium (1-3h)'
            WHEN session_length_minutes <= 360 THEN 'Long (3-6h)'
            ELSE 'Marathon (6h+)'
        END as session_category
    FROM session_stats
)
SELECT 
    p.username,
    slc.session_category,
    COUNT(*) as session_count,
    ROUND(AVG(slc.hands_in_session), 0) as avg_hands_per_session,
    ROUND(AVG(slc.session_length_minutes), 0) as avg_session_length_minutes,
    ROUND(AVG(slc.session_profit), 2) as avg_session_profit,
    ROUND(AVG(slc.avg_profit_per_hand), 3) as avg_profit_per_hand,
    ROUND(AVG(slc.early_session_avg), 3) as early_session_performance,
    ROUND(AVG(slc.late_session_avg), 3) as late_session_performance,
    ROUND((AVG(slc.late_session_avg) - AVG(slc.early_session_avg)), 3) as fatigue_effect,
    
    -- 세션 카테고리별 권장사항
    CASE 
        WHEN AVG(slc.late_session_avg) < AVG(slc.early_session_avg) - 0.5 THEN 'Consider Shorter Sessions'
        WHEN AVG(slc.session_profit) > 0 AND AVG(slc.late_session_avg) >= AVG(slc.early_session_avg) THEN 'Optimal Length'
        ELSE 'Monitor Performance'
    END as recommendation
    
FROM session_length_categories slc
JOIN players p ON slc.player_id = p.player_id
GROUP BY p.username, slc.session_category
HAVING COUNT(*) >= 5  -- 최소 5개 세션
ORDER BY p.username, 
         CASE slc.session_category
             WHEN 'Short (0-1h)' THEN 1
             WHEN 'Medium (1-3h)' THEN 2
             WHEN 'Long (3-6h)' THEN 3
             WHEN 'Marathon (6h+)' THEN 4
         END;

-- ==================================================
-- 5. 계절성 및 트렌드 분석
-- ==================================================

-- 5.1 주간/월간 트렌드 분석 함수
CREATE OR REPLACE FUNCTION analyze_temporal_trends(
    p_player_id UUID,
    p_months_back INTEGER DEFAULT 6
) RETURNS TABLE(
    time_period TEXT,
    period_type TEXT,
    hands_played INTEGER,
    avg_profit DECIMAL(10,2),
    vpip DECIMAL(5,2),
    pfr DECIMAL(5,2),
    trend_direction TEXT,
    significance_score DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH monthly_stats AS (
        SELECT 
            DATE_TRUNC('month', h.started_at) as period,
            'Monthly' as period_type,
            COUNT(*) as hands,
            AVG(hp.net_winnings) as avg_winnings,
            
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'CALL', 'RAISE')
                ) THEN 1 
            END)::DECIMAL / COUNT(*) * 100 as vpip_pct,
            
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'RAISE')
                ) THEN 1 
            END)::DECIMAL / COUNT(*) * 100 as pfr_pct
            
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE hp.player_id = p_player_id
          AND h.started_at >= NOW() - (p_months_back || ' months')::INTERVAL
        GROUP BY DATE_TRUNC('month', h.started_at)
        HAVING COUNT(*) >= 50
    ),
    weekly_stats AS (
        SELECT 
            DATE_TRUNC('week', h.started_at) as period,
            'Weekly' as period_type,
            COUNT(*) as hands,
            AVG(hp.net_winnings) as avg_winnings,
            
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'CALL', 'RAISE')
                ) THEN 1 
            END)::DECIMAL / COUNT(*) * 100 as vpip_pct,
            
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'RAISE')
                ) THEN 1 
            END)::DECIMAL / COUNT(*) * 100 as pfr_pct
            
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE hp.player_id = p_player_id
          AND h.started_at >= NOW() - (p_months_back || ' months')::INTERVAL
        GROUP BY DATE_TRUNC('week', h.started_at)
        HAVING COUNT(*) >= 20
    ),
    combined_stats AS (
        SELECT * FROM monthly_stats
        UNION ALL
        SELECT * FROM weekly_stats
    ),
    trend_analysis AS (
        SELECT 
            TO_CHAR(period, 'YYYY-MM') as time_desc,
            period_type,
            hands,
            avg_winnings,
            vpip_pct,
            pfr_pct,
            
            -- 트렌드 방향 계산 (이전 기간 대비)
            CASE 
                WHEN LAG(avg_winnings) OVER (PARTITION BY period_type ORDER BY period) IS NULL THEN 'N/A'
                WHEN avg_winnings > LAG(avg_winnings) OVER (PARTITION BY period_type ORDER BY period) * 1.1 THEN 'Strong Upward'
                WHEN avg_winnings > LAG(avg_winnings) OVER (PARTITION BY period_type ORDER BY period) THEN 'Upward'
                WHEN avg_winnings < LAG(avg_winnings) OVER (PARTITION BY period_type ORDER BY period) * 0.9 THEN 'Strong Downward'
                WHEN avg_winnings < LAG(avg_winnings) OVER (PARTITION BY period_type ORDER BY period) THEN 'Downward'
                ELSE 'Stable'
            END as trend,
            
            -- 유의미성 점수 (변화율과 표본 크기 기반)
            CASE 
                WHEN LAG(avg_winnings) OVER (PARTITION BY period_type ORDER BY period) IS NULL THEN 0
                ELSE ABS(avg_winnings - LAG(avg_winnings) OVER (PARTITION BY period_type ORDER BY period)) / 
                     NULLIF(ABS(LAG(avg_winnings) OVER (PARTITION BY period_type ORDER BY period)), 0) * 
                     LEAST(hands / 100.0, 1.0) * 100
            END as significance
            
        FROM combined_stats
    )
    SELECT 
        ta.time_desc,
        ta.period_type,
        ta.hands::INTEGER,
        ROUND(ta.avg_winnings, 3),
        ROUND(ta.vpip_pct, 1),
        ROUND(ta.pfr_pct, 1),
        ta.trend,
        ROUND(ta.significance, 1)
    FROM trend_analysis ta
    WHERE ta.significance > 10  -- 유의미한 변화만
    ORDER BY ta.period_type, ta.time_desc;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 완료: 시간대별/포지션별 패턴 분석 쿼리
-- ==================================================

-- 사용 예시:
/*
-- 시간대별 성과 분석
SELECT * FROM v_hourly_performance_analysis WHERE username = 'player123';

-- 최적 플레이 시간 추천
SELECT * FROM recommend_optimal_playtime('550e8400-e29b-41d4-a716-446655440000', 90);

-- 포지션별 수익성 매트릭스
SELECT * FROM v_positional_profitability_matrix WHERE username = 'player123';

-- 테이블 다이나믹스 분석
SELECT * FROM analyze_table_dynamics('550e8400-e29b-41d4-a716-446655440000', 60);

-- 세션 피로도 분석
SELECT * FROM v_session_fatigue_analysis WHERE username = 'player123';

-- 시간적 트렌드 분석
SELECT * FROM analyze_temporal_trends('550e8400-e29b-41d4-a716-446655440000', 6);
*/