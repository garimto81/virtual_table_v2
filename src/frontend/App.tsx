import React from 'react';
import Counter from './Counter';

/**
 * 메인 App 컴포넌트 (TypeScript)
 * 다양한 설정으로 Counter 컴포넌트를 사용하는 예제
 */
const App: React.FC = () => {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '40px',
          color: '#333'
        }}>
          React Counter 컴포넌트 예제
        </h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '30px'
        }}>
          {/* 기본 카운터 */}
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>
              기본 카운터
            </h3>
            <Counter />
          </div>

          {/* 초기값이 있는 카운터 */}
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>
              초기값 10인 카운터
            </h3>
            <Counter initialValue={10} />
          </div>

          {/* 스텝이 있는 카운터 */}
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>
              5씩 증가하는 카운터
            </h3>
            <Counter step={5} />
          </div>

          {/* 최대값이 있는 카운터 */}
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>
              최대 20까지인 카운터
            </h3>
            <Counter maxCount={20} />
          </div>

          {/* 모든 옵션을 가진 카운터 */}
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            gridColumn: 'span 2'
          }}>
            <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>
              커스텀 카운터 (초기값: 5, 스텝: 3, 최대: 30)
            </h3>
            <Counter
              initialValue={5}
              step={3}
              maxCount={30}
            />
          </div>
        </div>

        {/* 사용법 안내 */}
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          marginTop: '30px'
        }}>
          <h3>사용법</h3>
          <pre style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '5px',
            overflow: 'auto'
          }}>
{`// 기본 사용법
<Counter />

// 초기값 설정
<Counter initialValue={10} />

// 증가 단위 설정
<Counter step={5} />

// 최대값 제한
<Counter maxCount={100} />

// 모든 옵션 사용
<Counter
  initialValue={0}
  step={2}
  maxCount={50}
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default App;