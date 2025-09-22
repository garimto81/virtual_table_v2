-- ==================================================
-- 포커 핸드 로거 시스템 - 실시간 대시보드 KPI 쿼리
-- ==================================================
-- 목표: 실시간 모니터링 및 대시보드를 위한 핵심 성과 지표 쿼리
-- 작성일: 2024-09-22

-- ==================================================
-- 1. 실시간 시스템 상태 KPI
-- ==================================================

-- 1.1 실시간 활성 상태 대시보드 뷰
CREATE OR REPLACE VIEW v_realtime_system_status AS
WITH current_activity AS (
    SELECT 
        COUNT(DISTINCT gt.table_id) as active_tables,
        COUNT(DISTINCT hp.player_id) as active_players,
        COUNT(h.hand_id) as hands_last_hour,
        SUM(h.total_pot) as total_pot_last_hour,
        SUM(h.rake) as total_rake_last_hour,
        AVG(h.total_pot) as avg_pot_size,
        COUNT(CASE WHEN h.ended_at IS NULL THEN 1 END) as hands_in_progress
    FROM hands h
    JOIN game_tables gt ON h.table_id = gt.table_id
    LEFT JOIN hand_players hp ON h.hand_id = hp.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '1 hour'
      AND gt.is_active = true
),
system_health AS (
    SELECT 
        -- 시스템 성능 지표
        COUNT(*) as total_actions_last_hour,
        AVG(EXTRACT(EPOCH FROM (h.ended_at - h.started_at))) as avg_hand_duration_seconds,
        COUNT(DISTINCT DATE_TRUNC('minute', h.started_at)) as active_minutes_last_hour
    FROM hands h
    LEFT JOIN hand_actions ha ON h.hand_id = ha.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '1 hour'
      AND h.ended_at IS NOT NULL
),
error_rates AS (
    SELECT 
        COUNT(CASE WHEN al.anomaly_score > 80 THEN 1 END) as high_anomaly_count,
        COUNT(*) as total_anomalies_detected
    FROM anomaly_detection_log al
    WHERE al.detected_at >= NOW() - INTERVAL '1 hour'
)
SELECT 
    -- 활성도 지표
    ca.active_tables,
    ca.active_players,
    ca.hands_last_hour,
    ca.hands_in_progress,
    ROUND(ca.total_pot_last_hour, 2) as total_volume_last_hour,
    ROUND(ca.total_rake_last_hour, 2) as total_rake_last_hour,
    ROUND(ca.avg_pot_size, 2) as avg_pot_size,
    
    -- 성능 지표
    sh.total_actions_last_hour,
    ROUND(sh.avg_hand_duration_seconds, 1) as avg_hand_duration_sec,
    sh.active_minutes_last_hour,
    ROUND(ca.hands_last_hour::DECIMAL / NULLIF(sh.active_minutes_last_hour, 0), 1) as hands_per_minute,
    
    -- 품질 지표
    er.high_anomaly_count,
    er.total_anomalies_detected,
    ROUND(er.high_anomaly_count::DECIMAL / NULLIF(ca.hands_last_hour, 0) * 100, 2) as anomaly_rate_percent,
    
    -- 시스템 상태
    CASE 
        WHEN ca.active_players >= 100 AND ca.hands_last_hour >= 500 THEN 'High Activity'
        WHEN ca.active_players >= 50 AND ca.hands_last_hour >= 200 THEN 'Medium Activity'
        WHEN ca.active_players >= 10 AND ca.hands_last_hour >= 50 THEN 'Low Activity'
        ELSE 'Very Low Activity'
    END as activity_level,
    
    CASE 
        WHEN er.high_anomaly_count = 0 AND sh.avg_hand_duration_seconds < 120 THEN 'Healthy'
        WHEN er.high_anomaly_count <= 5 AND sh.avg_hand_duration_seconds < 180 THEN 'Good'
        WHEN er.high_anomaly_count <= 15 THEN 'Warning'
        ELSE 'Critical'
    END as system_health_status,
    
    NOW() as last_updated
    
