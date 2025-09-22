"""
math_utils.py 모듈의 테스트 코드
단위 테스트와 다양한 시나리오 검증
"""

import unittest
from math_utils import add_numbers


class TestAddNumbers(unittest.TestCase):
    """add_numbers 함수에 대한 테스트 클래스"""

    def test_positive_integers(self):
        """양의 정수 덧셈 테스트"""
        self.assertEqual(add_numbers(2, 3), 5)
        self.assertEqual(add_numbers(10, 20), 30)
        self.assertEqual(add_numbers(1, 1), 2)

    def test_negative_integers(self):
        """음의 정수 덧셈 테스트"""
        self.assertEqual(add_numbers(-2, -3), -5)
        self.assertEqual(add_numbers(-10, 5), -5)
        self.assertEqual(add_numbers(10, -5), 5)

    def test_floating_point_numbers(self):
        """실수 덧셈 테스트"""
        self.assertAlmostEqual(add_numbers(2.5, 3.7), 6.2, places=1)
        self.assertAlmostEqual(add_numbers(0.1, 0.2), 0.3, places=1)
        self.assertAlmostEqual(add_numbers(-1.5, 2.5), 1.0, places=1)

    def test_zero_values(self):
        """0을 포함한 덧셈 테스트"""
        self.assertEqual(add_numbers(0, 0), 0)
        self.assertEqual(add_numbers(5, 0), 5)
        self.assertEqual(add_numbers(0, -3), -3)

    def test_mixed_integer_float(self):
        """정수와 실수 혼합 덧셈 테스트"""
        self.assertEqual(add_numbers(5, 2.5), 7.5)
        self.assertAlmostEqual(add_numbers(3.14, 2), 5.14, places=2)
        self.assertEqual(add_numbers(-1, 1.5), 0.5)

    def test_large_numbers(self):
        """큰 숫자 덧셈 테스트"""
        self.assertEqual(add_numbers(1000000, 2000000), 3000000)
        self.assertEqual(add_numbers(999999999, 1), 1000000000)

    def test_edge_cases(self):
        """경계값 테스트"""
        # 매우 작은 수
        result = add_numbers(0.000001, 0.000002)
        self.assertAlmostEqual(result, 0.000003, places=6)

        # 음수와 양수의 조합으로 0이 되는 경우
        self.assertEqual(add_numbers(5, -5), 0)


def run_manual_tests():
    """수동 테스트 함수 - 다양한 시나리오 검증"""
    print("=== 수동 테스트 실행 ===")

    test_cases = [
        (1, 2, 3),
        (5.5, 4.5, 10.0),
        (-3, 7, 4),
        (0, 0, 0),
        (100, -50, 50),
        (3.14159, 2.71828, 5.85987)
    ]

    print("테스트 케이스 검증:")
    all_passed = True

    for a, b, expected in test_cases:
        result = add_numbers(a, b)
        passed = abs(result - expected) < 0.00001  # 부동소수점 오차 고려
        status = "PASS" if passed else "FAIL"
        print(f"{a} + {b} = {result} (예상: {expected}) {status}")

        if not passed:
            all_passed = False

    print(f"\n전체 테스트 결과: {'모든 테스트 통과' if all_passed else '일부 테스트 실패'}")


if __name__ == "__main__":
    print("unittest 실행:")
    unittest.main(argv=[''], exit=False, verbosity=2)

    print("\n" + "="*50)
    run_manual_tests()