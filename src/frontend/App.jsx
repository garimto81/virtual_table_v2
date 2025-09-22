import React from 'react';
import Counter from './Counter';

/**
 * 메인 App 컴포넌트
 * Counter 컴포넌트를 렌더링하는 예제
 */
function App() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <Counter />
      </div>
    </div>
  );
}

export default App;