FROM current_activity ca, system_health sh, error_rates er;

-- ==================================================
-- 2. 플레이어 성과 실시간 리더보드
-- ==================================================

-- 2.1 실시간 플레이어 순위 뷰 (다양한 기간별)
CREATE OR REPLACE VIEW v_player_leaderboard AS
WITH time_periods AS (
    SELECT 
        hp.player_id,
        p.username,
        
        -- 24시간 통계
        SUM(CASE WHEN h.started_at >= NOW() - INTERVAL '24 hours' 
            THEN hp.net_winnings ELSE 0 END) as winnings_24h,
        COUNT(CASE WHEN h.started_at >= NOW() - INTERVAL '24 hours' 
              THEN 1 END) as hands_24h,
        
        -- 7일 통계
        SUM(CASE WHEN h.started_at >= NOW() - INTERVAL '7 days' 
            THEN hp.net_winnings ELSE 0 END) as winnings_7d,
        COUNT(CASE WHEN h.started_at >= NOW() - INTERVAL '7 days' 
              THEN 1 END) as hands_7d,
        
        -- 30일 통계
        SUM(CASE WHEN h.started_at >= NOW() - INTERVAL '30 days' 
            THEN hp.net_winnings ELSE 0 END) as winnings_30d,
        COUNT(CASE WHEN h.started_at >= NOW() - INTERVAL '30 days' 
              THEN 1 END) as hands_30d,
        
        -- 최근 활동
        MAX(h.started_at) as last_activity,
        
        -- 현재 세션 통계 (최근 4시간 이내)
        SUM(CASE WHEN h.started_at >= NOW() - INTERVAL '4 hours' 
            THEN hp.net_winnings ELSE 0 END) as current_session_winnings,
        COUNT(CASE WHEN h.started_at >= NOW() - INTERVAL '4 hours' 
              THEN 1 END) as current_session_hands
        
    FROM hand_players hp
    JOIN players p ON hp.player_id = p.player_id
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '30 days'
    GROUP BY hp.player_id, p.username
    HAVING COUNT(CASE WHEN h.started_at >= NOW() - INTERVAL '7 days' THEN 1 END) >= 10
),
rankings AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (ORDER BY winnings_24h DESC) as rank_24h,
        ROW_NUMBER() OVER (ORDER BY winnings_7d DESC) as rank_7d,
        ROW_NUMBER() OVER (ORDER BY winnings_30d DESC) as rank_30d,
        
        -- 수익률 계산
        CASE WHEN hands_24h > 0 THEN winnings_24h / hands_24h ELSE 0 END as roi_24h,
        CASE WHEN hands_7d > 0 THEN winnings_7d / hands_7d ELSE 0 END as roi_7d,
        CASE WHEN hands_30d > 0 THEN winnings_30d / hands_30d ELSE 0 END as roi_30d
        
    FROM time_periods
)
SELECT 
    username,
    
    -- 24시간 성과
    rank_24h,
    ROUND(winnings_24h, 2) as winnings_24h,
    hands_24h,
    ROUND(roi_24h, 3) as avg_profit_per_hand_24h,
    
    -- 7일 성과
    rank_7d,
    ROUND(winnings_7d, 2) as winnings_7d,
    hands_7d,
    ROUND(roi_7d, 3) as avg_profit_per_hand_7d,
    
    -- 30일 성과
    rank_30d,
    ROUND(winnings_30d, 2) as winnings_30d,
    hands_30d,
    ROUND(roi_30d, 3) as avg_profit_per_hand_30d,
    
    -- 현재 세션
    ROUND(current_session_winnings, 2) as session_winnings,
    current_session_hands as session_hands,
    ROUND(CASE WHEN current_session_hands > 0 
          THEN current_session_winnings / current_session_hands 
          ELSE 0 END, 3) as session_roi,
    
    -- 활동 상태
    last_activity,
    CASE 
        WHEN last_activity >= NOW() - INTERVAL '10 minutes' THEN 'Online'
        WHEN last_activity >= NOW() - INTERVAL '1 hour' THEN 'Recently Active'
        WHEN last_activity >= NOW() - INTERVAL '24 hours' THEN 'Today'
        ELSE 'Inactive'
    END as activity_status,
    
    -- 트렌드 분석
    CASE 
        WHEN roi_24h > roi_7d * 1.2 THEN 'Hot Streak'
        WHEN roi_24h < roi_7d * 0.8 THEN 'Cold Streak'
        ELSE 'Stable'
    END as performance_trend
    
