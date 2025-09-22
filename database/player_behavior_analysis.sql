-- ==================================================
-- 포커 핸드 로거 시스템 - 플레이어 행동 패턴 및 성향 분석 쿼리
-- ==================================================
-- 목표: 플레이어 행동 예측 및 스타일 분류를 위한 고급 분석 쿼리
-- 작성일: 2024-09-22

-- ==================================================
-- 1. 플레이어 스타일 종합 분석 뷰
-- ==================================================

-- 1.1 플레이어 스타일 매트릭스 뷰
CREATE OR REPLACE VIEW v_player_style_matrix AS
WITH base_stats AS (
    SELECT 
        p.player_id,
        p.username,
        COUNT(hp.hand_player_id) as total_hands,
        
        -- 기본 통계
        AVG(hp.net_winnings) as avg_winnings_per_hand,
        SUM(hp.net_winnings) as total_winnings,
        STDDEV(hp.net_winnings) as winnings_volatility,
        
        -- VPIP 계산 (자발적 투자 비율)
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'CALL', 'RAISE')
                  AND NOT (hp.position IN ('SB', 'BB') AND ha.action_sequence <= 2)
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as vpip,
        
        -- PFR 계산 (프리플롭 레이즈 비율)
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as pfr,
        
        -- 3-Bet 비율
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
        
        -- 폴드 투 3-Bet 비율
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha1
                JOIN hand_actions ha2 ON ha1.hand_id = ha2.hand_id
                WHERE ha1.hand_id = hp.hand_id 
                  AND ha1.player_id = hp.player_id
                  AND ha1.street = 'PREFLOP'
                  AND ha1.action_type IN ('BET', 'RAISE')
                  AND ha2.player_id != hp.player_id
                  AND ha2.street = 'PREFLOP'
                  AND ha2.action_type = 'RAISE'
                  AND ha2.action_sequence > ha1.action_sequence
                  AND EXISTS(
                      SELECT 1 FROM hand_actions ha3
                      WHERE ha3.hand_id = hp.hand_id
                        AND ha3.player_id = hp.player_id
                        AND ha3.action_sequence > ha2.action_sequence
                        AND ha3.action_type = 'FOLD'
                  )
            ) THEN 1 
        END)::DECIMAL / NULLIF(COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'RAISE')
            ) THEN 1 
        END), 0) * 100 as fold_to_3bet,
        
        -- WTSD (쇼다운까지 가는 비율)
        COUNT(CASE WHEN hp.showed_cards = true THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street IN ('FLOP', 'TURN', 'RIVER')
            ) THEN 1 
        END), 0) * 100 as wtsd,
        
        -- WSD (쇼다운에서 이기는 비율)
        COUNT(CASE WHEN hp.showed_cards = true AND hp.is_winner = true THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN hp.showed_cards = true THEN 1 END), 0) * 100 as wsd
        
    FROM players p
    JOIN hand_players hp ON p.player_id = hp.player_id
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '30 days'
    GROUP BY p.player_id, p.username
    HAVING COUNT(hp.hand_player_id) >= 100  -- 최소 100핸드
)
SELECT 
    player_id,
    username,
    total_hands,
    ROUND(avg_winnings_per_hand, 2) as avg_winnings_per_hand,
    total_winnings,
    ROUND(winnings_volatility, 2) as winnings_volatility,
    ROUND(vpip, 1) as vpip,
    ROUND(pfr, 1) as pfr,
    ROUND(three_bet_ratio, 1) as three_bet_ratio,
    ROUND(fold_to_3bet, 1) as fold_to_3bet,
    ROUND(wtsd, 1) as wtsd,
    ROUND(wsd, 1) as wsd,
    
    -- 스타일 분류
    CASE 
        WHEN vpip > 25 AND pfr > 18 THEN 'LAG (Loose Aggressive)'
        WHEN vpip > 25 AND pfr <= 18 THEN 'LP (Loose Passive)'
        WHEN vpip <= 25 AND pfr > 15 THEN 'TAG (Tight Aggressive)'
        WHEN vpip <= 25 AND pfr <= 15 THEN 'TP (Tight Passive)'
        ELSE 'Unknown'
    END as player_style,
    
    -- 스킬 레벨 추정
    CASE 
        WHEN avg_winnings_per_hand > 0 AND vpip BETWEEN 18 AND 28 AND pfr BETWEEN 14 AND 22 THEN 'Professional'
        WHEN avg_winnings_per_hand > 0 AND vpip <= 35 AND pfr >= 10 THEN 'Advanced'
        WHEN avg_winnings_per_hand >= -0.5 THEN 'Intermediate'
        ELSE 'Beginner'
    END as skill_estimate,
    
    -- 리스크 프로파일
    CASE 
        WHEN winnings_volatility > 50 THEN 'High Risk'
        WHEN winnings_volatility > 25 THEN 'Medium Risk'
        ELSE 'Low Risk'
    END as risk_profile
    
