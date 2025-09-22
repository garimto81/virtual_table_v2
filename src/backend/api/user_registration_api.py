# 사용자 등록 API (User Registration API)
# 테스트를 위한 샘플 API 구현

import re
import hashlib
import uuid
from typing import Dict, Optional, List
from dataclasses import dataclass
from datetime import datetime

@dataclass
class User:
    """사용자 데이터 모델"""
    id: str
    username: str
    email: str
    password_hash: str
    created_at: datetime
    is_active: bool = True

class UserRepository:
    """사용자 데이터 저장소 (메모리 기반 - 테스트용)"""
    def __init__(self):
        self.users: Dict[str, User] = {}
        self.usernames: set = set()
        self.emails: set = set()
    
    def find_by_username(self, username: str) -> Optional[User]:
        """사용자명으로 사용자 검색"""
        for user in self.users.values():
            if user.username == username:
                return user
        return None
    
    def find_by_email(self, email: str) -> Optional[User]:
        """이메일로 사용자 검색"""
        for user in self.users.values():
            if user.email == email:
                return user
        return None
    
    def save(self, user: User) -> User:
        """사용자 저장"""
        self.users[user.id] = user
        self.usernames.add(user.username)
        self.emails.add(user.email)
        return user
    
    def username_exists(self, username: str) -> bool:
        """사용자명 중복 확인"""
        return username in self.usernames
    
    def email_exists(self, email: str) -> bool:
        """이메일 중복 확인"""
        return email in self.emails

class ValidationError(Exception):
    """유효성 검사 에러"""
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")

class UserRegistrationService:
    """사용자 등록 서비스"""
    
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository
    
    def register_user(self, username: str, email: str, password: str) -> Dict:
        """
        사용자 등록 메인 함수
        
        Args:
            username: 사용자명 (3-20자, 영문/숫자/언더스코어만)
            email: 이메일 주소
            password: 비밀번호 (8자 이상, 대소문자/숫자/특수문자 포함)
        
        Returns:
            Dict: 등록 결과 정보
        
        Raises:
            ValidationError: 유효성 검사 실패시
        """
        # 입력값 검증
        self._validate_username(username)
        self._validate_email(email)
        self._validate_password(password)
        
        # 중복 확인
        if self.user_repository.username_exists(username):
            raise ValidationError("username", "이미 사용중인 사용자명입니다")
        
        if self.user_repository.email_exists(email):
            raise ValidationError("email", "이미 등록된 이메일입니다")
        
        # 비밀번호 해시화
        password_hash = self._hash_password(password)
        
        # 사용자 생성
        user = User(
            id=str(uuid.uuid4()),
            username=username,
            email=email,
            password_hash=password_hash,
            created_at=datetime.now()
        )
        
        # 저장
        saved_user = self.user_repository.save(user)
        
        return {
            "success": True,
            "message": "사용자 등록이 완료되었습니다",
            "user": {
                "id": saved_user.id,
                "username": saved_user.username,
                "email": saved_user.email,
                "created_at": saved_user.created_at.isoformat()
            }
        }
    
    def _validate_username(self, username: str) -> None:
        """사용자명 유효성 검사"""
        if not username:
            raise ValidationError("username", "사용자명은 필수입니다")
        
        if len(username) < 3:
            raise ValidationError("username", "사용자명은 3자 이상이어야 합니다")
        
        if len(username) > 20:
            raise ValidationError("username", "사용자명은 20자 이하여야 합니다")
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            raise ValidationError("username", "사용자명은 영문, 숫자, 언더스코어만 사용 가능합니다")
    
    def _validate_email(self, email: str) -> None:
        """이메일 유효성 검사"""
        if not email:
            raise ValidationError("email", "이메일은 필수입니다")
        
        # 더 엄격한 이메일 패턴 (연속된 점이나 특수 문자 제한)
        email_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9._%-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise ValidationError("email", "올바른 이메일 형식이 아닙니다")
    
    def _validate_password(self, password: str) -> None:
        """비밀번호 유효성 검사"""
        if not password:
            raise ValidationError("password", "비밀번호는 필수입니다")
        
        if len(password) < 8:
            raise ValidationError("password", "비밀번호는 8자 이상이어야 합니다")
        
        if len(password) > 128:
            raise ValidationError("password", "비밀번호는 128자 이하여야 합니다")
        
        # 대문자, 소문자, 숫자, 특수문자 포함 확인
        if not re.search(r'[A-Z]', password):
            raise ValidationError("password", "비밀번호에 대문자를 포함해야 합니다")
        
        if not re.search(r'[a-z]', password):
            raise ValidationError("password", "비밀번호에 소문자를 포함해야 합니다")
        
        if not re.search(r'[0-9]', password):
            raise ValidationError("password", "비밀번호에 숫자를 포함해야 합니다")
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValidationError("password", "비밀번호에 특수문자를 포함해야 합니다")
    
    def _hash_password(self, password: str) -> str:
        """비밀번호 해시화"""
        salt = uuid.uuid4().hex
        return hashlib.sha256((password + salt).encode()).hexdigest() + ':' + salt