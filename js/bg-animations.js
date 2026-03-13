/**
 * FreyAI Visions — Background Animations
 * Industrial Luxury particle system (Canvas-based, zero dependencies)
 *
 * Usage: Add data-bg="particles|gradient-mesh|circuit" to any container element.
 * The script auto-initializes on DOMContentLoaded and creates a canvas inside each.
 *
 * @version 1.0.0
 * @license MIT
 */
(function () {
  'use strict';

  // --- Constants -----------------------------------------------------------
  var INDIGO = [99, 102, 241];
  var GOLD = [212, 168, 67];
  var PURPLE = [88, 28, 135];
  var DIM_DOT = [26, 26, 30];
  var isMobile = function () { return window.innerWidth < 768; };
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  // --- Utility -------------------------------------------------------------
  function rgba(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function dist(x1, y1, x2, y2) {
    var dx = x1 - x2, dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Base renderer -------------------------------------------------------
  function createCanvas(container) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
    var pos = getComputedStyle(container).position;
    if (pos === 'static' || pos === '') {container.style.position = 'relative';}
    container.insertBefore(canvas, container.firstChild);
    return canvas;
  }

  function sizeCanvas(canvas) {
    var rect = canvas.parentElement.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    return { w: w, h: h };
  }

  // --- PARTICLES mode ------------------------------------------------------
  function initParticles(container) {
    var canvas = createCanvas(container);
    var ctx = canvas.getContext('2d');
    var size = sizeCanvas(canvas);
    var w = size.w, h = size.h;
    var count = isMobile() ? 35 : 70;
    var proximity = 150;
    var mouseX = -9999, mouseY = -9999;
    var mouseRadius = 120;
    var particles = [];

    function spawn() {
      particles.length = 0;
      for (var i = 0; i < count; i++) {
        var isGold = Math.random() < 0.2;
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 1.5 + 1,
          color: isGold ? GOLD : INDIGO,
          alpha: Math.random() * 0.4 + 0.4
        });
      }
    }
    spawn();

    container.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    });
    container.addEventListener('mouseleave', function () {
      mouseX = -9999; mouseY = -9999;
    });

    function frame() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];

        // Mouse repulsion
        var md = dist(p.x, p.y, mouseX, mouseY);
        if (md < mouseRadius && md > 0) {
          var force = (mouseRadius - md) / mouseRadius * 0.8;
          p.vx += (p.x - mouseX) / md * force;
          p.vy += (p.y - mouseY) / md * force;
        }

        // Dampen velocity
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Clamp speed
        var speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 1.5) { p.vx *= 1.5 / speed; p.vy *= 1.5 / speed; }
        if (speed < 0.15) {
          p.vx += (Math.random() - 0.5) * 0.1;
          p.vy += (Math.random() - 0.5) * 0.1;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < -10) {p.x = w + 10;}
        if (p.x > w + 10) {p.x = -10;}
        if (p.y < -10) {p.y = h + 10;}
        if (p.y > h + 10) {p.y = -10;}

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = rgba(p.color, p.alpha);
        ctx.fill();
      }

      // Draw connections
      ctx.lineWidth = 0.6;
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var a = particles[i], b = particles[j];
          var d = dist(a.x, a.y, b.x, b.y);
          if (d < proximity) {
            var opacity = (1 - d / proximity) * 0.13;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = rgba(a.color, opacity);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(frame);
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var s = sizeCanvas(canvas);
        w = s.w; h = s.h;
        count = isMobile() ? 35 : 70;
        spawn();
      }, 200);
    });

    requestAnimationFrame(frame);
  }

  // --- GRADIENT-MESH mode --------------------------------------------------
  function initGradientMesh(container) {
    var canvas = createCanvas(container);
    var ctx = canvas.getContext('2d');
    var size = sizeCanvas(canvas);
    var w = size.w, h = size.h;
    var startTime = performance.now();

    var blobs = [
      { color: INDIGO, rx: 0.35, ry: 0.25, cx: 0.3, cy: 0.4, phaseX: 0, phaseY: 0.5, blur: 300, period: 25000 },
      { color: GOLD, rx: 0.2, ry: 0.2, cx: 0.7, cy: 0.3, phaseX: 1.2, phaseY: 2.1, blur: 250, period: 22000 },
      { color: PURPLE, rx: 0.3, ry: 0.3, cx: 0.5, cy: 0.7, phaseX: 2.5, phaseY: 0.8, blur: 350, period: 28000 },
      { color: INDIGO, rx: 0.15, ry: 0.15, cx: 0.8, cy: 0.6, phaseX: 3.8, phaseY: 1.4, blur: 200, period: 20000 }
    ];

    function frame(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'screen';

      var elapsed = now - startTime;

      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var t = (elapsed % b.period) / b.period * 6.2832;
        var bx = (b.cx + Math.sin(t + b.phaseX) * b.rx) * w;
        var by = (b.cy + Math.cos(t + b.phaseY) * b.ry) * h;
        var radius = b.blur * (isMobile() ? 0.6 : 1);

        var grad = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
        grad.addColorStop(0, rgba(b.color, 0.25));
        grad.addColorStop(0.4, rgba(b.color, 0.1));
        grad.addColorStop(1, rgba(b.color, 0));

        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, 6.2832);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var s = sizeCanvas(canvas);
        w = s.w; h = s.h;
      }, 200);
    });

    requestAnimationFrame(frame);
  }

  // --- CIRCUIT mode --------------------------------------------------------
  function initCircuit(container) {
    var canvas = createCanvas(container);
    var ctx = canvas.getContext('2d');
    var size = sizeCanvas(canvas);
    var w = size.w, h = size.h;
    var spacing = isMobile() ? 50 : 40;
    var cols, rows, dots;
    var pulses = [];
    var maxPulses = isMobile() ? 2 : 4;
    var pulseInterval = 1800;
    var lastPulse = 0;

    function buildGrid() {
      cols = Math.ceil(w / spacing) + 1;
      rows = Math.ceil(h / spacing) + 1;
      dots = new Float32Array(cols * rows * 2);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var idx = (r * cols + c) * 2;
          dots[idx] = c * spacing;
          dots[idx + 1] = r * spacing;
        }
      }
    }
    buildGrid();

    function spawnPulse() {
      // Pick random starting dot and direction (0=right, 1=down, 2=left, 3=up)
      var dir = (Math.random() * 4) | 0;
      var col, row;
      if (dir === 0) { col = 0; row = (Math.random() * rows) | 0; }
      else if (dir === 1) { col = (Math.random() * cols) | 0; row = 0; }
      else if (dir === 2) { col = cols - 1; row = (Math.random() * rows) | 0; }
      else { col = (Math.random() * cols) | 0; row = rows - 1; }

      var isGold = Math.random() < 0.2;
      pulses.push({
        col: col, row: row,
        dir: dir,
        progress: 0,
        color: isGold ? GOLD : INDIGO,
        segments: [],
        length: 5 + (Math.random() * 8) | 0,
        turnsLeft: 2 + (Math.random() * 3) | 0,
        dead: false
      });
    }

    function stepPulse(p) {
      p.progress++;
      if (p.progress % 3 !== 0) {return;} // slow down movement

      // Record position
      p.segments.push({ col: p.col, row: p.row });
      if (p.segments.length > p.length) {p.segments.shift();}

      // Move
      var dx = [1, 0, -1, 0];
      var dy = [0, 1, 0, -1];
      p.col += dx[p.dir];
      p.row += dy[p.dir];

      // Random turn
      if (p.turnsLeft > 0 && Math.random() < 0.15) {
        p.dir = (p.dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
        p.turnsLeft--;
      }

      // Out of bounds = dead
      if (p.col < 0 || p.col >= cols || p.row < 0 || p.row >= rows) {
        p.dead = true;
      }
    }

    function frame(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Build illumination map from pulse segments
      var illum = {};
      for (var pi = 0; pi < pulses.length; pi++) {
        var p = pulses[pi];
        var segs = p.segments;
        for (var si = 0; si < segs.length; si++) {
          var s = segs[si];
          var brightness = (si + 1) / segs.length;
          // Illuminate nearby dots (Manhattan distance <= 2)
          for (var dr = -2; dr <= 2; dr++) {
            for (var dc = -2; dc <= 2; dc++) {
              var nr = s.row + dr, nc = s.col + dc;
              if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {continue;}
              var md = Math.abs(dr) + Math.abs(dc);
              if (md > 2) {continue;}
              var falloff = brightness * (1 - md / 3) * 0.7;
              var key = nr * cols + nc;
              var prev = illum[key];
              if (!prev || prev.val < falloff) {
                illum[key] = { val: falloff, color: p.color };
              }
            }
          }
        }
      }

      // Draw grid dots
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var idx = (r * cols + c) * 2;
          var x = dots[idx], y = dots[idx + 1];
          var key = r * cols + c;
          var il = illum[key];

          ctx.beginPath();
          if (il) {
            ctx.arc(x, y, 1.8, 0, 6.2832);
            ctx.fillStyle = rgba(il.color, il.val);
          } else {
            ctx.arc(x, y, 1, 0, 6.2832);
            ctx.fillStyle = rgba(DIM_DOT, 0.35);
          }
          ctx.fill();
        }
      }

      // Draw pulse trail lines
      for (var pi = 0; pi < pulses.length; pi++) {
        var p = pulses[pi];
        var segs = p.segments;
        if (segs.length < 2) {continue;}
        for (var si = 1; si < segs.length; si++) {
          var a = segs[si - 1], b = segs[si];
          var brightness = (si / segs.length) * 0.6;
          ctx.beginPath();
          ctx.moveTo(a.col * spacing, a.row * spacing);
          ctx.lineTo(b.col * spacing, b.row * spacing);
          ctx.strokeStyle = rgba(p.color, brightness);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Head glow
        if (segs.length > 0) {
          var head = segs[segs.length - 1];
          var hx = head.col * spacing, hy = head.row * spacing;
          var glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 15);
          glow.addColorStop(0, rgba(p.color, 0.5));
          glow.addColorStop(1, rgba(p.color, 0));
          ctx.beginPath();
          ctx.arc(hx, hy, 15, 0, 6.2832);
          ctx.fillStyle = glow;
          ctx.fill();
        }
      }

      // Spawn new pulses
      if (now - lastPulse > pulseInterval && pulses.length < maxPulses) {
        spawnPulse();
        lastPulse = now;
      }

      // Step and prune pulses
      for (var pi = pulses.length - 1; pi >= 0; pi--) {
        stepPulse(pulses[pi]);
        if (pulses[pi].dead) {pulses.splice(pi, 1);}
      }

      requestAnimationFrame(frame);
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var s = sizeCanvas(canvas);
        w = s.w; h = s.h;
        spacing = isMobile() ? 50 : 40;
        buildGrid();
        pulses.length = 0;
      }, 200);
    });

    requestAnimationFrame(frame);
  }

  // --- Initialization ------------------------------------------------------
  var modes = {
    'particles': initParticles,
    'gradient-mesh': initGradientMesh,
    'circuit': initCircuit
  };

  function init() {
    var elements = document.querySelectorAll('[data-bg]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var mode = el.getAttribute('data-bg');
      if (modes[mode]) {
        modes[mode](el);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
