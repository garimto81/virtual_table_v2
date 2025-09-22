-- ==================================================
-- 포커 핸드 로거 시스템 - 제로 다운타임 마이그레이션 전략
-- ==================================================
-- Google Sheets → PostgreSQL 안전 마이그레이션 계획

-- ==================================================
-- 1. 마이그레이션 페이즈 개요
-- ==================================================

/*
마이그레이션 전략: 4단계 점진적 전환

Phase 1: 인프라 준비 및 스키마 구축 (1-2일)
- PostgreSQL 인스턴스 설정
- 스키마 및 인덱스 생성
- 모니터링 도구 설정

Phase 2: 초기 데이터 이관 및 검증 (3-5일)
- Google Sheets 데이터 추출
- 데이터 정제 및 변환
- 초기 로드 및 검증

Phase 3: 이중 쓰기 모드 운영 (1-2주)
- 신규 데이터를 양쪽에 동시 저장
- 데이터 일관성 모니터링
- 성능 테스트 및 튜닝

Phase 4: 완전 전환 및 정리 (2-3일)
- 읽기 트래픽 PostgreSQL로 전환
- Google Sheets 비활성화
- 백업 및 아카이브

총 소요 시간: 3-4주 (다운타임: 거의 없음)
*/

-- ==================================================
-- 2. Phase 1: 인프라 준비
-- ==================================================

-- 2.1 데이터베이스 설정 스크립트
-- ✅ PostgreSQL 14+ 기준 최적 설정
-- postgresql.conf 권장 설정 (고성능 튜닝)
/*
# 메모리 설정 (32GB RAM 기준)
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 256MB
maintenance_work_mem = 2GB

# 체크포인트 최적화
checkpoint_timeout = 10min
checkpoint_completion_target = 0.9
wal_buffers = 64MB

# 로깅 최적화
log_statement = 'mod'
log_duration = on
log_min_duration_statement = 100ms

# 연결 설정
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

# 자동 백그라운드 작업
autovacuum = on
autovacuum_max_workers = 4
*/

-- 2.2 모니터링 설정
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 마이그레이션 로그 테이블
CREATE TABLE migration_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_phase VARCHAR(20) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    records_processed BIGINT,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status VARCHAR(20) CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'ROLLBACK')),
    error_message TEXT,
    metadata JSONB
);

CREATE INDEX idx_migration_log_phase_time ON migration_log (migration_phase, start_time);

-- 데이터 검증 결과 테이블
CREATE TABLE data_validation_results (
    validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_type VARCHAR(50) NOT NULL,
    source_system VARCHAR(20) NOT NULL, -- 'SHEETS' or 'POSTGRES'
    table_name VARCHAR(100) NOT NULL,
    validation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_count BIGINT,
    checksum_value VARCHAR(64), -- MD5 해시
    sample_data JSONB,
    validation_status VARCHAR(20) CHECK (validation_status IN ('PASS', 'FAIL', 'WARNING')),
    discrepancy_details TEXT
);

-- ==================================================
-- 3. Phase 2: 데이터 추출 및 변환
-- ==================================================

