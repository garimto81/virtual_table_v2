import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from './auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// 임시 메모리 저장소 (실제로는 데이터베이스 사용)
const hands = new Map();
const handsByUser = new Map();

// 새 핸드 생성
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const {
      dealerButton,
      cameraPosition,
      initialChips,
      tableName,
      playerCount
    } = req.body;

    const hand = {
      id: uuidv4(),
      userId: req.user.userId,
      timestamp: new Date().toISOString(),
      dealerButton,
      cameraPosition,
      initialChips,
      tableName,
      playerCount,
      actions: [],
      finalChips: null,
      result: null,
      duration: null,
      status: 'active'
    };

    // 저장
    hands.set(hand.id, hand);

    // 사용자별 핸드 목록 업데이트
    if (!handsByUser.has(req.user.userId)) {
      handsByUser.set(req.user.userId, []);
    }
    handsByUser.get(req.user.userId).push(hand.id);

    logger.info(`New hand created: ${hand.id}`);

    res.status(201).json({
      success: true,
      data: hand
    });
  } catch (error) {
    next(error);
  }
});

// 핸드 조회
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const hand = hands.get(id);

    if (!hand) {
      return res.status(404).json({
        success: false,
        error: 'Hand not found'
      });
    }

    // 권한 확인
    if (hand.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: hand
    });
  } catch (error) {
    next(error);
  }
});

// 사용자의 모든 핸드 조회
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;
    const userHandIds = handsByUser.get(req.user.userId) || [];

    let userHands = userHandIds
      .map(id => hands.get(id))
      .filter(hand => hand);

    // 필터링
    if (status) {
      userHands = userHands.filter(hand => hand.status === status);
    }

    if (startDate) {
      userHands = userHands.filter(
        hand => new Date(hand.timestamp) >= new Date(startDate)
      );
    }

    if (endDate) {
      userHands = userHands.filter(
        hand => new Date(hand.timestamp) <= new Date(endDate)
      );
    }

    // 정렬 (최신순)
    userHands.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    // 페이지네이션
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedHands = userHands.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        hands: paginatedHands,
        pagination: {
          total: userHands.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(userHands.length / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// 핸드에 액션 추가
router.post('/:id/actions', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, amount, position, description } = req.body;

    const hand = hands.get(id);

    if (!hand) {
      return res.status(404).json({
        success: false,
        error: 'Hand not found'
      });
    }

    if (hand.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (hand.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Hand is not active'
      });
    }

    const action = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type,
      amount,
      position,
      description
    };

    hand.actions.push(action);
    hands.set(id, hand);

    logger.info(`Action added to hand ${id}: ${type}`);

    res.json({
      success: true,
      data: action
    });
  } catch (error) {
    next(error);
  }
});

// 핸드 완료
router.put('/:id/complete', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { finalChips, result, notes } = req.body;

    const hand = hands.get(id);

    if (!hand) {
      return res.status(404).json({
        success: false,
        error: 'Hand not found'
      });
    }

    if (hand.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (hand.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Hand is already completed'
      });
    }

    // 핸드 완료 처리
    const endTime = new Date();
    const startTime = new Date(hand.timestamp);
    const duration = Math.floor((endTime - startTime) / 1000); // 초 단위

    hand.status = 'completed';
    hand.finalChips = finalChips;
    hand.result = result;
    hand.notes = notes;
    hand.duration = duration;
    hand.completedAt = endTime.toISOString();

    hands.set(id, hand);

    logger.info(`Hand completed: ${id}, Result: ${result}`);

    res.json({
      success: true,
      data: hand
    });
  } catch (error) {
    next(error);
  }
});

// 핸드 삭제
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const hand = hands.get(id);

    if (!hand) {
      return res.status(404).json({
        success: false,
        error: 'Hand not found'
      });
    }

    if (hand.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // 삭제
    hands.delete(id);

    // 사용자 핸드 목록에서 제거
    const userHands = handsByUser.get(req.user.userId) || [];
    const index = userHands.indexOf(id);
    if (index > -1) {
      userHands.splice(index, 1);
      handsByUser.set(req.user.userId, userHands);
    }

    logger.info(`Hand deleted: ${id}`);

    res.json({
      success: true,
      message: 'Hand deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// 통계 조회
router.get('/stats/summary', authenticateToken, async (req, res, next) => {
  try {
    const userHandIds = handsByUser.get(req.user.userId) || [];
    const userHands = userHandIds
      .map(id => hands.get(id))
      .filter(hand => hand && hand.status === 'completed');

    const stats = {
      totalHands: userHands.length,
      totalWins: userHands.filter(h => h.result === 'win').length,
      totalLosses: userHands.filter(h => h.result === 'loss').length,
      winRate: 0,
      averageDuration: 0,
      totalProfit: 0
    };

    if (stats.totalHands > 0) {
      stats.winRate = (stats.totalWins / stats.totalHands * 100).toFixed(2);

      const totalDuration = userHands.reduce((sum, h) => sum + (h.duration || 0), 0);
      stats.averageDuration = Math.floor(totalDuration / stats.totalHands);

      stats.totalProfit = userHands.reduce((sum, h) => {
        const initial = h.initialChips || 0;
        const final = h.finalChips || 0;
        return sum + (final - initial);
      }, 0);
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;