FROM base_stats
ORDER BY total_winnings DESC;

-- ==================================================
-- 2. 포지션별 플레이 스타일 분석
-- ==================================================

-- 2.1 포지션별 상세 통계 쿼리
CREATE OR REPLACE FUNCTION analyze_positional_play(
    p_player_id UUID,
    p_days_back INTEGER DEFAULT 30
) RETURNS TABLE(
    position position_type,
    hands INTEGER,
    vpip DECIMAL(5,2),
    pfr DECIMAL(5,2),
    c_bet DECIMAL(5,2),
    fold_to_c_bet DECIMAL(5,2),
    avg_winnings DECIMAL(10,2),
    position_rank INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH position_analysis AS (
        SELECT 
            hp.position,
            COUNT(*) as hand_count,
            
            -- VPIP 계산
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'CALL', 'RAISE')
                ) THEN 1 
            END)::DECIMAL / COUNT(*) * 100 as vpip_pct,
            
            -- PFR 계산
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'RAISE')
                ) THEN 1 
            END)::DECIMAL / COUNT(*) * 100 as pfr_pct,
            
            -- C-Bet 비율 (플롭에서 프리플롭 레이저가 베팅)
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha1
                    WHERE ha1.hand_id = hp.hand_id 
                      AND ha1.player_id = hp.player_id
                      AND ha1.street = 'PREFLOP'
                      AND ha1.action_type IN ('BET', 'RAISE')
                ) AND EXISTS(
                    SELECT 1 FROM hand_actions ha2
                    WHERE ha2.hand_id = hp.hand_id 
                      AND ha2.player_id = hp.player_id
                      AND ha2.street = 'FLOP'
                      AND ha2.action_type IN ('BET', 'RAISE')
                      AND ha2.action_sequence = (
                          SELECT MIN(action_sequence) 
                          FROM hand_actions ha3 
                          WHERE ha3.hand_id = hp.hand_id 
                            AND ha3.street = 'FLOP'
                      )
                ) THEN 1 
            END)::DECIMAL / NULLIF(COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.player_id = hp.player_id
                      AND ha.street = 'PREFLOP'
                      AND ha.action_type IN ('BET', 'RAISE')
                ) THEN 1 
            END), 0) * 100 as c_bet_pct,
            
            -- Fold to C-Bet 비율
            COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha1
                    JOIN hand_actions ha2 ON ha1.hand_id = ha2.hand_id
                    WHERE ha1.hand_id = hp.hand_id 
                      AND ha2.player_id != hp.player_id
                      AND ha1.street = 'PREFLOP'
                      AND ha2.street = 'FLOP'
                      AND ha2.action_type IN ('BET', 'RAISE')
                      AND EXISTS(
                          SELECT 1 FROM hand_actions ha3
                          WHERE ha3.hand_id = hp.hand_id
                            AND ha3.player_id = hp.player_id
                            AND ha3.street = 'FLOP'
                            AND ha3.action_type = 'FOLD'
                            AND ha3.action_sequence > ha2.action_sequence
                      )
                ) THEN 1 
            END)::DECIMAL / NULLIF(COUNT(CASE 
                WHEN EXISTS(
                    SELECT 1 FROM hand_actions ha 
                    WHERE ha.hand_id = hp.hand_id 
                      AND ha.street = 'FLOP'
                      AND ha.player_id != hp.player_id
                      AND ha.action_type IN ('BET', 'RAISE')
                ) THEN 1 
            END), 0) * 100 as fold_to_c_bet_pct,
            
            AVG(hp.net_winnings) as avg_profit
            
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE hp.player_id = p_player_id
          AND h.started_at >= NOW() - (p_days_back || ' days')::INTERVAL
          AND hp.position IS NOT NULL
        GROUP BY hp.position
        HAVING COUNT(*) >= 20  -- 최소 표본 크기
    )
    SELECT 
        pa.position,
        pa.hand_count::INTEGER,
        ROUND(pa.vpip_pct, 2),
        ROUND(pa.pfr_pct, 2),
        ROUND(pa.c_bet_pct, 2),
        ROUND(pa.fold_to_c_bet_pct, 2),
        ROUND(pa.avg_profit, 2),
        ROW_NUMBER() OVER (ORDER BY pa.avg_profit DESC)::INTEGER
    FROM position_analysis pa
    ORDER BY pa.avg_profit DESC;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 3. 핸드 레인지 분석
