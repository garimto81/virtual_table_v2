#!/usr/bin/env python3
"""
MCP CLI - MCP Master Agent 명령줄 인터페이스

작성자: Claude AI Assistant
버전: 1.0.0
최종 업데이트: 2025-09-19
"""

import asyncio
import click
import json
import sys
import os
from datetime import datetime
from typing import Optional

# 로컬 모듈 임포트
from mcp_master_agent import MCPMasterAgent
from mcp_config import MCPConfigManager, MCPEnvironmentManager
from mcp_workflows import WorkflowEngine
from mcp_monitor import MCPMonitor

# 로깅 설정
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@click.group()
@click.version_option(version='1.0.0')
@click.option('--debug', is_flag=True, help='디버그 모드 활성화')
@click.pass_context
def cli(ctx, debug):
    """🚀 MCP Master Agent - MCP 도구 통합 관리 시스템"""
    ctx.ensure_object(dict)
    if debug:
        logging.getLogger().setLevel(logging.DEBUG)
        ctx.obj['debug'] = True
    else:
        ctx.obj['debug'] = False

    click.echo("🚀 MCP Master Agent CLI v1.0.0")
    click.echo("=" * 50)

@cli.group()
def health():
    """🏥 헬스체크 및 상태 모니터링"""
    pass

@health.command()
@click.option('--format', default='table', type=click.Choice(['table', 'json']), help='출력 형식')
async def check(format):
    """모든 MCP 도구 헬스체크 실행"""
    click.echo("🔍 MCP 도구 헬스체크 실행 중...")

    agent = MCPMasterAgent()
    health_report = await agent.comprehensive_health_check()

    if format == 'json':
        click.echo(json.dumps(health_report, indent=2, ensure_ascii=False))
    else:
        # 테이블 형식 출력
        click.echo(f"\n📊 헬스체크 결과 ({health_report['timestamp']})")
        click.echo("=" * 60)
        click.echo(f"총 도구: {health_report['total_tools']}")
        click.echo(f"활성 도구: {health_report['active_tools']} ✅")
        click.echo(f"비활성 도구: {health_report['inactive_tools']} ⏸️")
        click.echo(f"오류 도구: {health_report['error_tools']} ❌")
        click.echo(f"평균 응답시간: {health_report['average_response_time']:.3f}초")

        if health_report['recommendations']:
            click.echo("\n💡 권장사항:")
            for rec in health_report['recommendations']:
                click.echo(f"  • {rec}")

        # 도구별 상세 정보
        click.echo("\n🔧 도구별 상태:")
        for tool, details in health_report['tool_details'].items():
            status_icon = "✅" if details['status'] == 'active' else "❌" if details['status'] == 'error' else "⏸️"
            click.echo(f"  {status_icon} {tool}: {details['response_time']:.3f}초")

@health.command()
@click.option('--tool', help='특정 도구 추천 (예: github, supabase)')
@click.option('--task', help='작업 설명')
def recommend(tool, task):
    """작업에 적합한 MCP 도구 추천"""
    agent = MCPMasterAgent()

    if task:
        recommendations = agent.get_tool_recommendations(task)
        click.echo(f"\n🎯 '{task}' 작업에 적합한 도구:")
        click.echo("=" * 50)

        for i, rec in enumerate(recommendations[:5], 1):
            confidence_bar = "█" * int(rec['confidence'] * 10)
            click.echo(f"{i}. {rec['name']}")
            click.echo(f"   설명: {rec['description']}")
            click.echo(f"   신뢰도: {confidence_bar} {rec['confidence']:.1%}")
            click.echo(f"   상태: {rec['status']}")
            click.echo()
    else:
        click.echo("작업 설명을 --task 옵션으로 제공해주세요.")

@cli.group()
def workflow():
    """🔄 워크플로우 관리"""
    pass

