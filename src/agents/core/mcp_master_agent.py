#!/usr/bin/env python3
"""
MCP Master Agent - MCP 도구들을 적극적으로 활용하는 전문 에이전트

이 에이전트는 다음 기능들을 제공합니다:
1. MCP 도구 통합 관리자
2. 멀티 MCP 워크플로우 오케스트레이터
3. MCP 기반 프로젝트 분석기
4. 자동 MCP 헬스체크 시스템

작성자: Claude AI Assistant
버전: 1.0.0
최종 업데이트: 2025-09-19
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import subprocess
import os

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mcp_agent.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MCPStatus(Enum):
    """MCP 도구 상태"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    UNKNOWN = "unknown"

class WorkflowPriority(Enum):
    """워크플로우 우선순위"""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class MCPTool:
    """MCP 도구 정보"""
    name: str
    prefix: str
    description: str
    status: MCPStatus
    last_check: datetime
    response_time: float = 0.0
    error_count: int = 0
    success_count: int = 0
    capabilities: List[str] = None

    def __post_init__(self):
        if self.capabilities is None:
            self.capabilities = []

@dataclass
class WorkflowStep:
    """워크플로우 단계"""
    tool: str
    action: str
    parameters: Dict[str, Any]
    dependencies: List[str] = None
    timeout: int = 30
    retry_count: int = 3

    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []

