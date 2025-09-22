#!/usr/bin/env python3
"""
MCP Monitor - MCP 도구들의 실시간 모니터링 및 성능 분석

작성자: Claude AI Assistant
버전: 1.0.0
최종 업데이트: 2025-09-19
"""

import asyncio
import json
import logging
import time
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict, deque
import threading
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetric:
    """성능 메트릭"""
    timestamp: datetime
    response_time: float
    success: bool
    error_message: Optional[str] = None
    memory_usage: Optional[float] = None
    cpu_usage: Optional[float] = None

@dataclass
class ToolMetrics:
    """도구별 메트릭"""
    tool_name: str
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    average_response_time: float = 0.0
    min_response_time: float = float('inf')
    max_response_time: float = 0.0
    last_call_time: Optional[datetime] = None
    recent_metrics: deque = field(default_factory=lambda: deque(maxlen=100))
    hourly_stats: Dict[str, int] = field(default_factory=dict)

@dataclass
class SystemMetrics:
    """시스템 메트릭"""
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_latency: float
    active_workflows: int
    queue_size: int

@dataclass
class Alert:
    """알림"""
    id: str
    level: str  # INFO, WARNING, ERROR, CRITICAL
    title: str
    message: str
    timestamp: datetime
    tool_name: Optional[str] = None
    resolved: bool = False
    resolution_time: Optional[datetime] = None