@workflow.command()
def list():
    """사용 가능한 워크플로우 템플릿 목록"""
    engine = WorkflowEngine()
    templates = engine.get_workflow_templates()

    click.echo("📋 사용 가능한 워크플로우 템플릿:")
    click.echo("=" * 50)

    for template in templates:
        duration_min = template['estimated_duration'] // 60
        click.echo(f"🔧 {template['name']}")
        click.echo(f"   설명: {template['description']}")
        click.echo(f"   단계: {template['steps_count']}개")
        click.echo(f"   예상 시간: {duration_min}분")
        click.echo(f"   태그: {', '.join(template['id'])}")
        click.echo()

@workflow.command()
@click.argument('workflow_id')
@click.option('--params', help='워크플로우 파라미터 (JSON 형식)')
@click.option('--dry-run', is_flag=True, help='실제 실행 없이 계획만 표시')
async def run(workflow_id, params, dry_run):
    """워크플로우 실행"""
    engine = WorkflowEngine()

    # 파라미터 파싱
    parameters = {}
    if params:
        try:
            parameters = json.loads(params)
        except json.JSONDecodeError:
            click.echo("❌ 잘못된 JSON 파라미터 형식")
            return

    if dry_run:
        click.echo(f"🔍 워크플로우 '{workflow_id}' 실행 계획:")
        if workflow_id in engine.workflow_templates:
            template = engine.workflow_templates[workflow_id]
            click.echo(f"단계 수: {len(template.steps)}")
            for i, step in enumerate(template.steps, 1):
                click.echo(f"  {i}. {step.tool}.{step.action}")
                if step.dependencies:
                    click.echo(f"     의존성: {', '.join(step.dependencies)}")
        else:
            click.echo("❌ 워크플로우를 찾을 수 없습니다")
    else:
        click.echo(f"🚀 워크플로우 '{workflow_id}' 실행 중...")
        try:
            execution_id = await engine.execute_workflow(workflow_id, parameters)
            result = engine.get_workflow_status(execution_id)

            click.echo(f"✅ 실행 완료!")
            click.echo(f"실행 ID: {execution_id}")
            click.echo(f"상태: {result['status']}")
            click.echo(f"완료된 단계: {result['completed_steps']}/{result['total_steps']}")

            if result['error_log']:
                click.echo("\n❌ 오류 로그:")
                for error in result['error_log']:
                    click.echo(f"  • {error}")

        except Exception as e:
            click.echo(f"❌ 워크플로우 실행 실패: {e}")

@workflow.command()
@click.argument('execution_id')
def status(execution_id):
    """워크플로우 실행 상태 확인"""
    engine = WorkflowEngine()
    result = engine.get_workflow_status(execution_id)

    if not result:
        click.echo("❌ 실행 ID를 찾을 수 없습니다")
        return

    click.echo(f"📊 워크플로우 실행 상태: {execution_id}")
    click.echo("=" * 50)
    click.echo(f"이름: {result['name']}")
    click.echo(f"상태: {result['status']}")
    click.echo(f"생성 시간: {result['created_at']}")
    click.echo(f"진행률: {result['completed_steps']}/{result['total_steps']} ({result['completed_steps']/result['total_steps']*100:.1f}%)")

    if result['start_time']:
        click.echo(f"시작 시간: {result['start_time']}")
    if result['end_time']:
        click.echo(f"종료 시간: {result['end_time']}")

    click.echo("\n📋 단계별 상태:")
    for step in result['step_details']:
        status_icon = "✅" if step['status'] == 'completed' else "❌" if step['status'] == 'failed' else "⏳" if step['status'] == 'running' else "⏸️"
        click.echo(f"  {status_icon} {step['id']}: {step['tool']}.{step['action']}")
        if step['error']:
            click.echo(f"     오류: {step['error']}")

@cli.group()
def monitor():
    """📊 실시간 모니터링"""
    pass

