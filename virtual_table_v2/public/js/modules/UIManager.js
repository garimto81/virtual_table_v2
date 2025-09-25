/**
 * UIManager - 브라우저용 UI 관리 모듈
 */

export class UIManager {
    constructor() {
        this.toastQueue = [];
        this.isToastShowing = false;
    }

    showToast(message, type = 'info', duration = 3000) {
        this.toastQueue.push({ message, type, duration });
        if (!this.isToastShowing) {
            this.processToastQueue();
        }
    }

    processToastQueue() {
        if (this.toastQueue.length === 0) {
            this.isToastShowing = false;
            return;
        }

        this.isToastShowing = true;
        const { message, type, duration } = this.toastQueue.shift();

        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast ${type}`;
            toast.classList.add('show');

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    this.processToastQueue();
                }, 300);
            }, duration);
        }
    }

    showModal(title, content, buttons = []) {
        const modal = document.createElement('div');
        modal.className = 'modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        modalHeader.innerHTML = `<h3>${title}</h3><button class="close-modal">×</button>`;

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        modalBody.innerHTML = content;

        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `btn ${btn.class || 'btn-secondary'}`;
            button.textContent = btn.text;
            button.onclick = btn.onClick;
            modalFooter.appendChild(button);
        });

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modal.appendChild(modalContent);

        document.body.appendChild(modal);

        modalHeader.querySelector('.close-modal').onclick = () => {
            document.body.removeChild(modal);
        };

        return modal;
    }

    showConfirm(message, onConfirm, onCancel) {
        return this.showModal('확인', message, [
            {
                text: '취소',
                class: 'btn-secondary',
                onClick: () => {
                    if (onCancel) onCancel();
                    document.querySelector('.modal').remove();
                }
            },
            {
                text: '확인',
                class: 'btn-primary',
                onClick: () => {
                    if (onConfirm) onConfirm();
                    document.querySelector('.modal').remove();
                }
            }
        ]);
    }

    showLoading(message = '로딩 중...') {
        const loader = document.createElement('div');
        loader.id = 'loader';
        loader.className = 'loader-overlay';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(loader);
    }

    hideLoading() {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.remove();
        }
    }

    updateProgressBar(percent, message = '') {
        let progressBar = document.getElementById('progressBar');

        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.id = 'progressBar';
            progressBar.className = 'progress-bar-container';
            progressBar.innerHTML = `
                <div class="progress-bar">
                    <div class="progress-bar-fill"></div>
                </div>
                <div class="progress-message"></div>
            `;
            document.body.appendChild(progressBar);
        }

        const fill = progressBar.querySelector('.progress-bar-fill');
        const msg = progressBar.querySelector('.progress-message');

        fill.style.width = `${percent}%`;
        msg.textContent = message;

        if (percent >= 100) {
            setTimeout(() => {
                progressBar.remove();
            }, 1000);
        }
    }

    animateNumber(element, start, end, duration = 1000) {
        const startTime = Date.now();
        const range = end - start;

        const update = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            const value = Math.floor(start + range * progress);

            element.textContent = value;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    }

    createChart(canvasId, type, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');

        // 간단한 차트 그리기 (실제로는 Chart.js 등 사용 권장)
        if (type === 'line') {
            this.drawLineChart(ctx, data, options);
        } else if (type === 'bar') {
            this.drawBarChart(ctx, data, options);
        }
    }

    drawLineChart(ctx, data, options) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const padding = 40;

        ctx.clearRect(0, 0, width, height);

        // 축 그리기
        ctx.strokeStyle = '#ddd';
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();

        // 데이터 그리기
        if (data.length > 0) {
            const maxValue = Math.max(...data);
            const minValue = Math.min(...data);
            const range = maxValue - minValue || 1;

            ctx.strokeStyle = options.color || '#4a69bd';
            ctx.lineWidth = 2;
            ctx.beginPath();

            data.forEach((value, index) => {
                const x = padding + (index / (data.length - 1)) * (width - padding * 2);
                const y = height - padding - ((value - minValue) / range) * (height - padding * 2);

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
        }
    }

    drawBarChart(ctx, data, options) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const padding = 40;

        ctx.clearRect(0, 0, width, height);

        // 축 그리기
        ctx.strokeStyle = '#ddd';
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();

        // 바 그리기
        if (data.length > 0) {
            const maxValue = Math.max(...data.map(d => d.value));
            const barWidth = (width - padding * 2) / data.length - 10;

            data.forEach((item, index) => {
                const x = padding + index * (barWidth + 10) + 5;
                const barHeight = (item.value / maxValue) * (height - padding * 2);
                const y = height - padding - barHeight;

                ctx.fillStyle = options.colors ? options.colors[index] : '#4a69bd';
                ctx.fillRect(x, y, barWidth, barHeight);

                // 라벨
                ctx.fillStyle = '#333';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(item.label, x + barWidth / 2, height - padding + 20);
            });
        }
    }

    formatCurrency(amount, currency = 'KRW') {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0
        }).format(amount);
    }

    formatDate(date, format = 'short') {
        const d = new Date(date);

        if (format === 'short') {
            return d.toLocaleDateString('ko-KR');
        } else if (format === 'long') {
            return d.toLocaleString('ko-KR');
        } else if (format === 'relative') {
            return this.getRelativeTime(d);
        }

        return d.toISOString();
    }

    getRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}일 전`;
        if (hours > 0) return `${hours}시간 전`;
        if (minutes > 0) return `${minutes}분 전`;
        return '방금 전';
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

export default UIManager;