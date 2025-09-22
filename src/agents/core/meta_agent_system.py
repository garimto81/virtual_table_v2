#!/usr/bin/env python3
"""
Advanced Meta Agent System - 여러 하위 에이전트들을 적극적으로 활용하고 조합하는 메타 에이전트

주요 기능:
1. 멀티 에이전트 워크플로우 매니저
2. 지능형 에이전트 선택기  
3. 협업 에이전트 시스템
4. 메타 에이전트 분석기
5. 자동 에이전트 체인 구성기

작성자: Claude AI Assistant
버전: 1.0.0
최종 업데이트: 2025-09-19
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set, Union
from dataclasses import dataclass, asdict, field
from enum import Enum
import threading
import queue
import uuid
from abc import ABC, abstractmethod
import networkx as nx
import numpy as np

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('meta_agent.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AgentRole(Enum):
    """에이전트 역할 분류"""
    BACKEND_ARCHITECT = "backend-architect"
    PYTHON_PRO = "python-pro"
    FRONTEND_DEVELOPER = "frontend-developer"
    TYPESCRIPT_EXPERT = "typescript-expert"
    TEST_AUTOMATOR = "test-automator"
    QA_ENGINEER = "qa-engineer"
    SECURITY_AUDITOR = "security-auditor"
    PENETRATION_TESTER = "penetration-tester"
    PERFORMANCE_ENGINEER = "performance-engineer"
    DATABASE_OPTIMIZER = "database-optimizer"
    DEPLOYMENT_ENGINEER = "deployment-engineer"
    DEVOPS_EXPERT = "devops-expert"
    SYSTEM_DESIGNER = "system-designer"
    DATA_SCIENTIST = "data-scientist"
    ML_ENGINEER = "ml-engineer"
    UI_UX_DESIGNER = "ui-ux-designer"

class ExecutionMode(Enum):
    """실행 모드"""
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    PIPELINE = "pipeline"
    ADAPTIVE = "adaptive"

class AgentStatus(Enum):
    """에이전트 상태"""
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    OFFLINE = "offline"

@dataclass
class AgentCapability:
    """에이전트 역량 정의"""
    name: str
    skill_level: float  # 0.0 ~ 1.0
    domain: str
    keywords: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)

@dataclass
class SubAgent:
    """하위 에이전트 정의"""
    id: str
    role: AgentRole
    name: str
    description: str
    capabilities: List[AgentCapability]
    status: AgentStatus = AgentStatus.IDLE
    load_factor: float = 0.0  # 현재 부하 (0.0 ~ 1.0)
    success_rate: float = 1.0
    average_response_time: float = 0.0
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    last_activity: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        if not self.capabilities:
            self.capabilities = []

@dataclass 
class TaskDefinition:
    """작업 정의"""
    id: str
    title: str
    description: str
    priority: int  # 1(낮음) ~ 10(높음)
    estimated_duration: int  # 초
    required_skills: List[str] = field(default_factory=list)
    required_agents: List[AgentRole] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    input_data: Dict[str, Any] = field(default_factory=dict)
    output_schema: Dict[str, Any] = field(default_factory=dict)
    timeout: int = 300  # 기본 5분
    retry_count: int = 3

@dataclass
class AgentChain:
    """에이전트 체인 정의"""
    id: str
    name: str
    description: str
    agents: List[str]  # 에이전트 ID 순서
    execution_mode: ExecutionMode
    data_flow: Dict[str, str] = field(default_factory=dict)  # 출력->입력 매핑
    conditional_logic: Dict[str, Any] = field(default_factory=dict)
    
@dataclass
class WorkflowExecution:
    """워크플로우 실행 상태"""
    id: str
    chain_id: str
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None
    current_agent: Optional[str] = None
    completed_agents: List[str] = field(default_factory=list)
    results: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    metrics: Dict[str, float] = field(default_factory=dict)

class AgentInterface(ABC):
    """에이전트 인터페이스"""
    
    @abstractmethod
    async def execute_task(self, task: TaskDefinition) -> Dict[str, Any]:
        """작업 실행"""
        pass
    
    @abstractmethod
    async def get_status(self) -> AgentStatus:
        """상태 조회"""
        pass
    
    @abstractmethod
    async def get_capabilities(self) -> List[AgentCapability]:
        """역량 조회"""
        pass

class MetaAgentSystem:
    """메타 에이전트 시스템 - 여러 하위 에이전트들을 조합하고 관리"""
    
    def __init__(self):
        self.agents: Dict[str, SubAgent] = {}
        self.agent_chains: Dict[str, AgentChain] = {}
        self.active_workflows: Dict[str, WorkflowExecution] = {}
        self.task_queue = queue.PriorityQueue()
        self.performance_metrics = {}
        self.collaboration_graph = nx.DiGraph()
        self.initialize_agents()
        self.setup_collaboration_patterns()
        
    def initialize_agents(self):
        """하위 에이전트들 초기화"""
        logger.info("🤖 하위 에이전트 초기화 시작")
        
        # Python 개발 전문가
        python_pro = SubAgent(
            id="python_pro_01",
            role=AgentRole.PYTHON_PRO,
            name="Python 전문가",
            description="Python 개발, 라이브러리 활용, 성능 최적화 전문",
            capabilities=[
                AgentCapability("python_development", 0.95, "backend", 
                               ["python", "django", "fastapi", "flask", "asyncio"]),
                AgentCapability("data_processing", 0.90, "data", 
                               ["pandas", "numpy", "scipy", "data_analysis"]),
                AgentCapability("api_development", 0.88, "backend",
                               ["rest_api", "graphql", "microservices"])
            ]
        )
        
        # 백엔드 아키텍트
        backend_architect = SubAgent(
            id="backend_arch_01", 
            role=AgentRole.BACKEND_ARCHITECT,
            name="백엔드 아키텍트",
            description="시스템 설계, 아키텍처 패턴, 확장성 설계 전문",
            capabilities=[
                AgentCapability("system_design", 0.95, "architecture",
                               ["microservices", "scalability", "distributed_systems"]),
                AgentCapability("database_design", 0.90, "data",
                               ["relational_db", "nosql", "data_modeling"]),
                AgentCapability("api_design", 0.92, "backend",
                               ["rest", "graphql", "api_gateway"])
            ]
        )
        
        # 프론트엔드 개발자
        frontend_dev = SubAgent(
            id="frontend_dev_01",
            role=AgentRole.FRONTEND_DEVELOPER, 
            name="프론트엔드 개발자",
            description="React, Next.js, TypeScript 기반 프론트엔드 개발 전문",
            capabilities=[
                AgentCapability("react_development", 0.93, "frontend",
                               ["react", "nextjs", "jsx", "hooks"]),
                AgentCapability("typescript", 0.90, "frontend",
                               ["typescript", "type_safety", "interfaces"]),
                AgentCapability("ui_components", 0.88, "frontend",
                               ["components", "styling", "responsive"])
            ]
        )
        
        # 테스트 자동화 전문가
        test_automator = SubAgent(
            id="test_auto_01",
            role=AgentRole.TEST_AUTOMATOR,
            name="테스트 자동화 전문가", 
            description="자동화 테스트, E2E 테스트, 성능 테스트 전문",
            capabilities=[
                AgentCapability("unit_testing", 0.95, "testing",
                               ["pytest", "jest", "unit_tests", "mocking"]),
                AgentCapability("e2e_testing", 0.90, "testing",
                               ["playwright", "selenium", "cypress"]),
                AgentCapability("performance_testing", 0.85, "testing",
                               ["load_testing", "stress_testing", "benchmarking"])
            ]
        )
        
        # 보안 감사관
        security_auditor = SubAgent(
            id="security_audit_01",
            role=AgentRole.SECURITY_AUDITOR,
            name="보안 감사관",
            description="코드 보안 검토, 취약점 분석, 보안 가이드라인 적용",
            capabilities=[
                AgentCapability("security_audit", 0.92, "security",
                               ["vulnerability_scan", "code_review", "security_patterns"]),
                AgentCapability("penetration_testing", 0.88, "security", 
                               ["pentest", "exploit", "security_testing"]),
                AgentCapability("compliance", 0.85, "security",
                               ["gdpr", "security_standards", "audit"])
            ]
        )
        
        # 성능 엔지니어
        perf_engineer = SubAgent(
            id="perf_eng_01",
            role=AgentRole.PERFORMANCE_ENGINEER,
            name="성능 엔지니어",
            description="성능 최적화, 프로파일링, 병목 지점 분석 전문",
            capabilities=[
                AgentCapability("performance_optimization", 0.94, "performance",
                               ["profiling", "optimization", "bottleneck_analysis"]),
                AgentCapability("caching", 0.90, "performance",
                               ["redis", "memcached", "cache_strategies"]),
                AgentCapability("database_optimization", 0.88, "performance",
                               ["query_optimization", "indexing", "database_tuning"])
            ]
        )
        
        # DevOps 전문가
        devops_expert = SubAgent(
            id="devops_exp_01",
            role=AgentRole.DEVOPS_EXPERT,
            name="DevOps 전문가",
            description="CI/CD, 컨테이너화, 인프라 자동화 전문",
            capabilities=[
                AgentCapability("cicd", 0.93, "devops",
                               ["github_actions", "jenkins", "gitlab_ci"]),
                AgentCapability("containerization", 0.91, "devops",
                               ["docker", "kubernetes", "container_orchestration"]),
                AgentCapability("infrastructure", 0.89, "devops",
                               ["terraform", "ansible", "cloud_infrastructure"])
            ]
        )
        
        # 데이터베이스 최적화 전문가
        db_optimizer = SubAgent(
            id="db_opt_01",
            role=AgentRole.DATABASE_OPTIMIZER,
            name="데이터베이스 최적화 전문가",
            description="데이터베이스 성능 튜닝, 스키마 최적화, 쿼리 최적화",
            capabilities=[
                AgentCapability("query_optimization", 0.95, "database",
                               ["sql_optimization", "index_tuning", "execution_plans"]),
                AgentCapability("schema_design", 0.90, "database",
                               ["normalization", "denormalization", "schema_optimization"]),
                AgentCapability("database_monitoring", 0.88, "database",
                               ["performance_monitoring", "alerting", "database_health"])
            ]
        )
        
        # 시스템 설계자
        system_designer = SubAgent(
            id="sys_design_01",
            role=AgentRole.SYSTEM_DESIGNER,
            name="시스템 설계자",
            description="전체 시스템 아키텍처 설계, 기술 스택 선택, 통합 설계",
            capabilities=[
                AgentCapability("architecture_design", 0.94, "architecture",
                               ["system_architecture", "design_patterns", "scalability"]),
                AgentCapability("technology_selection", 0.90, "architecture",
                               ["tech_stack", "tool_selection", "technology_evaluation"]),
                AgentCapability("integration_design", 0.88, "architecture",
                               ["api_integration", "service_integration", "data_flow"])
            ]
        )
        
        # 에이전트 등록
        for agent in [python_pro, backend_architect, frontend_dev, test_automator,
                     security_auditor, perf_engineer, devops_expert, db_optimizer,
                     system_designer]:
            self.agents[agent.id] = agent
            
        logger.info(f"✅ {len(self.agents)}개 하위 에이전트 초기화 완료")
        
    def setup_collaboration_patterns(self):
        """협업 패턴 설정"""
        logger.info("🤝 협업 패턴 설정 시작")
        
        # 백엔드 개발 체인
        backend_chain = AgentChain(
            id="backend_development",
            name="백엔드 개발 파이프라인",
            description="시스템 설계 → 백엔드 개발 → 데이터베이스 최적화 → 보안 검토 → 성능 최적화",
            agents=["sys_design_01", "backend_arch_01", "python_pro_01", 
                   "db_opt_01", "security_audit_01", "perf_eng_01"],
            execution_mode=ExecutionMode.SEQUENTIAL,
            data_flow={
                "sys_design_01": "backend_arch_01",
                "backend_arch_01": "python_pro_01", 
                "python_pro_01": "db_opt_01",
                "db_opt_01": "security_audit_01",
                "security_audit_01": "perf_eng_01"
            }
        )
        
        # 풀스택 개발 체인
        fullstack_chain = AgentChain(
            id="fullstack_development",
            name="풀스택 개발 파이프라인",
            description="시스템 설계와 백엔드/프론트엔드 병렬 개발 후 통합 테스트",
            agents=["sys_design_01", "backend_arch_01", "python_pro_01", 
                   "frontend_dev_01", "test_auto_01", "security_audit_01"],
            execution_mode=ExecutionMode.PIPELINE,
            data_flow={
                "sys_design_01": "backend_arch_01,frontend_dev_01",
                "backend_arch_01": "python_pro_01",
                "python_pro_01": "test_auto_01",
                "frontend_dev_01": "test_auto_01",
                "test_auto_01": "security_audit_01"
            }
        )
        
        # 성능 최적화 체인
        performance_chain = AgentChain(
            id="performance_optimization",
            name="성능 최적화 파이프라인", 
            description="성능 분석 → 데이터베이스 최적화 → 코드 최적화 → 성능 테스트",
            agents=["perf_eng_01", "db_opt_01", "python_pro_01", "test_auto_01"],
            execution_mode=ExecutionMode.SEQUENTIAL,
            data_flow={
                "perf_eng_01": "db_opt_01,python_pro_01",
                "db_opt_01": "test_auto_01",
                "python_pro_01": "test_auto_01"
            }
        )
        
        # DevOps 배포 체인
        devops_chain = AgentChain(
            id="devops_deployment",
            name="DevOps 배포 파이프라인",
            description="코드 검토 → 테스트 → 보안 검토 → 배포 → 모니터링",
            agents=["python_pro_01", "test_auto_01", "security_audit_01", 
                   "devops_exp_01", "perf_eng_01"],
            execution_mode=ExecutionMode.SEQUENTIAL,
            data_flow={
                "python_pro_01": "test_auto_01",
                "test_auto_01": "security_audit_01",
                "security_audit_01": "devops_exp_01", 
                "devops_exp_01": "perf_eng_01"
            }
        )
        
        # 품질 보증 체인 (병렬)
        qa_chain = AgentChain(
            id="quality_assurance",
            name="품질 보증 파이프라인",
            description="테스트 자동화와 보안 감사를 병렬로 수행",
            agents=["test_auto_01", "security_audit_01", "perf_eng_01"],
            execution_mode=ExecutionMode.PARALLEL,
            data_flow={}
        )
        
        # 체인 등록
        for chain in [backend_chain, fullstack_chain, performance_chain, 
                     devops_chain, qa_chain]:
            self.agent_chains[chain.id] = chain
            
        # 협업 그래프 구성
        self._build_collaboration_graph()
        
        logger.info(f"✅ {len(self.agent_chains)}개 협업 체인 설정 완료")

    def _build_collaboration_graph(self):
        """협업 그래프 구성"""
        # 에이전트 노드 추가
        for agent_id, agent in self.agents.items():
            self.collaboration_graph.add_node(agent_id, agent=agent)
            
        # 협업 관계 엣지 추가
        collaborations = [
            # 강한 협업 관계 (직접적인 데이터 교환)
            ("sys_design_01", "backend_arch_01", {"weight": 0.9, "type": "direct"}),
            ("backend_arch_01", "python_pro_01", {"weight": 0.9, "type": "direct"}),
            ("python_pro_01", "db_opt_01", {"weight": 0.8, "type": "direct"}),
            ("python_pro_01", "test_auto_01", {"weight": 0.8, "type": "direct"}),
            ("test_auto_01", "security_audit_01", {"weight": 0.7, "type": "verification"}),
            ("security_audit_01", "perf_eng_01", {"weight": 0.6, "type": "optimization"}),
            ("devops_exp_01", "perf_eng_01", {"weight": 0.7, "type": "monitoring"}),
            
            # 중간 협업 관계 (간접적인 피드백)
            ("sys_design_01", "frontend_dev_01", {"weight": 0.7, "type": "design"}),
            ("frontend_dev_01", "test_auto_01", {"weight": 0.6, "type": "testing"}),
            ("db_opt_01", "perf_eng_01", {"weight": 0.8, "type": "optimization"}),
            ("security_audit_01", "devops_exp_01", {"weight": 0.6, "type": "deployment"}),
            
            # 약한 협업 관계 (정보 공유)
            ("sys_design_01", "security_audit_01", {"weight": 0.5, "type": "consultation"}),
            ("backend_arch_01", "devops_exp_01", {"weight": 0.5, "type": "consultation"}),
            ("frontend_dev_01", "security_audit_01", {"weight": 0.4, "type": "review"})
        ]
        
        self.collaboration_graph.add_edges_from(collaborations)

    async def intelligent_agent_selection(self, task: TaskDefinition) -> List[Tuple[str, float]]:
        """지능형 에이전트 선택 - 작업에 최적화된 에이전트 조합 추천"""
        logger.info(f"🎯 작업 '{task.title}'에 대한 최적 에이전트 선택 시작")
        
        candidates = []
        
        for agent_id, agent in self.agents.items():
            if agent.status == AgentStatus.OFFLINE:
                continue
                
            # 스킬 매칭 점수 계산
            skill_score = self._calculate_skill_match(agent, task.required_skills)
            
            # 가용성 점수 계산
            availability_score = 1.0 - agent.load_factor
            
            # 성능 점수 계산
            performance_score = agent.success_rate * (1.0 / max(agent.average_response_time, 0.1))
            
            # 역할 매칭 점수
            role_score = 1.0 if agent.role in task.required_agents else 0.5
            
            # 종합 점수 계산 (가중 평균)
            total_score = (
                skill_score * 0.4 +
                availability_score * 0.2 + 
                performance_score * 0.2 +
                role_score * 0.2
            )
            
            candidates.append((agent_id, total_score))
            
        # 점수 순으로 정렬
        candidates.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"✅ 상위 {min(5, len(candidates))}개 에이전트 선택 완료")
        return candidates[:5]

    def _calculate_skill_match(self, agent: SubAgent, required_skills: List[str]) -> float:
        """스킬 매칭 점수 계산"""
        if not required_skills:
            return 0.5  # 기본 점수
            
        total_match = 0.0
        total_skills = len(required_skills)
        
        for required_skill in required_skills:
            best_match = 0.0
            
            for capability in agent.capabilities:
                # 키워드 매칭
                keyword_matches = sum(1 for keyword in capability.keywords 
                                    if keyword.lower() in required_skill.lower())
                if keyword_matches > 0:
                    match_score = (keyword_matches / len(capability.keywords)) * capability.skill_level
                    best_match = max(best_match, match_score)
                    
                # 도메인 매칭
                if capability.domain.lower() in required_skill.lower():
                    best_match = max(best_match, capability.skill_level * 0.8)
                    
            total_match += best_match
            
        return total_match / total_skills

    async def create_agent_chain(self, task: TaskDefinition) -> AgentChain:
        """자동 에이전트 체인 구성"""
        logger.info(f"⛓️ 작업 '{task.title}'을 위한 에이전트 체인 자동 구성")
        
        # 1. 기본 에이전트 선택
        agent_candidates = await self.intelligent_agent_selection(task)
        selected_agents = [agent_id for agent_id, _ in agent_candidates[:3]]
        
        # 2. 의존성 분석으로 추가 에이전트 결정
        additional_agents = self._analyze_dependencies(selected_agents, task)
        all_agents = selected_agents + additional_agents
        
        # 3. 실행 모드 결정
        execution_mode = self._determine_execution_mode(all_agents, task)
        
        # 4. 데이터 플로우 구성
        data_flow = self._build_data_flow(all_agents, execution_mode)
        
        # 5. 체인 생성
        chain_id = f"auto_chain_{uuid.uuid4().hex[:8]}"
        chain = AgentChain(
            id=chain_id,
            name=f"자동 생성 체인: {task.title}",
            description=f"작업 '{task.title}'을 위해 자동 생성된 에이전트 체인",
            agents=all_agents,
            execution_mode=execution_mode,
            data_flow=data_flow
        )
        
        self.agent_chains[chain_id] = chain
        logger.info(f"✅ 에이전트 체인 '{chain_id}' 생성 완료 ({len(all_agents)}개 에이전트)")
        
        return chain

    def _analyze_dependencies(self, base_agents: List[str], task: TaskDefinition) -> List[str]:
        """의존성 분석을 통한 추가 에이전트 결정"""
        additional_agents = []
        
        # 작업 유형별 의존성 규칙
        dependency_rules = {
            "development": ["test_auto_01", "security_audit_01"],
            "backend": ["db_opt_01", "security_audit_01"],
            "frontend": ["test_auto_01"],
            "database": ["security_audit_01", "perf_eng_01"],
            "deployment": ["devops_exp_01", "perf_eng_01"],
            "testing": ["python_pro_01"],
            "security": ["test_auto_01", "perf_eng_01"]
        }
        
        task_description_lower = task.description.lower()
        
        for category, required_agents in dependency_rules.items():
            if category in task_description_lower:
                for agent_id in required_agents:
                    if agent_id not in base_agents and agent_id in self.agents:
                        additional_agents.append(agent_id)
                        
        return list(set(additional_agents))  # 중복 제거

    def _determine_execution_mode(self, agents: List[str], task: TaskDefinition) -> ExecutionMode:
        """실행 모드 자동 결정"""
        # 에이전트 수에 따른 기본 모드
        if len(agents) <= 2:
            return ExecutionMode.SEQUENTIAL
        elif len(agents) <= 4:
            # 독립적 작업이 가능한지 확인
            if self._can_parallelize(agents):
                return ExecutionMode.PARALLEL
            else:
                return ExecutionMode.SEQUENTIAL
        else:
            return ExecutionMode.PIPELINE
            
    def _can_parallelize(self, agents: List[str]) -> bool:
        """병렬 처리 가능 여부 확인"""
        # 그래프에서 에이전트 간 강한 의존성이 있는지 확인
        for i, agent1 in enumerate(agents):
            for agent2 in agents[i+1:]:
                if self.collaboration_graph.has_edge(agent1, agent2):
                    edge_data = self.collaboration_graph.get_edge_data(agent1, agent2)
                    if edge_data.get("weight", 0) > 0.7:  # 강한 의존성
                        return False
        return True

    def _build_data_flow(self, agents: List[str], mode: ExecutionMode) -> Dict[str, str]:
        """데이터 플로우 구성"""
        data_flow = {}
        
        if mode == ExecutionMode.SEQUENTIAL:
            # 순차 실행: 이전 → 다음
            for i in range(len(agents) - 1):
                data_flow[agents[i]] = agents[i + 1]
                
        elif mode == ExecutionMode.PARALLEL:
            # 병렬 실행: 데이터 플로우 없음
            pass
            
        elif mode == ExecutionMode.PIPELINE:
            # 파이프라인: 그래프 기반 플로우
            for agent in agents:
                successors = []
                for successor in agents:
                    if (self.collaboration_graph.has_edge(agent, successor) and 
                        successor != agent):
                        successors.append(successor)
                        
                if successors:
                    data_flow[agent] = ",".join(successors)
                    
        return data_flow

    async def execute_workflow(self, chain_id: str, input_data: Dict[str, Any] = None) -> WorkflowExecution:
        """워크플로우 실행"""
        if chain_id not in self.agent_chains:
            raise ValueError(f"체인 '{chain_id}'을 찾을 수 없습니다")
            
        chain = self.agent_chains[chain_id]
        logger.info(f"🚀 워크플로우 실행 시작: {chain.name}")
        
        execution = WorkflowExecution(
            id=f"exec_{uuid.uuid4().hex[:8]}",
            chain_id=chain_id,
            status="running",
            start_time=datetime.now()
        )
        
        self.active_workflows[execution.id] = execution
        
        try:
            if chain.execution_mode == ExecutionMode.SEQUENTIAL:
                await self._execute_sequential(execution, chain, input_data or {})
            elif chain.execution_mode == ExecutionMode.PARALLEL:
                await self._execute_parallel(execution, chain, input_data or {})
            elif chain.execution_mode == ExecutionMode.PIPELINE:
                await self._execute_pipeline(execution, chain, input_data or {})
                
            execution.status = "completed"
            
        except Exception as e:
            logger.error(f"❌ 워크플로우 실행 중 오류: {e}")
            execution.status = "failed"
            execution.errors.append(str(e))
            
        execution.end_time = datetime.now()
        execution.metrics["total_duration"] = (execution.end_time - execution.start_time).total_seconds()
        
        logger.info(f"✅ 워크플로우 실행 완료: {execution.status}")
        return execution

    async def _execute_sequential(self, execution: WorkflowExecution, 
                                chain: AgentChain, input_data: Dict[str, Any]):
        """순차 실행"""
        current_data = input_data
        
        for agent_id in chain.agents:
            if agent_id not in self.agents:
                continue
                
            execution.current_agent = agent_id
            agent = self.agents[agent_id]
            
            # 에이전트 상태 업데이트
            agent.status = AgentStatus.BUSY
            agent.load_factor = min(1.0, agent.load_factor + 0.3)
            
            try:
                start_time = time.time()
                
                # 모의 작업 실행
                result = await self._simulate_agent_execution(agent, current_data)
                
                execution_time = time.time() - start_time
                agent.average_response_time = (
                    (agent.average_response_time * agent.total_tasks + execution_time) /
                    (agent.total_tasks + 1)
                )
                
                agent.total_tasks += 1
                agent.completed_tasks += 1
                agent.last_activity = datetime.now()
                
                execution.results[agent_id] = result
                execution.completed_agents.append(agent_id)
                
                # 다음 에이전트로 데이터 전달
                current_data = result.get("output", current_data)
                
            except Exception as e:
                agent.failed_tasks += 1
                execution.errors.append(f"{agent_id}: {str(e)}")
                raise
                
            finally:
                agent.status = AgentStatus.IDLE
                agent.load_factor = max(0.0, agent.load_factor - 0.3)

    async def _execute_parallel(self, execution: WorkflowExecution,
                              chain: AgentChain, input_data: Dict[str, Any]):
        """병렬 실행"""
        tasks = []
        
        for agent_id in chain.agents:
            if agent_id in self.agents:
                tasks.append(self._execute_agent_task(agent_id, input_data))
                
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, (agent_id, result) in enumerate(zip(chain.agents, results)):
            if isinstance(result, Exception):
                execution.errors.append(f"{agent_id}: {str(result)}")
            else:
                execution.results[agent_id] = result
                execution.completed_agents.append(agent_id)

    async def _execute_pipeline(self, execution: WorkflowExecution,
                              chain: AgentChain, input_data: Dict[str, Any]):
        """파이프라인 실행"""
        # 토폴로지 정렬로 실행 순서 결정
        execution_order = self._topological_sort(chain.agents, chain.data_flow)
        
        agent_results = {}
        
        for agent_id in execution_order:
            if agent_id not in self.agents:
                continue
                
            # 입력 데이터 준비
            agent_input = input_data.copy()
            
            # 이전 에이전트 결과 병합
            for prev_agent in execution.completed_agents:
                if prev_agent in agent_results:
                    agent_input.update(agent_results[prev_agent].get("output", {}))
                    
            # 에이전트 실행
            result = await self._execute_agent_task(agent_id, agent_input)
            agent_results[agent_id] = result
            execution.results[agent_id] = result
            execution.completed_agents.append(agent_id)

    def _topological_sort(self, agents: List[str], data_flow: Dict[str, str]) -> List[str]:
        """토폴로지 정렬 (의존성 순서 결정)"""
        # 간단한 토폴로지 정렬 구현
        in_degree = {agent: 0 for agent in agents}
        graph = {agent: [] for agent in agents}
        
        # 그래프 구성
        for source, targets in data_flow.items():
            if source in agents:
                for target in targets.split(","):
                    target = target.strip()
                    if target in agents:
                        graph[source].append(target)
                        in_degree[target] += 1
                        
        # 토폴로지 정렬
        queue = [agent for agent in agents if in_degree[agent] == 0]
        result = []
        
        while queue:
            current = queue.pop(0)
            result.append(current)
            
            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
                    
        return result if len(result) == len(agents) else agents

    async def _execute_agent_task(self, agent_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """개별 에이전트 작업 실행"""
        agent = self.agents[agent_id]
        agent.status = AgentStatus.BUSY
        
        try:
            start_time = time.time()
            result = await self._simulate_agent_execution(agent, input_data)
            execution_time = time.time() - start_time
            
            # 성능 메트릭 업데이트
            agent.average_response_time = (
                (agent.average_response_time * agent.total_tasks + execution_time) /
                (agent.total_tasks + 1)
            )
            agent.total_tasks += 1
            agent.completed_tasks += 1
            agent.last_activity = datetime.now()
            
            return result
            
        except Exception as e:
            agent.failed_tasks += 1
            raise
        finally:
            agent.status = AgentStatus.IDLE

    async def _simulate_agent_execution(self, agent: SubAgent, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """에이전트 실행 시뮬레이션"""
        # 실제 환경에서는 여기서 실제 에이전트 로직을 호출
        await asyncio.sleep(0.5 + np.random.exponential(0.5))  # 실행 시간 시뮬레이션
        
        # 역할별 모의 출력 생성
        if agent.role == AgentRole.PYTHON_PRO:
            return {
                "status": "success",
                "output": {
                    "code_quality": "excellent",
                    "performance": "optimized",
                    "test_coverage": 0.95,
                    "generated_files": ["main.py", "utils.py", "tests.py"]
                },
                "duration": np.random.uniform(1.0, 3.0),
                "agent_id": agent.id
            }
            
        elif agent.role == AgentRole.BACKEND_ARCHITECT:
            return {
                "status": "success",
                "output": {
                    "architecture": "microservices",
                    "api_design": "REST + GraphQL",
                    "database_schema": "optimized",
                    "scalability": "horizontal",
                    "documentation": ["api_spec.yaml", "architecture_diagram.png"]
                },
                "duration": np.random.uniform(2.0, 5.0),
                "agent_id": agent.id
            }
            
        elif agent.role == AgentRole.FRONTEND_DEVELOPER:
            return {
                "status": "success", 
                "output": {
                    "ui_components": "React + TypeScript",
                    "responsive_design": True,
                    "accessibility": "WCAG 2.1 AA",
                    "performance_score": 0.92,
                    "generated_files": ["components/", "pages/", "styles/"]
                },
                "duration": np.random.uniform(1.5, 4.0),
                "agent_id": agent.id
            }
            
        elif agent.role == AgentRole.TEST_AUTOMATOR:
            return {
                "status": "success",
                "output": {
                    "test_coverage": 0.94,
                    "test_results": {"passed": 45, "failed": 2, "skipped": 1},
                    "performance_tests": "completed",
                    "e2e_tests": "passed",
                    "generated_reports": ["coverage.html", "test_results.xml"]
                },
                "duration": np.random.uniform(3.0, 6.0),
                "agent_id": agent.id
            }
            
        elif agent.role == AgentRole.SECURITY_AUDITOR:
            return {
                "status": "success",
                "output": {
                    "vulnerabilities": {"high": 0, "medium": 1, "low": 3},
                    "security_score": 0.88,
                    "compliance": "OWASP Top 10",
                    "recommendations": ["Update dependency X", "Add rate limiting"],
                    "security_report": "security_audit.pdf"
                },
                "duration": np.random.uniform(2.0, 4.0), 
                "agent_id": agent.id
            }
            
        elif agent.role == AgentRole.PERFORMANCE_ENGINEER:
            return {
                "status": "success",
                "output": {
                    "performance_score": 0.91,
                    "load_test_results": "passed",
                    "bottlenecks": ["database query optimization needed"],
                    "optimization_suggestions": ["Add caching", "Optimize queries"],
                    "performance_report": "performance_analysis.html"
                },
                "duration": np.random.uniform(2.5, 5.0),
                "agent_id": agent.id
            }
            
        else:
            return {
                "status": "success",
                "output": {
                    "task_completed": True,
                    "agent_role": agent.role.value,
                    "input_processed": len(input_data),
                    "execution_context": "simulated"
                },
                "duration": np.random.uniform(1.0, 3.0),
                "agent_id": agent.id
            }

    def analyze_agent_performance(self) -> Dict[str, Any]:
        """에이전트 성능 분석"""
        logger.info("📊 에이전트 성능 분석 시작")
        
        analysis = {
            "timestamp": datetime.now().isoformat(),
            "total_agents": len(self.agents),
            "performance_summary": {},
            "top_performers": [],
            "underperformers": [],
            "collaboration_metrics": {},
            "recommendations": []
        }
        
        # 개별 에이전트 성능 계산
        performance_scores = {}
        
        for agent_id, agent in self.agents.items():
            if agent.total_tasks > 0:
                success_rate = agent.completed_tasks / agent.total_tasks
                efficiency_score = 1.0 / max(agent.average_response_time, 0.1)
                load_score = 1.0 - agent.load_factor
                
                overall_score = (success_rate * 0.5 + 
                               efficiency_score * 0.3 + 
                               load_score * 0.2)
                               
                performance_scores[agent_id] = {
                    "agent_name": agent.name,
                    "role": agent.role.value,
                    "overall_score": overall_score,
                    "success_rate": success_rate,
                    "avg_response_time": agent.average_response_time,
                    "total_tasks": agent.total_tasks,
                    "current_load": agent.load_factor,
                    "status": agent.status.value
                }
        
        # 상위/하위 성능자 식별
        sorted_agents = sorted(performance_scores.items(), 
                              key=lambda x: x[1]["overall_score"], reverse=True)
        
        analysis["top_performers"] = [
            {"agent_id": agent_id, **metrics} 
            for agent_id, metrics in sorted_agents[:3]
        ]
        
        analysis["underperformers"] = [
            {"agent_id": agent_id, **metrics}
            for agent_id, metrics in sorted_agents[-2:]
            if metrics["overall_score"] < 0.7
        ]
        
        # 협업 메트릭
        analysis["collaboration_metrics"] = {
            "total_chains": len(self.agent_chains),
            "active_workflows": len(self.active_workflows),
            "collaboration_patterns": len(self.collaboration_graph.edges()),
            "most_connected_agent": self._find_most_connected_agent()
        }
        
        # 성능 요약
        if performance_scores:
            scores = [metrics["overall_score"] for metrics in performance_scores.values()]
            analysis["performance_summary"] = {
                "average_score": np.mean(scores),
                "median_score": np.median(scores),
                "std_deviation": np.std(scores),
                "total_tasks_completed": sum(agent.completed_tasks for agent in self.agents.values()),
                "total_tasks_failed": sum(agent.failed_tasks for agent in self.agents.values())
            }
        
        # 권장사항 생성
        if analysis["underperformers"]:
            analysis["recommendations"].append("성능이 낮은 에이전트들의 로드 밸런싱을 검토하세요")
            
        if analysis["performance_summary"].get("average_score", 0) < 0.8:
            analysis["recommendations"].append("전반적인 시스템 성능 최적화가 필요합니다")
            
        if len(analysis["top_performers"]) < 3:
            analysis["recommendations"].append("고성능 에이전트의 작업 패턴을 다른 에이전트에 적용하세요")
        
        logger.info("✅ 에이전트 성능 분석 완료")
        return analysis

    def _find_most_connected_agent(self) -> str:
        """가장 연결이 많은 에이전트 찾기"""
        if not self.collaboration_graph.nodes():
            return "none"
            
        centrality = nx.degree_centrality(self.collaboration_graph)
        most_connected = max(centrality.items(), key=lambda x: x[1])
        return most_connected[0]

    def optimize_agent_distribution(self) -> Dict[str, Any]:
        """에이전트 분배 최적화"""
        logger.info("⚖️ 에이전트 로드 밸런싱 최적화 시작")
        
        optimization_result = {
            "timestamp": datetime.now().isoformat(),
            "current_loads": {},
            "suggested_redistributions": [],
            "efficiency_improvement": 0.0,
            "actions_taken": []
        }
        
        # 현재 로드 상태 수집
        for agent_id, agent in self.agents.items():
            optimization_result["current_loads"][agent_id] = {
                "load_factor": agent.load_factor,
                "status": agent.status.value,
                "avg_response_time": agent.average_response_time
            }
        
        # 과부하 및 유휴 에이전트 식별
        overloaded_agents = [
            agent_id for agent_id, agent in self.agents.items()
            if agent.load_factor > 0.8
        ]
        
        idle_agents = [
            agent_id for agent_id, agent in self.agents.items() 
            if agent.load_factor < 0.3 and agent.status == AgentStatus.IDLE
        ]
        
        # 재분배 제안
        if overloaded_agents and idle_agents:
            for overloaded in overloaded_agents:
                for idle in idle_agents:
                    # 역량 호환성 확인
                    if self._check_capability_compatibility(overloaded, idle):
                        optimization_result["suggested_redistributions"].append({
                            "from": overloaded,
                            "to": idle,
                            "estimated_improvement": 0.2,
                            "compatibility_score": 0.8
                        })
        
        # 자동 로드 조정 (시뮬레이션)
        total_improvement = 0.0
        for redistribution in optimization_result["suggested_redistributions"]:
            # 실제 환경에서는 여기서 작업 재분배 실행
            total_improvement += redistribution["estimated_improvement"]
            optimization_result["actions_taken"].append(
                f"작업 일부를 {redistribution['from']}에서 {redistribution['to']}로 이동"
            )
        
        optimization_result["efficiency_improvement"] = total_improvement
        
        logger.info(f"✅ 로드 밸런싱 최적화 완료 (효율성 개선: {total_improvement:.2f})")
        return optimization_result

    def _check_capability_compatibility(self, agent1_id: str, agent2_id: str) -> bool:
        """에이전트 간 역량 호환성 확인"""
        agent1 = self.agents[agent1_id]
        agent2 = self.agents[agent2_id]
        
        # 도메인 겹치는 부분 확인
        domains1 = {cap.domain for cap in agent1.capabilities}
        domains2 = {cap.domain for cap in agent2.capabilities}
        
        return len(domains1.intersection(domains2)) > 0

    async def dynamic_agent_replacement(self, failing_agent_id: str) -> Dict[str, Any]:
        """동적 에이전트 교체"""
        logger.info(f"🔄 에이전트 '{failing_agent_id}' 동적 교체 시작")
        
        if failing_agent_id not in self.agents:
            raise ValueError(f"에이전트 '{failing_agent_id}'를 찾을 수 없습니다")
        
        failing_agent = self.agents[failing_agent_id]
        
        # 대체 에이전트 후보 찾기
        replacement_candidates = []
        
        for agent_id, agent in self.agents.items():
            if (agent_id != failing_agent_id and 
                agent.status != AgentStatus.OFFLINE and
                agent.load_factor < 0.7):
                
                # 역량 유사도 계산
                similarity = self._calculate_capability_similarity(failing_agent, agent)
                
                if similarity > 0.5:  # 50% 이상 유사
                    replacement_candidates.append({
                        "agent_id": agent_id,
                        "agent_name": agent.name,
                        "similarity": similarity,
                        "current_load": agent.load_factor,
                        "success_rate": agent.success_rate
                    })
        
        # 최적 대체자 선택
        if replacement_candidates:
            replacement_candidates.sort(
                key=lambda x: (x["similarity"], -x["current_load"], x["success_rate"]),
                reverse=True
            )
            
            best_replacement = replacement_candidates[0]
            
            # 활성 워크플로우에서 에이전트 교체
            replacement_count = 0
            for workflow in self.active_workflows.values():
                if failing_agent_id in workflow.completed_agents:
                    continue  # 이미 완료된 작업은 교체하지 않음
                    
                chain = self.agent_chains[workflow.chain_id]
                if failing_agent_id in chain.agents:
                    # 에이전트 교체
                    agent_index = chain.agents.index(failing_agent_id)
                    chain.agents[agent_index] = best_replacement["agent_id"]
                    replacement_count += 1
            
            # 실패한 에이전트 상태 업데이트
            failing_agent.status = AgentStatus.ERROR
            
            result = {
                "timestamp": datetime.now().isoformat(),
                "failing_agent": failing_agent_id,
                "replacement_agent": best_replacement["agent_id"],
                "similarity_score": best_replacement["similarity"],
                "workflows_affected": replacement_count,
                "status": "success"
            }
            
            logger.info(f"✅ 에이전트 교체 완료: {failing_agent_id} → {best_replacement['agent_id']}")
            
        else:
            result = {
                "timestamp": datetime.now().isoformat(),
                "failing_agent": failing_agent_id,
                "replacement_agent": None,
                "status": "no_suitable_replacement",
                "message": "적합한 대체 에이전트를 찾을 수 없습니다"
            }
            
            logger.warning(f"⚠️ 에이전트 '{failing_agent_id}' 교체 실패: 적합한 대체자 없음")
        
        return result

    def _calculate_capability_similarity(self, agent1: SubAgent, agent2: SubAgent) -> float:
        """에이전트 간 역량 유사도 계산"""
        if not agent1.capabilities or not agent2.capabilities:
            return 0.0
        
        # 도메인 유사도
        domains1 = {cap.domain for cap in agent1.capabilities}
        domains2 = {cap.domain for cap in agent2.capabilities}
        domain_similarity = len(domains1.intersection(domains2)) / len(domains1.union(domains2))
        
        # 키워드 유사도
        keywords1 = set()
        keywords2 = set()
        
        for cap in agent1.capabilities:
            keywords1.update(cap.keywords)
        for cap in agent2.capabilities:
            keywords2.update(cap.keywords)
            
        if keywords1 and keywords2:
            keyword_similarity = len(keywords1.intersection(keywords2)) / len(keywords1.union(keywords2))
        else:
            keyword_similarity = 0.0
        
        # 종합 유사도 (도메인 60%, 키워드 40%)
        return domain_similarity * 0.6 + keyword_similarity * 0.4

    def get_workflow_status(self, execution_id: str) -> Dict[str, Any]:
        """워크플로우 상태 조회"""
        if execution_id not in self.active_workflows:
            return {"error": f"실행 ID '{execution_id}'를 찾을 수 없습니다"}
        
        execution = self.active_workflows[execution_id]
        chain = self.agent_chains[execution.chain_id]
        
        progress = len(execution.completed_agents) / len(chain.agents) if chain.agents else 0.0
        
        return {
            "execution_id": execution_id,
            "chain_name": chain.name,
            "status": execution.status,
            "progress": progress,
            "current_agent": execution.current_agent,
            "completed_agents": execution.completed_agents,
            "total_agents": len(chain.agents),
            "start_time": execution.start_time.isoformat(),
            "duration": (datetime.now() - execution.start_time).total_seconds(),
            "errors": execution.errors,
            "results_count": len(execution.results)
        }

    def generate_comprehensive_report(self) -> Dict[str, Any]:
        """종합 시스템 리포트 생성"""
        logger.info("📋 종합 시스템 리포트 생성 시작")
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "system_overview": {
                "total_agents": len(self.agents),
                "total_chains": len(self.agent_chains),
                "active_workflows": len(self.active_workflows),
                "collaboration_edges": len(self.collaboration_graph.edges())
            },
            "agent_summary": {},
            "performance_analysis": self.analyze_agent_performance(),
            "optimization_suggestions": self.optimize_agent_distribution(),
            "health_status": {},
            "recommendations": []
        }
        
        # 에이전트 요약
        status_counts = {}
        for agent in self.agents.values():
            status = agent.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
        
        report["agent_summary"] = {
            "status_distribution": status_counts,
            "average_load": np.mean([agent.load_factor for agent in self.agents.values()]),
            "total_tasks_completed": sum(agent.completed_tasks for agent in self.agents.values()),
            "total_tasks_failed": sum(agent.failed_tasks for agent in self.agents.values()),
            "average_success_rate": np.mean([
                agent.completed_tasks / max(agent.total_tasks, 1) 
                for agent in self.agents.values()
            ])
        }
        
        # 시스템 건강도
        healthy_agents = sum(1 for agent in self.agents.values() 
                           if agent.status in [AgentStatus.IDLE, AgentStatus.BUSY])
        
        report["health_status"] = {
            "overall_health": healthy_agents / len(self.agents),
            "healthy_agents": healthy_agents,
            "error_agents": sum(1 for agent in self.agents.values() 
                              if agent.status == AgentStatus.ERROR),
            "system_status": "healthy" if healthy_agents / len(self.agents) > 0.8 else "degraded"
        }
        
        # 종합 권장사항
        if report["health_status"]["overall_health"] < 0.8:
            report["recommendations"].append("시스템 전반적인 건강도 개선 필요")
            
        if report["agent_summary"]["average_load"] > 0.8:
            report["recommendations"].append("에이전트 로드 분산 최적화 필요")
            
        if report["agent_summary"]["average_success_rate"] < 0.9:
            report["recommendations"].append("에이전트 성공률 개선 필요")
        
        logger.info("✅ 종합 시스템 리포트 생성 완료")
        return report

def create_usage_examples():
    """사용 예시 생성"""
    return """
