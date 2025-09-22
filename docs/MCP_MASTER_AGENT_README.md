# 🚀 MCP Master Agent

> **MCP 도구들을 적극적으로 활용하는 전문 에이전트**

MCP Master Agent는 다양한 MCP(Model Context Protocol) 도구들을 통합하여 관리하고, 복합적인 워크플로우를 자동화하며, 실시간 모니터링을 제공하는 종합 관리 시스템입니다.

## 📋 목차

- [주요 기능](#-주요-기능)
- [설치 방법](#-설치-방법)
- [빠른 시작](#-빠른-시작)
- [사용법](#-사용법)
- [MCP 도구 지원](#-mcp-도구-지원)
- [워크플로우](#-워크플로우)
- [모니터링](#-모니터링)
- [설정](#-설정)
- [API 문서](#-api-문서)
- [개발 가이드](#-개발-가이드)
- [문제 해결](#-문제-해결)
- [기여하기](#-기여하기)
- [라이선스](#-라이선스)

## 🌟 주요 기능

### 1. **MCP 도구 통합 관리자**
- 🔍 사용 가능한 모든 MCP 도구 자동 스캔 및 목록화
- 📊 각 도구의 상태와 기능 실시간 모니터링
- 💡 도구별 최적 사용 시나리오 제안
- ⚙️ 도구별 설정 및 구성 관리

### 2. **멀티 MCP 워크플로우 오케스트레이터**
- 🔄 여러 MCP 도구 연계 복합 작업 수행
- 🏗️ GitHub + Supabase + Context7 + Exa 조합 워크플로우
- 📈 도구 간 데이터 파이프라인 자동 구성
- 🎯 조건부 실행 및 오류 처리

### 3. **MCP 기반 프로젝트 분석기**
- 📁 GitHub 저장소 분석 → Supabase 데이터베이스 설계
- 📚 Exa 검색으로 관련 기술 스택 리서치
- 📖 Context7로 최신 문서 확인 및 자동 문서화
- 🔧 IDE 통합으로 실시간 코드 분석

### 4. **자동 MCP 헬스체크 시스템**
- 🔍 주기적인 모든 MCP 연결 상태 확인
- 🚨 장애 발생 시 대체 워크플로우 제안
- 📊 성능 메트릭 수집 및 최적화 제안
- 📋 종합 건강 상태 보고서 생성

## 🚀 설치 방법

### 1. 필수 요구사항
- Python 3.8+
- Git
- 활성 인터넷 연결

### 2. 저장소 복제
```bash
git clone <repository-url>
cd mcp-master-agent
```

### 3. 의존성 설치
```bash
pip install -r requirements.txt
```

### 4. 환경 변수 설정
```bash
# 환경 변수 템플릿 생성
python mcp_cli.py config template

# .env 파일 생성 및 편집
cp mcp_env_template.txt .env
# .env 파일을 편집하여 실제 API 키와 설정 추가
```

### 5. 설정 검증
```bash
python mcp_cli.py config show
```

## ⚡ 빠른 시작

### 1. 기본 데모 실행
```bash
python run_mcp_agent.py demo
```

### 2. 대화형 모드
```bash
python run_mcp_agent.py interactive
```

### 3. CLI 사용
```bash
# 헬스체크 실행
python mcp_cli.py health check

# 도구 추천
python mcp_cli.py health recommend --task "GitHub에서 코드 검색"

# 워크플로우 목록
python mcp_cli.py workflow list
```

## 📖 사용법

### CLI 명령어

#### 헬스체크 및 상태 모니터링
```bash
# 전체 시스템 헬스체크
python mcp_cli.py health check

# JSON 형식으로 출력
python mcp_cli.py health check --format json

# 특정 작업에 적합한 도구 추천
python mcp_cli.py health recommend --task "데이터베이스 쿼리"
```

#### 워크플로우 관리
```bash
# 사용 가능한 워크플로우 템플릿 목록
python mcp_cli.py workflow list

# 워크플로우 실행
python mcp_cli.py workflow run health_check --params '{"username": "myuser"}'

# 실행 계획만 확인 (실제 실행 없음)
python mcp_cli.py workflow run github_to_supabase --dry-run

# 워크플로우 실행 상태 확인
python mcp_cli.py workflow status <execution_id>
```

#### 실시간 모니터링
```bash
# 60초 간격으로 300초간 모니터링
python mcp_cli.py monitor start --interval 60 --duration 300

# 현재 모니터링 대시보드 표시
python mcp_cli.py monitor dashboard
```

#### 설정 관리
```bash
# 현재 설정 표시
python mcp_cli.py config show

# 도구 설정 변경
python mcp_cli.py config set mcp__github__ timeout 60

# 환경 변수 템플릿 생성
python mcp_cli.py config template
```

### Python API 사용

```python
import asyncio
from mcp_master_agent import MCPMasterAgent
from mcp_workflows import WorkflowEngine
from mcp_monitor import MCPMonitor

async def main():
    # 에이전트 초기화
    agent = MCPMasterAgent()

    # 헬스체크 실행
    health_report = await agent.comprehensive_health_check()
    print(f"활성 도구: {health_report['active_tools']}")

    # 도구 추천
    recommendations = agent.get_tool_recommendations("GitHub 저장소 분석")
    for rec in recommendations[:3]:
        print(f"- {rec['name']}: {rec['confidence']:.1%}")

    # 워크플로우 실행
    engine = WorkflowEngine()
    execution_id = await engine.execute_workflow("health_check")

    # 모니터링 시작
    monitor = MCPMonitor()
    await monitor.start_monitoring()

asyncio.run(main())
```

## 🔧 MCP 도구 지원

### 현재 지원 도구

| 도구 | 기능 | 상태 |
|------|------|------|
| **mcp__supabase__** | 데이터베이스 관리, 인증, 스토리지 | ✅ 완전 지원 |
| **mcp__github__** | 저장소 관리, 이슈 추적, PR | ✅ 완전 지원 |
| **mcp__context7__** | 문서 검색, API 참조 | ✅ 완전 지원 |
| **mcp__exa__** | 웹 검색, 콘텐츠 크롤링 | ✅ 완전 지원 |
| **mcp__ide__** | 코드 실행, 진단 | ✅ 완전 지원 |
| **mcp__playwright__** | 브라우저 자동화 | ✅ 완전 지원 |
| **mcp__taskmanager__** | 작업 관리, 승인 프로세스 | ✅ 완전 지원 |
| **mcp__desktop-commander__** | 파일 작업, 프로세스 관리 | ✅ 완전 지원 |

### 도구 추가

새로운 MCP 도구를 추가하려면:

1. `mcp_master_agent.py`의 `initialize_tools()` 메서드에 도구 정보 추가
2. `mcp_config.py`의 기본 설정에 도구 구성 추가
3. 필요시 워크플로우 템플릿에 도구 단계 추가

## 🔄 워크플로우

### 사전 정의된 워크플로우

#### 1. GitHub to Supabase Setup
GitHub 저장소를 분석하여 Supabase 프로젝트를 자동 설정

```bash
python mcp_cli.py workflow run github_to_supabase --params '{
  "repo_query": "fastapi python",
  "repo_owner": "tiangolo",
  "repo_name": "fastapi",
  "org_id": "your-org-id"
}'
```

#### 2. Comprehensive Health Check
모든 연결된 서비스의 상태를 종합적으로 점검

```bash
python mcp_cli.py workflow run health_check --params '{
  "username": "your-username"
}'
```

#### 3. Project Initialization
새 프로젝트의 완전 자동 초기화

```bash
python mcp_cli.py workflow run project_init --params '{
  "project_name": "my-new-project",
  "github_username": "your-username",
  "org_id": "your-org-id"
}'
```

#### 4. Code Quality Check
코드 품질 종합 검사 및 개선 제안

```bash
python mcp_cli.py workflow run code_quality --params '{
  "owner": "your-username",
  "repo": "your-repo",
  "language": "python"
}'
```

### 커스텀 워크플로우 생성

```python
from mcp_workflows import Workflow, WorkflowStep

# 커스텀 워크플로우 정의
custom_workflow = Workflow(
    id="custom_analysis",
    name="Custom Analysis",
    description="커스텀 분석 워크플로우",
    steps=[
        WorkflowStep(
            id="search_repos",
            tool="mcp__github__",
            action="search_repositories",
            parameters={"query": "{search_query}"}
        ),
        WorkflowStep(
            id="analyze_content",
            tool="mcp__exa__",
            action="web_search_exa",
            parameters={"query": "{analysis_topic}"},
            dependencies=["search_repos"]
        )
    ]
)

# 워크플로우 엔진에 등록
engine = WorkflowEngine()
engine.workflow_templates["custom_analysis"] = custom_workflow
```

## 📊 모니터링

### 실시간 대시보드

```python
from mcp_monitor import MCPMonitor

monitor = MCPMonitor()

# 대시보드 데이터 확인
dashboard = monitor.get_dashboard_data()
print(f"총 호출: {dashboard['overview']['total_calls']}")
print(f"성공률: {dashboard['overview']['success_rate']:.1%}")

# 특정 도구 상세 정보
details = monitor.get_tool_details("mcp__github__")
print(f"GitHub 도구 성공률: {details['summary']['success_rate']:.1%}")
```

### 알림 시스템

모니터링 시스템은 다음 상황에서 자동으로 알림을 생성합니다:

- 🚨 **Critical**: 응답 시간 > 5초, 오류율 > 25%
- ⚠️ **Warning**: 응답 시간 > 2초, 오류율 > 10%
- 📊 **Info**: 일반적인 상태 변경

### 성능 메트릭

- **응답 시간**: 평균, 최소, 최대, P95
- **성공률**: 성공한 호출 / 전체 호출
- **처리량**: 시간당 호출 수
- **가용성**: 24시간 가동 시간 비율

## ⚙️ 설정

### 환경 변수

필수 환경 변수:
```bash
# GitHub 설정
GITHUB_TOKEN=your_github_token_here

# Supabase 설정
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Exa 검색 API
EXA_API_KEY=your_exa_api_key_here
```

선택적 환경 변수:
```bash
# 디버그 모드
MCP_DEBUG=false

# 로그 레벨
MCP_LOG_LEVEL=INFO

# 기본 타임아웃
MCP_TIMEOUT_DEFAULT=30
```

### 도구별 설정

```python
from mcp_config import MCPConfigManager

config = MCPConfigManager()

# GitHub 도구 타임아웃 변경
config.update_config("mcp__github__", timeout=60)

# Supabase 도구 재시도 횟수 변경
config.update_config("mcp__supabase__", retry_count=5)

# 설정 저장
config.save_config_file()
```

## 📚 API 문서

### MCPMasterAgent

```python
class MCPMasterAgent:
    async def comprehensive_health_check() -> Dict[str, Any]:
        """모든 MCP 도구에 대한 종합 헬스체크"""

    def get_tool_recommendations(task_description: str) -> List[Dict[str, Any]]:
        """작업 설명을 바탕으로 최적 도구 조합 추천"""

    async def execute_workflow(workflow_name: str, parameters: Dict[str, Any]) -> str:
        """워크플로우 실행"""

    def generate_performance_report() -> Dict[str, Any]:
        """성능 보고서 생성"""
```

### WorkflowEngine

```python
class WorkflowEngine:
    async def execute_workflow(workflow_id: str, parameters: Dict[str, Any]) -> str:
        """워크플로우 실행"""

    def get_workflow_status(workflow_id: str) -> Optional[Dict[str, Any]]:
        """워크플로우 상태 조회"""

    def list_workflows(status_filter: Optional[WorkflowStatus]) -> List[Dict[str, Any]]:
        """워크플로우 목록 조회"""

    async def cancel_workflow(workflow_id: str) -> bool:
        """워크플로우 취소"""
```

### MCPMonitor

```python
class MCPMonitor:
    def record_tool_call(tool_name: str, response_time: float, success: bool):
        """도구 호출 기록"""

    def get_dashboard_data() -> Dict[str, Any]:
        """대시보드 데이터 생성"""

    def get_tool_details(tool_name: str) -> Optional[Dict[str, Any]]:
        """특정 도구의 상세 정보"""

    def generate_health_report() -> Dict[str, Any]:
        """종합 건강 상태 보고서"""
```

## 🛠️ 개발 가이드

### 개발 환경 설정

```bash
# 개발 의존성 설치
pip install -r requirements.txt

# 테스트 실행
python test_mcp_agent.py --suite

# 코드 품질 검사
flake8 mcp_*.py
black mcp_*.py
```

### 테스트

```bash
# 전체 테스트 스위트 실행
python test_mcp_agent.py --suite

# 개별 테스트 클래스 실행
python -m unittest test_mcp_agent.TestMCPMasterAgent

# 비동기 테스트 실행
python -m pytest test_mcp_agent.py -v
```

### 새 기능 추가

1. **새 MCP 도구 추가**:
   - `mcp_master_agent.py`에 도구 정의 추가
   - `mcp_config.py`에 기본 설정 추가
   - 테스트 케이스 작성

2. **새 워크플로우 추가**:
   - `mcp_workflows.py`에 워크플로우 템플릿 추가
   - 단계별 의존성 및 조건 정의
   - 테스트 및 문서화

3. **모니터링 메트릭 추가**:
   - `mcp_monitor.py`에 새 메트릭 클래스 정의
   - 수집 로직 및 임계값 설정
   - 대시보드 표시 업데이트

## 🔧 문제 해결

### 일반적인 문제들

#### 1. MCP 도구 연결 실패
```bash
# 설정 확인
python mcp_cli.py config show

# 헬스체크 실행
python mcp_cli.py health check --format json
```

#### 2. 환경 변수 누락
```bash
# 환경 변수 템플릿 생성
python mcp_cli.py config template

# 누락된 변수 확인
python mcp_cli.py config show
```

#### 3. 워크플로우 실행 실패
```bash
# 워크플로우 상태 확인
python mcp_cli.py workflow status <execution_id>

# 로그 확인
tail -f mcp_agent.log
```

#### 4. 성능 문제
```bash
# 모니터링 대시보드 확인
python mcp_cli.py monitor dashboard

# 성능 보고서 생성
python mcp_cli.py export --format json --output metrics.json
```

### 로그 확인

```bash
# 실시간 로그 모니터링
tail -f mcp_agent.log

# 오류만 필터링
grep ERROR mcp_agent.log

# 특정 도구의 로그만 확인
grep "mcp__github__" mcp_agent.log
```

### 디버그 모드

```bash
# 디버그 모드로 실행
python mcp_cli.py --debug health check

# 환경 변수로 디버그 활성화
export MCP_DEBUG=true
python run_mcp_agent.py demo
```

## 🤝 기여하기

1. **이슈 보고**: 버그나 기능 요청은 GitHub Issues를 사용해 주세요
2. **풀 리퀘스트**: 코드 기여는 풀 리퀘스트로 제출해 주세요
3. **문서 개선**: 문서 오류나 개선사항을 알려주세요
4. **테스트 추가**: 새 기능에 대한 테스트를 작성해 주세요

### 개발 가이드라인

- 코드 스타일: Black + Flake8
- 커밋 메시지: Conventional Commits
- 테스트: 모든 새 기능에 테스트 필수
- 문서: 공개 API에 대한 독스트링 필수

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 지원

- **문서**: [API 문서](#-api-문서)
- **예제**: `examples/` 디렉토리 참조
- **이슈**: GitHub Issues
- **토론**: GitHub Discussions

---

## 🎯 로드맵

### v1.1.0 (계획)
- [ ] 웹 UI 대시보드
- [ ] 더 많은 MCP 도구 지원
- [ ] 워크플로우 시각적 편집기
- [ ] 알림 통합 (Slack, Discord)

### v1.2.0 (계획)
- [ ] 머신러닝 기반 이상 탐지
- [ ] 자동 성능 최적화
- [ ] 클러스터 모드 지원
- [ ] 프로메테우스 메트릭 내보내기

---

**작성자**: Claude AI Assistant
**버전**: 1.0.0
**최종 업데이트**: 2025-09-19

> 🚀 MCP Master Agent로 여러분의 개발 워크플로우를 한 단계 끌어올려보세요!