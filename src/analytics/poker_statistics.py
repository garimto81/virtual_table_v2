"""
포커 핸드 로거 시스템 - Python 통계 분석 라이브러리
=======================================================
목표: 포커 데이터의 고급 통계 분석 및 인사이트 도출을 위한 Python 라이브러리
작성일: 2024-09-22
"""

import pandas as pd
import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor
from sqlalchemy import create_engine
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import warnings
from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

warnings.filterwarnings('ignore')

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class PlayerMetrics:
    """플레이어 메트릭 데이터 클래스"""
    player_id: str
    username: str
    vpip: float
    pfr: float
    aggression_factor: float
    wtsd: float
    wsd: float
    total_hands: int
    total_winnings: float
    avg_winnings_per_hand: float
    bb_per_100: float  # 100핸드당 빅블라인드 단위 수익

@dataclass
class SessionAnalysis:
    """세션 분석 결과 데이터 클래스"""
    session_id: str
    player_id: str
    duration_minutes: int
    hands_played: int
    total_winnings: float
    peak_winnings: float
    max_drawdown: float
    fatigue_score: float
    performance_trend: str

class DatabaseConnection:
    """데이터베이스 연결 및 쿼리 관리자"""
    
    def __init__(self, connection_string: str):
        """
        데이터베이스 연결 초기화
        
        Args:
            connection_string: PostgreSQL 연결 문자열
        """
        self.connection_string = connection_string
        self.engine = create_engine(connection_string)
        
    def execute_query(self, query: str, params: Optional[Dict] = None) -> pd.DataFrame:
        """
        SQL 쿼리 실행 및 DataFrame 반환
        
        Args:
            query: 실행할 SQL 쿼리
            params: 쿼리 매개변수
            
        Returns:
            쿼리 결과 DataFrame
        """
        try:
            return pd.read_sql_query(query, self.engine, params=params)
        except Exception as e:
            logger.error(f"쿼리 실행 오류: {e}")
            raise
    
    def get_player_metrics(self, player_id: Optional[str] = None, 
                          days_back: int = 30) -> pd.DataFrame:
        """
        플레이어 메트릭 데이터 조회
        
        Args:
            player_id: 특정 플레이어 ID (None이면 모든 플레이어)
            days_back: 분석할 일수
            
        Returns:
            플레이어 메트릭 DataFrame
        """
        query = """
        WITH player_stats AS (
            SELECT 
                p.player_id,
                p.username,
                COUNT(hp.hand_player_id) as total_hands,
                AVG(hp.net_winnings) as avg_winnings_per_hand,
                SUM(hp.net_winnings) as total_winnings,
                
                -- VPIP 계산
                COUNT(CASE 
                    WHEN EXISTS(
                        SELECT 1 FROM hand_actions ha 
                        WHERE ha.hand_id = hp.hand_id 
                          AND ha.player_id = hp.player_id
                          AND ha.street = 'PREFLOP'
                          AND ha.action_type IN ('BET', 'CALL', 'RAISE')
                    ) THEN 1 
                END)::DECIMAL / COUNT(*) * 100 as vpip,
                
                -- PFR 계산
                COUNT(CASE 
                    WHEN EXISTS(
                        SELECT 1 FROM hand_actions ha 
                        WHERE ha.hand_id = hp.hand_id 
                          AND ha.player_id = hp.player_id
                          AND ha.street = 'PREFLOP'
                          AND ha.action_type IN ('BET', 'RAISE')
                    ) THEN 1 
                END)::DECIMAL / COUNT(*) * 100 as pfr,
                
                -- WTSD 계산
                COUNT(CASE WHEN hp.showed_cards = true THEN 1 END)::DECIMAL / 
                NULLIF(COUNT(CASE 
                    WHEN EXISTS(
                        SELECT 1 FROM hand_actions ha 
                        WHERE ha.hand_id = hp.hand_id 
                          AND ha.player_id = hp.player_id
                          AND ha.street IN ('FLOP', 'TURN', 'RIVER')
                    ) THEN 1 
                END), 0) * 100 as wtsd,
                
                -- WSD 계산
                COUNT(CASE WHEN hp.showed_cards = true AND hp.is_winner = true THEN 1 END)::DECIMAL / 
                NULLIF(COUNT(CASE WHEN hp.showed_cards = true THEN 1 END), 0) * 100 as wsd
                
            FROM players p
            JOIN hand_players hp ON p.player_id = hp.player_id
            JOIN hands h ON hp.hand_id = h.hand_id
            WHERE h.started_at >= NOW() - INTERVAL '%s days'
            """ + (f"AND p.player_id = '{player_id}'" if player_id else "") + """
            GROUP BY p.player_id, p.username
            HAVING COUNT(hp.hand_player_id) >= 100
        )
        SELECT 
            *,
            calculate_aggression_factor(player_id) as aggression_factor
        FROM player_stats
        ORDER BY total_winnings DESC
        """
        
        return self.execute_query(query % days_back)

