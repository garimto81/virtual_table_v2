/**
 * ChipCalculator - 브라우저용 칩 계산 모듈
 */

export class ChipCalculator {
    constructor(config = {}) {
        this.denominations = config.denominations || [1, 5, 25, 100, 500, 1000, 5000, 25000];
        this.currency = config.currency || 'chips';
        this.precision = config.precision || 0;
    }

    calculateTotal(chips) {
        if (!chips || typeof chips !== 'object') {
            return 0;
        }

        return Object.entries(chips).reduce((total, [denomination, count]) => {
            const denomValue = parseInt(denomination, 10);
            const chipCount = parseInt(count, 10) || 0;

            if (isNaN(denomValue) || isNaN(chipCount)) {
                console.warn(`Invalid chip entry: ${denomination}:${count}`);
                return total;
            }

            return total + (denomValue * chipCount);
        }, 0);
    }

    optimizeChips(amount) {
        if (amount <= 0) {
            return {};
        }

        const result = {};
        let remaining = Math.round(amount);

        for (let i = this.denominations.length - 1; i >= 0; i--) {
            const denom = this.denominations[i];
            if (remaining >= denom) {
                const count = Math.floor(remaining / denom);
                result[denom] = count;
                remaining = remaining % denom;
            }
        }

        if (remaining > 0 && remaining < this.denominations[0]) {
            const smallestDenom = this.denominations[0];
            if (result[smallestDenom]) {
                result[smallestDenom]++;
            } else {
                result[smallestDenom] = 1;
            }
        }

        return result;
    }

    addChips(chips1, chips2) {
        const result = { ...chips1 };

        Object.entries(chips2).forEach(([denom, count]) => {
            const denomValue = parseInt(denom, 10);
            if (result[denomValue]) {
                result[denomValue] += count;
            } else {
                result[denomValue] = count;
            }
        });

        return result;
    }

    subtractChips(chips1, chips2) {
        const result = { ...chips1 };

        Object.entries(chips2).forEach(([denom, count]) => {
            const denomValue = parseInt(denom, 10);
            if (result[denomValue]) {
                result[denomValue] -= count;
                if (result[denomValue] <= 0) {
                    delete result[denomValue];
                }
            }
        });

        return result;
    }

    formatChips(chips) {
        if (!chips || Object.keys(chips).length === 0) {
            return '0 chips';
        }

        const sorted = Object.entries(chips)
            .filter(([_, count]) => count > 0)
            .sort(([a], [b]) => parseInt(b, 10) - parseInt(a, 10));

        const formatted = sorted.map(([denom, count]) => {
            return `${count}×${this.formatDenomination(parseInt(denom, 10))}`;
        }).join(' + ');

        const total = this.calculateTotal(chips);
        return `${formatted} = ${this.formatAmount(total)}`;
    }

    formatDenomination(denomination) {
        if (denomination >= 1000000) {
            return `${denomination / 1000000}M`;
        } else if (denomination >= 1000) {
            return `${denomination / 1000}K`;
        }
        return denomination.toString();
    }

    formatAmount(amount) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: this.precision,
            maximumFractionDigits: this.precision
        }).format(amount);
    }

    exchangeChips(chips, targetDenom) {
        const total = this.calculateTotal(chips);
        const targetCount = Math.floor(total / targetDenom);
        const remainder = total % targetDenom;

        const result = {
            [targetDenom]: targetCount
        };

        if (remainder > 0) {
            const remainderChips = this.optimizeChips(remainder);
            Object.assign(result, remainderChips);
        }

        return result;
    }

    calculatePot(bets) {
        return bets.reduce((pot, bet) => {
            if (typeof bet === 'number') {
                return pot + bet;
            } else if (typeof bet === 'object' && bet.amount) {
                return pot + bet.amount;
            }
            return pot;
        }, 0);
    }

    calculateSidePots(players) {
        const activePlayers = players.filter(p => p.active);
        const pots = [];

        while (activePlayers.length > 0) {
            const minBet = Math.min(...activePlayers.map(p => p.bet));

            if (minBet > 0) {
                const potSize = minBet * activePlayers.length;
                const eligiblePlayers = activePlayers.map(p => p.id);

                pots.push({
                    amount: potSize,
                    eligiblePlayers
                });

                activePlayers.forEach(p => {
                    p.bet -= minBet;
                });
            }

            const remainingPlayers = activePlayers.filter(p => p.bet > 0);
            activePlayers.length = 0;
            activePlayers.push(...remainingPlayers);
        }

        return pots;
    }
}

export default ChipCalculator;