@monitor.command()
@click.option('--interval', default=60, help='모니터링 간격 (초)')
@click.option('--duration', default=300, help='모니터링 지속 시간 (초)')
async def start(interval, duration):
    """실시간 모니터링 시작"""
    monitor = MCPMonitor(monitoring_interval=interval)

    click.echo(f"📊 {duration}초 동안 {interval}초 간격으로 모니터링 시작")

    # 백그라운드에서 모니터링 시작
    monitor_task = asyncio.create_task(monitor.start_monitoring())

    try:
        # 지정된 시간 동안 대기
        await asyncio.sleep(duration)

        # 모니터링 중지
        monitor.stop_monitoring()
        await asyncio.sleep(1)  # 정리 시간

        # 최종 대시보드 표시
        dashboard = monitor.get_dashboard_data()
        click.echo("\n📈 모니터링 완료 - 최종 대시보드:")
        click.echo("=" * 50)
        click.echo(f"총 호출: {dashboard['overview']['total_calls']}")
        click.echo(f"성공률: {dashboard['overview']['success_rate']:.1%}")
        click.echo(f"활성 알림: {dashboard['overview']['active_alerts']}")

    except KeyboardInterrupt:
        click.echo("\n⏹️ 사용자에 의해 모니터링 중단됨")
        monitor.stop_monitoring()

@monitor.command()
def dashboard():
    """현재 모니터링 대시보드 표시"""
    monitor = MCPMonitor()

    # 테스트 데이터 생성 (실제 환경에서는 실제 데이터 사용)
    import random
    for _ in range(20):
        tool = random.choice(['mcp__github__', 'mcp__supabase__', 'mcp__exa__'])
        monitor.record_tool_call(tool, random.uniform(0.1, 2.0), random.random() > 0.1)

    dashboard = monitor.get_dashboard_data()

    click.echo("📈 MCP 모니터링 대시보드")
    click.echo("=" * 50)
    click.echo(f"업데이트 시간: {dashboard['timestamp']}")
    click.echo(f"총 호출: {dashboard['overview']['total_calls']}")
    click.echo(f"전체 성공률: {dashboard['overview']['success_rate']:.1%}")
    click.echo(f"활성 도구: {dashboard['overview']['active_tools']}")
    click.echo(f"활성 알림: {dashboard['overview']['active_alerts']}")

    if dashboard['tools']:
        click.echo("\n🔧 도구별 상태:")
        for tool in dashboard['tools']:
            status_icon = "✅" if tool['status'] == 'healthy' else "⚠️" if tool['status'] == 'warning' else "❌"
            click.echo(f"  {status_icon} {tool['name']}: {tool['success_rate']:.1%} 성공률, {tool['avg_response_time']:.2f}초")

    if dashboard['alerts']:
        click.echo("\n🚨 활성 알림:")
        for alert in dashboard['alerts'][:5]:  # 최근 5개만 표시
            level_icon = "🔴" if alert['level'] == 'CRITICAL' else "🟡" if alert['level'] == 'WARNING' else "🔵"
            click.echo(f"  {level_icon} {alert['title']}: {alert['message']}")

@cli.group()
def config():
    """⚙️ 설정 관리"""
    pass

@config.command()
def show():
    """현재 설정 표시"""
    config_manager = MCPConfigManager()
    env_manager = MCPEnvironmentManager()

    click.echo("⚙️ MCP 설정 현황")
    click.echo("=" * 50)

    # 설정 검증
    validation = config_manager.validate_configuration()
    click.echo(f"총 설정: {validation['total_configs']}")
    click.echo(f"활성 설정: {validation['enabled_configs']}")
    click.echo(f"문제점: {len(validation['issues'])}")
    click.echo(f"경고: {len(validation['warnings'])}")

    if validation['issues']:
        click.echo("\n❌ 문제점:")
        for issue in validation['issues']:
            click.echo(f"  • {issue}")

    if validation['warnings']:
        click.echo("\n⚠️ 경고:")
        for warning in validation['warnings']:
            click.echo(f"  • {warning}")

    # 환경 변수 검증
    env_validation = env_manager.validate_environment()
    click.echo(f"\n🌍 환경 변수:")
    click.echo(f"필수 변수 - 존재: {len(env_validation['required_vars']['present'])}, 누락: {len(env_validation['required_vars']['missing'])}")
    click.echo(f"선택 변수 - 존재: {len(env_validation['optional_vars']['present'])}, 누락: {len(env_validation['optional_vars']['missing'])}")

    if env_validation['required_vars']['missing']:
        click.echo("\n❌ 누락된 필수 환경 변수:")
        for var in env_validation['required_vars']['missing']:
            click.echo(f"  • {var['name']}: {var['description']}")

