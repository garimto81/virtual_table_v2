#!/usr/bin/env python3
"""
간단한 MCP Master Agent 테스트

Windows 콘솔 인코딩 문제를 피하기 위한 기본 테스트
"""

import sys
import asyncio
import logging

# 로깅 설정 (이모지 없이)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 로컬 모듈 임포트
try:
    from mcp_master_agent import MCPMasterAgent
    from mcp_config import MCPConfigManager
    from mcp_workflows import WorkflowEngine
    from mcp_monitor import MCPMonitor
    print("모든 모듈 임포트 성공")
except ImportError as e:
    print(f"모듈 임포트 실패: {e}")
    sys.exit(1)

async def test_basic_functionality():
    """기본 기능 테스트"""
    print("\n=== MCP Master Agent 기본 기능 테스트 ===")

    # 1. 에이전트 초기화
    print("1. 에이전트 초기화 중...")
    try:
        agent = MCPMasterAgent()
        print(f"   성공: {len(agent.tools)}개 도구 초기화됨")
    except Exception as e:
        print(f"   실패: {e}")
        return False

    # 2. 설정 관리자 테스트
    print("2. 설정 관리자 테스트...")
    try:
        config = MCPConfigManager()
        validation = config.validate_configuration()
        print(f"   성공: {validation['total_configs']}개 설정 검증됨")
    except Exception as e:
        print(f"   실패: {e}")
        return False

    # 3. 워크플로우 엔진 테스트
    print("3. 워크플로우 엔진 테스트...")
    try:
        engine = WorkflowEngine()
        templates = engine.get_workflow_templates()
        print(f"   성공: {len(templates)}개 워크플로우 템플릿 로드됨")
    except Exception as e:
        print(f"   실패: {e}")
        return False

    # 4. 모니터 시스템 테스트
    print("4. 모니터 시스템 테스트...")
    try:
        monitor = MCPMonitor()
        # 테스트 데이터 추가
        monitor.record_tool_call("mcp__github__", 1.5, True)
        dashboard = monitor.get_dashboard_data()
        print(f"   성공: {dashboard['overview']['total_calls']}개 호출 기록됨")
    except Exception as e:
        print(f"   실패: {e}")
        return False

    # 5. 헬스체크 테스트
    print("5. 헬스체크 실행...")
    try:
        health_report = await agent.comprehensive_health_check()
        print(f"   성공: {health_report['active_tools']}/{health_report['total_tools']} 도구 활성")
    except Exception as e:
        print(f"   실패: {e}")
        return False

    # 6. 도구 추천 테스트
    print("6. 도구 추천 시스템 테스트...")
    try:
        recommendations = agent.get_tool_recommendations("GitHub에서 코드 검색")
        print(f"   성공: {len(recommendations)}개 도구 추천됨")
        if recommendations:
            print(f"   최고 추천: {recommendations[0]['name']} (신뢰도: {recommendations[0]['confidence']:.1%})")
    except Exception as e:
        print(f"   실패: {e}")
        return False

    # 7. 간단한 워크플로우 실행 테스트
    print("7. 워크플로우 실행 테스트...")
    try:
        execution_id = await engine.execute_workflow("health_check", {"username": "test"})
        status = engine.get_workflow_status(execution_id)
        print(f"   성공: 워크플로우 '{status['name']}' 상태 - {status['status']}")
    except Exception as e:
        print(f"   실패: {e}")
        return False

    print("\n=== 모든 테스트 완료 ===")
    return True

async def test_integration():
    """통합 테스트"""
    print("\n=== 통합 테스트 ===")

    try:
        # 모든 컴포넌트 초기화
        agent = MCPMasterAgent()
        config = MCPConfigManager()
        engine = WorkflowEngine()
        monitor = MCPMonitor()

        # 시뮬레이션된 작업 부하
        print("시뮬레이션된 작업 부하 생성 중...")
        import random

        tools = list(agent.tools.keys())
        for i in range(50):
            tool = random.choice(tools)
            response_time = random.uniform(0.1, 3.0)
            success = random.random() > 0.1  # 90% 성공률
            monitor.record_tool_call(tool, response_time, success)

        # 성능 보고서 생성
        performance_report = agent.generate_performance_report()
        print(f"성능 보고서 생성됨:")
        top_performers = performance_report.get('top_performers', [])
        problem_tools = performance_report.get('problem_tools', [])
        print(f"  - 상위 성능 도구: {len(top_performers)}개")
        print(f"  - 문제 도구: {len(problem_tools)}개")

        # 건강 상태 보고서
        health_report = monitor.generate_health_report()
        print(f"건강 상태 보고서:")
        print(f"  - 전체 상태: {health_report['overall_health']}")
        print(f"  - 건강한 도구: {len(health_report['tool_status']['healthy'])}개")

        print("통합 테스트 완료")
        return True

    except Exception as e:
        print(f"통합 테스트 실패: {e}")
        return False

def main():
    """메인 테스트 실행"""
    print("MCP Master Agent 간단 테스트 시작")
    print("=" * 50)

    try:
        # 기본 기능 테스트
        basic_success = asyncio.run(test_basic_functionality())

        if basic_success:
            # 통합 테스트
            integration_success = asyncio.run(test_integration())

            if integration_success:
                print("\n모든 테스트 성공!")
                return True
            else:
                print("\n통합 테스트 실패")
                return False
        else:
            print("\n기본 기능 테스트 실패")
            return False

    except Exception as e:
        print(f"테스트 실행 중 오류: {e}")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)