# Advanced Meta Agent System 사용 가이드

## 1. 시스템 초기화
```python
meta_system = MetaAgentSystem()
print(f"초기화 완료: {len(meta_system.agents)}개 에이전트, {len(meta_system.agent_chains)}개 체인")
```

## 2. 작업 정의 및 자동 에이전트 선택
```python
task = TaskDefinition(
    id="task_001",
    title="웹 애플리케이션 개발",
    description="Python Flask 백엔드와 React 프론트엔드 개발",
    priority=8,
    estimated_duration=3600,
    required_skills=["python", "react", "database", "testing"],
    required_agents=[AgentRole.PYTHON_PRO, AgentRole.FRONTEND_DEVELOPER]
)

# 최적 에이전트 선택
candidates = await meta_system.intelligent_agent_selection(task)
print("추천 에이전트:", [f"{agent_id} (점수: {score:.2f})" for agent_id, score in candidates])
```

## 3. 자동 에이전트 체인 생성 및 실행
```python
# 자동 체인 생성
chain = await meta_system.create_agent_chain(task)
print(f"생성된 체인: {chain.name} ({len(chain.agents)}개 에이전트)")

# 워크플로우 실행
execution = await meta_system.execute_workflow(chain.id, {
    "project_name": "my-web-app",
    "tech_stack": "Flask + React",
    "database": "PostgreSQL"
})

print(f"실행 결과: {execution.status}")
print(f"완료된 에이전트: {len(execution.completed_agents)}/{len(chain.agents)}")
```