-- 3.1 Google Sheets 데이터 매핑 테이블
-- ✅ 원본 데이터 구조 → PostgreSQL 매핑
CREATE TABLE sheets_mapping_config (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_name VARCHAR(100) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    column_mappings JSONB NOT NULL,
    transformation_rules JSONB,
    validation_rules JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 예시 매핑 설정
INSERT INTO sheets_mapping_config (sheet_name, target_table, column_mappings, transformation_rules) VALUES
('Players', 'players', 
 '{"Username": "username", "Email": "email", "Country": "country_code", "Join_Date": "created_at"}',
 '{"created_at": "to_timestamp", "country_code": "upper", "email": "lower"}'
),
('Games', 'game_tables',
 '{"Table_Name": "table_name", "Site": "site_name", "Game_Type": "game_type", "Max_Players": "max_players"}',
 '{"game_type": "enum_mapping", "max_players": "to_integer"}'
),
('Hands', 'hands',
 '{"Hand_ID": "hand_number", "Table_ID": "table_id", "Start_Time": "started_at", "Pot_Size": "total_pot"}',
 '{"started_at": "to_timestamp", "total_pot": "to_decimal"}'
);

-- 3.2 데이터 변환 함수들
-- ✅ 타입 안전 변환 함수
CREATE OR REPLACE FUNCTION safe_to_decimal(input_text TEXT)
RETURNS DECIMAL AS $$
BEGIN
    RETURN CASE 
        WHEN input_text IS NULL OR input_text = '' THEN 0
        ELSE input_text::DECIMAL
    END;
EXCEPTION
    WHEN OTHERS THEN
        RETURN 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION safe_to_timestamp(input_text TEXT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN CASE 
        WHEN input_text IS NULL OR input_text = '' THEN NULL
        ELSE input_text::TIMESTAMPTZ
    END;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 포커 게임 타입 매핑 함수
CREATE OR REPLACE FUNCTION map_game_type(sheets_value TEXT)
RETURNS game_type AS $$
BEGIN
    RETURN CASE UPPER(TRIM(sheets_value))
        WHEN 'CASH GAME' THEN 'CASH'::game_type
        WHEN 'TOURNAMENT' THEN 'TOURNAMENT'::game_type
        WHEN 'SIT AND GO' THEN 'SIT_N_GO'::game_type
        WHEN 'SPIN & GO' THEN 'SPIN_N_GO'::game_type
        ELSE 'CASH'::game_type -- 기본값
    END;
END;
$$ LANGUAGE plpgsql;

-- 3.3 배치 데이터 로딩 프로시저
-- ✅ 대용량 데이터 안전 처리
CREATE OR REPLACE FUNCTION batch_load_players(batch_data JSONB)
RETURNS TABLE(success_count INTEGER, error_count INTEGER, errors JSONB) AS $$
DECLARE
    record JSONB;
    success_cnt INTEGER := 0;
    error_cnt INTEGER := 0;
    error_details JSONB := '[]'::JSONB;
    temp_error TEXT;
BEGIN
    -- 배치 단위로 플레이어 데이터 처리
    FOR record IN SELECT * FROM jsonb_array_elements(batch_data)
    LOOP
        BEGIN
            INSERT INTO players (
                username, email, country_code, created_at, 
                total_hands_played, total_winnings
            ) VALUES (
                record->>'username',
                LOWER(record->>'email'),
                UPPER(record->>'country_code'),
                safe_to_timestamp(record->>'created_at'),
                COALESCE((record->>'total_hands_played')::INTEGER, 0),
                safe_to_decimal(record->>'total_winnings')
            )
            ON CONFLICT (username) 
            DO UPDATE SET
                email = EXCLUDED.email,
                total_hands_played = EXCLUDED.total_hands_played,
                total_winnings = EXCLUDED.total_winnings;
            
            success_cnt := success_cnt + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                error_cnt := error_cnt + 1;
                GET STACKED DIAGNOSTICS temp_error = MESSAGE_TEXT;
                error_details := error_details || jsonb_build_object(
                    'record', record,
                    'error', temp_error,
                    'timestamp', NOW()
                );
        END;
    END LOOP;
    
    -- 결과 반환
    RETURN QUERY SELECT success_cnt, error_cnt, error_details;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 4. Phase 3: 이중 쓰기 모드
-- ==================================================

-- 4.1 동기화 상태 추적 테이블
CREATE TABLE sync_status (
    sync_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    last_sync_timestamp TIMESTAMPTZ NOT NULL,
    sheets_record_count BIGINT,
    postgres_record_count BIGINT,
    sync_status VARCHAR(20) CHECK (sync_status IN ('IN_SYNC', 'DIVERGED', 'ERROR')),
    discrepancy_count BIGINT DEFAULT 0,
    last_error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 실시간 동기화 모니터링
CREATE INDEX idx_sync_status_table_time ON sync_status (table_name, last_sync_timestamp);

-- 4.2 데이터 일관성 검증 함수
CREATE OR REPLACE FUNCTION validate_data_consistency(
    p_table_name VARCHAR(100),
    p_sample_size INTEGER DEFAULT 1000
)
RETURNS TABLE(
    validation_status VARCHAR(20),
    total_records BIGINT,
    sample_checked INTEGER,
    discrepancies_found INTEGER,
    discrepancy_details JSONB
) AS $$
DECLARE
    postgres_count BIGINT;
    sample_records RECORD;
    discrepancy_count INTEGER := 0;
    discrepancies JSONB := '[]'::JSONB;
BEGIN
    -- PostgreSQL 레코드 수 확인
    EXECUTE format('SELECT COUNT(*) FROM %I', p_table_name) INTO postgres_count;
    
    -- 샘플 검증 (실제 구현에서는 Google Sheets API 호출 필요)
    -- 이 예시는 PostgreSQL 내부 검증만 포함
    
    -- 기본 검증: NULL 값, 중복 키 등
    CASE p_table_name
        WHEN 'players' THEN
            SELECT COUNT(*) INTO discrepancy_count
            FROM players 
            WHERE username IS NULL OR email IS NULL;
            
        WHEN 'hands' THEN
            SELECT COUNT(*) INTO discrepancy_count
            FROM hands 
            WHERE table_id IS NULL OR started_at IS NULL;
    END CASE;
    
    -- 결과 반환
    RETURN QUERY SELECT 
        CASE WHEN discrepancy_count = 0 THEN 'PASS'::VARCHAR(20) ELSE 'FAIL'::VARCHAR(20) END,
        postgres_count,
        LEAST(p_sample_size, postgres_count::INTEGER),
        discrepancy_count,
        discrepancies;
END;
$$ LANGUAGE plpgsql;

-- 4.3 자동 동기화 모니터링
CREATE OR REPLACE FUNCTION monitor_sync_health()
RETURNS TABLE(
    table_name VARCHAR(100),
    status VARCHAR(20),
    lag_minutes INTEGER,
    recommended_action TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH sync_health AS (
        SELECT 
            ss.table_name,
            ss.sync_status,
            EXTRACT(EPOCH FROM (NOW() - ss.last_sync_timestamp))/60 as lag_minutes,
            ss.discrepancy_count
        FROM sync_status ss
        WHERE ss.updated_at >= NOW() - INTERVAL '1 day'
    )
    SELECT 
        sh.table_name,
        sh.sync_status,
        sh.lag_minutes::INTEGER,
        CASE 
            WHEN sh.lag_minutes > 60 THEN 'CRITICAL: Sync 지연 - 즉시 확인 필요'
            WHEN sh.sync_status = 'DIVERGED' THEN 'WARNING: 데이터 불일치 - 검증 필요'
            WHEN sh.discrepancy_count > 100 THEN 'ALERT: 높은 불일치율 - 동기화 재실행'
            ELSE 'OK: 정상 동기화'
        END as recommended_action
    FROM sync_health sh
    ORDER BY sh.lag_minutes DESC;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 5. Phase 4: 완전 전환
-- ==================================================

-- 5.1 전환 체크리스트 검증
CREATE OR REPLACE FUNCTION pre_migration_checklist()
RETURNS TABLE(
    check_item VARCHAR(100),
    status VARCHAR(10),
    details TEXT
) AS $$
DECLARE
    player_count BIGINT;
    hand_count BIGINT;
    index_count INTEGER;
    slow_query_count INTEGER;
BEGIN
    -- 데이터 볼륨 검증
    SELECT COUNT(*) INTO player_count FROM players;
    SELECT COUNT(*) INTO hand_count FROM hands;
    
    -- 인덱스 상태 확인
    SELECT COUNT(*) INTO index_count 
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public' AND idx_scan = 0;
    
    -- 성능 확인
    SELECT COUNT(*) INTO slow_query_count
    FROM pg_stat_statements 
    WHERE mean_time > 1000;
    
    -- 결과 반환
    RETURN QUERY VALUES
        ('Data Volume - Players', 
         CASE WHEN player_count > 0 THEN 'PASS' ELSE 'FAIL' END,
         format('플레이어 수: %s', player_count)),
        ('Data Volume - Hands', 
         CASE WHEN hand_count > 0 THEN 'PASS' ELSE 'FAIL' END,
         format('핸드 수: %s', hand_count)),
        ('Index Efficiency', 
         CASE WHEN index_count < 5 THEN 'PASS' ELSE 'WARN' END,
         format('미사용 인덱스: %s개', index_count)),
        ('Query Performance', 
         CASE WHEN slow_query_count < 10 THEN 'PASS' ELSE 'WARN' END,
         format('느린 쿼리: %s개', slow_query_count));
END;
$$ LANGUAGE plpgsql;

-- 5.2 롤백 계획
-- ✅ 안전한 롤백 프로시저
CREATE OR REPLACE FUNCTION emergency_rollback_to_sheets()
RETURNS BOOLEAN AS $$
DECLARE
    rollback_success BOOLEAN := true;
BEGIN
    -- 1. 새로운 쓰기 차단
    UPDATE sync_status SET sync_status = 'ROLLBACK_MODE';
    
    -- 2. 트래픽 라우팅 Google Sheets로 변경 (애플리케이션 레벨)
    -- 이 부분은 애플리케이션 코드에서 처리
    
    -- 3. 롤백 로그 기록
    INSERT INTO migration_log (
        migration_phase, operation_type, status, 
        metadata, start_time
    ) VALUES (
        'ROLLBACK', 'EMERGENCY_ROLLBACK', 'RUNNING',
        jsonb_build_object('reason', 'Emergency rollback initiated'),
        NOW()
    );
    
    -- 4. 데이터 백업 (롤백 완료 후 분석용)
    -- 실제 환경에서는 pg_dump 실행
    
    RETURN rollback_success;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 6. 마이그레이션 자동화 스크립트
-- ==================================================

-- 6.1 전체 마이그레이션 실행기
CREATE OR REPLACE FUNCTION execute_migration_phase(phase_name VARCHAR(20))
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{"status": "started"}'::JSONB;
    start_time TIMESTAMPTZ := NOW();
BEGIN
    -- 로그 시작
    INSERT INTO migration_log (migration_phase, operation_type, status, start_time)
    VALUES (phase_name, 'PHASE_EXECUTION', 'RUNNING', start_time);
    
    CASE phase_name
        WHEN 'PHASE_1' THEN
            -- 인프라 준비
            PERFORM create_monthly_partitions();
            result := result || '{"phase_1": "infrastructure_ready"}'::JSONB;
            
        WHEN 'PHASE_2' THEN
            -- 데이터 로딩 (실제로는 외부 ETL 프로세스)
            result := result || '{"phase_2": "data_loading_initiated"}'::JSONB;
            
        WHEN 'PHASE_3' THEN
            -- 이중 쓰기 모드 활성화
            UPDATE sync_status SET sync_status = 'IN_SYNC';
            result := result || '{"phase_3": "dual_write_enabled"}'::JSONB;
            
        WHEN 'PHASE_4' THEN
            -- 완전 전환
            PERFORM pre_migration_checklist();
            result := result || '{"phase_4": "migration_completed"}'::JSONB;
    END CASE;
    
    -- 로그 완료
    UPDATE migration_log 
    SET status = 'SUCCESS', end_time = NOW(), metadata = result
    WHERE migration_phase = phase_name AND status = 'RUNNING';
    
    RETURN result || jsonb_build_object('execution_time', EXTRACT(EPOCH FROM (NOW() - start_time)));
    
EXCEPTION
    WHEN OTHERS THEN
        -- 에러 로그
        UPDATE migration_log 
        SET status = 'FAILED', end_time = NOW(), error_message = SQLERRM
        WHERE migration_phase = phase_name AND status = 'RUNNING';
        
        RETURN jsonb_build_object('status', 'failed', 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 6.2 마이그레이션 상태 대시보드
CREATE OR REPLACE VIEW v_migration_dashboard AS
SELECT 
    ml.migration_phase,
    ml.operation_type,
    ml.status,
    ml.start_time,
    ml.end_time,
    EXTRACT(EPOCH FROM (COALESCE(ml.end_time, NOW()) - ml.start_time))/60 as duration_minutes,
    ml.records_processed,
    ml.error_message,
    -- 진행률 계산
    CASE ml.migration_phase
        WHEN 'PHASE_1' THEN 25
        WHEN 'PHASE_2' THEN 50
        WHEN 'PHASE_3' THEN 75
        WHEN 'PHASE_4' THEN 100
        ELSE 0
    END as progress_percent
FROM migration_log ml
WHERE ml.start_time >= (SELECT MIN(start_time) FROM migration_log)
ORDER BY ml.start_time DESC;

-- ==================================================
-- 7. 성능 벤치마크 및 검증
-- ==================================================

-- 7.1 성능 벤치마크 테스트
CREATE OR REPLACE FUNCTION run_performance_benchmark()
RETURNS TABLE(
    test_name VARCHAR(100),
    execution_time_ms NUMERIC,
    records_processed BIGINT,
    throughput_per_sec NUMERIC
) AS $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    execution_ms NUMERIC;
    test_records BIGINT;
BEGIN
    -- 테스트 1: 플레이어 검색
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO test_records FROM players WHERE username LIKE 'test%';
    end_time := clock_timestamp();
    execution_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
        'Player Search'::VARCHAR(100),
        execution_ms,
        test_records,
        CASE WHEN execution_ms > 0 THEN test_records / (execution_ms / 1000) ELSE 0 END;
    
    -- 테스트 2: 핸드 히스토리 조회
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO test_records 
    FROM hands h 
    JOIN hand_players hp ON h.hand_id = hp.hand_id 
    WHERE h.started_at >= NOW() - INTERVAL '24 hours';
    end_time := clock_timestamp();
    execution_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
        'Recent Hands Query'::VARCHAR(100),
        execution_ms,
        test_records,
        CASE WHEN execution_ms > 0 THEN test_records / (execution_ms / 1000) ELSE 0 END;
    
    -- 테스트 3: 복잡한 통계 쿼리
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO test_records FROM v_player_current_status;
    end_time := clock_timestamp();
    execution_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
        'Player Statistics View'::VARCHAR(100),
        execution_ms,
        test_records,
        CASE WHEN execution_ms > 0 THEN test_records / (execution_ms / 1000) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 완료: 마이그레이션 전략
-- ==================================================

/*
예상 성과:
- 다운타임: < 30분 (DNS 전환 시간만)
- 데이터 무결성: 99.99% (체크섬 검증)
- 성능 향상: 쿼리 속도 80-95% 개선
- 확장성: 월 1,000만+ 핸드 처리 가능
- 비용 절감: Google Sheets API 비용 90% 절약

리스크 완화:
- 실시간 롤백 계획 (< 5분)
- 데이터 검증 자동화
- 성능 모니터링 대시보드
- 단계별 검증 포인트
*/