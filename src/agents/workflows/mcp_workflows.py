#!/usr/bin/env python3
"""
MCP Workflow Manager - 복합적인 MCP 워크플로우 관리 및 실행

작성자: Claude AI Assistant
버전: 1.0.0
최종 업데이트: 2025-09-19
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import uuid

logger = logging.getLogger(__name__)

class WorkflowStatus(Enum):
    """워크플로우 상태"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"

class StepStatus(Enum):
    """단계 상태"""
    WAITING = "waiting"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class WorkflowContext:
    """워크플로우 실행 컨텍스트"""
    variables: Dict[str, Any] = field(default_factory=dict)
    step_results: Dict[str, Any] = field(default_factory=dict)
    error_log: List[str] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

@dataclass
class WorkflowStep:
    """향상된 워크플로우 단계"""
    id: str
    tool: str
    action: str
    parameters: Dict[str, Any]
    dependencies: List[str] = field(default_factory=list)
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    timeout: int = 30
    retry_count: int = 3
    on_success: Optional[Dict[str, Any]] = None
    on_failure: Optional[Dict[str, Any]] = None
    status: StepStatus = StepStatus.WAITING
    result: Optional[Any] = None
    error: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

@dataclass
class Workflow:
    """향상된 워크플로우"""
    id: str
    name: str
    description: str
    steps: List[WorkflowStep]
    context: WorkflowContext = field(default_factory=WorkflowContext)
    status: WorkflowStatus = WorkflowStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