## 4. 실시간 모니터링
```python
# 워크플로우 상태 확인
status = meta_system.get_workflow_status(execution.id)
print(f"진행률: {status['progress']*100:.1f}%")
print(f"현재 에이전트: {status['current_agent']}")

# 성능 분석
performance = meta_system.analyze_agent_performance()
print("상위 성능자:", [p['agent_name'] for p in performance['top_performers']])
```

## 5. 동적 최적화
```python
# 로드 밸런싱 최적화
optimization = meta_system.optimize_agent_distribution()
print(f"효율성 개선: {optimization['efficiency_improvement']:.2f}")

# 실패한 에이전트 교체
if "python_pro_01" in meta_system.agents:
    replacement = await meta_system.dynamic_agent_replacement("python_pro_01")
    print(f"교체 결과: {replacement['status']}")
```

## 6. 사전 정의 협업 패턴 사용
```python
# 백엔드 개발 파이프라인
backend_execution = await meta_system.execute_workflow("backend_development", {
    "project_type": "microservice",
    "database": "MongoDB",
    "api_style": "GraphQL"
})

# 풀스택 개발 파이프라인  
fullstack_execution = await meta_system.execute_workflow("fullstack_development", {
    "frontend": "Next.js",
    "backend": "FastAPI", 
    "database": "Supabase"
})
```

