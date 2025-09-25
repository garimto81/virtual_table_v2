/**
 * HandLogger - 브라우저용 핸드 로깅 모듈
 */

export class HandLogger {
    constructor(dataService, config = {}) {
        this.dataService = dataService;
        this.currentHand = null;
        this.handHistory = [];
        this.maxHistorySize = config.maxHistorySize || 100;
        this.autoSave = config.autoSave !== false;
        this.autoSaveInterval = config.autoSaveInterval || 30000;
        this.offlineMode = false;
        this.offlineQueue = [];
        this.listeners = new Map();

        if (this.autoSave) {
            this.startAutoSave();
        }
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    startNewHand(params = {}) {
        if (this.currentHand && this.autoSave) {
            this.saveHand().catch(console.error);
        }

        const {
            dealerButton = 1,
            cameraPosition = 1,
            initialChips = 0,
            tableName = 'Table 1',
            playerCount = 9,
            blinds = { small: 1, big: 2 },
            ante = 0
        } = params;

        this.currentHand = {
            id: this.generateUUID(),
            timestamp: new Date().toISOString(),
            dealerButton,
            cameraPosition,
            initialChips,
            tableName,
            playerCount,
            blinds,
            ante,
            actions: [],
            cards: {
                hole: [],
                flop: [],
                turn: null,
                river: null
            },
            pot: 0,
            rake: 0,
            result: null,
            finalChips: null,
            duration: null,
            status: 'active',
            notes: ''
        };

        this.emit('handStarted', this.currentHand);
        return this.currentHand.id;
    }

    addAction(action) {
        if (!this.currentHand) {
            throw new Error('No active hand. Start a new hand first.');
        }

        if (this.currentHand.status !== 'active') {
            throw new Error('Cannot add action to completed hand.');
        }

        const actionData = {
            id: this.generateUUID(),
            timestamp: new Date().toISOString(),
            street: this.getCurrentStreet(),
            position: action.position || this.currentHand.cameraPosition,
            type: action.type,
            amount: action.amount || 0,
            potBefore: this.currentHand.pot,
            description: action.description || ''
        };

        if (['CALL', 'BET', 'RAISE', 'ALL_IN'].includes(action.type)) {
            this.currentHand.pot += actionData.amount;
            actionData.potAfter = this.currentHand.pot;
        }

        this.currentHand.actions.push(actionData);
        this.emit('actionAdded', actionData);
        return actionData.id;
    }

    getCurrentStreet() {
        if (!this.currentHand) return 'preflop';

        const { flop, turn, river } = this.currentHand.cards;

        if (river) return 'river';
        if (turn) return 'turn';
        if (flop && flop.length === 3) return 'flop';
        return 'preflop';
    }

    completeHand(result = {}) {
        if (!this.currentHand) {
            throw new Error('No active hand to complete');
        }

        const endTime = new Date();
        const startTime = new Date(this.currentHand.timestamp);
        const duration = Math.floor((endTime - startTime) / 1000);

        this.currentHand.status = 'completed';
        this.currentHand.completedAt = endTime.toISOString();
        this.currentHand.duration = duration;
        this.currentHand.result = result.result || 'unknown';
        this.currentHand.finalChips = result.finalChips || this.currentHand.initialChips;
        this.currentHand.profit = this.currentHand.finalChips - this.currentHand.initialChips;
        this.currentHand.rake = result.rake || 0;
        this.currentHand.notes = result.notes || '';

        this.addToHistory(this.currentHand);
        this.emit('handCompleted', this.currentHand);

        if (this.autoSave) {
            this.saveHand().catch(console.error);
        }

        return this.currentHand;
    }

    async saveHand() {
        if (!this.currentHand) {
            throw new Error('No hand to save');
        }

        try {
            if (!this.offlineMode && this.dataService) {
                const result = await this.dataService.saveHand(this.currentHand);
                this.emit('handSaved', result);
                return result;
            }
        } catch (error) {
            console.error('Failed to save hand online:', error);
            this.offlineMode = true;
        }

        this.saveOffline(this.currentHand);
        return { offline: true, id: this.currentHand.id };
    }

    saveOffline(hand) {
        this.offlineQueue.push(hand);

        const existing = JSON.parse(localStorage.getItem('offlineHands') || '[]');
        existing.push(hand);
        localStorage.setItem('offlineHands', JSON.stringify(existing));

        this.emit('handSavedOffline', hand);
    }

    async syncOfflineData() {
        if (this.offlineQueue.length === 0) {
            return { synced: 0, failed: 0 };
        }

        let synced = 0;
        let failed = 0;

        for (const hand of this.offlineQueue) {
            try {
                await this.dataService.saveHand(hand);
                synced++;
            } catch (error) {
                console.error(`Failed to sync hand ${hand.id}:`, error);
                failed++;
            }
        }

        if (synced > 0) {
            this.offlineQueue = this.offlineQueue.slice(synced);
            localStorage.setItem('offlineHands', JSON.stringify(this.offlineQueue));
        }

        if (this.offlineQueue.length === 0) {
            this.offlineMode = false;
        }

        this.emit('syncCompleted', { synced, failed });
        return { synced, failed };
    }

    addToHistory(hand) {
        this.handHistory.unshift(hand);

        if (this.handHistory.length > this.maxHistorySize) {
            this.handHistory = this.handHistory.slice(0, this.maxHistorySize);
        }
    }

    getHistory(filters = {}) {
        let history = [...this.handHistory];

        if (filters.startDate) {
            history = history.filter(h =>
                new Date(h.timestamp) >= new Date(filters.startDate)
            );
        }

        if (filters.endDate) {
            history = history.filter(h =>
                new Date(h.timestamp) <= new Date(filters.endDate)
            );
        }

        if (filters.result) {
            history = history.filter(h => h.result === filters.result);
        }

        if (filters.tableName) {
            history = history.filter(h => h.tableName === filters.tableName);
        }

        if (filters.sortBy === 'profit') {
            history.sort((a, b) => (b.profit || 0) - (a.profit || 0));
        } else if (filters.sortBy === 'duration') {
            history.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        }

        if (filters.limit) {
            history = history.slice(0, filters.limit);
        }

        return history;
    }

    getStatistics() {
        const completedHands = this.handHistory.filter(h => h.status === 'completed');

        if (completedHands.length === 0) {
            return {
                totalHands: 0,
                winRate: 0,
                averageProfit: 0,
                totalProfit: 0,
                averageDuration: 0,
                vpip: 0,
                pfr: 0
            };
        }

        const wins = completedHands.filter(h => h.result === 'win').length;
        const totalProfit = completedHands.reduce((sum, h) => sum + (h.profit || 0), 0);
        const totalDuration = completedHands.reduce((sum, h) => sum + (h.duration || 0), 0);

        const handsWithVoluntaryAction = completedHands.filter(h => {
            const preflopActions = h.actions.filter(a => a.street === 'preflop');
            return preflopActions.some(a => ['CALL', 'BET', 'RAISE'].includes(a.type));
        }).length;

        const handsWithPreflopRaise = completedHands.filter(h => {
            const preflopActions = h.actions.filter(a => a.street === 'preflop');
            return preflopActions.some(a => ['BET', 'RAISE'].includes(a.type));
        }).length;

        return {
            totalHands: completedHands.length,
            winRate: ((wins / completedHands.length) * 100).toFixed(2),
            averageProfit: Math.round(totalProfit / completedHands.length),
            totalProfit,
            averageDuration: Math.round(totalDuration / completedHands.length),
            vpip: ((handsWithVoluntaryAction / completedHands.length) * 100).toFixed(2),
            pfr: ((handsWithPreflopRaise / completedHands.length) * 100).toFixed(2),
            biggestWin: Math.max(...completedHands.map(h => h.profit || 0)),
            biggestLoss: Math.min(...completedHands.map(h => h.profit || 0))
        };
    }

    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.currentHand && this.currentHand.status === 'active') {
                const lastAction = this.currentHand.actions[this.currentHand.actions.length - 1];
                const lastActivityTime = lastAction ?
                    new Date(lastAction.timestamp) :
                    new Date(this.currentHand.timestamp);

                const inactiveTime = Date.now() - lastActivityTime.getTime();
                if (inactiveTime > 300000) {
                    this.completeHand({ result: 'timeout' });
                }
            }

            if (this.offlineQueue.length > 0) {
                this.syncOfflineData().catch(console.error);
            }
        }, this.autoSaveInterval);
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    destroy() {
        this.stopAutoSave();
        this.listeners.clear();
        this.currentHand = null;
        this.handHistory = [];
        this.offlineQueue = [];
    }
}

export default HandLogger;