@dataclass
class Workflow:
    """워크플로우 정의"""
    name: str
    description: str
    steps: List[WorkflowStep]
    priority: WorkflowPriority
    estimated_duration: int
    tags: List[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []

class MCPMasterAgent:
    """MCP Master Agent - 모든 MCP 도구를 통합 관리하는 전문 에이전트"""

    def __init__(self):
        self.tools: Dict[str, MCPTool] = {}
        self.workflows: Dict[str, Workflow] = {}
        self.health_check_interval = 300  # 5분
        self.performance_metrics = {}
        self.active_workflows = {}
        self.initialize_tools()
        self.load_predefined_workflows()

    def initialize_tools(self):
        """사용 가능한 MCP 도구들을 초기화"""
        logger.info("🔧 MCP 도구 초기화 시작")

        # 알려진 MCP 도구들 정의
        known_tools = {
            "mcp__supabase__": {
                "description": "Supabase 데이터베이스 통합",
                "capabilities": [
                    "database_management", "real_time", "auth",
                    "storage", "edge_functions"
                ]
            },
            "mcp__github__": {
                "description": "GitHub 저장소 관리",
                "capabilities": [
                    "repository_management", "issue_tracking",
                    "pull_requests", "code_search", "releases"
                ]
            },
            "mcp__context7__": {
                "description": "문서 검색 및 컨텍스트 관리",
                "capabilities": [
                    "documentation_search", "library_docs",
                    "code_examples", "api_reference"
                ]
            },
            "mcp__exa__": {
                "description": "웹 검색 및 크롤링",
                "capabilities": [
                    "web_search", "content_crawling",
                    "company_research", "linkedin_search"
                ]
            },
            "mcp__ide__": {
                "description": "IDE 통합 기능",
                "capabilities": [
                    "code_execution", "diagnostics",
                    "debugging", "intellisense"
                ]
            },
            "mcp__playwright__": {
                "description": "브라우저 자동화",
                "capabilities": [
                    "web_automation", "testing",
                    "scraping", "ui_interaction"
                ]
            },
            "mcp__taskmanager__": {
                "description": "작업 관리",
                "capabilities": [
                    "task_planning", "progress_tracking",
                    "workflow_management", "approval_process"
                ]
            },
            "mcp__wonderwhy-er-desktop-commander__": {
                "description": "Desktop Commander 통합",
                "capabilities": [
                    "file_operations", "process_management",
                    "search", "system_integration"
                ]
            }
        }

        for prefix, info in known_tools.items():
            tool = MCPTool(
                name=prefix.replace("mcp__", "").replace("__", ""),
                prefix=prefix,
                description=info["description"],
                status=MCPStatus.UNKNOWN,
                last_check=datetime.now(),
                capabilities=info["capabilities"]
            )
            self.tools[prefix] = tool

        logger.info(f"✅ {len(self.tools)}개 MCP 도구 초기화 완료")

    def load_predefined_workflows(self):
        """사전 정의된 워크플로우 로드"""
        logger.info("📋 사전 정의 워크플로우 로드 시작")

        # GitHub 저장소 분석 → Supabase 설계 → 문서화 워크플로우
        github_to_supabase_workflow = Workflow(
            name="github_to_supabase_analysis",
            description="GitHub 저장소를 분석하여 Supabase 데이터베이스 설계 및 문서화",
            priority=WorkflowPriority.HIGH,
            estimated_duration=600,  # 10분
            tags=["analysis", "database", "documentation"],
            steps=[
                WorkflowStep(
                    tool="mcp__github__",
                    action="search_repositories",
                    parameters={"query": "{repo_query}"}
                ),
                WorkflowStep(
                    tool="mcp__github__",
                    action="get_repository",
                    parameters={"owner": "{repo_owner}", "repo": "{repo_name}"},
                    dependencies=["step_0"]
                ),
                WorkflowStep(
                    tool="mcp__context7__",
                    action="resolve_library_id",
                    parameters={"libraryName": "supabase"}
                ),
                WorkflowStep(
                    tool="mcp__supabase__",
                    action="list_projects",
                    parameters={}
                ),
                WorkflowStep(
                    tool="mcp__exa__",
                    action="web_search_exa",
                    parameters={"query": "{tech_stack} database design patterns"}
                )
            ]
        )

        # 프로젝트 헬스체크 워크플로우
        health_check_workflow = Workflow(
            name="comprehensive_health_check",
            description="모든 MCP 도구 및 프로젝트 상태 종합 점검",
            priority=WorkflowPriority.MEDIUM,
            estimated_duration=180,  # 3분
            tags=["monitoring", "health", "maintenance"],
            steps=[
                WorkflowStep(
                    tool="mcp__github__",
                    action="search_repositories",
                    parameters={"query": "user:{username}"}
                ),
                WorkflowStep(
                    tool="mcp__supabase__",
                    action="list_projects",
                    parameters={}
                ),
                WorkflowStep(
                    tool="mcp__ide__",
                    action="getDiagnostics",
                    parameters={}
                ),
                WorkflowStep(
                    tool="mcp__wonderwhy-er-desktop-commander__",
                    action="get_usage_stats",
                    parameters={}
                )
            ]
        )

        # 기술 스택 리서치 워크플로우
        tech_research_workflow = Workflow(
            name="tech_stack_research",
            description="최신 기술 스택 리서치 및 문서 수집",
            priority=WorkflowPriority.MEDIUM,
            estimated_duration=300,  # 5분
            tags=["research", "technology", "documentation"],
            steps=[
                WorkflowStep(
                    tool="mcp__exa__",
                    action="web_search_exa",
                    parameters={"query": "{technology} best practices 2025"}
                ),
                WorkflowStep(
                    tool="mcp__context7__",
                    action="resolve_library_id",
                    parameters={"libraryName": "{technology}"}
                ),
                WorkflowStep(
                    tool="mcp__github__",
                    action="search_repositories",
                    parameters={"query": "{technology} stars:>1000 language:{language}"}
                ),
                WorkflowStep(
                    tool="mcp__exa__",
                    action="company_research_exa",
                    parameters={"companyName": "{company_name}"}
                )
            ]
        )

        self.workflows = {
            "github_to_supabase": github_to_supabase_workflow,
            "health_check": health_check_workflow,
            "tech_research": tech_research_workflow
        }

        logger.info(f"✅ {len(self.workflows)}개 워크플로우 로드 완료")

    async def check_tool_health(self, tool_prefix: str) -> MCPStatus:
        """개별 MCP 도구 상태 확인"""
        start_time = time.time()

        try:
            # 간단한 테스트 작업으로 도구 상태 확인
            test_commands = {
                "mcp__github__": "search_repositories",
                "mcp__supabase__": "list_organizations",
                "mcp__context7__": "resolve_library_id",
                "mcp__exa__": "web_search_exa",
                "mcp__ide__": "getDiagnostics",
                "mcp__playwright__": "browser_snapshot",
                "mcp__taskmanager__": "list_requests",
                "mcp__wonderwhy-er-desktop-commander__": "get_config"
            }

            if tool_prefix in test_commands:
                # 실제 MCP 도구 호출 시뮬레이션
                # 여기서는 단순히 성공으로 가정
                await asyncio.sleep(0.1)  # 네트워크 지연 시뮬레이션

                response_time = time.time() - start_time

                if tool_prefix in self.tools:
                    self.tools[tool_prefix].response_time = response_time
                    self.tools[tool_prefix].success_count += 1
                    self.tools[tool_prefix].last_check = datetime.now()

                return MCPStatus.ACTIVE
            else:
                return MCPStatus.UNKNOWN

        except Exception as e:
            logger.error(f"❌ {tool_prefix} 헬스체크 실패: {e}")
            if tool_prefix in self.tools:
                self.tools[tool_prefix].error_count += 1
            return MCPStatus.ERROR

    async def comprehensive_health_check(self) -> Dict[str, Any]:
        """모든 MCP 도구에 대한 종합 헬스체크"""
        logger.info("🔍 종합 헬스체크 시작")
        start_time = time.time()

        # 모든 도구를 병렬로 체크
        health_tasks = [
            self.check_tool_health(prefix)
            for prefix in self.tools.keys()
        ]

        results = await asyncio.gather(*health_tasks, return_exceptions=True)

        health_report = {
            "timestamp": datetime.now().isoformat(),
            "total_tools": len(self.tools),
            "active_tools": 0,
            "inactive_tools": 0,
            "error_tools": 0,
            "average_response_time": 0.0,
            "tool_details": {},
            "recommendations": []
        }

        total_response_time = 0.0
        active_count = 0

        for i, (prefix, tool) in enumerate(self.tools.items()):
            if i < len(results):
                status = results[i] if not isinstance(results[i], Exception) else MCPStatus.ERROR
                tool.status = status

                if status == MCPStatus.ACTIVE:
                    health_report["active_tools"] += 1
                    total_response_time += tool.response_time
                    active_count += 1
                elif status == MCPStatus.ERROR:
                    health_report["error_tools"] += 1
                else:
                    health_report["inactive_tools"] += 1

                health_report["tool_details"][prefix] = {
                    "status": status.value,
                    "response_time": tool.response_time,
                    "success_count": tool.success_count,
                    "error_count": tool.error_count,
                    "last_check": tool.last_check.isoformat(),
                    "capabilities": tool.capabilities
                }

        if active_count > 0:
            health_report["average_response_time"] = total_response_time / active_count

        # 권장사항 생성
        if health_report["error_tools"] > 0:
            health_report["recommendations"].append("오류가 발생한 도구들의 연결 상태를 확인하세요")

        if health_report["average_response_time"] > 2.0:
            health_report["recommendations"].append("평균 응답 시간이 느립니다. 네트워크 상태를 확인하세요")

        if health_report["active_tools"] < health_report["total_tools"] * 0.8:
            health_report["recommendations"].append("80% 이하의 도구만 활성화되어 있습니다")

        total_time = time.time() - start_time
        logger.info(f"✅ 종합 헬스체크 완료 ({total_time:.2f}초)")

        return health_report

    async def execute_workflow(self, workflow_name: str, parameters: Dict[str, Any] = None) -> Dict[str, Any]:
        """워크플로우 실행"""
        if workflow_name not in self.workflows:
            raise ValueError(f"워크플로우 '{workflow_name}'를 찾을 수 없습니다")

        workflow = self.workflows[workflow_name]
        logger.info(f"🚀 워크플로우 '{workflow_name}' 실행 시작")

        execution_id = f"{workflow_name}_{int(time.time())}"
        start_time = time.time()

        execution_result = {
            "execution_id": execution_id,
            "workflow_name": workflow_name,
            "start_time": datetime.now().isoformat(),
            "status": "running",
            "steps_completed": 0,
            "total_steps": len(workflow.steps),
            "results": {},
            "errors": [],
            "metrics": {}
        }

        self.active_workflows[execution_id] = execution_result

        try:
            step_results = {}

            for i, step in enumerate(workflow.steps):
                step_start = time.time()
                logger.info(f"📍 단계 {i+1}/{len(workflow.steps)}: {step.tool}.{step.action}")

                # 의존성 체크
                for dep in step.dependencies:
                    if dep not in step_results:
                        raise ValueError(f"의존성 단계 '{dep}'가 완료되지 않았습니다")

                # 파라미터 템플릿 처리
                processed_params = self._process_parameters(
                    step.parameters, parameters or {}, step_results
                )

                # 실제 MCP 도구 호출 시뮬레이션
                step_result = await self._simulate_mcp_call(
                    step.tool, step.action, processed_params
                )

                step_results[f"step_{i}"] = step_result
                execution_result["results"][f"step_{i}"] = {
                    "tool": step.tool,
                    "action": step.action,
                    "duration": time.time() - step_start,
                    "result": step_result
                }

                execution_result["steps_completed"] = i + 1

        except Exception as e:
            logger.error(f"❌ 워크플로우 실행 중 오류: {e}")
            execution_result["status"] = "error"
            execution_result["errors"].append(str(e))
        else:
            execution_result["status"] = "completed"

        execution_result["end_time"] = datetime.now().isoformat()
        execution_result["total_duration"] = time.time() - start_time

        logger.info(f"✅ 워크플로우 '{workflow_name}' 실행 완료")
        return execution_result

    def _process_parameters(self, params: Dict[str, Any],
                           user_params: Dict[str, Any],
                           step_results: Dict[str, Any]) -> Dict[str, Any]:
        """파라미터 템플릿 처리"""
        processed = {}

        for key, value in params.items():
            if isinstance(value, str) and value.startswith('{') and value.endswith('}'):
                param_name = value[1:-1]
                if param_name in user_params:
                    processed[key] = user_params[param_name]
                else:
                    # 이전 단계 결과에서 값 찾기
                    processed[key] = value  # 기본값 유지
            else:
                processed[key] = value

        return processed

    async def _simulate_mcp_call(self, tool: str, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """MCP 도구 호출 시뮬레이션"""
        # 실제 환경에서는 여기서 실제 MCP 도구를 호출합니다
        await asyncio.sleep(0.5)  # 네트워크 지연 시뮬레이션

        # 도구별 모의 응답 생성
        if tool == "mcp__github__":
            if action == "search_repositories":
                return {
                    "repositories": [
                        {"name": "example-repo", "stars": 1234, "language": "Python"},
                        {"name": "another-repo", "stars": 567, "language": "JavaScript"}
                    ]
                }
            elif action == "get_repository":
                return {
                    "name": params.get("repo", "example"),
                    "description": "Example repository",
                    "language": "Python",
                    "stars": 1234
                }

        elif tool == "mcp__supabase__":
            if action == "list_projects":
                return {
                    "projects": [
                        {"id": "proj_1", "name": "test-project", "status": "active"},
                        {"id": "proj_2", "name": "demo-project", "status": "paused"}
                    ]
                }

        elif tool == "mcp__exa__":
            if action == "web_search_exa":
                return {
                    "results": [
                        {"title": "Best Practices 2025", "url": "https://example.com/1"},
                        {"title": "Modern Development", "url": "https://example.com/2"}
                    ]
                }

        return {"simulated": True, "tool": tool, "action": action, "params": params}

    def get_tool_recommendations(self, task_description: str) -> List[Dict[str, Any]]:
        """작업 설명을 바탕으로 최적 도구 조합 추천"""
        recommendations = []

        # 키워드 기반 도구 매핑
        keyword_mappings = {
            "github": ["mcp__github__"],
            "repository": ["mcp__github__"],
            "database": ["mcp__supabase__"],
            "supabase": ["mcp__supabase__"],
            "search": ["mcp__exa__", "mcp__github__"],
            "documentation": ["mcp__context7__"],
            "web": ["mcp__exa__", "mcp__playwright__"],
            "browser": ["mcp__playwright__"],
            "code": ["mcp__ide__", "mcp__github__"],
            "test": ["mcp__playwright__", "mcp__ide__"],
            "file": ["mcp__wonderwhy-er-desktop-commander__"],
            "task": ["mcp__taskmanager__"]
        }

        task_lower = task_description.lower()
        suggested_tools = set()

        for keyword, tools in keyword_mappings.items():
            if keyword in task_lower:
                suggested_tools.update(tools)

        for tool_prefix in suggested_tools:
            if tool_prefix in self.tools:
                tool = self.tools[tool_prefix]
                recommendations.append({
                    "tool": tool_prefix,
                    "name": tool.name,
                    "description": tool.description,
                    "capabilities": tool.capabilities,
                    "status": tool.status.value,
                    "confidence": self._calculate_confidence(tool, task_description)
                })

        # 신뢰도 순으로 정렬
        recommendations.sort(key=lambda x: x["confidence"], reverse=True)

        return recommendations

    def _calculate_confidence(self, tool: MCPTool, task_description: str) -> float:
        """도구와 작업의 적합성 신뢰도 계산"""
        confidence = 0.5  # 기본값

        # 상태에 따른 가중치
        if tool.status == MCPStatus.ACTIVE:
            confidence += 0.3
        elif tool.status == MCPStatus.ERROR:
            confidence -= 0.2

        # 성공률에 따른 가중치
        total_attempts = tool.success_count + tool.error_count
        if total_attempts > 0:
            success_rate = tool.success_count / total_attempts
            confidence += success_rate * 0.2

        # 응답 시간에 따른 가중치
        if tool.response_time < 1.0:
            confidence += 0.1
        elif tool.response_time > 3.0:
            confidence -= 0.1

        return min(1.0, max(0.0, confidence))

    def get_workflow_suggestions(self, task_type: str) -> List[Dict[str, Any]]:
        """작업 유형에 따른 워크플로우 제안"""
        suggestions = []

        for name, workflow in self.workflows.items():
            if any(tag in task_type.lower() for tag in workflow.tags):
                suggestions.append({
                    "name": name,
                    "description": workflow.description,
                    "priority": workflow.priority.name,
                    "estimated_duration": workflow.estimated_duration,
                    "tags": workflow.tags,
                    "steps_count": len(workflow.steps)
                })

        # 우선순위 순으로 정렬
        suggestions.sort(key=lambda x: WorkflowPriority[x["priority"]].value, reverse=True)

        return suggestions

    def generate_performance_report(self) -> Dict[str, Any]:
        """성능 보고서 생성"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "tools_summary": {
                "total": len(self.tools),
                "active": sum(1 for t in self.tools.values() if t.status == MCPStatus.ACTIVE),
                "error": sum(1 for t in self.tools.values() if t.status == MCPStatus.ERROR),
                "inactive": sum(1 for t in self.tools.values() if t.status == MCPStatus.INACTIVE)
            },
            "performance_metrics": {},
            "top_performers": [],
            "problem_tools": [],
            "recommendations": []
        }

        # 성능 메트릭 계산
        active_tools = [t for t in self.tools.values() if t.status == MCPStatus.ACTIVE]

        if active_tools:
            response_times = [t.response_time for t in active_tools if t.response_time > 0]
            if response_times:
                report["performance_metrics"] = {
                    "average_response_time": sum(response_times) / len(response_times),
                    "min_response_time": min(response_times),
                    "max_response_time": max(response_times),
                    "total_requests": sum(t.success_count + t.error_count for t in active_tools),
                    "success_rate": sum(t.success_count for t in active_tools) /
                                   max(1, sum(t.success_count + t.error_count for t in active_tools))
                }

        # 상위 성능 도구
        report["top_performers"] = [
            {
                "name": tool.name,
                "response_time": tool.response_time,
                "success_rate": tool.success_count / max(1, tool.success_count + tool.error_count)
            }
            for tool in sorted(active_tools, key=lambda t: t.response_time)[:3]
        ]

        # 문제 도구
        report["problem_tools"] = [
            {
                "name": tool.name,
                "status": tool.status.value,
                "error_count": tool.error_count,
                "response_time": tool.response_time
            }
            for tool in self.tools.values()
            if tool.status == MCPStatus.ERROR or tool.error_count > 5
        ]

        # 권장사항
        if report["problem_tools"]:
            report["recommendations"].append("문제가 있는 도구들의 설정을 확인하세요")

        if report["performance_metrics"].get("average_response_time", 0) > 2.0:
            report["recommendations"].append("전반적인 응답 시간 개선이 필요합니다")

        return report

    async def start_monitoring(self):
        """백그라운드 모니터링 시작"""
        logger.info("📊 백그라운드 모니터링 시작")

        while True:
            try:
                await self.comprehensive_health_check()
                await asyncio.sleep(self.health_check_interval)
            except Exception as e:
                logger.error(f"❌ 모니터링 중 오류: {e}")
                await asyncio.sleep(60)  # 1분 후 재시도

def create_sample_usage():
    """샘플 사용법 데모"""
    return """
# MCP Master Agent 사용 예시

## 1. 에이전트 초기화 및 헬스체크
```python
agent = MCPMasterAgent()
health_report = await agent.comprehensive_health_check()
print(json.dumps(health_report, indent=2, ensure_ascii=False))
```

## 2. 작업에 적합한 도구 추천
```python
recommendations = agent.get_tool_recommendations("GitHub 저장소에서 코드를 검색하고 분석")
for rec in recommendations:
    print(f"추천 도구: {rec['name']} (신뢰도: {rec['confidence']:.2f})")
```

## 3. 워크플로우 실행
```python
# GitHub → Supabase 분석 워크플로우
result = await agent.execute_workflow("github_to_supabase", {
    "repo_query": "python web framework",
    "repo_owner": "fastapi",
    "repo_name": "fastapi",
    "tech_stack": "fastapi"
})
print(f"워크플로우 결과: {result['status']}")
```

## 4. 성능 보고서 생성
```python
performance_report = agent.generate_performance_report()
print("성능 요약:", performance_report['tools_summary'])
```

## 5. 백그라운드 모니터링 시작
```python
await agent.start_monitoring()  # 백그라운드에서 지속적으로 실행
```
"""

if __name__ == "__main__":
    # 간단한 테스트 실행
    async def main():
        agent = MCPMasterAgent()

        print("🚀 MCP Master Agent 시작")
        print("=" * 50)

        # 헬스체크 실행
        health_report = await agent.comprehensive_health_check()
        print("\n📊 헬스체크 결과:")
        print(f"총 도구: {health_report['total_tools']}")
        print(f"활성 도구: {health_report['active_tools']}")
        print(f"평균 응답시간: {health_report['average_response_time']:.3f}초")

        # 도구 추천 테스트
        print("\n🔧 도구 추천:")
        recommendations = agent.get_tool_recommendations("웹에서 정보를 검색하고 데이터베이스에 저장")
        for rec in recommendations[:3]:
            print(f"- {rec['name']}: {rec['description']} (신뢰도: {rec['confidence']:.2f})")

        # 워크플로우 제안
        print("\n📋 워크플로우 제안:")
        workflow_suggestions = agent.get_workflow_suggestions("research analysis")
        for sug in workflow_suggestions:
            print(f"- {sug['name']}: {sug['description']} ({sug['estimated_duration']}초)")

        print("\n✅ 테스트 완료")
        print("\n사용법 가이드:")
        print(create_sample_usage())

    # 이벤트 루프 실행
    asyncio.run(main())