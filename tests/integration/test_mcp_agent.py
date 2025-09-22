#!/usr/bin/env python3
"""
MCP Master Agent 테스트 스위트

작성자: Claude AI Assistant
버전: 1.0.0
최종 업데이트: 2025-09-19
"""

import unittest
import asyncio
import json
import tempfile
import os
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# 테스트할 모듈들 임포트
from mcp_master_agent import MCPMasterAgent, MCPStatus, MCPTool
from mcp_config import MCPConfigManager, MCPEnvironmentManager
from mcp_workflows import WorkflowEngine, WorkflowStatus
from mcp_monitor import MCPMonitor, PerformanceMetric

class TestMCPMasterAgent(unittest.TestCase):
    """MCP Master Agent 테스트"""

    def setUp(self):
        self.agent = MCPMasterAgent()

    def test_initialization(self):
        """초기화 테스트"""
        self.assertIsInstance(self.agent.tools, dict)
        self.assertGreater(len(self.agent.tools), 0)
        self.assertIsInstance(self.agent.workflows, dict)

    def test_tool_discovery(self):
        """도구 발견 테스트"""
        # 알려진 도구들이 초기화되었는지 확인
        expected_tools = [
            "mcp__supabase__",
            "mcp__github__",
            "mcp__context7__",
            "mcp__exa__"
        ]

        for tool in expected_tools:
            self.assertIn(tool, self.agent.tools)
            self.assertIsInstance(self.agent.tools[tool], MCPTool)

    async def test_health_check(self):
        """헬스체크 테스트"""
        health_report = await self.agent.comprehensive_health_check()

        self.assertIsInstance(health_report, dict)
        self.assertIn('timestamp', health_report)
        self.assertIn('total_tools', health_report)
        self.assertIn('active_tools', health_report)
        self.assertIn('tool_details', health_report)
        self.assertGreater(health_report['total_tools'], 0)

    def test_tool_recommendations(self):
        """도구 추천 테스트"""
        # GitHub 관련 작업
        recommendations = self.agent.get_tool_recommendations("GitHub 저장소에서 코드 검색")
        self.assertIsInstance(recommendations, list)
        self.assertGreater(len(recommendations), 0)

        # 첫 번째 추천이 GitHub 관련인지 확인
        github_found = any("github" in rec['tool'].lower() for rec in recommendations)
        self.assertTrue(github_found)

        # 데이터베이스 관련 작업
        recommendations = self.agent.get_tool_recommendations("데이터베이스 쿼리 실행")
        supabase_found = any("supabase" in rec['tool'].lower() for rec in recommendations)
        self.assertTrue(supabase_found)

    async def test_workflow_execution(self):
        """워크플로우 실행 테스트"""
        # 간단한 워크플로우 실행
        result = await self.agent.execute_workflow("health_check")

        self.assertIsInstance(result, dict)
        self.assertIn('execution_id', result)
        self.assertIn('status', result)
        self.assertIn('results', result)

    def test_performance_report(self):
        """성능 보고서 테스트"""
        # 일부 테스트 데이터 추가
        for tool_name in list(self.agent.tools.keys())[:3]:
            tool = self.agent.tools[tool_name]
            tool.success_count = 10
            tool.error_count = 1
            tool.response_time = 1.5

        report = self.agent.generate_performance_report()

        self.assertIsInstance(report, dict)
        self.assertIn('timestamp', report)
        self.assertIn('tools_summary', report)
        self.assertIn('performance_metrics', report)

class TestMCPConfig(unittest.TestCase):
    """MCP 설정 관리자 테스트"""

    def setUp(self):
        # 임시 설정 파일 사용
        self.temp_config = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        self.config_manager = MCPConfigManager(self.temp_config.name)

    def tearDown(self):
        # 임시 파일 정리
        if os.path.exists(self.temp_config.name):
            os.unlink(self.temp_config.name)

    def test_default_configurations(self):
        """기본 설정 테스트"""
        self.assertGreater(len(self.config_manager.configurations), 0)

        # 알려진 도구 설정 확인
        self.assertIn("mcp__github__", self.config_manager.configurations)
        github_config = self.config_manager.get_config("mcp__github__")
        self.assertIsNotNone(github_config)
        self.assertEqual(github_config.name, "GitHub")

    def test_config_validation(self):
        """설정 검증 테스트"""
        validation_report = self.config_manager.validate_configuration()

        self.assertIsInstance(validation_report, dict)
        self.assertIn('timestamp', validation_report)
        self.assertIn('total_configs', validation_report)
        self.assertIn('issues', validation_report)
        self.assertIn('warnings', validation_report)

    def test_config_update(self):
        """설정 업데이트 테스트"""
        original_timeout = self.config_manager.get_config("mcp__github__").timeout
        new_timeout = 60

        self.config_manager.update_config("mcp__github__", timeout=new_timeout)
        updated_timeout = self.config_manager.get_config("mcp__github__").timeout

        self.assertEqual(updated_timeout, new_timeout)
        self.assertNotEqual(updated_timeout, original_timeout)

    def test_enable_disable_tool(self):
        """도구 활성화/비활성화 테스트"""
        tool_name = "mcp__github__"

        # 비활성화
        self.config_manager.disable_tool(tool_name)
        self.assertFalse(self.config_manager.get_config(tool_name).enabled)

        # 활성화
        self.config_manager.enable_tool(tool_name)
        self.assertTrue(self.config_manager.get_config(tool_name).enabled)

