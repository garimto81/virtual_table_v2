import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';
import errorHandler from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import sheetsRouter from './routes/sheets.js';
import spreadsheetRouter from './routes/spreadsheet.js';
import handsRouter from './routes/hands.js';

// ES 모듈에서 __dirname 사용
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드 (.env 파일은 virtual_table_v2 디렉토리에 있음)
const envPath = path.join(__dirname, '../.env');
console.log('🔍 dotenv 경로:', envPath);
console.log('🔍 .env 파일 존재 여부:', fs.existsSync(envPath));

const dotenvResult = dotenv.config({ path: envPath });
console.log('🔍 dotenv 로딩 결과:', dotenvResult);

// 환경변수 직접 확인
console.log('🔍 로딩 후 환경변수:');
console.log('- PORT:', process.env.PORT);
console.log('- SPREADSHEET_ID:', process.env.SPREADSHEET_ID);
console.log('- APPS_SCRIPT_URL:', process.env.APPS_SCRIPT_URL?.substring(0, 50) + '...');

const app = express();
const PORT = process.env.PORT || 3000;

// 보안 미들웨어 (환경별 CSP 분기)
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: isDevelopment
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]  // 개발환경: 인라인 허용
        : ["'self'"],                                     // 프로덕션: 인라인 차단
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://sheets.googleapis.com", "https://script.google.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS 설정 (현재 포트 기반)
const currentPort = process.env.PORT || 3000;
app.use(cors({
  origin: process.env.CORS_ORIGIN || `http://localhost:${currentPort}`,
  credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// 미들웨어
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../public')));

// 요청 로깅
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API 라우트
app.use('/api/auth', authRouter);
app.use('/api/sheets', sheetsRouter);
app.use('/api/spreadsheet', spreadsheetRouter);
app.use('/api/hands', handsRouter);

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// SPA를 위한 폴백
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 에러 핸들링
app.use(errorHandler);

// 서버 시작
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔒 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});