@config.command()
@click.argument('tool_prefix')
@click.argument('setting')
@click.argument('value')
def set(tool_prefix, setting, value):
    """MCP 도구 설정 변경"""
    config_manager = MCPConfigManager()

    # 값 타입 변환
    if value.lower() in ['true', 'false']:
        value = value.lower() == 'true'
    elif value.isdigit():
        value = int(value)
    elif '.' in value and value.replace('.', '').isdigit():
        value = float(value)

    config_manager.update_config(tool_prefix, **{setting: value})
    config_manager.save_config_file()

    click.echo(f"✅ {tool_prefix}.{setting} = {value}")

@config.command()
def template():
    """설정 템플릿 생성"""
    env_manager = MCPEnvironmentManager()
    template = env_manager.create_env_template()

    template_file = "mcp_env_template.txt"
    with open(template_file, 'w', encoding='utf-8') as f:
        f.write(template)

    click.echo(f"📄 환경 변수 템플릿이 '{template_file}'에 생성되었습니다")
    click.echo("이 파일을 .env로 복사하고 실제 값들로 수정하세요")

@cli.command()
@click.option('--format', default='json', type=click.Choice(['json', 'csv']), help='내보내기 형식')
@click.option('--output', help='출력 파일명')
def export(format, output):
    """메트릭 및 설정 데이터 내보내기"""
    monitor = MCPMonitor()

    # 내보낼 데이터 수집
    exported_data = monitor.export_metrics(format)

    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(exported_data)
        click.echo(f"✅ 데이터가 '{output}'에 내보내졌습니다")
    else:
        click.echo(exported_data)

@cli.command()
def version():
    """버전 정보 표시"""
    click.echo("🚀 MCP Master Agent")
    click.echo("버전: 1.0.0")
    click.echo("작성자: Claude AI Assistant")
    click.echo("최종 업데이트: 2025-09-19")
    click.echo("\n지원되는 MCP 도구:")
    tools = [
        "mcp__supabase__ - Supabase 데이터베이스 통합",
        "mcp__github__ - GitHub 저장소 관리",
        "mcp__context7__ - 문서 검색 및 컨텍스트 관리",
        "mcp__exa__ - 웹 검색 및 크롤링",
        "mcp__ide__ - IDE 통합 기능",
        "mcp__playwright__ - 브라우저 자동화",
        "mcp__taskmanager__ - 작업 관리",
        "mcp__wonderwhy-er-desktop-commander__ - Desktop Commander 통합"
    ]
    for tool in tools:
        click.echo(f"  • {tool}")

def run_async_command(coro):
    """비동기 명령어 실행 헬퍼"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # 이미 실행 중인 루프가 있는 경우
            task = asyncio.create_task(coro)
            return loop.run_until_complete(task)
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        # 새 이벤트 루프 생성
        return asyncio.run(coro)

# 비동기 명령어들을 동기화
for command in [check, run, start]:
    original_callback = command.callback
    def make_sync_callback(async_callback):
        def sync_callback(*args, **kwargs):
            return run_async_command(async_callback(*args, **kwargs))
        return sync_callback
    command.callback = make_sync_callback(original_callback)

if __name__ == '__main__':
    try:
        cli()
    except KeyboardInterrupt:
        click.echo("\n👋 MCP Master Agent 종료")
        sys.exit(0)
    except Exception as e:
        click.echo(f"❌ 오류 발생: {e}")
        if '--debug' in sys.argv:
            import traceback
            traceback.print_exc()
        sys.exit(1)