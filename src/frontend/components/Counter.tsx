import React, { useState } from 'react';

// Counter 컴포넌트의 Props 타입 정의
interface CounterProps {
  initialValue?: number;
  step?: number;
  maxCount?: number;
}

/**
 * 클릭할 때마다 카운터가 증가하는 TypeScript React 컴포넌트
 * @param initialValue - 카운터 초기값 (기본값: 0)
 * @param step - 증가 단위 (기본값: 1)
 * @param maxCount - 최대 카운트 제한 (선택사항)
 */
const Counter: React.FC<CounterProps> = ({
  initialValue = 0,
  step = 1,
  maxCount
}) => {
  const [count, setCount] = useState<number>(initialValue);

  // 카운터 증가 함수
  const incrementCounter = (): void => {
    setCount(prevCount => {
      const newCount = prevCount + step;
      // 최대값 제한이 있으면 적용
      return maxCount ? Math.min(newCount, maxCount) : newCount;
    });
  };

  // 카운터 감소 함수
  const decrementCounter = (): void => {
    setCount(prevCount => Math.max(prevCount - step, 0));
  };

  // 카운터 리셋 함수
  const resetCounter = (): void => {
    setCount(initialValue);
  };

  // 최대값에 도달했는지 확인
  const isMaxReached = maxCount ? count >= maxCount : false;
  const isMinReached = count <= 0;

  return (
    <div className="counter-container">
      <h2>카운터 앱 (TypeScript)</h2>

      {/* 현재 카운트 표시 */}
      <div className="count-display">
        카운트: <span className="count-number">{count}</span>
        {maxCount && <span className="max-indicator"> / {maxCount}</span>}
      </div>

      {/* 진행률 바 (최대값이 설정된 경우) */}
      {maxCount && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(count / maxCount) * 100}%` }}
          />
        </div>
      )}

      {/* 버튼들 */}
      <div className="button-group">
        <button
          onClick={decrementCounter}
          disabled={isMinReached}
          className={`btn btn-secondary ${isMinReached ? 'disabled' : ''}`}
        >
          감소 (-{step})
        </button>

        <button
          onClick={incrementCounter}
          disabled={isMaxReached}
          className={`btn btn-primary ${isMaxReached ? 'disabled' : ''}`}
        >
          증가 (+{step})
        </button>

        <button
          onClick={resetCounter}
          className="btn btn-reset"
        >
          리셋
        </button>
      </div>

      {/* 상태 메시지 */}
      <div className="status-message">
        {isMaxReached && (
          <p className="message success">🎯 최대값에 도달했습니다!</p>
        )}
        {count > 0 && !isMaxReached && (
          <p className="message info">
            {count >= (maxCount ? maxCount * 0.8 : 50)
              ? '🔥 거의 다 왔습니다!'
              : `현재 ${count}회 클릭했습니다.`}
          </p>
        )}
      </div>

      {/* 인라인 스타일 */}
      <style jsx>{`
        .counter-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 400px;
          margin: 0 auto;
        }

        .count-display {
          font-size: 2rem;
          margin: 20px 0;
          padding: 15px 25px;
          border: 2px solid #007bff;
          border-radius: 12px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .count-number {
          font-weight: bold;
          color: #007bff;
        }

        .max-indicator {
          color: #6c757d;
          font-size: 1.2rem;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background-color: #e9ecef;
          border-radius: 4px;
          margin: 10px 0;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff 0%, #28a745 100%);
          transition: width 0.3s ease;
          border-radius: 4px;
        }

        .button-group {
          display: flex;
          gap: 10px;
          margin: 20px 0;
          flex-wrap: wrap;
          justify-content: center;
        }

        .btn {
          padding: 12px 20px;
          font-size: 1rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 500;
          min-width: 100px;
        }

        .btn-primary {
          background-color: #007bff;
          color: white;
        }

        .btn-primary:hover:not(.disabled) {
          background-color: #0056b3;
          transform: translateY(-1px);
        }

        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(.disabled) {
          background-color: #545b62;
          transform: translateY(-1px);
        }

        .btn-reset {
          background-color: #dc3545;
          color: white;
        }

        .btn-reset:hover {
          background-color: #c82333;
          transform: translateY(-1px);
        }

        .btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .status-message {
          margin-top: 15px;
          min-height: 20px;
        }

        .message {
          margin: 0;
          padding: 8px 12px;
          border-radius: 4px;
          font-weight: 500;
        }

        .message.success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.info {
          background-color: #d1ecf1;
          color: #0c5460;
          border: 1px solid #bee5eb;
        }
      `}</style>
    </div>
  );
};

export default Counter;