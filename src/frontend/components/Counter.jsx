import React, { useState } from 'react';

/**
 * 클릭할 때마다 카운터가 증가하는 간단한 React 컴포넌트
 * Counter - 사용자가 버튼을 클릭하면 숫자가 1씩 증가하는 기능을 제공
 */
const Counter = () => {
  // useState 훅을 사용하여 카운터 상태 관리
  const [count, setCount] = useState(0);

  // 카운터 증가 함수
  const incrementCounter = () => {
    setCount(prevCount => prevCount + 1);
  };

  // 카운터 리셋 함수 (추가 기능)
  const resetCounter = () => {
    setCount(0);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2>카운터 앱</h2>

      {/* 현재 카운트 표시 */}
      <div style={{
        fontSize: '2rem',
        margin: '20px 0',
        padding: '10px 20px',
        border: '2px solid #007bff',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        카운트: {count}
      </div>

      {/* 버튼들 */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={incrementCounter}
          style={{
            padding: '10px 20px',
            fontSize: '1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
        >
          클릭해서 증가 (+1)
        </button>

        <button
          onClick={resetCounter}
          style={{
            padding: '10px 20px',
            fontSize: '1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#545b62'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
        >
          리셋 (0으로)
        </button>
      </div>

      {/* 카운트에 따른 메시지 */}
      {count > 0 && (
        <p style={{
          marginTop: '15px',
          color: count >= 10 ? '#28a745' : '#6c757d'
        }}>
          {count >= 10 ? '🎉 10번 이상 클릭했습니다!' : `${count}번 클릭했습니다.`}
        </p>
      )}
    </div>
  );
};

export default Counter;