class WorkflowEngine:
    """워크플로우 실행 엔진"""

    def __init__(self):
        self.active_workflows: Dict[str, Workflow] = {}
        self.completed_workflows: Dict[str, Workflow] = {}
        self.workflow_templates: Dict[str, Workflow] = {}
        self.step_handlers: Dict[str, Callable] = {}
        self.load_builtin_templates()

    def load_builtin_templates(self):
        """내장 워크플로우 템플릿 로드"""
        logger.info("📋 내장 워크플로우 템플릿 로드")

        # 1. GitHub 저장소 분석 → Supabase 프로젝트 설정 워크플로우
        github_supabase_workflow = Workflow(
            id="github_to_supabase_setup",
            name="GitHub to Supabase Setup",
            description="GitHub 저장소 분석 후 Supabase 프로젝트 자동 설정",
            tags=["github", "supabase", "setup", "analysis"],
            steps=[
                WorkflowStep(
                    id="search_repo",
                    tool="mcp__github__",
                    action="search_repositories",
                    parameters={"query": "{repo_query}"},
                    timeout=30
                ),
                WorkflowStep(
                    id="analyze_repo",
                    tool="mcp__github__",
                    action="get_repository",
                    parameters={"owner": "{repo_owner}", "repo": "{repo_name}"},
                    dependencies=["search_repo"],
                    timeout=30
                ),
                WorkflowStep(
                    id="get_file_structure",
                    tool="mcp__github__",
                    action="get_file_contents",
                    parameters={"owner": "{repo_owner}", "repo": "{repo_name}", "path": "package.json"},
                    dependencies=["analyze_repo"],
                    timeout=30,
                    conditions=[
                        {"type": "file_exists", "path": "package.json"}
                    ]
                ),
                WorkflowStep(
                    id="list_supabase_projects",
                    tool="mcp__supabase__",
                    action="list_projects",
                    parameters={},
                    timeout=30
                ),
                WorkflowStep(
                    id="analyze_tech_stack",
                    tool="mcp__exa__",
                    action="web_search_exa",
                    parameters={"query": "{detected_framework} supabase integration guide"},
                    dependencies=["get_file_structure"],
                    timeout=45
                ),
                WorkflowStep(
                    id="create_supabase_project",
                    tool="mcp__supabase__",
                    action="create_project",
                    parameters={
                        "name": "{project_name}",
                        "organization_id": "{org_id}",
                        "region": "us-east-1"
                    },
                    dependencies=["list_supabase_projects", "analyze_tech_stack"],
                    timeout=120,
                    conditions=[
                        {"type": "approval_required", "message": "새 Supabase 프로젝트를 생성하시겠습니까?"}
                    ]
                )
            ]
        )

        # 2. 종합 프로젝트 헬스체크 워크플로우
        health_check_workflow = Workflow(
            id="comprehensive_health_check",
            name="Comprehensive Health Check",
            description="모든 연결된 서비스의 상태를 종합적으로 점검",
            tags=["monitoring", "health", "status"],
            steps=[
                WorkflowStep(
                    id="check_github_status",
                    tool="mcp__github__",
                    action="search_repositories",
                    parameters={"query": "user:{username}", "per_page": 1},
                    timeout=15
                ),
                WorkflowStep(
                    id="check_supabase_projects",
                    tool="mcp__supabase__",
                    action="list_projects",
                    parameters={},
                    timeout=30
                ),
                WorkflowStep(
                    id="check_ide_status",
                    tool="mcp__ide__",
                    action="getDiagnostics",
                    parameters={},
                    timeout=10
                ),
                WorkflowStep(
                    id="check_browser_automation",
                    tool="mcp__playwright__",
                    action="browser_snapshot",
                    parameters={},
                    timeout=20
                ),
                WorkflowStep(
                    id="system_resource_check",
                    tool="mcp__wonderwhy-er-desktop-commander__",
                    action="get_usage_stats",
                    parameters={},
                    timeout=15
                ),
                WorkflowStep(
                    id="generate_health_report",
                    tool="mcp__taskmanager__",
                    action="request_planning",
                    parameters={
                        "originalRequest": "Generate comprehensive health report",
                        "tasks": [
                            {"title": "Compile service status", "description": "Aggregate all service statuses"},
                            {"title": "Identify issues", "description": "Highlight any problems found"},
                            {"title": "Generate recommendations", "description": "Provide actionable recommendations"}
                        ]
                    },
                    dependencies=["check_github_status", "check_supabase_projects", "check_ide_status"]
                )
            ]
        )

        # 3. 프로젝트 초기화 워크플로우
        project_init_workflow = Workflow(
            id="project_initialization",
            name="Project Initialization",
            description="새 프로젝트의 완전 자동 초기화",
            tags=["initialization", "setup", "automation"],
            steps=[
                WorkflowStep(
                    id="create_github_repo",
                    tool="mcp__github__",
                    action="create_repository",
                    parameters={
                        "name": "{project_name}",
                        "description": "{project_description}",
                        "private": False,
                        "autoInit": True
                    },
                    timeout=30
                ),
                WorkflowStep(
                    id="setup_project_structure",
                    tool="mcp__wonderwhy-er-desktop-commander__",
                    action="create_directory",
                    parameters={"path": "{local_project_path}"},
                    timeout=10
                ),
                WorkflowStep(
                    id="init_package_json",
                    tool="mcp__github__",
                    action="create_or_update_file",
                    parameters={
                        "owner": "{github_username}",
                        "repo": "{project_name}",
                        "path": "package.json",
                        "content": "{package_json_content}",
                        "message": "feat: Initialize package.json",
                        "branch": "main"
                    },
                    dependencies=["create_github_repo"],
                    timeout=30
                ),
                WorkflowStep(
                    id="create_supabase_project",
                    tool="mcp__supabase__",
                    action="create_project",
                    parameters={
                        "name": "{project_name}-db",
                        "organization_id": "{org_id}",
                        "region": "us-east-1"
                    },
                    timeout=120
                ),
                WorkflowStep(
                    id="setup_ci_cd",
                    tool="mcp__github__",
                    action="create_or_update_file",
                    parameters={
                        "owner": "{github_username}",
                        "repo": "{project_name}",
                        "path": ".github/workflows/ci.yml",
                        "content": "{ci_workflow_content}",
                        "message": "feat: Add CI/CD workflow",
                        "branch": "main"
                    },
                    dependencies=["init_package_json"],
                    timeout=30
                ),
                WorkflowStep(
                    id="create_readme",
                    tool="mcp__github__",
                    action="create_or_update_file",
                    parameters={
                        "owner": "{github_username}",
                        "repo": "{project_name}",
                        "path": "README.md",
                        "content": "{readme_content}",
                        "message": "docs: Add comprehensive README",
                        "branch": "main"
                    },
                    dependencies=["setup_ci_cd"],
                    timeout=30
                )
            ]
        )

        # 4. 코드 품질 검사 워크플로우
        code_quality_workflow = Workflow(
            id="code_quality_check",
            name="Code Quality Check",
            description="코드 품질 종합 검사 및 개선 제안",
            tags=["quality", "analysis", "improvement"],
            steps=[
                WorkflowStep(
                    id="get_repo_files",
                    tool="mcp__github__",
                    action="search_code",
                    parameters={"q": "repo:{owner}/{repo} extension:py OR extension:js OR extension:ts"},
                    timeout=45
                ),
                WorkflowStep(
                    id="analyze_code_structure",
                    tool="mcp__ide__",
                    action="getDiagnostics",
                    parameters={},
                    dependencies=["get_repo_files"],
                    timeout=30
                ),
                WorkflowStep(
                    id="search_best_practices",
                    tool="mcp__exa__",
                    action="web_search_exa",
                    parameters={"query": "{language} code quality best practices 2025"},
                    timeout=30
                ),
                WorkflowStep(
                    id="get_documentation",
                    tool="mcp__context7__",
                    action="get_library_docs",
                    parameters={"context7CompatibleLibraryID": "{main_framework}"},
                    timeout=45
                ),
                WorkflowStep(
                    id="create_improvement_tasks",
                    tool="mcp__taskmanager__",
                    action="request_planning",
                    parameters={
                        "originalRequest": "Improve code quality based on analysis",
                        "tasks": "{improvement_tasks}"
                    },
                    dependencies=["analyze_code_structure", "search_best_practices"],
                    timeout=30
                )
            ]
        )

        self.workflow_templates = {
            "github_to_supabase": github_supabase_workflow,
            "health_check": health_check_workflow,
            "project_init": project_init_workflow,
            "code_quality": code_quality_workflow
        }

        logger.info(f"✅ {len(self.workflow_templates)}개 워크플로우 템플릿 로드 완료")

    async def execute_workflow(self, workflow_id: str, parameters: Dict[str, Any] = None) -> str:
        """워크플로우 실행"""
        if workflow_id not in self.workflow_templates:
            raise ValueError(f"워크플로우 템플릿 '{workflow_id}'를 찾을 수 없습니다")

        # 워크플로우 인스턴스 생성
        template = self.workflow_templates[workflow_id]
        instance = Workflow(
            id=str(uuid.uuid4()),
            name=template.name,
            description=template.description,
            steps=[self._copy_step(step) for step in template.steps],
            tags=template.tags.copy(),
            metadata=template.metadata.copy()
        )

        # 파라미터 설정
        if parameters:
            instance.context.variables.update(parameters)

        # 실행 시작
        instance.status = WorkflowStatus.RUNNING
        instance.context.start_time = datetime.now()
        self.active_workflows[instance.id] = instance

        logger.info(f"🚀 워크플로우 '{instance.name}' 실행 시작 (ID: {instance.id})")

        try:
            await self._execute_workflow_steps(instance)
            instance.status = WorkflowStatus.COMPLETED
            logger.info(f"✅ 워크플로우 '{instance.name}' 완료")

        except Exception as e:
            instance.status = WorkflowStatus.FAILED
            instance.context.error_log.append(str(e))
            logger.error(f"❌ 워크플로우 '{instance.name}' 실패: {e}")

        finally:
            instance.context.end_time = datetime.now()
            # 완료된 워크플로우를 보관
            self.completed_workflows[instance.id] = instance
            if instance.id in self.active_workflows:
                del self.active_workflows[instance.id]

        return instance.id

    def _copy_step(self, step: WorkflowStep) -> WorkflowStep:
        """워크플로우 단계 복사"""
        return WorkflowStep(
            id=step.id,
            tool=step.tool,
            action=step.action,
            parameters=step.parameters.copy(),
            dependencies=step.dependencies.copy(),
            conditions=step.conditions.copy(),
            timeout=step.timeout,
            retry_count=step.retry_count,
            on_success=step.on_success.copy() if step.on_success else None,
            on_failure=step.on_failure.copy() if step.on_failure else None
        )

    async def _execute_workflow_steps(self, workflow: Workflow):
        """워크플로우 단계들 실행"""
        step_map = {step.id: step for step in workflow.steps}
        completed_steps = set()

        while len(completed_steps) < len(workflow.steps):
            ready_steps = []

            for step in workflow.steps:
                if (step.id not in completed_steps and
                    step.status == StepStatus.WAITING and
                    all(dep in completed_steps for dep in step.dependencies)):
                    ready_steps.append(step)

            if not ready_steps:
                # 데드락 감지
                remaining_steps = [s for s in workflow.steps if s.id not in completed_steps]
                if remaining_steps:
                    raise RuntimeError(f"데드락 감지: 실행할 수 없는 단계들 - {[s.id for s in remaining_steps]}")
                break

            # 병렬 실행 가능한 단계들 실행
            tasks = []
            for step in ready_steps:
                tasks.append(self._execute_step(step, workflow.context))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for i, step in enumerate(ready_steps):
                if isinstance(results[i], Exception):
                    step.status = StepStatus.FAILED
                    step.error = str(results[i])
                    workflow.context.error_log.append(f"Step {step.id}: {step.error}")

                    # 실패 처리
                    if step.retry_count > 0:
                        step.retry_count -= 1
                        step.status = StepStatus.WAITING
                        continue
                    else:
                        # 치명적 오류인 경우 워크플로우 중단
                        raise results[i]
                else:
                    step.status = StepStatus.COMPLETED
                    step.result = results[i]
                    workflow.context.step_results[step.id] = results[i]
                    completed_steps.add(step.id)

    async def _execute_step(self, step: WorkflowStep, context: WorkflowContext) -> Any:
        """개별 단계 실행"""
        step.status = StepStatus.RUNNING
        step.start_time = datetime.now()

        logger.info(f"📍 단계 실행: {step.id} ({step.tool}.{step.action})")

        try:
            # 조건 확인
            if not await self._check_step_conditions(step, context):
                step.status = StepStatus.SKIPPED
                logger.info(f"⏭️ 단계 건너뜀: {step.id}")
                return None

            # 파라미터 처리
            processed_params = self._process_step_parameters(step.parameters, context)

            # MCP 도구 호출 시뮬레이션
            result = await self._simulate_mcp_call(step.tool, step.action, processed_params)

            step.end_time = datetime.now()
            logger.info(f"✅ 단계 완료: {step.id}")

            return result

        except Exception as e:
            step.end_time = datetime.now()
            logger.error(f"❌ 단계 실패: {step.id} - {e}")
            raise

    async def _check_step_conditions(self, step: WorkflowStep, context: WorkflowContext) -> bool:
        """단계 실행 조건 확인"""
        for condition in step.conditions:
            condition_type = condition.get("type")

            if condition_type == "approval_required":
                # 실제 구현에서는 사용자 승인 대기
                logger.info(f"🔔 승인 필요: {condition.get('message', '단계 실행 승인이 필요합니다')}")
                return True  # 시뮬레이션에서는 자동 승인

            elif condition_type == "file_exists":
                # 파일 존재 확인 (시뮬레이션)
                return True

            elif condition_type == "variable_exists":
                var_name = condition.get("variable")
                return var_name in context.variables

        return True

    def _process_step_parameters(self, params: Dict[str, Any], context: WorkflowContext) -> Dict[str, Any]:
        """단계 파라미터 처리 (템플릿 변수 치환)"""
        processed = {}

        for key, value in params.items():
            if isinstance(value, str) and value.startswith('{') and value.endswith('}'):
                var_name = value[1:-1]
                if var_name in context.variables:
                    processed[key] = context.variables[var_name]
                elif var_name in context.step_results:
                    processed[key] = context.step_results[var_name]
                else:
                    processed[key] = value  # 원래 값 유지
            elif isinstance(value, dict):
                processed[key] = self._process_step_parameters(value, context)
            elif isinstance(value, list):
                processed[key] = [
                    self._process_step_parameters(item, context) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                processed[key] = value

        return processed

    async def _simulate_mcp_call(self, tool: str, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """MCP 도구 호출 시뮬레이션"""
        await asyncio.sleep(0.5)  # 네트워크 지연 시뮬레이션

        # 도구별 모의 응답
        mock_responses = {
            ("mcp__github__", "search_repositories"): {
                "repositories": [
                    {"name": "test-repo", "stars": 100, "language": "Python"}
                ]
            },
            ("mcp__github__", "create_repository"): {
                "id": 123456,
                "name": params.get("name", "new-repo"),
                "full_name": f"user/{params.get('name', 'new-repo')}",
                "clone_url": f"https://github.com/user/{params.get('name', 'new-repo')}.git"
            },
            ("mcp__supabase__", "list_projects"): {
                "projects": [
                    {"id": "proj_1", "name": "test-project", "status": "active"}
                ]
            },
            ("mcp__supabase__", "create_project"): {
                "id": f"proj_{datetime.now().timestamp()}",
                "name": params.get("name", "new-project"),
                "status": "provisioning"
            },
            ("mcp__exa__", "web_search_exa"): {
                "results": [
                    {"title": "Best Practices Guide", "url": "https://example.com/guide"}
                ]
            }
        }

        key = (tool, action)
        if key in mock_responses:
            return mock_responses[key]

        return {
            "simulated": True,
            "tool": tool,
            "action": action,
            "parameters": params,
            "timestamp": datetime.now().isoformat()
        }

    def get_workflow_status(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """워크플로우 상태 조회"""
        workflow = (self.active_workflows.get(workflow_id) or
                   self.completed_workflows.get(workflow_id))

        if not workflow:
            return None

        return {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status.value,
            "created_at": workflow.created_at.isoformat(),
            "start_time": workflow.context.start_time.isoformat() if workflow.context.start_time else None,
            "end_time": workflow.context.end_time.isoformat() if workflow.context.end_time else None,
            "total_steps": len(workflow.steps),
            "completed_steps": sum(1 for s in workflow.steps if s.status == StepStatus.COMPLETED),
            "failed_steps": sum(1 for s in workflow.steps if s.status == StepStatus.FAILED),
            "step_details": [
                {
                    "id": step.id,
                    "tool": step.tool,
                    "action": step.action,
                    "status": step.status.value,
                    "error": step.error
                }
                for step in workflow.steps
            ],
            "error_log": workflow.context.error_log
        }

    def list_workflows(self, status_filter: Optional[WorkflowStatus] = None) -> List[Dict[str, Any]]:
        """워크플로우 목록 조회"""
        all_workflows = {**self.active_workflows, **self.completed_workflows}

        workflows = []
        for workflow in all_workflows.values():
            if status_filter is None or workflow.status == status_filter:
                workflows.append({
                    "id": workflow.id,
                    "name": workflow.name,
                    "status": workflow.status.value,
                    "created_at": workflow.created_at.isoformat(),
                    "tags": workflow.tags,
                    "progress": sum(1 for s in workflow.steps if s.status == StepStatus.COMPLETED) / len(workflow.steps)
                })

        return sorted(workflows, key=lambda x: x["created_at"], reverse=True)

    def get_workflow_templates(self) -> List[Dict[str, Any]]:
        """사용 가능한 워크플로우 템플릿 목록"""
        return [
            {
                "id": template_id,
                "name": template.name,
                "description": template.description,
                "tags": template.tags,
                "steps_count": len(template.steps),
                "estimated_duration": sum(step.timeout for step in template.steps)
            }
            for template_id, template in self.workflow_templates.items()
        ]

    async def cancel_workflow(self, workflow_id: str) -> bool:
        """워크플로우 취소"""
        if workflow_id in self.active_workflows:
            workflow = self.active_workflows[workflow_id]
            workflow.status = WorkflowStatus.CANCELLED
            workflow.context.end_time = datetime.now()

            # 실행 중인 단계들 취소
            for step in workflow.steps:
                if step.status == StepStatus.RUNNING:
                    step.status = StepStatus.FAILED
                    step.error = "Workflow cancelled"

            logger.info(f"🚫 워크플로우 '{workflow.name}' 취소됨")
            return True

        return False

if __name__ == "__main__":
    # 워크플로우 엔진 테스트
    async def main():
        print("🔄 MCP 워크플로우 엔진 테스트")
        print("=" * 50)

        engine = WorkflowEngine()

        # 사용 가능한 템플릿 확인
        templates = engine.get_workflow_templates()
        print(f"\n📋 사용 가능한 워크플로우 템플릿: {len(templates)}")
        for template in templates:
            print(f"- {template['name']}: {template['description']}")

        # 헬스체크 워크플로우 실행
        print(f"\n🚀 헬스체크 워크플로우 실행")
        workflow_id = await engine.execute_workflow("health_check", {
            "username": "test_user"
        })

        # 실행 결과 확인
        status = engine.get_workflow_status(workflow_id)
        print(f"✅ 워크플로우 상태: {status['status']}")
        print(f"완료된 단계: {status['completed_steps']}/{status['total_steps']}")

        if status['error_log']:
            print(f"오류 로그: {status['error_log']}")

        print("\n✅ 워크플로우 엔진 테스트 완료")

    asyncio.run(main())