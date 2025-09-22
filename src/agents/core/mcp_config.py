#!/usr/bin/env python3
"""
MCP Configuration Manager - MCP 도구별 설정 및 구성 관리

작성자: Claude AI Assistant
버전: 1.0.0
최종 업데이트: 2025-09-19
"""

import json
import os
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@dataclass
class MCPConfiguration:
    """MCP 도구 설정"""
    name: str
    prefix: str
    endpoint: Optional[str] = None
    timeout: int = 30
    retry_count: int = 3
    rate_limit: int = 100  # requests per minute
    auth_required: bool = False
    auth_config: Dict[str, Any] = None
    custom_headers: Dict[str, str] = None
    enabled: bool = True

    def __post_init__(self):
        if self.auth_config is None:
            self.auth_config = {}
        if self.custom_headers is None:
            self.custom_headers = {}

class MCPConfigManager:
    """MCP 설정 관리자"""

    def __init__(self, config_file: str = "mcp_config.json"):
        self.config_file = config_file
        self.configurations: Dict[str, MCPConfiguration] = {}
        self.load_default_configurations()
        self.load_config_file()

    def load_default_configurations(self):
        """기본 MCP 설정 로드"""
        default_configs = {
            "mcp__supabase__": MCPConfiguration(
                name="Supabase",
                prefix="mcp__supabase__",
                timeout=45,
                rate_limit=50,
                auth_required=True,
                auth_config={
                    "api_key_required": True,
                    "project_ref_required": True
                }
            ),
            "mcp__github__": MCPConfiguration(
                name="GitHub",
                prefix="mcp__github__",
                timeout=30,
                rate_limit=100,
                auth_required=True,
                auth_config={
                    "token_required": True,
                    "scope": ["repo", "user"]
                }
            ),
            "mcp__context7__": MCPConfiguration(
                name="Context7",
                prefix="mcp__context7__",
                timeout=60,
                rate_limit=20,
                auth_required=False
            ),
            "mcp__exa__": MCPConfiguration(
                name="Exa",
                prefix="mcp__exa__",
                timeout=45,
                rate_limit=30,
                auth_required=True,
                auth_config={
                    "api_key_required": True
                }
            ),
            "mcp__ide__": MCPConfiguration(
                name="IDE Integration",
                prefix="mcp__ide__",
                timeout=15,
                rate_limit=200,
                auth_required=False
            ),
            "mcp__playwright__": MCPConfiguration(
                name="Playwright",
                prefix="mcp__playwright__",
                timeout=120,
                rate_limit=10,
                auth_required=False
            ),
            "mcp__taskmanager__": MCPConfiguration(
                name="Task Manager",
                prefix="mcp__taskmanager__",
                timeout=30,
                rate_limit=50,
                auth_required=False
            ),
            "mcp__wonderwhy-er-desktop-commander__": MCPConfiguration(
                name="Desktop Commander",
                prefix="mcp__wonderwhy-er-desktop-commander__",
                timeout=30,
                rate_limit=100,
                auth_required=False
            )
        }

        for prefix, config in default_configs.items():
            self.configurations[prefix] = config

        logger.info(f"✅ {len(default_configs)}개 기본 설정 로드 완료")

    def load_config_file(self):
        """설정 파일에서 커스텀 설정 로드"""
        if not os.path.exists(self.config_file):
            logger.info("설정 파일이 없습니다. 기본 설정을 사용합니다.")
            return

        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config_data = json.load(f)

            for prefix, data in config_data.items():
                if prefix in self.configurations:
                    # 기존 설정 업데이트
                    current_config = self.configurations[prefix]
                    for key, value in data.items():
                        if hasattr(current_config, key):
                            setattr(current_config, key, value)
                else:
                    # 새 설정 추가
                    self.configurations[prefix] = MCPConfiguration(**data)

            logger.info(f"✅ 설정 파일 '{self.config_file}'에서 설정 로드 완료")

        except Exception as e:
            logger.error(f"❌ 설정 파일 로드 실패: {e}")

    def save_config_file(self):
        """현재 설정을 파일로 저장"""
        try:
            config_data = {}
            for prefix, config in self.configurations.items():
                config_data[prefix] = asdict(config)

            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, indent=2, ensure_ascii=False, default=str)

            logger.info(f"✅ 설정 파일 '{self.config_file}' 저장 완료")

        except Exception as e:
            logger.error(f"❌ 설정 파일 저장 실패: {e}")

    def get_config(self, prefix: str) -> Optional[MCPConfiguration]:
        """특정 MCP 도구 설정 조회"""
        return self.configurations.get(prefix)

    def update_config(self, prefix: str, **kwargs):
        """특정 MCP 도구 설정 업데이트"""
        if prefix not in self.configurations:
            logger.warning(f"⚠️ 알 수 없는 MCP 도구: {prefix}")
            return

        config = self.configurations[prefix]
        for key, value in kwargs.items():
            if hasattr(config, key):
                setattr(config, key, value)
                logger.info(f"✅ {prefix}.{key} = {value}")
            else:
                logger.warning(f"⚠️ 알 수 없는 설정 키: {key}")

    def enable_tool(self, prefix: str):
        """MCP 도구 활성화"""
        if prefix in self.configurations:
            self.configurations[prefix].enabled = True
            logger.info(f"✅ {prefix} 활성화")

    def disable_tool(self, prefix: str):
        """MCP 도구 비활성화"""
        if prefix in self.configurations:
            self.configurations[prefix].enabled = False
            logger.info(f"🔴 {prefix} 비활성화")

    def get_enabled_tools(self) -> Dict[str, MCPConfiguration]:
        """활성화된 도구 목록 반환"""
        return {
            prefix: config for prefix, config in self.configurations.items()
            if config.enabled
        }

    def validate_configuration(self) -> Dict[str, Any]:
        """설정 검증 및 문제점 보고"""
        validation_report = {
            "timestamp": datetime.now().isoformat(),
            "total_configs": len(self.configurations),
            "enabled_configs": len(self.get_enabled_tools()),
            "issues": [],
            "warnings": [],
            "recommendations": []
        }

        for prefix, config in self.configurations.items():
            # 필수 인증 설정 확인
            if config.auth_required and not config.auth_config:
                validation_report["issues"].append(
                    f"{prefix}: 인증이 필요하지만 인증 설정이 없습니다"
                )

            # 타임아웃 설정 확인
            if config.timeout < 5:
                validation_report["warnings"].append(
                    f"{prefix}: 타임아웃이 너무 짧습니다 ({config.timeout}초)"
                )
            elif config.timeout > 300:
                validation_report["warnings"].append(
                    f"{prefix}: 타임아웃이 너무 깁니다 ({config.timeout}초)"
                )

            # 레이트 리미트 확인
            if config.rate_limit < 1:
                validation_report["issues"].append(
                    f"{prefix}: 레이트 리미트가 너무 낮습니다 ({config.rate_limit})"
                )

        # 권장사항 생성
        if validation_report["issues"]:
            validation_report["recommendations"].append(
                "발견된 문제점들을 해결해야 합니다"
            )

        if validation_report["warnings"]:
            validation_report["recommendations"].append(
                "경고사항들을 검토하고 필요시 조정하세요"
            )

        return validation_report

    def export_config_template(self) -> str:
        """설정 템플릿 내보내기"""
        template = {
            "_comment": "MCP Master Agent 설정 파일",
            "_description": "각 MCP 도구의 동작을 제어하는 설정들",
            "_last_updated": datetime.now().isoformat()
        }

        for prefix, config in self.configurations.items():
            template[prefix] = {
                "name": config.name,
                "enabled": config.enabled,
                "timeout": config.timeout,
                "retry_count": config.retry_count,
                "rate_limit": config.rate_limit,
                "auth_required": config.auth_required,
                "auth_config": config.auth_config,
                "custom_headers": config.custom_headers,
                "_description": f"Configuration for {config.name}"
            }

        return json.dumps(template, indent=2, ensure_ascii=False)

