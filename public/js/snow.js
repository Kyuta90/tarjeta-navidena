/**
 * Canvas Snowflake Engine - Tarjeta Navideña Digital
 * Generates smooth, realistic snowfall particles with gentle wind drift
 */
(function () {
  let canvas = null;
  let ctx = null;
  let flakes = [];
  let animId = null;
  let width = 0;
  let height = 0;
  let isRunning = false;

  class Snowflake {
    constructor(w, h, isInit = false) {
      this.reset(w, h, isInit);
    }

    reset(w, h, isInit = false) {
      this.x = Math.random() * w;
      this.y = isInit ? Math.random() * h : -10;
      this.radius = Math.random() * 2.8 + 1.0; // 1px to 3.8px
      this.speed = Math.random() * 1.2 + 0.6;   // vertical fall speed
      this.wind = Math.random() * 0.6 - 0.3;   // slight horizontal drift
      this.swingSpeed = Math.random() * 0.03 + 0.01;
      this.swingPhase = Math.random() * Math.PI * 2;
      this.swingAmplitude = Math.random() * 1.5 + 0.5;
      this.opacity = Math.random() * 0.6 + 0.3;
      // Some special star-like flakes
      this.isSpecial = Math.random() > 0.88;
    }

    update(w, h) {
      this.swingPhase += this.swingSpeed;
      this.x += Math.sin(this.swingPhase) * this.swingAmplitude + this.wind;
      this.y += this.speed;

      // Wrap around screen boundaries
      if (this.y > h + 10) {
        this.reset(w, h, false);
      }
      if (this.x > w + 10) {
        this.x = -10;
      } else if (this.x < -10) {
        this.x = w + 10;
      }
    }

    draw(ctx) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
      if (this.isSpecial) {
        // Draw delicate diamond/star flake
        ctx.arc(this.x, this.y, this.radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(254, 240, 138, ${this.opacity * 0.8})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else {
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function resize() {
    if (!canvas) return;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < flakes.length; i++) {
      flakes[i].update(width, height);
      flakes[i].draw(ctx);
    }

    if (isRunning) {
      animId = requestAnimationFrame(render);
    }
  }

  function initSnow() {
    canvas = document.getElementById('snowCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'snowCanvas';
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    // Number of flakes based on screen width (desktop: ~90, mobile: ~50)
    const flakeCount = Math.min(Math.floor(width / 14), 110);
    flakes = [];
    for (let i = 0; i < flakeCount; i++) {
      flakes.push(new Snowflake(width, height, true));
    }

    isRunning = true;
    render();
  }

  function stopSnow() {
    isRunning = false;
    if (animId) cancelAnimationFrame(animId);
  }

  // Auto initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSnow);
  } else {
    initSnow();
  }

  // Export to window for external control
  window.SnowEngine = {
    init: initSnow,
    stop: stopSnow
  };
})();
