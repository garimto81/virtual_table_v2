# 사용자 등록 API 테스트 케이스
# Test cases for User Registration API

import pytest
import re
from datetime import datetime
from unittest.mock import Mock, patch
from user_registration_api import (
    User, UserRepository, UserRegistrationService, ValidationError
)

class TestUserRepository:
    """UserRepository 클래스 테스트"""
    
    def setup_method(self):
        """각 테스트 메서드 실행 전 초기화"""
        self.repository = UserRepository()
        self.sample_user = User(
            id="test-123",
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            created_at=datetime.now()
        )
    
    def test_save_user_success(self):
        """사용자 저장 성공 테스트"""
        # Given
        user = self.sample_user
        
        # When
        result = self.repository.save(user)
        
        # Then
        assert result == user
        assert user.id in self.repository.users
        assert user.username in self.repository.usernames
        assert user.email in self.repository.emails
    
    def test_find_by_username_exists(self):
        """존재하는 사용자명으로 사용자 검색 테스트"""
        # Given
        self.repository.save(self.sample_user)
        
        # When
        result = self.repository.find_by_username("testuser")
        
        # Then
        assert result is not None
        assert result.username == "testuser"
        assert result.email == "test@example.com"
    
    def test_find_by_username_not_exists(self):
        """존재하지 않는 사용자명으로 검색 테스트"""
        # Given & When
        result = self.repository.find_by_username("nonexistent")
        
        # Then
        assert result is None
    
    def test_find_by_email_exists(self):
        """존재하는 이메일로 사용자 검색 테스트"""
        # Given
        self.repository.save(self.sample_user)
        
        # When
        result = self.repository.find_by_email("test@example.com")
        
        # Then
        assert result is not None
        assert result.email == "test@example.com"
        assert result.username == "testuser"
    
    def test_find_by_email_not_exists(self):
        """존재하지 않는 이메일로 검색 테스트"""
        # Given & When
        result = self.repository.find_by_email("nonexistent@example.com")
        
        # Then
        assert result is None
    
    def test_username_exists_true(self):
        """사용자명 중복 확인 - 존재하는 경우"""
        # Given
        self.repository.save(self.sample_user)
        
        # When
        result = self.repository.username_exists("testuser")
        
        # Then
        assert result is True
    
    def test_username_exists_false(self):
        """사용자명 중복 확인 - 존재하지 않는 경우"""
        # Given & When
        result = self.repository.username_exists("nonexistent")
        
        # Then
        assert result is False
    
    def test_email_exists_true(self):
        """이메일 중복 확인 - 존재하는 경우"""
        # Given
        self.repository.save(self.sample_user)
        
        # When
        result = self.repository.email_exists("test@example.com")
        
        # Then
        assert result is True
    
    def test_email_exists_false(self):
        """이메일 중복 확인 - 존재하지 않는 경우"""
        # Given & When
        result = self.repository.email_exists("nonexistent@example.com")
        
        # Then
        assert result is False


