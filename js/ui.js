export class UIManager {
    constructor() {
        this.statsElement = document.getElementById('game-stats');
        this.gameOverElement = document.getElementById('game-over');
        this.finalStatsElement = document.getElementById('final-stats');
        this.replayButton = document.getElementById('replay-btn');
        this.missIndicator = document.getElementById('miss-indicator');

        // Callbacks
        this.onReplay = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.replayButton.addEventListener('click', () => {
            if (this.onReplay) {
                this.onReplay();
            }
        });
    }

    updateStats(steps, time) {
        const timeString = this.formatTime(time);
        this.statsElement.textContent = `Steps: ${steps} | Time: ${timeString}`;
    }

    formatTime(totalMilliseconds) {
        const minutes = Math.floor(totalMilliseconds / 60000);
        const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
        const ms = totalMilliseconds % 1000;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    showGameOver(steps, time) {
        const timeString = this.formatTime(time);
        this.finalStatsElement.textContent = `Steps: ${steps} | Time: ${timeString}`;
        this.gameOverElement.classList.add('visible');
    }

    hideGameOver() {
        this.gameOverElement.classList.remove('visible');
    }

    showMissIndicator(x, y) {
        this.missIndicator.style.left = `${x}px`;
        this.missIndicator.style.top = `${y}px`;
        this.missIndicator.style.opacity = '1';
        this.missIndicator.style.animation = 'fadeOut 0.5s ease-out forwards';

        // Reset animation after completion
        setTimeout(() => {
            this.missIndicator.style.opacity = '0';
            this.missIndicator.style.animation = '';
        }, 500);
    }

    reset() {
        this.statsElement.textContent = 'Steps: 0 | Time: 00:00.000';
        this.hideGameOver();
    }
}