-- ==================================================

-- 3.1 스타팅 핸드 분석 쿼리
CREATE OR REPLACE VIEW v_starting_hand_analysis AS
WITH hand_categories AS (
    SELECT 
        hp.player_id,
        hp.hole_cards,
        hp.position,
        hp.net_winnings,
        hp.is_winner,
        
        -- 핸드 카테고리 분류
        CASE 
            -- 프리미엄 페어
            WHEN hp.hole_cards ~ '^(AA|KK|QQ|JJ|TT)' THEN 'Premium Pairs (AA-TT)'
            -- 미디엄 페어
            WHEN hp.hole_cards ~ '^(99|88|77|66|55)' THEN 'Medium Pairs (99-55)'
            -- 스몰 페어
            WHEN hp.hole_cards ~ '^(44|33|22)' THEN 'Small Pairs (44-22)'
            -- 프리미엄 브로드웨이
            WHEN hp.hole_cards ~ '^(AK|AQ|AJ|KQ)' THEN 'Premium Broadway'
            -- 에이스 하이
            WHEN hp.hole_cards ~ '^A[T-2]' THEN 'Ace High (AT-A2)'
            -- 킹 하이
            WHEN hp.hole_cards ~ '^K[J-2]' THEN 'King High (KJ-K2)'
            -- 수티드 커넥터
            WHEN hp.hole_cards ~ 's$' AND 
                 ABS(ASCII(SUBSTRING(hp.hole_cards, 1, 1)) - ASCII(SUBSTRING(hp.hole_cards, 2, 1))) <= 1 
                 THEN 'Suited Connectors'
            -- 수티드 갭퍼
            WHEN hp.hole_cards ~ 's$' THEN 'Suited Cards'
            -- 오프수트 브로드웨이
            WHEN hp.hole_cards ~ '^[AKQJT][AKQJT]o?$' THEN 'Offsuit Broadway'
            ELSE 'Trash Hands'
        END as hand_category,
        
        -- 포지션 그룹
        CASE 
            WHEN hp.position IN ('SB', 'BB') THEN 'Blinds'
            WHEN hp.position IN ('UTG', 'UTG1', 'UTG2') THEN 'Early'
            WHEN hp.position IN ('MP', 'MP1', 'MP2') THEN 'Middle'
            WHEN hp.position IN ('CO', 'BTN') THEN 'Late'
        END as position_group
        
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE hp.hole_cards IS NOT NULL
      AND h.started_at >= NOW() - INTERVAL '30 days'
),
aggregated_data AS (
    SELECT 
        player_id,
        hand_category,
        position_group,
        COUNT(*) as hands_played,
        AVG(net_winnings) as avg_winnings,
        SUM(net_winnings) as total_winnings,
        COUNT(CASE WHEN is_winner THEN 1 END) as wins,
        STDDEV(net_winnings) as profit_stddev
    FROM hand_categories
    GROUP BY player_id, hand_category, position_group
    HAVING COUNT(*) >= 10  -- 최소 표본 크기
)
SELECT 
    p.username,
    ad.hand_category,
    ad.position_group,
    ad.hands_played,
    ROUND(ad.avg_winnings, 2) as avg_profit_per_hand,
    ad.total_winnings,
    ROUND((ad.wins::DECIMAL / ad.hands_played * 100), 1) as win_rate,
    ROUND(ad.profit_stddev, 2) as profit_volatility,
    
    -- ROI 계산 (평균 투자 대비 수익률)
    ROUND((ad.avg_winnings / NULLIF(ABS(ad.avg_winnings), 0) * 100), 1) as roi_estimate,
    
    -- 수익성 등급
    CASE 
        WHEN ad.avg_winnings > 2 THEN 'Highly Profitable'
        WHEN ad.avg_winnings > 0 THEN 'Profitable'
        WHEN ad.avg_winnings > -1 THEN 'Break Even'
        ELSE 'Losing'
    END as profitability_grade
    