class TestUserRegistrationService:
    """UserRegistrationService 클래스 테스트"""
    
    def setup_method(self):
        """각 테스트 메서드 실행 전 초기화"""
        self.repository = UserRepository()
        self.service = UserRegistrationService(self.repository)
        self.valid_username = "testuser123"
        self.valid_email = "test@example.com"
        self.valid_password = "Password123!"
    
    # === 성공 케이스 테스트 ===
    
    def test_register_user_success(self):
        """사용자 등록 성공 테스트"""
        # Given
        username = self.valid_username
        email = self.valid_email
        password = self.valid_password
        
        # When
        result = self.service.register_user(username, email, password)
        
        # Then
        assert result["success"] is True
        assert result["message"] == "사용자 등록이 완료되었습니다"
        assert "user" in result
        assert result["user"]["username"] == username
        assert result["user"]["email"] == email
        assert "id" in result["user"]
        assert "created_at" in result["user"]
        
        # 저장소에 실제로 저장되었는지 확인
        saved_user = self.repository.find_by_username(username)
        assert saved_user is not None
        assert saved_user.username == username
        assert saved_user.email == email
    
    @patch('user_registration_api.uuid.uuid4')
    def test_register_user_generates_unique_id(self, mock_uuid):
        """사용자 등록 시 고유 ID 생성 확인"""
        # Given
        mock_uuid.return_value.hex = "mocked-uuid"
        mock_uuid.return_value.__str__ = Mock(return_value="mocked-uuid-string")
        
        # When
        result = self.service.register_user(
            self.valid_username, self.valid_email, self.valid_password
        )
        
        # Then
        assert mock_uuid.called
        assert result["user"]["id"] == "mocked-uuid-string"
    
    def test_password_is_hashed(self):
        """비밀번호 해시화 확인"""
        # Given
        password = self.valid_password
        
        # When
        self.service.register_user(self.valid_username, self.valid_email, password)
        
        # Then
        saved_user = self.repository.find_by_username(self.valid_username)
        assert saved_user.password_hash != password  # 원본 비밀번호와 다름
        assert len(saved_user.password_hash) > 0     # 해시값이 존재
        assert ':' in saved_user.password_hash       # salt가 포함된 형식
    
    # === 사용자명 유효성 검사 테스트 ===
    
    def test_register_user_empty_username(self):
        """빈 사용자명으로 등록 시 에러 테스트"""
        # Given & When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user("", self.valid_email, self.valid_password)
        
        assert exc_info.value.field == "username"
        assert "필수입니다" in exc_info.value.message
    
    def test_register_user_short_username(self):
        """짧은 사용자명으로 등록 시 에러 테스트"""
        # Given & When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user("ab", self.valid_email, self.valid_password)
        
        assert exc_info.value.field == "username"
        assert "3자 이상" in exc_info.value.message
    
    def test_register_user_long_username(self):
        """긴 사용자명으로 등록 시 에러 테스트"""
        # Given
        long_username = "a" * 21  # 21자
        
        # When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(long_username, self.valid_email, self.valid_password)
        
        assert exc_info.value.field == "username"
        assert "20자 이하" in exc_info.value.message
    
    @pytest.mark.parametrize("invalid_username", [
        "user name",     # 공백 포함
        "user-name",     # 하이픈 포함
        "user@name",     # 특수문자 포함
        "사용자명",       # 한글 포함
        "user.name",     # 점 포함
    ])
    def test_register_user_invalid_username_characters(self, invalid_username):
        """잘못된 문자가 포함된 사용자명 테스트"""
        # Given & When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(invalid_username, self.valid_email, self.valid_password)
        
        assert exc_info.value.field == "username"
        assert "영문, 숫자, 언더스코어만" in exc_info.value.message
    
    def test_register_user_duplicate_username(self):
        """중복 사용자명으로 등록 시 에러 테스트"""
        # Given
        # 첫 번째 사용자 등록
        self.service.register_user(self.valid_username, "first@example.com", self.valid_password)
        
        # When & Then
        # 같은 사용자명으로 다시 등록 시도
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, "second@example.com", self.valid_password)
        
        assert exc_info.value.field == "username"
        assert "이미 사용중인" in exc_info.value.message    # === 이메일 유효성 검사 테스트 ===
    
    def test_register_user_empty_email(self):
        """빈 이메일로 등록 시 에러 테스트"""
        # Given & When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, "", self.valid_password)
        
        assert exc_info.value.field == "email"
        assert "필수입니다" in exc_info.value.message
    
    @pytest.mark.parametrize("invalid_email", [
        "invalid-email",           # @ 기호 없음
        "@example.com",           # 로컬 부분 없음
        "user@",                  # 도메인 부분 없음
        "user@.com",             # 도메인명 없음
        "user@example",          # 최상위 도메인 없음
        "user space@example.com", # 공백 포함
        "user@exam ple.com",     # 도메인에 공백
        "user@@example.com",     # @ 기호 중복
        "user@example..com",     # 점 중복
    ])
    def test_register_user_invalid_email_format(self, invalid_email):
        """잘못된 이메일 형식 테스트"""
        # Given & When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, invalid_email, self.valid_password)
        
        assert exc_info.value.field == "email"
        assert "올바른 이메일 형식" in exc_info.value.message
    
    def test_register_user_duplicate_email(self):
        """중복 이메일로 등록 시 에러 테스트"""
        # Given
        # 첫 번째 사용자 등록
        self.service.register_user("user1", self.valid_email, self.valid_password)
        
        # When & Then
        # 같은 이메일로 다시 등록 시도
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user("user2", self.valid_email, self.valid_password)
        
        assert exc_info.value.field == "email"
        assert "이미 등록된" in exc_info.value.message
    
    # === 비밀번호 유효성 검사 테스트 ===
    
    def test_register_user_empty_password(self):
        """빈 비밀번호로 등록 시 에러 테스트"""
        # Given & When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, self.valid_email, "")
        
        assert exc_info.value.field == "password"
        assert "필수입니다" in exc_info.value.message
    
    def test_register_user_short_password(self):
        """짧은 비밀번호로 등록 시 에러 테스트"""
        # Given
        short_password = "Pass1!"  # 6자
        
        # When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, self.valid_email, short_password)
        
        assert exc_info.value.field == "password"
        assert "8자 이상" in exc_info.value.message
    
    def test_register_user_long_password(self):
        """긴 비밀번호로 등록 시 에러 테스트"""
        # Given
        long_password = "A" * 129  # 129자
        
        # When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, self.valid_email, long_password)
        
        assert exc_info.value.field == "password"
        assert "128자 이하" in exc_info.value.message
    
    def test_register_user_password_no_uppercase(self):
        """대문자 없는 비밀번호 에러 테스트"""
        # Given
        password = "password123!"  # 대문자 없음
        
        # When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, self.valid_email, password)
        
        assert exc_info.value.field == "password"
        assert "대문자를 포함" in exc_info.value.message
    
    def test_register_user_password_no_lowercase(self):
        """소문자 없는 비밀번호 에러 테스트"""
        # Given
        password = "PASSWORD123!"  # 소문자 없음
        
        # When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, self.valid_email, password)
        
        assert exc_info.value.field == "password"
        assert "소문자를 포함" in exc_info.value.message
    
    def test_register_user_password_no_digit(self):
        """숫자 없는 비밀번호 에러 테스트"""
        # Given
        password = "Password!"  # 숫자 없음
        
        # When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, self.valid_email, password)
        
        assert exc_info.value.field == "password"
        assert "숫자를 포함" in exc_info.value.message
    
    def test_register_user_password_no_special_char(self):
        """특수문자 없는 비밀번호 에러 테스트"""
        # Given
        password = "Password123"  # 특수문자 없음
        
        # When & Then
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(self.valid_username, self.valid_email, password)
        
        assert exc_info.value.field == "password"
        assert "특수문자를 포함" in exc_info.value.message
    
    @pytest.mark.parametrize("valid_password", [
        "Password123!",     # 기본 조건 만족
        "MySecure1@",       # 최소 길이
        "VeryLongPassword123!@#",  # 긴 비밀번호
        "Test1234$",        # 달러 기호
        "MyPass1%",         # 퍼센트 기호
        "Secure&Pass1",     # 앰퍼샌드
    ])
    def test_register_user_valid_passwords(self, valid_password):
        """유효한 비밀번호들 테스트"""
        # Given
        username = f"user_{valid_password[:5]}"  # 고유한 사용자명
        email = f"test_{valid_password[:5]}@example.com"  # 고유한 이메일
        
        # When
        result = self.service.register_user(username, email, valid_password)
        
        # Then
        assert result["success"] is True
        assert result["user"]["username"] == username
        assert result["user"]["email"] == email