class PokerStatistics:
    """포커 통계 분석 메인 클래스"""
    
    def __init__(self, db_connection: DatabaseConnection):
        """
        포커 통계 분석기 초기화
        
        Args:
            db_connection: 데이터베이스 연결 객체
        """
        self.db = db_connection
        
    def calculate_correlation_matrix(self, metrics_df: pd.DataFrame) -> pd.DataFrame:
        """
        플레이어 메트릭 간 상관관계 분석
        
        Args:
            metrics_df: 플레이어 메트릭 DataFrame
            
        Returns:
            상관관계 매트릭스 DataFrame
        """
        numeric_columns = ['vpip', 'pfr', 'aggression_factor', 'wtsd', 'wsd', 
                          'total_hands', 'avg_winnings_per_hand']
        
        correlation_matrix = metrics_df[numeric_columns].corr()
        
        # 시각화
        plt.figure(figsize=(10, 8))
        sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0,
                   square=True, linewidths=0.5)
        plt.title('포커 메트릭 간 상관관계 분석')
        plt.tight_layout()
        plt.show()
        
        return correlation_matrix
    
    def perform_player_clustering(self, metrics_df: pd.DataFrame, 
                                n_clusters: int = 4) -> Dict:
        """
        플레이어 스타일 클러스터링 분석
        
        Args:
            metrics_df: 플레이어 메트릭 DataFrame
            n_clusters: 클러스터 수
            
        Returns:
            클러스터링 결과 딕셔너리
        """
        # 특성 선택 및 정규화
        features = ['vpip', 'pfr', 'aggression_factor', 'wtsd']
        X = metrics_df[features].dropna()
        
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # K-means 클러스터링
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(X_scaled)
        
        # 결과 분석
        metrics_df_clean = metrics_df.loc[X.index].copy()
        metrics_df_clean['cluster'] = clusters
        
        cluster_summary = metrics_df_clean.groupby('cluster')[features].agg([
            'mean', 'std', 'count'
        ]).round(2)
        
        # 클러스터 라벨링
        cluster_labels = self._assign_cluster_labels(cluster_summary)
        metrics_df_clean['cluster_label'] = metrics_df_clean['cluster'].map(cluster_labels)
        
        # 시각화
        self._visualize_clusters(metrics_df_clean, features)
        
        return {
            'clustered_data': metrics_df_clean,
            'cluster_summary': cluster_summary,
            'cluster_labels': cluster_labels,
            'scaler': scaler,
            'model': kmeans
        }
    
    def _assign_cluster_labels(self, cluster_summary: pd.DataFrame) -> Dict[int, str]:
        """클러스터에 의미있는 라벨 할당"""
        labels = {}
        
        for cluster_id in cluster_summary.index.get_level_values(0).unique():
            vpip = cluster_summary.loc[cluster_id, ('vpip', 'mean')]
            pfr = cluster_summary.loc[cluster_id, ('pfr', 'mean')]
            
            if vpip > 25 and pfr > 18:
                labels[cluster_id] = 'Loose Aggressive (LAG)'
            elif vpip > 25 and pfr <= 18:
                labels[cluster_id] = 'Loose Passive (Fish)'
            elif vpip <= 25 and pfr > 15:
                labels[cluster_id] = 'Tight Aggressive (TAG)'
            else:
                labels[cluster_id] = 'Tight Passive (Rock)'
                
        return labels
    
    def _visualize_clusters(self, clustered_data: pd.DataFrame, features: List[str]):
        """클러스터링 결과 시각화"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        
        # VPIP vs PFR 산점도
        sns.scatterplot(data=clustered_data, x='vpip', y='pfr', 
                       hue='cluster_label', s=100, alpha=0.7, ax=axes[0,0])
        axes[0,0].set_title('VPIP vs PFR by Player Style')
        axes[0,0].grid(True, alpha=0.3)
        
        # Aggression Factor vs WTSD
        sns.scatterplot(data=clustered_data, x='aggression_factor', y='wtsd',
                       hue='cluster_label', s=100, alpha=0.7, ax=axes[0,1])
        axes[0,1].set_title('Aggression Factor vs WTSD by Player Style')
        axes[0,1].grid(True, alpha=0.3)
        
        # 클러스터별 박스플롯
        clustered_data_melted = clustered_data.melt(
            id_vars=['cluster_label'], 
            value_vars=features,
            var_name='metric', 
            value_name='value'
        )
        
        sns.boxplot(data=clustered_data_melted, x='metric', y='value',
                   hue='cluster_label', ax=axes[1,0])
        axes[1,0].set_title('Metric Distribution by Cluster')
        axes[1,0].tick_params(axis='x', rotation=45)
        
        # 클러스터 크기
        cluster_counts = clustered_data['cluster_label'].value_counts()
        axes[1,1].pie(cluster_counts.values, labels=cluster_counts.index, autopct='%1.1f%%')
        axes[1,1].set_title('Player Distribution by Style')
        
        plt.tight_layout()
        plt.show()
    
    def detect_anomalous_sessions(self, player_id: str, 
                                contamination: float = 0.1) -> pd.DataFrame:
        """
        이상 세션 탐지 (Isolation Forest 사용)
        
        Args:
            player_id: 분석할 플레이어 ID
            contamination: 이상치 비율 (0.1 = 10%)
            
        Returns:
            이상 세션 정보 DataFrame
        """
        # 세션 데이터 조회
        session_query = """
        WITH session_data AS (
            SELECT 
                h.hand_id,
                h.started_at,
                hp.net_winnings,
                LAG(h.started_at) OVER (ORDER BY h.started_at) as prev_time,
                ROW_NUMBER() OVER (ORDER BY h.started_at) as hand_sequence
            FROM hand_players hp
            JOIN hands h ON hp.hand_id = h.hand_id
            WHERE hp.player_id = %s
              AND h.started_at >= NOW() - INTERVAL '90 days'
        ),
        session_breaks AS (
            SELECT 
                *,
                CASE 
                    WHEN prev_time IS NULL OR 
                         started_at - prev_time > INTERVAL '1 hour'
                    THEN 1 ELSE 0 
                END as session_start
            FROM session_data
        ),
        session_numbered AS (
            SELECT 
                *,
                SUM(session_start) OVER (ORDER BY hand_sequence) as session_id
            FROM session_breaks
        )
        SELECT 
            session_id,
            COUNT(*) as hands_in_session,
            SUM(net_winnings) as session_winnings,
            AVG(net_winnings) as avg_winnings_per_hand,
            MIN(started_at) as session_start,
            MAX(started_at) as session_end,
            EXTRACT(EPOCH FROM (MAX(started_at) - MIN(started_at))) / 60 as duration_minutes
        FROM session_numbered
        GROUP BY session_id
        HAVING COUNT(*) >= 20
        ORDER BY session_start
        """
        
        sessions_df = self.db.execute_query(session_query, [player_id])
        
        if sessions_df.empty:
            logger.warning(f"플레이어 {player_id}의 세션 데이터가 없습니다.")
            return pd.DataFrame()
        
        # 이상 탐지를 위한 특성 생성
        features = ['hands_in_session', 'session_winnings', 'avg_winnings_per_hand', 
                   'duration_minutes']
        
        X = sessions_df[features].fillna(0)
        
        # Isolation Forest 모델
        isolation_forest = IsolationForest(contamination=contamination, random_state=42)
        anomaly_labels = isolation_forest.fit_predict(X)
        anomaly_scores = isolation_forest.score_samples(X)
        
        sessions_df['is_anomaly'] = anomaly_labels == -1
        sessions_df['anomaly_score'] = anomaly_scores
        
        # 이상 세션만 필터링
        anomalous_sessions = sessions_df[sessions_df['is_anomaly']].copy()
        
        # 이상 유형 분류
        anomalous_sessions['anomaly_type'] = anomalous_sessions.apply(
            self._classify_anomaly_type, axis=1
        )
        
        return anomalous_sessions.sort_values('anomaly_score')
    
    def _classify_anomaly_type(self, row: pd.Series) -> str:
        """이상 세션 유형 분류"""
        if row['session_winnings'] > row['session_winnings'] * 2:
            return 'Exceptional Win'
        elif row['session_winnings'] < -abs(row['session_winnings']) * 2:
            return 'Heavy Loss'
        elif row['duration_minutes'] > 480:  # 8시간 이상
            return 'Marathon Session'
        elif row['hands_in_session'] > 1000:
            return 'High Volume'
        else:
            return 'Other'
    
    def analyze_variance_and_downswings(self, player_id: str) -> Dict:
        """
        플레이어의 분산 및 다운스윙 분석
        
        Args:
            player_id: 분석할 플레이어 ID
            
        Returns:
            분산 분석 결과 딕셔너리
        """
        # 핸드별 수익 데이터 조회
        winnings_query = """
        SELECT 
            h.started_at,
            hp.net_winnings,
            SUM(hp.net_winnings) OVER (ORDER BY h.started_at) as cumulative_winnings,
            ROW_NUMBER() OVER (ORDER BY h.started_at) as hand_number
        FROM hand_players hp
        JOIN hands h ON hp.hand_id = h.hand_id
        WHERE hp.player_id = %s
          AND h.started_at >= NOW() - INTERVAL '90 days'
        ORDER BY h.started_at
        """
        
        winnings_df = self.db.execute_query(winnings_query, [player_id])
        
        if winnings_df.empty:
            return {}
        
        # 기본 통계
        winnings = winnings_df['net_winnings']
        cumulative = winnings_df['cumulative_winnings']
        
        variance_stats = {
            'total_hands': len(winnings),
            'total_winnings': cumulative.iloc[-1],
            'winnings_per_hand': winnings.mean(),
            'standard_deviation': winnings.std(),
            'variance': winnings.var(),
            'skewness': stats.skew(winnings),
            'kurtosis': stats.kurtosis(winnings)
        }
        
        # 다운스윙 분석
        drawdowns = self._calculate_drawdowns(cumulative)
        variance_stats.update(drawdowns)
        
        # 신뢰구간 계산
        confidence_intervals = self._calculate_confidence_intervals(winnings)
        variance_stats.update(confidence_intervals)
        
        # 시각화
        self._visualize_variance_analysis(winnings_df, variance_stats)
        
        return variance_stats
    
    def _calculate_drawdowns(self, cumulative_winnings: pd.Series) -> Dict:
        """다운드로우 계산"""
        peak = cumulative_winnings.expanding().max()
        drawdown = cumulative_winnings - peak
        
        max_drawdown = drawdown.min()
        max_drawdown_duration = 0
        current_drawdown_duration = 0
        
        for dd in drawdown:
            if dd < 0:
                current_drawdown_duration += 1
                max_drawdown_duration = max(max_drawdown_duration, current_drawdown_duration)
            else:
                current_drawdown_duration = 0
        
        return {
            'max_drawdown': max_drawdown,
            'max_drawdown_duration_hands': max_drawdown_duration,
            'current_drawdown': drawdown.iloc[-1],
            'num_drawdown_periods': (drawdown < 0).sum()
        }
    
    def _calculate_confidence_intervals(self, winnings: pd.Series) -> Dict:
        """신뢰구간 계산"""
        mean = winnings.mean()
        std = winnings.std()
        n = len(winnings)
        
        # 95% 신뢰구간
        ci_95 = stats.t.interval(0.95, n-1, loc=mean, scale=std/np.sqrt(n))
        
        # 99% 신뢰구간
        ci_99 = stats.t.interval(0.99, n-1, loc=mean, scale=std/np.sqrt(n))
        
        return {
            '95_ci_lower': ci_95[0],
            '95_ci_upper': ci_95[1],
            '99_ci_lower': ci_99[0],
            '99_ci_upper': ci_99[1]
        }
    
    def _visualize_variance_analysis(self, winnings_df: pd.DataFrame, stats: Dict):
        """분산 분석 시각화"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        
        # 누적 수익 그래프
        axes[0,0].plot(winnings_df['hand_number'], winnings_df['cumulative_winnings'])
        axes[0,0].set_title('Cumulative Winnings Over Time')
        axes[0,0].set_xlabel('Hand Number')
        axes[0,0].set_ylabel('Cumulative Winnings')
        axes[0,0].grid(True, alpha=0.3)
        
        # 핸드별 수익 히스토그램
        axes[0,1].hist(winnings_df['net_winnings'], bins=50, alpha=0.7, edgecolor='black')
        axes[0,1].axvline(stats['winnings_per_hand'], color='red', linestyle='--', 
                         label=f"Mean: {stats['winnings_per_hand']:.3f}")
        axes[0,1].set_title('Distribution of Hand Winnings')
        axes[0,1].set_xlabel('Net Winnings per Hand')
        axes[0,1].set_ylabel('Frequency')
        axes[0,1].legend()
        
        # Q-Q plot (정규성 검정)
        stats.probplot(winnings_df['net_winnings'], dist="norm", plot=axes[1,0])
        axes[1,0].set_title('Q-Q Plot (Normality Test)')
        
        # 이동평균
        rolling_mean = winnings_df['net_winnings'].rolling(window=100).mean()
        axes[1,1].plot(winnings_df['hand_number'], rolling_mean)
        axes[1,1].set_title('100-Hand Moving Average')
        axes[1,1].set_xlabel('Hand Number')
        axes[1,1].set_ylabel('Moving Average Winnings')
        axes[1,1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.show()
    
    def predict_player_performance(self, metrics_df: pd.DataFrame) -> Dict:
        """
        플레이어 성과 예측 모델
        
        Args:
            metrics_df: 플레이어 메트릭 DataFrame
            
        Returns:
            예측 모델 결과 딕셔너리
        """
        # 특성 준비
        features = ['vpip', 'pfr', 'aggression_factor', 'wtsd', 'wsd', 'total_hands']
        target = 'avg_winnings_per_hand'
        
        # 결측치 제거
        clean_data = metrics_df[features + [target]].dropna()
        
        if len(clean_data) < 50:
            logger.warning("예측 모델 학습에 충분한 데이터가 없습니다.")
            return {}
        
        X = clean_data[features]
        y = (clean_data[target] > 0).astype(int)  # 수익성 여부로 이진 분류
        
        # 학습/테스트 분할
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Random Forest 모델
        rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
        rf_model.fit(X_train, y_train)
        
        # 예측 및 평가
        y_pred = rf_model.predict(X_test)
        y_pred_proba = rf_model.predict_proba(X_test)[:, 1]
        
        # 특성 중요도
        feature_importance = pd.DataFrame({
            'feature': features,
            'importance': rf_model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        # 결과 시각화
        self._visualize_prediction_results(
            y_test, y_pred, y_pred_proba, feature_importance
        )
        
        return {
            'model': rf_model,
            'feature_importance': feature_importance,
            'classification_report': classification_report(y_test, y_pred),
            'confusion_matrix': confusion_matrix(y_test, y_pred),
            'test_accuracy': rf_model.score(X_test, y_test)
        }
    
    def _visualize_prediction_results(self, y_test: np.array, y_pred: np.array, 
                                    y_pred_proba: np.array, 
                                    feature_importance: pd.DataFrame):
        """예측 결과 시각화"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        
        # 혼동 행렬
        cm = confusion_matrix(y_test, y_pred)
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[0,0])
        axes[0,0].set_title('Confusion Matrix')
        axes[0,0].set_xlabel('Predicted')
        axes[0,0].set_ylabel('Actual')
        
        # 특성 중요도
        axes[0,1].barh(feature_importance['feature'], feature_importance['importance'])
        axes[0,1].set_title('Feature Importance')
        axes[0,1].set_xlabel('Importance')
        
        # ROC 곡선 (간단 버전)
        from sklearn.metrics import roc_curve, auc
        fpr, tpr, _ = roc_curve(y_test, y_pred_proba)
        roc_auc = auc(fpr, tpr)
        
        axes[1,0].plot(fpr, tpr, label=f'ROC curve (AUC = {roc_auc:.2f})')
        axes[1,0].plot([0, 1], [0, 1], 'k--')
        axes[1,0].set_title('ROC Curve')
        axes[1,0].set_xlabel('False Positive Rate')
        axes[1,0].set_ylabel('True Positive Rate')
        axes[1,0].legend()
        
        # 예측 확률 분포
        axes[1,1].hist(y_pred_proba[y_test == 0], alpha=0.5, label='Losing Players', bins=20)
        axes[1,1].hist(y_pred_proba[y_test == 1], alpha=0.5, label='Winning Players', bins=20)
        axes[1,1].set_title('Prediction Probability Distribution')
        axes[1,1].set_xlabel('Predicted Probability')
        axes[1,1].set_ylabel('Frequency')
        axes[1,1].legend()
        
        plt.tight_layout()
        plt.show()
    
    def generate_comprehensive_report(self, player_id: str) -> Dict:
        """
        플레이어 종합 분석 리포트 생성
        
        Args:
            player_id: 분석할 플레이어 ID
            
        Returns:
            종합 분석 결과 딕셔너리
        """
        logger.info(f"플레이어 {player_id} 종합 분석 시작...")
        
        report = {
            'player_id': player_id,
            'analysis_date': datetime.now().isoformat(),
            'metrics': {},
            'variance_analysis': {},
            'anomalous_sessions': pd.DataFrame(),
            'recommendations': []
        }
        
        try:
            # 기본 메트릭
            metrics_df = self.db.get_player_metrics(player_id)
            if not metrics_df.empty:
                report['metrics'] = metrics_df.iloc[0].to_dict()
            
            # 분산 분석
            report['variance_analysis'] = self.analyze_variance_and_downswings(player_id)
            
            # 이상 세션 탐지
            report['anomalous_sessions'] = self.detect_anomalous_sessions(player_id)
            
            # 권장사항 생성
            report['recommendations'] = self._generate_recommendations(report)
            
            logger.info("종합 분석 완료")
            
        except Exception as e:
            logger.error(f"분석 중 오류 발생: {e}")
            
        return report
    
    def _generate_recommendations(self, report: Dict) -> List[str]:
        """분석 결과 기반 권장사항 생성"""
        recommendations = []
        metrics = report.get('metrics', {})
        variance = report.get('variance_analysis', {})
        
        # VPIP 권장사항
        vpip = metrics.get('vpip', 0)
        if vpip > 30:
            recommendations.append("VPIP가 높습니다. 더 타이트한 스타팅 핸드 선택을 고려하세요.")
        elif vpip < 15:
            recommendations.append("VPIP가 낮습니다. 조금 더 많은 핸드를 플레이해보세요.")
        
        # PFR 권장사항
        pfr = metrics.get('pfr', 0)
        if pfr < vpip * 0.6:
            recommendations.append("PFR이 VPIP 대비 낮습니다. 더 어그레시브한 플레이를 고려하세요.")
        
        # 분산 권장사항
        max_drawdown = variance.get('max_drawdown', 0)
        if max_drawdown < -50:
            recommendations.append("큰 다운스윙이 감지되었습니다. 뱅크롤 관리에 주의하세요.")
        
        # 이상 세션 권장사항
        anomalous_sessions = report.get('anomalous_sessions', pd.DataFrame())
        if not anomalous_sessions.empty:
            marathon_sessions = anomalous_sessions[
                anomalous_sessions['anomaly_type'] == 'Marathon Session'
            ]
            if len(marathon_sessions) > 0:
                recommendations.append("긴 세션이 감지되었습니다. 피로도 관리를 위해 적절한 휴식을 취하세요.")
        
        return recommendations


# 사용 예제
if __name__ == "__main__":
    # 데이터베이스 연결
    connection_string = "postgresql://username:password@localhost:5432/poker_db"
    db = DatabaseConnection(connection_string)
    
    # 통계 분석기 초기화
    analyzer = PokerStatistics(db)
    
    # 모든 플레이어 메트릭 조회
    metrics_df = db.get_player_metrics(days_back=30)
    print(f"분석 대상 플레이어: {len(metrics_df)}명")
    
    # 상관관계 분석
    correlation_matrix = analyzer.calculate_correlation_matrix(metrics_df)
    print("\n상관관계 분석 완료")
    
    # 클러스터링 분석
    clustering_results = analyzer.perform_player_clustering(metrics_df)
    print(f"\n클러스터링 완료: {len(clustering_results['cluster_labels'])}개 클러스터")
    
    # 특정 플레이어 종합 분석
    if not metrics_df.empty:
        sample_player_id = metrics_df.iloc[0]['player_id']
        comprehensive_report = analyzer.generate_comprehensive_report(sample_player_id)
        print(f"\n플레이어 {sample_player_id} 종합 분석 완료")
        print("권장사항:")
        for rec in comprehensive_report['recommendations']:
            print(f"- {rec}")