FROM aggregated_data ad
JOIN players p ON ad.player_id = p.player_id
ORDER BY p.username, ad.total_winnings DESC;

-- ==================================================
-- 4. 블러핑 및 어그레션 패턴 분석
-- ==================================================

-- 4.1 블러핑 빈도 및 성공률 분석
CREATE OR REPLACE FUNCTION analyze_bluffing_patterns(
    p_player_id UUID,
    p_days_back INTEGER DEFAULT 30
) RETURNS TABLE(
    street street_type,
    total_bets INTEGER,
    potential_bluffs INTEGER,
    bluff_frequency DECIMAL(5,2),
    bluff_success_rate DECIMAL(5,2),
    avg_bluff_size DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH bluff_analysis AS (
        SELECT 
            ha.street,
            ha.action_type,
            ha.amount,
            hp.hole_cards,
            hp.is_winner,
            hp.showed_cards,
            
            -- 블러프 가능성 추정 (약한 핸드로 베팅/레이즈)
            CASE 
                WHEN ha.action_type IN ('BET', 'RAISE') AND
                     hp.hole_cards IS NOT NULL AND
                     NOT (
                         hp.hole_cards ~ '^(AA|KK|QQ|JJ|TT|99|88|AK|AQ|AJ|KQ)' OR
                         hp.hole_cards ~ '^[AKQJT][AKQJT]s$'
                     ) THEN 1
                ELSE 0
            END as potential_bluff,
            
            -- 블러프 성공 추정 (상대방이 폴드하거나 약한 핸드로 승리)
            CASE 
                WHEN ha.action_type IN ('BET', 'RAISE') AND
                     hp.hole_cards IS NOT NULL AND
                     NOT (
                         hp.hole_cards ~ '^(AA|KK|QQ|JJ|TT|99|88|AK|AQ|AJ|KQ)' OR
                         hp.hole_cards ~ '^[AKQJT][AKQJT]s$'
                     ) AND
                     (hp.is_winner = true OR hp.showed_cards = false) THEN 1
                ELSE 0
            END as successful_bluff
            
        FROM hand_actions ha
        JOIN hand_players hp ON ha.hand_id = hp.hand_id AND ha.player_id = hp.player_id
        JOIN hands h ON ha.hand_id = h.hand_id
        WHERE ha.player_id = p_player_id
          AND h.started_at >= NOW() - (p_days_back || ' days')::INTERVAL
          AND ha.action_type IN ('BET', 'RAISE')
          AND ha.street != 'PREFLOP'  -- 프리플롭 제외
    )
    SELECT 
        ba.street,
        COUNT(*)::INTEGER as total_betting_actions,
        SUM(ba.potential_bluff)::INTEGER as estimated_bluffs,
        ROUND((SUM(ba.potential_bluff)::DECIMAL / COUNT(*) * 100), 2) as bluff_freq,
        ROUND((SUM(ba.successful_bluff)::DECIMAL / NULLIF(SUM(ba.potential_bluff), 0) * 100), 2) as success_rate,
        ROUND(AVG(CASE WHEN ba.potential_bluff = 1 THEN ba.amount END), 2) as avg_bluff_amount
    FROM bluff_analysis ba
    GROUP BY ba.street
    HAVING COUNT(*) >= 20  -- 최소 표본 크기
    ORDER BY ba.street;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 5. 상대방 대응 패턴 분석
-- ==================================================

-- 5.1 상대방 플레이어에 대한 적응 패턴 분석
CREATE OR REPLACE VIEW v_opponent_adaptation AS
WITH player_matchups AS (
    SELECT 
        hp1.player_id as player_id,
        hp2.player_id as opponent_id,
        COUNT(*) as hands_together,
        
        -- 상대방이 있을 때 vs 없을 때 통계 비교
        AVG(hp1.net_winnings) as avg_winnings_vs_opponent,
        
        -- VPIP 변화
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp1.hand_id 
                  AND ha.player_id = hp1.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'CALL', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as vpip_vs_opponent,
        
        -- 어그레션 변화
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp1.hand_id 
                  AND ha.player_id = hp1.player_id
                  AND ha.action_type IN ('BET', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / NULLIF(COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp1.hand_id 
                  AND ha.player_id = hp1.player_id
                  AND ha.action_type = 'CALL'
            ) THEN 1 
        END), 0) as aggression_vs_opponent
        
    FROM hand_players hp1
    JOIN hand_players hp2 ON hp1.hand_id = hp2.hand_id AND hp1.player_id != hp2.player_id
    JOIN hands h ON hp1.hand_id = h.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '30 days'
    GROUP BY hp1.player_id, hp2.player_id
    HAVING COUNT(*) >= 30  -- 최소 30핸드 함께 플레이
),
player_baselines AS (
    SELECT 
        hp.player_id,
        AVG(hp.net_winnings) as baseline_winnings,
        
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.street = 'PREFLOP'
                  AND ha.action_type IN ('BET', 'CALL', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / COUNT(*) * 100 as baseline_vpip,
        
        COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.action_type IN ('BET', 'RAISE')
            ) THEN 1 
        END)::DECIMAL / NULLIF(COUNT(CASE 
            WHEN EXISTS(
                SELECT 1 FROM hand_actions ha 
                WHERE ha.hand_id = hp.hand_id 
                  AND ha.player_id = hp.player_id
                  AND ha.action_type = 'CALL'
            ) THEN 1 
        END), 0) as baseline_aggression
        
    FROM hand_players hp
    JOIN hands h ON hp.hand_id = h.hand_id
    WHERE h.started_at >= NOW() - INTERVAL '30 days'
    GROUP BY hp.player_id
)
SELECT 
    p1.username as player_name,
    p2.username as opponent_name,
    pm.hands_together,
    ROUND(pm.avg_winnings_vs_opponent, 2) as winnings_vs_opponent,
    ROUND(pb.baseline_winnings, 2) as baseline_winnings,
    ROUND((pm.avg_winnings_vs_opponent - pb.baseline_winnings), 2) as winnings_difference,
    
    ROUND(pm.vpip_vs_opponent, 1) as vpip_vs_opponent,
    ROUND(pb.baseline_vpip, 1) as baseline_vpip,
    ROUND((pm.vpip_vs_opponent - pb.baseline_vpip), 1) as vpip_adjustment,
    
    ROUND(pm.aggression_vs_opponent, 2) as aggression_vs_opponent,
    ROUND(pb.baseline_aggression, 2) as baseline_aggression,
    ROUND((pm.aggression_vs_opponent - pb.baseline_aggression), 2) as aggression_adjustment,
    
    -- 적응 등급
    CASE 
        WHEN (pm.avg_winnings_vs_opponent - pb.baseline_winnings) > 1 THEN 'Strong Adaptation'
        WHEN (pm.avg_winnings_vs_opponent - pb.baseline_winnings) > 0 THEN 'Good Adaptation'
        WHEN (pm.avg_winnings_vs_opponent - pb.baseline_winnings) > -1 THEN 'Neutral'
        ELSE 'Poor Adaptation'
    END as adaptation_grade
    
FROM player_matchups pm
JOIN players p1 ON pm.player_id = p1.player_id
JOIN players p2 ON pm.opponent_id = p2.player_id
JOIN player_baselines pb ON pm.player_id = pb.player_id
ORDER BY winnings_difference DESC;

-- ==================================================
-- 완료: 플레이어 행동 패턴 및 성향 분석 쿼리
-- ==================================================

-- 사용 예시:
/*
-- 플레이어 스타일 매트릭스 조회
SELECT * FROM v_player_style_matrix WHERE username = 'player123';

-- 포지션별 플레이 분석
SELECT * FROM analyze_positional_play('550e8400-e29b-41d4-a716-446655440000', 30);

-- 스타팅 핸드 분석
SELECT * FROM v_starting_hand_analysis WHERE username = 'player123';

-- 블러핑 패턴 분석
SELECT * FROM analyze_bluffing_patterns('550e8400-e29b-41d4-a716-446655440000', 30);

-- 상대방 적응 패턴
SELECT * FROM v_opponent_adaptation WHERE player_name = 'player123';
*/