FROM rankings
ORDER BY winnings_24h DESC
LIMIT 50;

-- ==================================================
-- 3. 테이블별 실시간 모니터링
-- ==================================================

-- 3.1 테이블 활동 모니터링 뷰
CREATE OR REPLACE VIEW v_table_activity_monitor AS
WITH table_stats AS (
    SELECT 
        gt.table_id,
        gt.table_name,
        gt.site_name,
        gt.small_blind,
        gt.big_blind,
        gt.max_players,
        
        -- 최근 1시간 통계
        COUNT(CASE WHEN h.started_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as hands_last_hour,
        AVG(CASE WHEN h.started_at >= NOW() - INTERVAL '1 hour' THEN h.total_pot END) as avg_pot_last_hour,
        SUM(CASE WHEN h.started_at >= NOW() - INTERVAL '1 hour' THEN h.rake END) as rake_last_hour,
        
        -- 현재 활성 플레이어
        COUNT(DISTINCT CASE WHEN h.started_at >= NOW() - INTERVAL '10 minutes' 
                            THEN hp.player_id END) as current_players,
        
        -- 최근 핸드 정보
        MAX(h.started_at) as last_hand_time,
        COUNT(CASE WHEN h.ended_at IS NULL THEN 1 END) as hands_in_progress,
        
        -- 평균 핸드 시간
        AVG(CASE WHEN h.ended_at IS NOT NULL AND h.started_at >= NOW() - INTERVAL '1 hour'
                 THEN EXTRACT(EPOCH FROM (h.ended_at - h.started_at)) END) as avg_hand_duration,
        
        -- 액션 밀도
        COUNT(CASE WHEN ha.created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as actions_last_hour
        
    FROM game_tables gt
    LEFT JOIN hands h ON gt.table_id = h.table_id
    LEFT JOIN hand_players hp ON h.hand_id = hp.hand_id
    LEFT JOIN hand_actions ha ON h.hand_id = ha.hand_id
    WHERE gt.is_active = true
    GROUP BY gt.table_id, gt.table_name, gt.site_name, gt.small_blind, gt.big_blind, gt.max_players
),
table_health AS (
    SELECT 
        *,
        -- 테이블 활성도 점수
        CASE 
            WHEN hands_last_hour >= 60 AND current_players >= max_players * 0.8 THEN 100
            WHEN hands_last_hour >= 30 AND current_players >= max_players * 0.6 THEN 80
            WHEN hands_last_hour >= 10 AND current_players >= 2 THEN 60
            WHEN hands_last_hour > 0 THEN 40
            ELSE 0
        END as activity_score,
        
        -- 수익성 점수 (사이트 관점)
        CASE 
            WHEN rake_last_hour >= 100 THEN 100
            WHEN rake_last_hour >= 50 THEN 80
            WHEN rake_last_hour >= 20 THEN 60
            WHEN rake_last_hour > 0 THEN 40
            ELSE 0
        END as profitability_score
        
    FROM table_stats
)
SELECT 
    table_name,
    site_name,
    small_blind || '/' || big_blind as blinds,
    max_players,
    current_players,
    hands_last_hour,
    ROUND(avg_pot_last_hour, 2) as avg_pot_size,
    ROUND(rake_last_hour, 2) as total_rake_last_hour,
    hands_in_progress,
    ROUND(avg_hand_duration, 1) as avg_hand_duration_sec,
    actions_last_hour,
    last_hand_time,
    
    -- 성과 지표
    activity_score,
    profitability_score,
    ROUND((activity_score + profitability_score) / 2.0, 1) as overall_score,
    
    -- 상태 분류
    CASE 
        WHEN activity_score >= 80 THEN 'High Activity'
        WHEN activity_score >= 60 THEN 'Medium Activity'
        WHEN activity_score >= 40 THEN 'Low Activity'
        ELSE 'Inactive'
    END as activity_level,
    
    CASE 
        WHEN last_hand_time >= NOW() - INTERVAL '5 minutes' THEN 'Live'
        WHEN last_hand_time >= NOW() - INTERVAL '30 minutes' THEN 'Recent'
        WHEN last_hand_time >= NOW() - INTERVAL '2 hours' THEN 'Slow'
        ELSE 'Stale'
    END as freshness_status,
    
    -- 효율성 지표
    ROUND(CASE WHEN current_players > 0 
          THEN hands_last_hour::DECIMAL / current_players 
          ELSE 0 END, 1) as hands_per_player_per_hour,
    
    ROUND(CASE WHEN hands_last_hour > 0 
          THEN rake_last_hour / hands_last_hour 
          ELSE 0 END, 2) as avg_rake_per_hand
    
FROM table_health
ORDER BY overall_score DESC, hands_last_hour DESC;

-- ==================================================
-- 4. 이상 탐지 및 보안 대시보드
-- ==================================================

-- 4.1 실시간 이상 탐지 대시보드 뷰
CREATE OR REPLACE VIEW v_anomaly_dashboard AS
WITH recent_anomalies AS (
    SELECT 
        al.anomaly_type,
        COUNT(*) as occurrence_count,
        AVG(al.anomaly_score) as avg_score,
        MAX(al.anomaly_score) as max_score,
        MAX(al.detected_at) as latest_detection,
        
        -- 최고 위험도 사례
        (SELECT p.username FROM players p 
         WHERE p.player_id = al.player_id 
           AND al.anomaly_score = MAX(al.anomaly_score) 
         LIMIT 1) as highest_risk_player
         
    FROM anomaly_detection_log al
    WHERE al.detected_at >= NOW() - INTERVAL '24 hours'
    GROUP BY al.anomaly_type
),
player_risk_scores AS (
    SELECT 
        p.username,
        COUNT(*) as anomaly_count_24h,
        AVG(al.anomaly_score) as avg_risk_score,
        MAX(al.anomaly_score) as max_risk_score,
        MAX(al.detected_at) as last_anomaly_time,
        
        -- 리스크 레벨 분류
        CASE 
            WHEN MAX(al.anomaly_score) >= 90 THEN 'Critical'
            WHEN MAX(al.anomaly_score) >= 75 THEN 'High'
            WHEN MAX(al.anomaly_score) >= 60 THEN 'Medium'
            ELSE 'Low'
        END as risk_level
        
    FROM anomaly_detection_log al
    JOIN players p ON al.player_id = p.player_id
    WHERE al.detected_at >= NOW() - INTERVAL '24 hours'
    GROUP BY p.username, p.player_id
    HAVING COUNT(*) >= 3  -- 최소 3회 이상 이상 행동
),
system_alerts AS (
    SELECT 
        COUNT(CASE WHEN al.anomaly_score >= 90 THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN al.anomaly_score >= 75 THEN 1 END) as high_alerts,
        COUNT(CASE WHEN al.anomaly_score >= 60 THEN 1 END) as medium_alerts,
        COUNT(*) as total_alerts,
        
        -- 트렌드 (전일 대비)
        COUNT(CASE WHEN al.detected_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as alerts_today,
        COUNT(CASE WHEN al.detected_at >= NOW() - INTERVAL '48 hours' 
                   AND al.detected_at < NOW() - INTERVAL '24 hours' THEN 1 END) as alerts_yesterday
        
    FROM anomaly_detection_log al
    WHERE al.detected_at >= NOW() - INTERVAL '48 hours'
)
SELECT 
    -- 전체 시스템 알림 현황
    sa.critical_alerts,
    sa.high_alerts,
    sa.medium_alerts,
    sa.total_alerts,
    sa.alerts_today,
    sa.alerts_yesterday,
    
    CASE 
        WHEN sa.alerts_yesterday > 0 
        THEN ROUND((sa.alerts_today - sa.alerts_yesterday)::DECIMAL / sa.alerts_yesterday * 100, 1)
        ELSE 0 
    END as trend_percentage,
    
    -- 가장 빈번한 이상 유형
    (SELECT anomaly_type FROM recent_anomalies ORDER BY occurrence_count DESC LIMIT 1) as top_anomaly_type,
    (SELECT occurrence_count FROM recent_anomalies ORDER BY occurrence_count DESC LIMIT 1) as top_anomaly_count,
    
    -- 최고 위험 플레이어
    (SELECT username FROM player_risk_scores ORDER BY max_risk_score DESC LIMIT 1) as highest_risk_player,
    (SELECT max_risk_score FROM player_risk_scores ORDER BY max_risk_score DESC LIMIT 1) as highest_risk_score,
    
    -- 시스템 보안 상태
    CASE 
        WHEN sa.critical_alerts > 0 THEN 'Critical - Immediate Action Required'
        WHEN sa.high_alerts > 5 THEN 'High Risk - Monitor Closely'
        WHEN sa.medium_alerts > 10 THEN 'Medium Risk - Review Required'
        ELSE 'Normal - All Clear'
    END as security_status,
    
    NOW() as dashboard_updated
    
FROM system_alerts sa;

-- ==================================================
-- 5. 수익성 및 비즈니스 KPI
-- ==================================================

-- 5.1 비즈니스 성과 대시보드 뷰
CREATE OR REPLACE VIEW v_business_kpi_dashboard AS
WITH time_periods AS (
    SELECT 
        -- 오늘
        SUM(CASE WHEN h.started_at::date = CURRENT_DATE 
            THEN h.rake ELSE 0 END) as rake_today,
        COUNT(CASE WHEN h.started_at::date = CURRENT_DATE 
              THEN 1 END) as hands_today,
        
        -- 어제
        SUM(CASE WHEN h.started_at::date = CURRENT_DATE - 1 
            THEN h.rake ELSE 0 END) as rake_yesterday,
        COUNT(CASE WHEN h.started_at::date = CURRENT_DATE - 1 
              THEN 1 END) as hands_yesterday,
        
        -- 이번 주
        SUM(CASE WHEN h.started_at >= DATE_TRUNC('week', CURRENT_DATE) 
            THEN h.rake ELSE 0 END) as rake_this_week,
        COUNT(CASE WHEN h.started_at >= DATE_TRUNC('week', CURRENT_DATE) 
              THEN 1 END) as hands_this_week,
        
        -- 이번 달
        SUM(CASE WHEN h.started_at >= DATE_TRUNC('month', CURRENT_DATE) 
            THEN h.rake ELSE 0 END) as rake_this_month,
        COUNT(CASE WHEN h.started_at >= DATE_TRUNC('month', CURRENT_DATE) 
              THEN 1 END) as hands_this_month,
        
        -- 플레이어 활동
        COUNT(DISTINCT CASE WHEN h.started_at::date = CURRENT_DATE 
                            THEN hp.player_id END) as active_players_today,
        COUNT(DISTINCT CASE WHEN h.started_at >= DATE_TRUNC('week', CURRENT_DATE) 
                            THEN hp.player_id END) as active_players_this_week,
        COUNT(DISTINCT CASE WHEN h.started_at >= DATE_TRUNC('month', CURRENT_DATE) 
                            THEN hp.player_id END) as active_players_this_month
        
    FROM hands h
    LEFT JOIN hand_players hp ON h.hand_id = hp.hand_id
    WHERE h.started_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
),
growth_metrics AS (
    SELECT 
        tp.*,
        
        -- 성장률 계산
        CASE WHEN rake_yesterday > 0 
             THEN (rake_today - rake_yesterday) / rake_yesterday * 100 
             ELSE 0 END as daily_growth_rate,
        
        CASE WHEN hands_yesterday > 0 
             THEN (hands_today - hands_yesterday)::DECIMAL / hands_yesterday * 100 
             ELSE 0 END as volume_growth_rate,
        
        -- 효율성 지표
        CASE WHEN hands_today > 0 
             THEN rake_today / hands_today 
             ELSE 0 END as rake_per_hand_today,
        
        CASE WHEN active_players_today > 0 
             THEN hands_today::DECIMAL / active_players_today 
             ELSE 0 END as hands_per_player_today,
        
        CASE WHEN active_players_today > 0 
             THEN rake_today / active_players_today 
             ELSE 0 END as revenue_per_player_today
        
    FROM time_periods tp
)
SELECT 
    -- 수익 지표
    ROUND(rake_today, 2) as revenue_today,
    ROUND(rake_yesterday, 2) as revenue_yesterday,
    ROUND(rake_this_week, 2) as revenue_this_week,
    ROUND(rake_this_month, 2) as revenue_this_month,
    
    -- 볼륨 지표
    hands_today,
    hands_yesterday,
    hands_this_week,
    hands_this_month,
    
    -- 플레이어 지표
    active_players_today,
    active_players_this_week,
    active_players_this_month,
    
    -- 성장률
    ROUND(daily_growth_rate, 1) as daily_revenue_growth_pct,
    ROUND(volume_growth_rate, 1) as daily_volume_growth_pct,
    
    -- 효율성 지표
    ROUND(rake_per_hand_today, 3) as avg_rake_per_hand,
    ROUND(hands_per_player_today, 1) as avg_hands_per_player,
    ROUND(revenue_per_player_today, 2) as avg_revenue_per_player,
    
    -- 목표 대비 성과 (가정된 목표)
    ROUND((rake_today / 1000.0) * 100, 1) as daily_target_achievement_pct,  -- 일일 목표 $1000 가정
    ROUND((rake_this_month / 25000.0) * 100, 1) as monthly_target_achievement_pct,  -- 월간 목표 $25000 가정
    
    -- 상태 지표
    CASE 
        WHEN daily_growth_rate > 10 THEN 'Excellent Growth'
        WHEN daily_growth_rate > 0 THEN 'Positive Growth'
        WHEN daily_growth_rate > -10 THEN 'Stable'
        ELSE 'Declining'
    END as growth_status,
    
    CASE 
        WHEN active_players_today >= 100 THEN 'High Engagement'
        WHEN active_players_today >= 50 THEN 'Good Engagement'
        WHEN active_players_today >= 20 THEN 'Moderate Engagement'
        ELSE 'Low Engagement'
    END as engagement_level,
    
    CURRENT_TIMESTAMP as last_updated
    
FROM growth_metrics;

-- ==================================================
-- 완료: 실시간 대시보드 KPI 쿼리
-- ==================================================

-- 사용 예시:
/*
-- 실시간 시스템 상태 확인
SELECT * FROM v_realtime_system_status;

-- 플레이어 리더보드
SELECT * FROM v_player_leaderboard LIMIT 20;

-- 테이블 활동 모니터링
SELECT * FROM v_table_activity_monitor;

-- 이상 탐지 대시보드
SELECT * FROM v_anomaly_dashboard;

-- 비즈니스 KPI 대시보드
SELECT * FROM v_business_kpi_dashboard;
*/