class TestMCPEnvironment(unittest.TestCase):
    """MCP 환경 관리자 테스트"""

    def setUp(self):
        self.env_manager = MCPEnvironmentManager()

    def test_environment_validation(self):
        """환경 변수 검증 테스트"""
        validation = self.env_manager.validate_environment()

        self.assertIsInstance(validation, dict)
        self.assertIn('required_vars', validation)
        self.assertIn('optional_vars', validation)
        self.assertIn('recommendations', validation)

    def test_env_template_creation(self):
        """환경 변수 템플릿 생성 테스트"""
        template = self.env_manager.create_env_template()

        self.assertIsInstance(template, str)
        self.assertIn("GITHUB_TOKEN", template)
        self.assertIn("SUPABASE_URL", template)
        self.assertIn("MCP_DEBUG", template)

class TestWorkflowEngine(unittest.TestCase):
    """워크플로우 엔진 테스트"""

    def setUp(self):
        self.engine = WorkflowEngine()

    def test_workflow_templates_loading(self):
        """워크플로우 템플릿 로딩 테스트"""
        templates = self.engine.get_workflow_templates()

        self.assertIsInstance(templates, list)
        self.assertGreater(len(templates), 0)

        # 알려진 템플릿 확인
        template_names = [t['name'] for t in templates]
        self.assertIn("GitHub to Supabase Setup", template_names)
        self.assertIn("Comprehensive Health Check", template_names)

    async def test_workflow_execution(self):
        """워크플로우 실행 테스트"""
        # 헬스체크 워크플로우 실행
        execution_id = await self.engine.execute_workflow("health_check", {
            "username": "test_user"
        })

        self.assertIsInstance(execution_id, str)

        # 실행 상태 확인
        status = self.engine.get_workflow_status(execution_id)
        self.assertIsNotNone(status)
        self.assertIn('status', status)
        self.assertIn('total_steps', status)

    def test_workflow_listing(self):
        """워크플로우 목록 조회 테스트"""
        workflows = self.engine.list_workflows()
        self.assertIsInstance(workflows, list)

        # 상태별 필터링
        running_workflows = self.engine.list_workflows(WorkflowStatus.RUNNING)
        self.assertIsInstance(running_workflows, list)

class TestMCPMonitor(unittest.TestCase):
    """MCP 모니터 테스트"""

    def setUp(self):
        self.monitor = MCPMonitor(monitoring_interval=1)  # 빠른 테스트를 위해 1초

    def test_monitor_initialization(self):
        """모니터 초기화 테스트"""
        self.assertIsInstance(self.monitor.tool_metrics, dict)
        self.assertGreater(len(self.monitor.tool_metrics), 0)
        self.assertEqual(len(self.monitor.system_metrics), 0)

    def test_tool_call_recording(self):
        """도구 호출 기록 테스트"""
        tool_name = "mcp__github__"
        response_time = 1.5
        success = True

        initial_calls = self.monitor.tool_metrics[tool_name].total_calls

        self.monitor.record_tool_call(tool_name, response_time, success)

        metrics = self.monitor.tool_metrics[tool_name]
        self.assertEqual(metrics.total_calls, initial_calls + 1)
        self.assertEqual(metrics.successful_calls, 1)
        self.assertEqual(metrics.average_response_time, response_time)

    def test_dashboard_data_generation(self):
        """대시보드 데이터 생성 테스트"""
        # 테스트 데이터 추가
        for i in range(10):
            self.monitor.record_tool_call("mcp__github__", 1.0, True)
            self.monitor.record_tool_call("mcp__supabase__", 2.0, i % 5 != 0)  # 20% 실패율

        dashboard = self.monitor.get_dashboard_data()

        self.assertIsInstance(dashboard, dict)
        self.assertIn('overview', dashboard)
        self.assertIn('tools', dashboard)
        self.assertIn('alerts', dashboard)
        self.assertGreater(dashboard['overview']['total_calls'], 0)

    def test_tool_details(self):
        """도구 상세 정보 테스트"""
        tool_name = "mcp__github__"

        # 테스트 데이터 추가
        for i in range(5):
            self.monitor.record_tool_call(tool_name, 1.0 + i * 0.5, True)

        details = self.monitor.get_tool_details(tool_name)

        self.assertIsNotNone(details)
        self.assertIn('summary', details)
        self.assertIn('recent_activity', details)
        self.assertEqual(details['summary']['total_calls'], 5)

    def test_health_report_generation(self):
        """건강 상태 보고서 생성 테스트"""
        # 다양한 상태의 테스트 데이터 추가
        self.monitor.record_tool_call("mcp__github__", 1.0, True)  # 건강
        self.monitor.record_tool_call("mcp__supabase__", 3.0, True)  # 느림
        self.monitor.record_tool_call("mcp__exa__", 1.0, False)  # 오류

        report = self.monitor.generate_health_report()

        self.assertIsInstance(report, dict)
        self.assertIn('overall_health', report)
        self.assertIn('summary', report)
        self.assertIn('tool_status', report)
        self.assertIn('recommendations', report)

    async def test_system_metrics_collection(self):
        """시스템 메트릭 수집 테스트"""
        metrics = await self.monitor.collect_system_metrics()

        if metrics:  # None이 아닌 경우만 테스트
            self.assertIsInstance(metrics.cpu_usage, float)
            self.assertIsInstance(metrics.memory_usage, float)
            self.assertIsInstance(metrics.timestamp, datetime)