class TestValidationError:
    """ValidationError 예외 클래스 테스트"""
    
    def test_validation_error_creation(self):
        """ValidationError 생성 테스트"""
        # Given
        field = "test_field"
        message = "test message"
        
        # When
        error = ValidationError(field, message)
        
        # Then
        assert error.field == field
        assert error.message == message
        assert str(error) == f"{field}: {message}"
    
    def test_validation_error_inheritance(self):
        """ValidationError가 Exception을 상속하는지 테스트"""
        # Given
        error = ValidationError("field", "message")
        
        # When & Then
        assert isinstance(error, Exception)


class TestUserDataModel:
    """User 데이터 모델 테스트"""
    
    def test_user_creation(self):
        """User 객체 생성 테스트"""
        # Given
        user_data = {
            "id": "test-123",
            "username": "testuser",
            "email": "test@example.com",
            "password_hash": "hashed_password",
            "created_at": datetime.now()
        }
        
        # When
        user = User(**user_data)
        
        # Then
        assert user.id == user_data["id"]
        assert user.username == user_data["username"]
        assert user.email == user_data["email"]
        assert user.password_hash == user_data["password_hash"]
        assert user.created_at == user_data["created_at"]
        assert user.is_active is True  # 기본값
    
    def test_user_with_custom_is_active(self):
        """User 객체 is_active 커스텀 값 테스트"""
        # Given & When
        user = User(
            id="test-123",
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            created_at=datetime.now(),
            is_active=False
        )
        
        # Then
        assert user.is_active is False