class MCPEnvironmentManager:
    """MCP 환경 관리자"""

    def __init__(self):
        self.environment_vars = self._load_environment_vars()

    def _load_environment_vars(self) -> Dict[str, str]:
        """환경 변수 로드"""
        env_vars = {}

        # MCP 관련 환경 변수들
        mcp_env_keys = [
            'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
            'GITHUB_TOKEN', 'GITHUB_API_URL',
            'EXA_API_KEY',
            'CONTEXT7_API_KEY',
            'MCP_DEBUG', 'MCP_LOG_LEVEL',
            'MCP_TIMEOUT_DEFAULT', 'MCP_RETRY_DEFAULT'
        ]

        for key in mcp_env_keys:
            value = os.getenv(key)
            if value:
                env_vars[key] = value

        return env_vars

    def get_env_var(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """환경 변수 조회"""
        return self.environment_vars.get(key, default)

    def validate_environment(self) -> Dict[str, Any]:
        """환경 설정 검증"""
        validation = {
            "timestamp": datetime.now().isoformat(),
            "required_vars": {
                "missing": [],
                "present": []
            },
            "optional_vars": {
                "missing": [],
                "present": []
            },
            "recommendations": []
        }

        # 필수 환경 변수
        required_vars = {
            'GITHUB_TOKEN': 'GitHub API 접근을 위한 토큰',
            'SUPABASE_URL': 'Supabase 프로젝트 URL',
            'SUPABASE_ANON_KEY': 'Supabase 익명 키'
        }

        # 선택적 환경 변수
        optional_vars = {
            'EXA_API_KEY': 'Exa 검색 API 키',
            'CONTEXT7_API_KEY': 'Context7 API 키',
            'MCP_DEBUG': 'MCP 디버그 모드',
            'MCP_LOG_LEVEL': 'MCP 로그 레벨'
        }

        # 필수 변수 확인
        for var, description in required_vars.items():
            if self.get_env_var(var):
                validation["required_vars"]["present"].append({
                    "name": var,
                    "description": description
                })
            else:
                validation["required_vars"]["missing"].append({
                    "name": var,
                    "description": description
                })

        # 선택적 변수 확인
        for var, description in optional_vars.items():
            if self.get_env_var(var):
                validation["optional_vars"]["present"].append({
                    "name": var,
                    "description": description
                })
            else:
                validation["optional_vars"]["missing"].append({
                    "name": var,
                    "description": description
                })

        # 권장사항 생성
        if validation["required_vars"]["missing"]:
            validation["recommendations"].append(
                "누락된 필수 환경 변수들을 설정하세요"
            )

        if validation["optional_vars"]["missing"]:
            validation["recommendations"].append(
                "선택적 환경 변수들을 설정하면 더 많은 기능을 사용할 수 있습니다"
            )

        return validation

    def create_env_template(self) -> str:
        """환경 변수 템플릿 생성"""
        template = """# MCP Master Agent 환경 변수 설정
# 이 파일을 .env로 저장하고 실제 값들로 수정하세요

# === 필수 설정 ===
# GitHub 설정
GITHUB_TOKEN=your_github_token_here
GITHUB_API_URL=https://api.github.com

# Supabase 설정
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# === 선택적 설정 ===
# Exa 검색 API
EXA_API_KEY=your_exa_api_key_here

# Context7 API
CONTEXT7_API_KEY=your_context7_api_key_here

# === MCP 일반 설정 ===
# 디버그 모드 (true/false)
MCP_DEBUG=false

# 로그 레벨 (DEBUG, INFO, WARNING, ERROR)
MCP_LOG_LEVEL=INFO

# 기본 타임아웃 (초)
MCP_TIMEOUT_DEFAULT=30

# 기본 재시도 횟수
MCP_RETRY_DEFAULT=3

# === 고급 설정 ===
# 프록시 설정 (필요시)
# HTTP_PROXY=http://proxy.company.com:8080
# HTTPS_PROXY=https://proxy.company.com:8080

# SSL 인증서 검증 (true/false)
# SSL_VERIFY=true
"""
        return template

if __name__ == "__main__":
    # 설정 관리자 테스트
    print("🔧 MCP 설정 관리자 테스트")
    print("=" * 50)

    # 설정 관리자 초기화
    config_manager = MCPConfigManager()

    # 설정 검증
    validation_report = config_manager.validate_configuration()
    print(f"\n📋 설정 검증 결과:")
    print(f"총 설정: {validation_report['total_configs']}")
    print(f"활성화된 설정: {validation_report['enabled_configs']}")
    print(f"문제점: {len(validation_report['issues'])}")
    print(f"경고: {len(validation_report['warnings'])}")

    # 환경 관리자 테스트
    env_manager = MCPEnvironmentManager()
    env_validation = env_manager.validate_environment()
    print(f"\n🌍 환경 변수 검증:")
    print(f"필수 변수 - 존재: {len(env_validation['required_vars']['present'])}, "
          f"누락: {len(env_validation['required_vars']['missing'])}")

    # 템플릿 생성
    print(f"\n📄 환경 변수 템플릿:")
    print(env_manager.create_env_template()[:200] + "...")

    print("\n✅ 설정 관리자 테스트 완료")