class TestIntegration(unittest.TestCase):
    """통합 테스트"""

    def setUp(self):
        self.agent = MCPMasterAgent()
        self.config = MCPConfigManager()
        self.engine = WorkflowEngine()
        self.monitor = MCPMonitor()

    async def test_full_workflow_with_monitoring(self):
        """모니터링과 함께하는 전체 워크플로우 테스트"""
        # 워크플로우 실행
        execution_id = await self.engine.execute_workflow("health_check")

        # 모니터링 데이터 기록 (시뮬레이션)
        for tool_name in self.agent.tools.keys():
            self.monitor.record_tool_call(tool_name, 1.0, True)

        # 결과 확인
        workflow_status = self.engine.get_workflow_status(execution_id)
        dashboard = self.monitor.get_dashboard_data()

        self.assertIsNotNone(workflow_status)
        self.assertGreater(dashboard['overview']['total_calls'], 0)

    def test_config_and_agent_integration(self):
        """설정과 에이전트 통합 테스트"""
        # 설정에서 활성화된 도구들 확인
        enabled_tools = self.config.get_enabled_tools()

        # 에이전트의 도구들과 비교
        for tool_prefix in enabled_tools.keys():
            if tool_prefix in self.agent.tools:
                tool = self.agent.tools[tool_prefix]
                self.assertIsInstance(tool, MCPTool)

def run_async_test(test_func):
    """비동기 테스트 실행 헬퍼"""
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(test_func)

# 비동기 테스트 메서드들을 동기화
async_test_methods = [
    (TestMCPMasterAgent, 'test_health_check'),
    (TestMCPMasterAgent, 'test_workflow_execution'),
    (TestWorkflowEngine, 'test_workflow_execution'),
    (TestMCPMonitor, 'test_system_metrics_collection'),
    (TestIntegration, 'test_full_workflow_with_monitoring')
]

for test_class, method_name in async_test_methods:
    original_method = getattr(test_class, method_name)
    def make_sync_method(async_method):
        def sync_method(self):
            return run_async_test(async_method(self))
        return sync_method
    setattr(test_class, method_name, make_sync_method(original_method))

class TestSuite:
    """테스트 스위트 실행기"""

    @staticmethod
    def run_all_tests():
        """모든 테스트 실행"""
        print("🧪 MCP Master Agent 테스트 스위트 실행")
        print("=" * 50)

        # 테스트 로더 생성
        loader = unittest.TestLoader()
        suite = unittest.TestSuite()

        # 테스트 클래스들 추가
        test_classes = [
            TestMCPMasterAgent,
            TestMCPConfig,
            TestMCPEnvironment,
            TestWorkflowEngine,
            TestMCPMonitor,
            TestIntegration
        ]

        for test_class in test_classes:
            tests = loader.loadTestsFromTestCase(test_class)
            suite.addTests(tests)

        # 테스트 실행
        runner = unittest.TextTestRunner(verbosity=2)
        result = runner.run(suite)

        # 결과 요약
        print("\n" + "=" * 50)
        print(f"📊 테스트 결과 요약:")
        print(f"실행된 테스트: {result.testsRun}")
        print(f"실패: {len(result.failures)}")
        print(f"오류: {len(result.errors)}")
        print(f"성공률: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")

        if result.failures:
            print(f"\n❌ 실패한 테스트:")
            for test, traceback in result.failures:
                print(f"  • {test}")

        if result.errors:
            print(f"\n💥 오류가 발생한 테스트:")
            for test, traceback in result.errors:
                print(f"  • {test}")

        return result.wasSuccessful()

if __name__ == '__main__':
    # 개별 테스트 실행 또는 전체 스위트 실행
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == '--suite':
        # 전체 테스트 스위트 실행
        success = TestSuite.run_all_tests()
        sys.exit(0 if success else 1)
    else:
        # 표준 unittest 실행
        unittest.main()