import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

const router = express.Router();

// 임시 사용자 저장소 (실제로는 데이터베이스 사용)
const users = new Map();

// 임시 계정 초기화 (서버 시작 시 자동 생성)
const initTempAccounts = async () => {
  // 테스트용 임시 계정 1
  const tempUser1 = {
    id: 'temp-user-001',
    email: 'test@poker.com',
    name: '테스트 사용자',
    password: await bcrypt.hash('test123', 10),
    createdAt: new Date().toISOString()
  };
  users.set('test@poker.com', tempUser1);

  // 테스트용 임시 계정 2
  const tempUser2 = {
    id: 'temp-user-002',
    email: 'admin@poker.com',
    name: '관리자',
    password: await bcrypt.hash('admin123', 10),
    createdAt: new Date().toISOString()
  };
  users.set('admin@poker.com', tempUser2);

  // 데모용 임시 계정
  const demoUser = {
    id: 'demo-user-001',
    email: 'demo@poker.com',
    name: '데모 사용자',
    password: await bcrypt.hash('demo123', 10),
    createdAt: new Date().toISOString()
  };
  users.set('demo@poker.com', demoUser);

  logger.info('✅ 임시 계정 생성 완료:');
  logger.info('   - test@poker.com / test123');
  logger.info('   - admin@poker.com / admin123');
  logger.info('   - demo@poker.com / demo123');
};

// 서버 시작 시 임시 계정 초기화
initTempAccounts();

// JWT 토큰 생성
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// 회원가입
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // 입력 검증
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // 이메일 중복 검사
    if (users.has(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const user = {
      id: Date.now().toString(),
      email,
      name,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.set(email, user);

    // 토큰 생성
    const tokens = generateTokens(user.id);

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        ...tokens
      }
    });
  } catch (error) {
    next(error);
  }
});

// 로그인
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 입력 검증
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // 사용자 찾기
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // 토큰 생성
    const tokens = generateTokens(user.id);

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        ...tokens
      }
    });
  } catch (error) {
    next(error);
  }
});

// 토큰 갱신
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // 토큰 검증
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'default-refresh-secret'
    );

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    // 새 토큰 생성
    const tokens = generateTokens(decoded.userId);

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Refresh token expired'
      });
    }
    next(error);
  }
});

// 토큰 검증 미들웨어
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || 'default-secret',
    (err, user) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
      req.user = user;
      next();
    }
  );
};

export default router;