class TestIntegration:
    """통합 테스트 (Integration Tests)"""
    
    def setup_method(self):
        """각 테스트 메서드 실행 전 초기화"""
        self.repository = UserRepository()
        self.service = UserRegistrationService(self.repository)
    
    def test_multiple_user_registration(self):
        """여러 사용자 연속 등록 테스트"""
        # Given
        users_data = [
            ("user1", "user1@example.com", "Password123!"),
            ("user2", "user2@example.com", "SecurePass456@"),
            ("user3", "user3@example.com", "MyPassword789#"),
        ]
        
        # When
        results = []
        for username, email, password in users_data:
            result = self.service.register_user(username, email, password)
            results.append(result)
        
        # Then
        # 모든 등록이 성공했는지 확인
        for result in results:
            assert result["success"] is True
        
        # 저장소에 모든 사용자가 있는지 확인
        assert len(self.repository.users) == 3
        assert len(self.repository.usernames) == 3
        assert len(self.repository.emails) == 3
        
        # 각 사용자를 찾을 수 있는지 확인
        for username, email, _ in users_data:
            assert self.repository.find_by_username(username) is not None
            assert self.repository.find_by_email(email) is not None
    
    def test_repository_and_service_interaction(self):
        """Repository와 Service 간 상호작용 테스트"""
        # Given
        username = "integration_user"
        email = "integration@example.com"
        password = "IntegrationTest123!"
        
        # When
        # 서비스를 통해 사용자 등록
        registration_result = self.service.register_user(username, email, password)
        
        # Repository를 직접 사용해서 확인
        found_by_username = self.repository.find_by_username(username)
        found_by_email = self.repository.find_by_email(email)
        username_exists = self.repository.username_exists(username)
        email_exists = self.repository.email_exists(email)
        
        # Then
        # 등록 결과 확인
        assert registration_result["success"] is True
        assert registration_result["user"]["username"] == username
        
        # Repository 검색 결과 확인
        assert found_by_username is not None
        assert found_by_username.username == username
        assert found_by_username.email == email
        
        assert found_by_email is not None
        assert found_by_email.username == username
        assert found_by_email.email == email
        
        # 중복 확인 기능 테스트
        assert username_exists is True
        assert email_exists is True
        assert self.repository.username_exists("nonexistent") is False
        assert self.repository.email_exists("nonexistent@example.com") is False
    
    def test_concurrent_registration_same_username(self):
        """동시에 같은 사용자명으로 등록 시도 시뮬레이션"""
        # Given
        username = "concurrent_user"
        password = "ConcurrentTest123!"
        
        # When
        # 첫 번째 사용자 등록 성공
        first_result = self.service.register_user(username, "first@example.com", password)
        
        # 두 번째 사용자가 같은 사용자명으로 등록 시도
        with pytest.raises(ValidationError) as exc_info:
            self.service.register_user(username, "second@example.com", password)
        
        # Then
        assert first_result["success"] is True
        assert exc_info.value.field == "username"
        assert "이미 사용중인" in exc_info.value.message
        
        # Repository에는 하나의 사용자만 있어야 함
        assert len(self.repository.users) == 1
        assert len(self.repository.usernames) == 1


# === 성능 테스트 ===

class TestPerformance:
    """성능 관련 테스트"""
    
    def setup_method(self):
        """각 테스트 메서드 실행 전 초기화"""
        self.repository = UserRepository()
        self.service = UserRegistrationService(self.repository)
    
    def test_large_number_of_users(self):
        """대량 사용자 등록 성능 테스트"""
        # Given
        user_count = 100
        
        # When
        import time
        start_time = time.time()
        
        for i in range(user_count):
            username = f"user_{i:03d}"
            email = f"user{i:03d}@example.com"
            password = f"Password{i}!"
            
            result = self.service.register_user(username, email, password)
            assert result["success"] is True
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Then
        assert len(self.repository.users) == user_count
        assert execution_time < 10.0  # 10초 내에 완료되어야 함
        print(f"등록 {user_count}명 사용자 소요 시간: {execution_time:.2f}초")
    
    def test_username_lookup_performance(self):
        """사용자명 검색 성능 테스트"""
        # Given
        # 1000명의 사용자 미리 등록
        for i in range(1000):
            user = User(
                id=f"user-{i}",
                username=f"user_{i:04d}",
                email=f"user{i:04d}@example.com",
                password_hash="hashed",
                created_at=datetime.now()
            )
            self.repository.save(user)
        
        # When
        import time
        start_time = time.time()
        
        # 100번 검색 수행
        for i in range(100):
            username = f"user_{i:04d}"
            result = self.repository.find_by_username(username)
            assert result is not None
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Then
        assert execution_time < 1.0  # 1초 내에 완료되어야 함
        print(f"100회 사용자명 검색 소요 시간: {execution_time:.3f}초")


if __name__ == "__main__":
    # 테스트 실행 방법
    # pytest test_user_registration_api.py -v --cov=user_registration_api
    print("사용자 등록 API 테스트 케이스")
    print("실행 방법: pytest test_user_registration_api.py -v")
    print("커버리지 포함: pytest test_user_registration_api.py -v --cov=user_registration_api")