class MCPMonitor:
    """MCP 도구 모니터링 시스템"""

    def __init__(self, monitoring_interval: int = 60):
        self.monitoring_interval = monitoring_interval
        self.tool_metrics: Dict[str, ToolMetrics] = {}
        self.system_metrics: deque = deque(maxlen=1440)  # 24시간 (1분 간격)
        self.alerts: deque = deque(maxlen=1000)
        self.thresholds = self._load_default_thresholds()
        self.monitoring_active = False
        self.executor = ThreadPoolExecutor(max_workers=4)

        # 알려진 MCP 도구들 초기화
        self._initialize_tool_metrics()

    def _load_default_thresholds(self) -> Dict[str, Any]:
        """기본 임계값 설정"""
        return {
            "response_time": {
                "warning": 2.0,  # 2초
                "critical": 5.0  # 5초
            },
            "error_rate": {
                "warning": 0.1,  # 10%
                "critical": 0.25  # 25%
            },
            "system": {
                "cpu_warning": 80.0,  # 80%
                "cpu_critical": 95.0,  # 95%
                "memory_warning": 80.0,
                "memory_critical": 90.0,
                "disk_warning": 85.0,
                "disk_critical": 95.0
            },
            "availability": {
                "warning": 0.95,  # 95%
                "critical": 0.90  # 90%
            }
        }

    def _initialize_tool_metrics(self):
        """도구별 메트릭 초기화"""
        tools = [
            "mcp__supabase__",
            "mcp__github__",
            "mcp__context7__",
            "mcp__exa__",
            "mcp__ide__",
            "mcp__playwright__",
            "mcp__taskmanager__",
            "mcp__wonderwhy-er-desktop-commander__"
        ]

        for tool in tools:
            self.tool_metrics[tool] = ToolMetrics(tool_name=tool)

        logger.info(f"✅ {len(tools)}개 도구 메트릭 초기화 완료")

    def record_tool_call(self, tool_name: str, response_time: float,
                        success: bool, error_message: Optional[str] = None):
        """도구 호출 기록"""
        if tool_name not in self.tool_metrics:
            self.tool_metrics[tool_name] = ToolMetrics(tool_name=tool_name)

        metrics = self.tool_metrics[tool_name]
        current_time = datetime.now()

        # 기본 통계 업데이트
        metrics.total_calls += 1
        metrics.last_call_time = current_time

        if success:
            metrics.successful_calls += 1
        else:
            metrics.failed_calls += 1

        # 응답 시간 통계 업데이트
        if response_time > 0:
            metrics.min_response_time = min(metrics.min_response_time, response_time)
            metrics.max_response_time = max(metrics.max_response_time, response_time)

            # 평균 응답 시간 계산
            total_response_time = metrics.average_response_time * (metrics.total_calls - 1)
            metrics.average_response_time = (total_response_time + response_time) / metrics.total_calls

        # 최근 메트릭 추가
        metric = PerformanceMetric(
            timestamp=current_time,
            response_time=response_time,
            success=success,
            error_message=error_message
        )
        metrics.recent_metrics.append(metric)

        # 시간별 통계 업데이트
        hour_key = current_time.strftime("%Y-%m-%d %H")
        if hour_key not in metrics.hourly_stats:
            metrics.hourly_stats[hour_key] = 0
        metrics.hourly_stats[hour_key] += 1

        # 임계값 확인 및 알림 생성
        self._check_thresholds(tool_name, metrics)

        logger.debug(f"📊 {tool_name} 호출 기록: {response_time:.3f}초, 성공: {success}")

    def _check_thresholds(self, tool_name: str, metrics: ToolMetrics):
        """임계값 확인 및 알림 생성"""
        current_time = datetime.now()

        # 응답 시간 체크
        if metrics.average_response_time > self.thresholds["response_time"]["critical"]:
            self._create_alert(
                level="CRITICAL",
                title=f"{tool_name} 응답 시간 임계 초과",
                message=f"평균 응답 시간: {metrics.average_response_time:.2f}초",
                tool_name=tool_name
            )
        elif metrics.average_response_time > self.thresholds["response_time"]["warning"]:
            self._create_alert(
                level="WARNING",
                title=f"{tool_name} 응답 시간 지연",
                message=f"평균 응답 시간: {metrics.average_response_time:.2f}초",
                tool_name=tool_name
            )

        # 에러율 체크
        if metrics.total_calls > 10:  # 최소 10회 호출 후 체크
            error_rate = metrics.failed_calls / metrics.total_calls

            if error_rate > self.thresholds["error_rate"]["critical"]:
                self._create_alert(
                    level="CRITICAL",
                    title=f"{tool_name} 높은 오류율",
                    message=f"오류율: {error_rate:.1%}",
                    tool_name=tool_name
                )
            elif error_rate > self.thresholds["error_rate"]["warning"]:
                self._create_alert(
                    level="WARNING",
                    title=f"{tool_name} 오류율 증가",
                    message=f"오류율: {error_rate:.1%}",
                    tool_name=tool_name
                )

    def _create_alert(self, level: str, title: str, message: str, tool_name: Optional[str] = None):
        """알림 생성"""
        alert = Alert(
            id=f"alert_{int(time.time() * 1000)}",
            level=level,
            title=title,
            message=message,
            timestamp=datetime.now(),
            tool_name=tool_name
        )

        self.alerts.append(alert)
        logger.warning(f"🚨 {level} 알림: {title} - {message}")

    async def collect_system_metrics(self) -> SystemMetrics:
        """시스템 메트릭 수집"""
        try:
            # 시스템 메트릭 시뮬레이션 (실제 구현에서는 psutil 등 사용)
            import random

            cpu_usage = random.uniform(10, 90)
            memory_usage = random.uniform(30, 80)
            disk_usage = random.uniform(40, 70)
            network_latency = random.uniform(10, 100)

            metrics = SystemMetrics(
                timestamp=datetime.now(),
                cpu_usage=cpu_usage,
                memory_usage=memory_usage,
                disk_usage=disk_usage,
                network_latency=network_latency,
                active_workflows=len([m for m in self.tool_metrics.values() if m.last_call_time and
                                    datetime.now() - m.last_call_time < timedelta(minutes=5)]),
                queue_size=sum(len(m.recent_metrics) for m in self.tool_metrics.values())
            )

            self.system_metrics.append(metrics)

            # 시스템 임계값 체크
            self._check_system_thresholds(metrics)

            return metrics

        except Exception as e:
            logger.error(f"❌ 시스템 메트릭 수집 실패: {e}")
            return None

    def _check_system_thresholds(self, metrics: SystemMetrics):
        """시스템 임계값 체크"""
        thresholds = self.thresholds["system"]

        # CPU 사용률 체크
        if metrics.cpu_usage > thresholds["cpu_critical"]:
            self._create_alert("CRITICAL", "CPU 사용률 위험", f"CPU: {metrics.cpu_usage:.1f}%")
        elif metrics.cpu_usage > thresholds["cpu_warning"]:
            self._create_alert("WARNING", "CPU 사용률 높음", f"CPU: {metrics.cpu_usage:.1f}%")

        # 메모리 사용률 체크
        if metrics.memory_usage > thresholds["memory_critical"]:
            self._create_alert("CRITICAL", "메모리 부족", f"메모리: {metrics.memory_usage:.1f}%")
        elif metrics.memory_usage > thresholds["memory_warning"]:
            self._create_alert("WARNING", "메모리 사용률 높음", f"메모리: {metrics.memory_usage:.1f}%")

    async def start_monitoring(self):
        """모니터링 시작"""
        if self.monitoring_active:
            logger.warning("⚠️ 모니터링이 이미 실행 중입니다")
            return

        self.monitoring_active = True
        logger.info("📊 MCP 모니터링 시작")

        try:
            while self.monitoring_active:
                # 시스템 메트릭 수집
                await self.collect_system_metrics()

                # 도구별 헬스체크 시뮬레이션
                await self._simulate_health_checks()

                # 모니터링 간격만큼 대기
                await asyncio.sleep(self.monitoring_interval)

        except Exception as e:
            logger.error(f"❌ 모니터링 중 오류: {e}")
        finally:
            self.monitoring_active = False
            logger.info("📊 MCP 모니터링 종료")

    async def _simulate_health_checks(self):
        """헬스체크 시뮬레이션"""
        import random

        for tool_name in self.tool_metrics.keys():
            # 랜덤한 응답 시간과 성공율로 시뮬레이션
            response_time = random.uniform(0.1, 3.0)
            success = random.random() > 0.05  # 95% 성공율

            self.record_tool_call(
                tool_name=tool_name,
                response_time=response_time,
                success=success,
                error_message="Connection timeout" if not success else None
            )

    def stop_monitoring(self):
        """모니터링 중지"""
        self.monitoring_active = False
        logger.info("🛑 모니터링 중지 요청")

    def get_dashboard_data(self) -> Dict[str, Any]:
        """대시보드 데이터 생성"""
        current_time = datetime.now()

        # 전체 통계
        total_calls = sum(m.total_calls for m in self.tool_metrics.values())
        total_failures = sum(m.failed_calls for m in self.tool_metrics.values())
        overall_success_rate = (total_calls - total_failures) / max(total_calls, 1)

        # 도구별 상태
        tool_status = []
        for tool_name, metrics in self.tool_metrics.items():
            status = "healthy"
            if metrics.total_calls > 0:
                error_rate = metrics.failed_calls / metrics.total_calls
                if error_rate > 0.1:
                    status = "warning"
                if error_rate > 0.25:
                    status = "critical"

            tool_status.append({
                "name": tool_name,
                "status": status,
                "total_calls": metrics.total_calls,
                "success_rate": metrics.successful_calls / max(metrics.total_calls, 1),
                "avg_response_time": metrics.average_response_time,
                "last_call": metrics.last_call_time.isoformat() if metrics.last_call_time else None
            })

        # 최근 시스템 메트릭
        latest_system_metrics = self.system_metrics[-1] if self.system_metrics else None

        # 활성 알림
        active_alerts = [
            {
                "id": alert.id,
                "level": alert.level,
                "title": alert.title,
                "message": alert.message,
                "timestamp": alert.timestamp.isoformat(),
                "tool_name": alert.tool_name
            }
            for alert in self.alerts if not alert.resolved
        ]

        return {
            "timestamp": current_time.isoformat(),
            "overview": {
                "total_calls": total_calls,
                "success_rate": overall_success_rate,
                "active_tools": len([m for m in self.tool_metrics.values()
                                   if m.last_call_time and current_time - m.last_call_time < timedelta(hours=1)]),
                "active_alerts": len(active_alerts)
            },
            "tools": tool_status,
            "system": {
                "cpu_usage": latest_system_metrics.cpu_usage if latest_system_metrics else 0,
                "memory_usage": latest_system_metrics.memory_usage if latest_system_metrics else 0,
                "disk_usage": latest_system_metrics.disk_usage if latest_system_metrics else 0,
                "network_latency": latest_system_metrics.network_latency if latest_system_metrics else 0
            } if latest_system_metrics else {},
            "alerts": active_alerts,
            "monitoring_active": self.monitoring_active
        }

    def get_tool_details(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """특정 도구의 상세 정보"""
        if tool_name not in self.tool_metrics:
            return None

        metrics = self.tool_metrics[tool_name]

        # 최근 24시간 통계
        recent_calls = [m for m in metrics.recent_metrics
                       if datetime.now() - m.timestamp < timedelta(hours=24)]

        # 시간별 호출 패턴
        hourly_pattern = {}
        for hour in range(24):
            hour_key = f"{hour:02d}"
            hourly_pattern[hour_key] = len([m for m in recent_calls
                                          if m.timestamp.hour == hour])

        # 응답 시간 분포
        response_times = [m.response_time for m in recent_calls if m.response_time > 0]
        response_time_stats = {}
        if response_times:
            response_time_stats = {
                "min": min(response_times),
                "max": max(response_times),
                "avg": statistics.mean(response_times),
                "median": statistics.median(response_times),
                "p95": sorted(response_times)[int(len(response_times) * 0.95)] if len(response_times) > 20 else max(response_times)
            }

        return {
            "tool_name": tool_name,
            "summary": {
                "total_calls": metrics.total_calls,
                "successful_calls": metrics.successful_calls,
                "failed_calls": metrics.failed_calls,
                "success_rate": metrics.successful_calls / max(metrics.total_calls, 1),
                "average_response_time": metrics.average_response_time,
                "min_response_time": metrics.min_response_time if metrics.min_response_time != float('inf') else 0,
                "max_response_time": metrics.max_response_time,
                "last_call_time": metrics.last_call_time.isoformat() if metrics.last_call_time else None
            },
            "recent_activity": {
                "calls_24h": len(recent_calls),
                "success_rate_24h": len([m for m in recent_calls if m.success]) / max(len(recent_calls), 1),
                "hourly_pattern": hourly_pattern,
                "response_time_stats": response_time_stats
            },
            "recent_errors": [
                {
                    "timestamp": m.timestamp.isoformat(),
                    "error_message": m.error_message,
                    "response_time": m.response_time
                }
                for m in recent_calls if not m.success
            ][-10:]  # 최근 10개 오류
        }

    def generate_health_report(self) -> Dict[str, Any]:
        """종합 건강 상태 보고서"""
        current_time = datetime.now()

        # 전체 통계
        total_tools = len(self.tool_metrics)
        active_tools = len([m for m in self.tool_metrics.values()
                           if m.last_call_time and current_time - m.last_call_time < timedelta(hours=1)])

        # 상태별 도구 분류
        healthy_tools = []
        warning_tools = []
        critical_tools = []

        for tool_name, metrics in self.tool_metrics.items():
            if metrics.total_calls == 0:
                continue

            error_rate = metrics.failed_calls / metrics.total_calls
            avg_response_time = metrics.average_response_time

            if (error_rate <= 0.05 and avg_response_time <= 2.0):
                healthy_tools.append(tool_name)
            elif (error_rate <= 0.15 and avg_response_time <= 5.0):
                warning_tools.append(tool_name)
            else:
                critical_tools.append(tool_name)

        # 권장사항 생성
        recommendations = []
        if critical_tools:
            recommendations.append(f"긴급: {', '.join(critical_tools)} 도구들의 문제를 즉시 해결하세요")
        if warning_tools:
            recommendations.append(f"주의: {', '.join(warning_tools)} 도구들을 모니터링하세요")
        if len(active_tools) < total_tools * 0.8:
            recommendations.append("일부 도구들이 비활성 상태입니다. 연결 상태를 확인하세요")

        # 최근 알림 요약
        recent_alerts = [a for a in self.alerts
                        if current_time - a.timestamp < timedelta(hours=24)]
        alert_summary = {
            "total": len(recent_alerts),
            "critical": len([a for a in recent_alerts if a.level == "CRITICAL"]),
            "warning": len([a for a in recent_alerts if a.level == "WARNING"]),
            "info": len([a for a in recent_alerts if a.level == "INFO"])
        }

        return {
            "timestamp": current_time.isoformat(),
            "overall_health": "healthy" if not critical_tools else "critical" if len(critical_tools) > 2 else "warning",
            "summary": {
                "total_tools": total_tools,
                "active_tools": active_tools,
                "healthy_tools": len(healthy_tools),
                "warning_tools": len(warning_tools),
                "critical_tools": len(critical_tools)
            },
            "tool_status": {
                "healthy": healthy_tools,
                "warning": warning_tools,
                "critical": critical_tools
            },
            "alert_summary": alert_summary,
            "recommendations": recommendations,
            "system_status": {
                "monitoring_active": self.monitoring_active,
                "uptime": "모니터링 시작 이후 시간 계산 필요"
            }
        }

    def export_metrics(self, format: str = "json") -> str:
        """메트릭 데이터 내보내기"""
        data = {
            "export_timestamp": datetime.now().isoformat(),
            "tools": {},
            "system_metrics": [],
            "alerts": []
        }

        # 도구별 메트릭
        for tool_name, metrics in self.tool_metrics.items():
            data["tools"][tool_name] = {
                "total_calls": metrics.total_calls,
                "successful_calls": metrics.successful_calls,
                "failed_calls": metrics.failed_calls,
                "average_response_time": metrics.average_response_time,
                "min_response_time": metrics.min_response_time if metrics.min_response_time != float('inf') else 0,
                "max_response_time": metrics.max_response_time,
                "last_call_time": metrics.last_call_time.isoformat() if metrics.last_call_time else None,
                "hourly_stats": metrics.hourly_stats
            }

        # 시스템 메트릭
        data["system_metrics"] = [
            {
                "timestamp": m.timestamp.isoformat(),
                "cpu_usage": m.cpu_usage,
                "memory_usage": m.memory_usage,
                "disk_usage": m.disk_usage,
                "network_latency": m.network_latency,
                "active_workflows": m.active_workflows,
                "queue_size": m.queue_size
            }
            for m in list(self.system_metrics)[-100:]  # 최근 100개
        ]

        # 알림
        data["alerts"] = [
            {
                "id": alert.id,
                "level": alert.level,
                "title": alert.title,
                "message": alert.message,
                "timestamp": alert.timestamp.isoformat(),
                "tool_name": alert.tool_name,
                "resolved": alert.resolved
            }
            for alert in list(self.alerts)
        ]

        if format.lower() == "json":
            return json.dumps(data, indent=2, ensure_ascii=False)
        else:
            # CSV나 다른 형식도 추가 가능
            return json.dumps(data, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    # 모니터 테스트
    async def main():
        print("📊 MCP 모니터 테스트")
        print("=" * 50)

        monitor = MCPMonitor(monitoring_interval=5)  # 5초 간격

        # 일부 테스트 데이터 추가
        import random
        for _ in range(50):
            tool = random.choice(list(monitor.tool_metrics.keys()))
            response_time = random.uniform(0.1, 4.0)
            success = random.random() > 0.1  # 90% 성공율

            monitor.record_tool_call(tool, response_time, success)

        # 대시보드 데이터 확인
        dashboard = monitor.get_dashboard_data()
        print(f"\n📈 대시보드 요약:")
        print(f"총 호출: {dashboard['overview']['total_calls']}")
        print(f"성공률: {dashboard['overview']['success_rate']:.1%}")
        print(f"활성 도구: {dashboard['overview']['active_tools']}")
        print(f"활성 알림: {dashboard['overview']['active_alerts']}")

        # 도구별 상세 정보
        tool_name = "mcp__github__"
        details = monitor.get_tool_details(tool_name)
        if details:
            print(f"\n🔧 {tool_name} 상세:")
            print(f"총 호출: {details['summary']['total_calls']}")
            print(f"성공률: {details['summary']['success_rate']:.1%}")
            print(f"평균 응답시간: {details['summary']['average_response_time']:.2f}초")

        # 건강 상태 보고서
        health_report = monitor.generate_health_report()
        print(f"\n🏥 건강 상태: {health_report['overall_health']}")
        print(f"건강한 도구: {len(health_report['tool_status']['healthy'])}")
        print(f"경고 도구: {len(health_report['tool_status']['warning'])}")
        print(f"위험 도구: {len(health_report['tool_status']['critical'])}")

        if health_report['recommendations']:
            print("\n💡 권장사항:")
            for rec in health_report['recommendations']:
                print(f"- {rec}")

        print("\n✅ 모니터 테스트 완료")

    asyncio.run(main())