## 7. 종합 리포트 생성
```python
report = meta_system.generate_comprehensive_report()
print(f"시스템 건강도: {report['health_status']['overall_health']:.2f}")
print(f"평균 성공률: {report['agent_summary']['average_success_rate']:.2f}")
print("권장사항:", report['recommendations'])
```

## 8. 고급 협업 패턴
```python
# 사용자 정의 체인 생성
custom_chain = AgentChain(
    id="custom_security_review",
    name="보안 중심 코드 리뷰",
    description="개발 → 테스트 → 보안 감사 → 성능 검토",
    agents=["python_pro_01", "test_auto_01", "security_audit_01", "perf_eng_01"],
    execution_mode=ExecutionMode.SEQUENTIAL,
    data_flow={
        "python_pro_01": "test_auto_01",
        "test_auto_01": "security_audit_01", 
        "security_audit_01": "perf_eng_01"
    }
)

meta_system.agent_chains["custom_security"] = custom_chain

# 병렬 품질 검증
parallel_execution = await meta_system.execute_workflow("quality_assurance", {
    "code_base": "/path/to/project",
    "test_scope": "full",
    "security_level": "strict"
})
```

## 주요 특징:
- ✅ **자동 에이전트 선택**: 작업 요구사항에 따른 최적 에이전트 조합
- ✅ **동적 워크플로우**: 실시간 상황에 따른 실행 계획 조정
- ✅ **지능형 로드 밸런싱**: 에이전트 부하 분산 및 성능 최적화
- ✅ **실시간 모니터링**: 워크플로우 진행 상황 및 에이전트 상태 추적
- ✅ **자동 복구**: 실패한 에이전트 감지 및 대체
- ✅ **협업 최적화**: 에이전트 간 데이터 플로우 및 의존성 관리
"""

if __name__ == "__main__":
    async def demo():
        print("🚀 Advanced Meta Agent System 데모 시작")
        print("=" * 60)
        
        # 시스템 초기화
        meta_system = MetaAgentSystem()
        
        # 작업 정의
        demo_task = TaskDefinition(
            id="demo_task",
            title="Python 웹 API 개발 및 배포",
            description="FastAPI 기반 REST API 개발, 테스트, 보안 검토, 배포",
            priority=9,
            estimated_duration=1800,
            required_skills=["python", "api", "testing", "security", "deployment"],
            required_agents=[AgentRole.PYTHON_PRO, AgentRole.TEST_AUTOMATOR, 
                           AgentRole.SECURITY_AUDITOR, AgentRole.DEVOPS_EXPERT]
        )
        
        print("\n🎯 지능형 에이전트 선택:")
        candidates = await meta_system.intelligent_agent_selection(demo_task)
        for agent_id, score in candidates[:3]:
            agent = meta_system.agents[agent_id]
            print(f"- {agent.name} ({agent.role.value}): {score:.3f}")
        
        print("\n⛓️ 자동 에이전트 체인 생성:")
        chain = await meta_system.create_agent_chain(demo_task)
        print(f"체인명: {chain.name}")
        print(f"실행 모드: {chain.execution_mode.value}")
        print(f"에이전트: {[meta_system.agents[aid].name for aid in chain.agents]}")
        
        print("\n🚀 워크플로우 실행:")
        execution = await meta_system.execute_workflow(chain.id, {
            "project_name": "demo-api",
            "framework": "FastAPI",
            "database": "PostgreSQL"
        })
        
        print(f"실행 상태: {execution.status}")
        print(f"완료된 단계: {len(execution.completed_agents)}/{len(chain.agents)}")
        print(f"실행 시간: {execution.metrics.get('total_duration', 0):.2f}초")
        
        print("\n📊 성능 분석:")
        performance = meta_system.analyze_agent_performance()
        print(f"평균 성능 점수: {performance['performance_summary']['average_score']:.3f}")
        print("상위 성능자:")
        for performer in performance['top_performers'][:2]:
            print(f"- {performer['agent_name']}: {performer['overall_score']:.3f}")
        
        print("\n⚖️ 시스템 최적화:")
        optimization = meta_system.optimize_agent_distribution()
        print(f"효율성 개선: {optimization['efficiency_improvement']:.2f}")
        
        print("\n📋 종합 리포트:")
        report = meta_system.generate_comprehensive_report()
        print(f"시스템 건강도: {report['health_status']['overall_health']:.1%}")
        print(f"총 완료 작업: {report['agent_summary']['total_tasks_completed']}")
        print(f"평균 성공률: {report['agent_summary']['average_success_rate']:.1%}")
        
        if report['recommendations']:
            print("권장사항:")
            for rec in report['recommendations'][:2]:
                print(f"- {rec}")
        
        print("\n✅ 데모 완료!")
        print("\n사용 가이드:")
        print("=" * 60)
        print(create_usage_examples())
    
    # 데모 실행
    asyncio.run(demo())