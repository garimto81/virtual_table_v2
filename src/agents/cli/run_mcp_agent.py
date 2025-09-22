#!/usr/bin/env python3
"""
MCP Master Agent 실행 스크립트

간편한 실행을 위한 래퍼 스크립트

작성자: Claude AI Assistant
버전: 1.0.0
최종 업데이트: 2025-09-19
"""

import sys
import os
import asyncio
import logging
from datetime import datetime

# 현재 디렉토리를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from mcp_master_agent import MCPMasterAgent
    from mcp_workflows import WorkflowEngine
    from mcp_monitor import MCPMonitor
    from mcp_config import MCPConfigManager
except ImportError as e:
    print(f"❌ 모듈 임포트 실패: {e}")
    print("requirements.txt에 명시된 의존성을 설치해주세요:")
    print("pip install -r requirements.txt")
    sys.exit(1)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MCPAgentRunner:
    """MCP Agent 실행기"""

    def __init__(self):
        self.agent = None
        self.monitor = None
        self.engine = None
        self.config = None

    def initialize(self):
        """컴포넌트 초기화"""
        print("🚀 MCP Master Agent 초기화 중...")

        try:
            self.agent = MCPMasterAgent()
            self.monitor = MCPMonitor()
            self.engine = WorkflowEngine()
            self.config = MCPConfigManager()

            print("✅ 모든 컴포넌트 초기화 완료")
            return True

        except Exception as e:
            print(f"❌ 초기화 실패: {e}")
            return False

    async def run_quick_demo(self):
        """빠른 데모 실행"""
        print("\n📊 MCP Master Agent 빠른 데모")
        print("=" * 50)

        # 1. 헬스체크 실행
        print("1️⃣ 전체 시스템 헬스체크...")
        health_report = await self.agent.comprehensive_health_check()

        print(f"   총 도구: {health_report['total_tools']}")
        print(f"   활성 도구: {health_report['active_tools']}")
        print(f"   평균 응답시간: {health_report['average_response_time']:.3f}초")

        # 2. 도구 추천 테스트
        print("\n2️⃣ 도구 추천 시스템 테스트...")
        task = "GitHub에서 코드를 검색하고 Supabase 데이터베이스에 저장"
        recommendations = self.agent.get_tool_recommendations(task)

        print(f"   작업: {task}")
        print("   추천 도구:")
        for i, rec in enumerate(recommendations[:3], 1):
            print(f"   {i}. {rec['name']} (신뢰도: {rec['confidence']:.1%})")

        # 3. 워크플로우 목록 확인
        print("\n3️⃣ 사용 가능한 워크플로우...")
        templates = self.engine.get_workflow_templates()
        print(f"   등록된 워크플로우: {len(templates)}개")
        for template in templates[:3]:
            print(f"   • {template['name']}: {template['description']}")

        # 4. 모니터링 데이터 시뮬레이션
        print("\n4️⃣ 모니터링 시스템 테스트...")
        # 테스트 데이터 생성
        import random
        for _ in range(20):
            tool = random.choice(list(self.agent.tools.keys()))
            response_time = random.uniform(0.1, 3.0)
            success = random.random() > 0.1  # 90% 성공률

            self.monitor.record_tool_call(tool, response_time, success)

        dashboard = self.monitor.get_dashboard_data()
        print(f"   모니터링된 호출: {dashboard['overview']['total_calls']}")
        print(f"   전체 성공률: {dashboard['overview']['success_rate']:.1%}")

        # 5. 설정 상태 확인
        print("\n5️⃣ 설정 상태 확인...")
        validation = self.config.validate_configuration()
        print(f"   총 설정: {validation['total_configs']}")
        print(f"   활성 설정: {validation['enabled_configs']}")
        print(f"   문제점: {len(validation['issues'])}")

        print("\n✅ 데모 완료!")

    async def run_interactive_mode(self):
        """대화형 모드 실행"""
        print("\n🎮 MCP Master Agent 대화형 모드")
        print("=" * 50)
        print("명령어:")
        print("  h, health     - 헬스체크 실행")
        print("  r, recommend  - 도구 추천")
        print("  w, workflow   - 워크플로우 실행")
        print("  m, monitor    - 모니터링 대시보드")
        print("  c, config     - 설정 확인")
        print("  q, quit       - 종료")
        print()

        while True:
            try:
                command = input("MCP> ").strip().lower()

                if command in ['q', 'quit', 'exit']:
                    print("👋 MCP Master Agent 종료")
                    break

                elif command in ['h', 'health']:
                    print("🔍 헬스체크 실행 중...")
                    health_report = await self.agent.comprehensive_health_check()
                    print(f"활성 도구: {health_report['active_tools']}/{health_report['total_tools']}")

                elif command in ['r', 'recommend']:
                    task = input("작업 설명을 입력하세요: ").strip()
                    if task:
                        recommendations = self.agent.get_tool_recommendations(task)
                        print("🎯 추천 도구:")
                        for i, rec in enumerate(recommendations[:3], 1):
                            print(f"  {i}. {rec['name']} ({rec['confidence']:.1%})")

                elif command in ['w', 'workflow']:
                    templates = self.engine.get_workflow_templates()
                    print("📋 사용 가능한 워크플로우:")
                    for i, template in enumerate(templates, 1):
                        print(f"  {i}. {template['name']}")

                    try:
                        choice = int(input("실행할 워크플로우 번호: "))
                        if 1 <= choice <= len(templates):
                            template = templates[choice - 1]
                            print(f"🚀 '{template['name']}' 실행 중...")
                            # 실제 실행은 파라미터가 필요할 수 있으므로 여기서는 스킵
                            print("✅ 워크플로우 완료 (시뮬레이션)")
                    except ValueError:
                        print("❌ 잘못된 번호입니다")

                elif command in ['m', 'monitor']:
                    dashboard = self.monitor.get_dashboard_data()
                    print("📊 모니터링 대시보드:")
                    print(f"  총 호출: {dashboard['overview']['total_calls']}")
                    print(f"  성공률: {dashboard['overview']['success_rate']:.1%}")

                elif command in ['c', 'config']:
                    validation = self.config.validate_configuration()
                    print("⚙️ 설정 상태:")
                    print(f"  총 설정: {validation['total_configs']}")
                    print(f"  활성 설정: {validation['enabled_configs']}")

                else:
                    print("❌ 알 수 없는 명령어입니다. 'h'를 입력하면 도움말을 볼 수 있습니다.")

            except KeyboardInterrupt:
                print("\n👋 MCP Master Agent 종료")
                break
            except EOFError:
                print("\n👋 MCP Master Agent 종료")
                break
            except Exception as e:
                print(f"❌ 오류 발생: {e}")

    async def run_health_monitoring(self, duration: int = 300):
        """헬스 모니터링 실행"""
        print(f"\n📊 {duration}초 동안 헬스 모니터링 실행")
        print("Ctrl+C로 중단할 수 있습니다")
        print("=" * 50)

        start_time = datetime.now()

        try:
            # 백그라운드에서 모니터링 시작
            monitor_task = asyncio.create_task(self.monitor.start_monitoring())

            # 주기적으로 상태 출력
            for i in range(duration // 10):  # 10초마다 출력
                await asyncio.sleep(10)

                elapsed = datetime.now() - start_time
                dashboard = self.monitor.get_dashboard_data()

                print(f"[{elapsed}] 호출: {dashboard['overview']['total_calls']}, "
                      f"성공률: {dashboard['overview']['success_rate']:.1%}, "
                      f"활성 알림: {dashboard['overview']['active_alerts']}")

            # 모니터링 중지
            self.monitor.stop_monitoring()
            await asyncio.sleep(1)

            # 최종 보고서
            health_report = self.monitor.generate_health_report()
            print(f"\n📋 최종 건강 상태 보고서:")
            print(f"전체 상태: {health_report['overall_health']}")
            print(f"건강한 도구: {len(health_report['tool_status']['healthy'])}")
            print(f"경고 도구: {len(health_report['tool_status']['warning'])}")
            print(f"위험 도구: {len(health_report['tool_status']['critical'])}")

        except KeyboardInterrupt:
            print("\n⏹️ 모니터링이 사용자에 의해 중단되었습니다")
            self.monitor.stop_monitoring()

def main():
    """메인 실행 함수"""
    print("🚀 MCP Master Agent v1.0.0")
    print("작성자: Claude AI Assistant")
    print("=" * 50)

    runner = MCPAgentRunner()

    # 초기화
    if not runner.initialize():
        sys.exit(1)

    # 실행 모드 선택
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()

        if mode == 'demo':
            print("📊 빠른 데모 모드")
            asyncio.run(runner.run_quick_demo())

        elif mode == 'interactive':
            print("🎮 대화형 모드")
            asyncio.run(runner.run_interactive_mode())

        elif mode == 'monitor':
            duration = int(sys.argv[2]) if len(sys.argv) > 2 else 300
            print(f"📊 {duration}초 모니터링 모드")
            asyncio.run(runner.run_health_monitoring(duration))

        elif mode == 'help':
            print_help()

        else:
            print(f"❌ 알 수 없는 모드: {mode}")
            print_help()
            sys.exit(1)

    else:
        # 기본값: 빠른 데모 실행
        print("📊 기본 모드: 빠른 데모")
        asyncio.run(runner.run_quick_demo())

def print_help():
    """도움말 출력"""
    print("""
🚀 MCP Master Agent 사용법:

python run_mcp_agent.py [mode] [options]

사용 가능한 모드:
  demo        - 빠른 데모 실행 (기본값)
  interactive - 대화형 모드
  monitor     - 헬스 모니터링 모드
  help        - 이 도움말 표시

예시:
  python run_mcp_agent.py demo
  python run_mcp_agent.py interactive
  python run_mcp_agent.py monitor 600  # 600초 모니터링

CLI 사용법:
  python mcp_cli.py --help

의존성 설치:
  pip install -r requirements.txt

테스트 실행:
  python test_mcp_agent.py --suite
""")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n👋 프로그램이 중단되었습니다")
        sys.exit(0)
    except Exception as e:
        print(f"❌ 예기치 않은 오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)