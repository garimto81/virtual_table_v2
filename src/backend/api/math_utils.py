"""
수학 유틸리티 함수들
간단한 산술 연산을 위한 함수 모음
"""

from typing import Union

Number = Union[int, float]


def add_numbers(a: Number, b: Number) -> Number:
    """
    두 숫자를 더하는 함수

    Args:
        a (Number): 첫 번째 숫자 (정수 또는 실수)
        b (Number): 두 번째 숫자 (정수 또는 실수)

    Returns:
        Number: 두 숫자의 합

    Examples:
        >>> add_numbers(2, 3)
        5
        >>> add_numbers(2.5, 3.7)
        6.2
        >>> add_numbers(-1, 5)
        4
    """
    return a + b


if __name__ == "__main__":
    # 기본 사용 예시
    result1 = add_numbers(10, 20)
    print(f"10 + 20 = {result1}")

    result2 = add_numbers(3.14, 2.86)
    print(f"3.14 + 2.86 = {result2}")

    result3 = add_numbers(-5, 15)
    print(f"-5 + 15 = {result3}")