// ===== ArTodo — Artistic Task Manager =====
// Pure vanilla JS, no dependencies

// ============================
//  STORE — State + LocalStorage
// ============================
class Store {
  constructor() {
    this.KEY = 'artodo_data';
    this.state = this.load();
  }

  defaults() {
    return {
      tasks: [],
      categories: [
        { id: 'work', name: 'Work', color: '#457b9d' },
        { id: 'personal', name: 'Personal', color: '#2a9d8f' },
        { id: 'health', name: 'Health', color: '#e76f51' },
        { id: 'creative', name: 'Creative', color: '#8b5cf6' }
      ],
      theme: 'starry-night',
      streak: { count: 0, lastDate: null },
      pomodoroSessions: 0,
      completionLog: {} // { 'YYYY-MM-DD': { added: N, completed: N } }
    };
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY));
      return data ? { ...this.defaults(), ...data } : this.defaults();
    } catch { return this.defaults(); }
  }

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.state));
  }

  // Tasks
  addTask(task) {
    task.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    task.createdAt = new Date().toISOString();
    task.completed = false;
    task.subtasks = task.subtasks || [];
    this.state.tasks.unshift(task);
    this.logDay('added');
    this.save();
    return task;
  }

  updateTask(id, updates) {
    const i = this.state.tasks.findIndex(t => t.id === id);
    if (i !== -1) { Object.assign(this.state.tasks[i], updates); this.save(); }
  }

  deleteTask(id) {
    this.state.tasks = this.state.tasks.filter(t => t.id !== id);
    this.save();
  }

  toggleTask(id) {
    const task = this.state.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;
      if (task.completed) this.logDay('completed');
      this.updateStreak();
      this.save();
    }
    return task;
  }

  reorder(fromIdx, toIdx) {
    const [item] = this.state.tasks.splice(fromIdx, 1);
    this.state.tasks.splice(toIdx, 0, item);
    this.save();
  }

  // Categories
  addCategory(name, color) {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    if (!this.state.categories.find(c => c.id === id)) {
      this.state.categories.push({ id, name, color: color || this.randomColor() });
      this.save();
    }
    return id;
  }

  deleteCategory(id) {
    this.state.categories = this.state.categories.filter(c => c.id !== id);
    this.state.tasks.forEach(t => { if (t.category === id) t.category = ''; });
    this.save();
  }

  randomColor() {
    const colors = ['#e63946', '#457b9d', '#2a9d8f', '#e76f51', '#8b5cf6', '#f4a261', '#d4af37', '#00f0ff'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Streak
  logDay(type) {
    const today = new Date().toISOString().slice(0, 10);
    if (!this.state.completionLog[today]) this.state.completionLog[today] = { added: 0, completed: 0 };
    this.state.completionLog[today][type]++;
  }

  updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const log = this.state.completionLog;
    if (log[today] && log[today].completed > 0) {
      if (this.state.streak.lastDate === today) return;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (this.state.streak.lastDate === yesterday || !this.state.streak.lastDate) {
        this.state.streak.count++;
      } else {
        this.state.streak.count = 1;
      }
      this.state.streak.lastDate = today;
    }
  }

  // Filters
  getTasks(filter, category, search) {
    let tasks = [...this.state.tasks];
    const today = new Date().toISOString().slice(0, 10);

    if (filter === 'today') tasks = tasks.filter(t => t.dueDate === today && !t.completed);
    else if (filter === 'upcoming') tasks = tasks.filter(t => t.dueDate > today && !t.completed);
    else if (filter === 'completed') tasks = tasks.filter(t => t.completed);
    else tasks = filter === 'all' ? tasks : tasks;

    if (category && category !== 'all') tasks = tasks.filter(t => t.category === category);
    if (search) {
      const q = search.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }
    return tasks;
  }

  getProgress() {
    const total = this.state.tasks.length;
    const done = this.state.tasks.filter(t => t.completed).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  getWeeklyStats() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const log = this.state.completionLog[key] || { added: 0, completed: 0 };
      days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), ...log });
    }
    return days;
  }
}

// ============================
//  THEME MANAGER + Canvas BG
// ============================
class ThemeManager {
  constructor() {
    this.canvas = document.getElementById('bg-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.animId = null;
    this.particles = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    cancelAnimationFrame(this.animId);
    this.particles = [];
    this.startBackground(name);
    // Mark active theme card
    document.querySelectorAll('.theme-card').forEach(c => {
      c.classList.toggle('active', c.dataset.theme === name);
    });
  }

  startBackground(theme) {
    switch (theme) {
      case 'starry-night': this.initStarryNight(); break;
      case 'ukiyo-e': this.initUkiyoE(); break;
      case 'art-deco': this.initArtDeco(); break;
      case 'bauhaus': this.initBauhaus(); break;
      case 'impressionist': this.initImpressionist(); break;
      case 'cyberpunk': this.initCyberpunk(); break;
    }
  }

  // Starry Night — faithful recreation of Van Gogh's painting (1889, MoMA)
  // Composition: swirling sky, crescent moon, 11 stars with concentric halos,
  // cypress tree, rolling hills, village with church steeple, warm windows
  initStarryNight() {
    const W = this.canvas.width, H = this.canvas.height;
    let t = 0;
    let mouseX = W / 2, mouseY = H / 2;

    // Subtle parallax on mouse
    document.addEventListener('mousemove', e => {
      mouseX = e.clientX; mouseY = e.clientY;
    });

    // === SCENE CONSTANTS ===
    const skyLine = H * 0.68;   // where the sky meets the hills
    const hillLine = H * 0.78;  // where hills meet the village base

    // === SWIRL VORTEXES (the painting's iconic feature) ===
    // The painting has ~3 major spiral vortexes
    const vortexes = [
      { x: W * 0.42, y: H * 0.28, rx: 90, ry: 50, layers: 5, dir: 1 },
      { x: W * 0.18, y: H * 0.22, rx: 55, ry: 30, layers: 4, dir: -1 },
      { x: W * 0.72, y: H * 0.32, rx: 65, ry: 35, layers: 4, dir: 1 },
    ];

    // === STARS with concentric ring halos (like the painting) ===
    const stars = [
      { x: W * 0.08, y: H * 0.12, r: 4, rings: 4, haloR: 22 },
      { x: W * 0.22, y: H * 0.08, r: 3.5, rings: 3, haloR: 18 },
      { x: W * 0.35, y: H * 0.05, r: 3, rings: 3, haloR: 16 },
      { x: W * 0.48, y: H * 0.14, r: 5, rings: 5, haloR: 28 },
      { x: W * 0.55, y: H * 0.04, r: 3, rings: 3, haloR: 15 },
      { x: W * 0.62, y: H * 0.18, r: 4, rings: 4, haloR: 20 },
      { x: W * 0.75, y: H * 0.08, r: 3.5, rings: 3, haloR: 17 },
      { x: W * 0.88, y: H * 0.22, r: 4.5, rings: 4, haloR: 24 },
      { x: W * 0.94, y: H * 0.06, r: 3, rings: 3, haloR: 14 },
      { x: W * 0.3, y: H * 0.35, r: 3, rings: 3, haloR: 16 },
      { x: W * 0.58, y: H * 0.38, r: 3.5, rings: 3, haloR: 18 },
    ].map(s => ({ ...s, phase: Math.random() * Math.PI * 2, speed: Math.random() * 0.012 + 0.006 }));

    // === MOON ===
    const moon = { x: W * 0.85, y: H * 0.12, r: 24 };

    // === BRUSHSTROKE WIND BANDS ===
    const windBands = [];
    for (let i = 0; i < 14; i++) {
      windBands.push({
        y: H * 0.04 + i * (skyLine - H * 0.04) / 14,
        amplitude: 8 + Math.random() * 10,
        freq: 0.004 + Math.random() * 0.004,
        speed: 0.3 + Math.random() * 0.4,
        width: 2 + Math.random() * 3,
        colorIdx: Math.floor(Math.random() * 4)
      });
    }
    const bandColors = [
      [30, 60, 140],   // ultramarine
      [50, 100, 180],  // cobalt
      [80, 140, 210],  // cerulean
      [100, 170, 230], // light blue highlight
    ];

    // === VILLAGE BUILDINGS ===
    const buildings = [];
    const bCount = 14;
    const villageStart = W * 0.2, villageEnd = W * 0.85;
    for (let i = 0; i < bCount; i++) {
      const bx = villageStart + (villageEnd - villageStart) / bCount * i + Math.random() * 15;
      const bw = 15 + Math.random() * 20;
      const bh = 20 + Math.random() * 30;
      buildings.push({
        x: bx, w: bw, h: bh,
        hasWindow: Math.random() > 0.3,
        windowY: 0.3 + Math.random() * 0.4,
        windowGlow: Math.random() * Math.PI * 2
      });
    }
    // Church steeple (the tallest structure, center-right of village)
    const church = { x: W * 0.55, w: 14, h: 65 };

    // === SHOOTING STARS (extra animation) ===
    let shootingStar = null;
    const spawnShootingStar = () => {
      shootingStar = {
        x: Math.random() * W * 0.7 + W * 0.1,
        y: Math.random() * H * 0.2,
        vx: 4 + Math.random() * 3,
        vy: 1.5 + Math.random() * 2,
        life: 1.0,
        trail: []
      };
    };

    // === FIREFLIES near village (extra animation) ===
    const fireflies = Array.from({ length: 12 }, () => ({
      x: W * 0.2 + Math.random() * W * 0.65,
      y: hillLine + Math.random() * (H - hillLine) * 0.6,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.03 + 0.01,
      drift: Math.random() * 0.3 + 0.1
    }));

    // ==================
    //  RENDER LOOP
    // ==================
    const animate = () => {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, W, H);
      t += 0.006;

      // Parallax offset
      const px = (mouseX - W / 2) * 0.008;
      const py = (mouseY - H / 2) * 0.005;

      // --- SKY GRADIENT BASE ---
      const skyGrad = ctx.createLinearGradient(0, 0, 0, skyLine);
      skyGrad.addColorStop(0, '#0a1535');
      skyGrad.addColorStop(0.4, '#0f1f4a');
      skyGrad.addColorStop(0.7, '#163060');
      skyGrad.addColorStop(1, '#1a3a6a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, skyLine + 5);

      // --- FLOWING WIND BANDS (Van Gogh's horizontal brushstrokes) ---
      windBands.forEach(band => {
        const [r, g, b] = bandColors[band.colorIdx];
        ctx.beginPath();
        ctx.moveTo(-10, band.y);
        for (let x = -10; x <= W + 10; x += 3) {
          const wave = Math.sin(x * band.freq + t * band.speed) * band.amplitude
            + Math.sin(x * band.freq * 2.3 + t * band.speed * 1.7) * band.amplitude * 0.4;
          ctx.lineTo(x + px * 0.5, band.y + wave + py * 0.3);
        }
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.08 + Math.sin(t + band.y * 0.01) * 0.03})`;
        ctx.lineWidth = band.width;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      // --- SWIRL VORTEXES (concentric spirals — the iconic element) ---
      vortexes.forEach(v => {
        for (let layer = 0; layer < v.layers; layer++) {
          const layerR = 0.4 + layer * 0.15;
          const rx = v.rx * layerR;
          const ry = v.ry * layerR;
          const segments = 60;
          ctx.beginPath();
          for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2 * 1.5 + t * 0.8 * v.dir + layer * 0.5;
            const spiral = 1 + (i / segments) * 0.3;
            const sx = v.x + Math.cos(angle) * rx * spiral + px;
            const sy = v.y + Math.sin(angle) * ry * spiral + py;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          const alpha = 0.12 - layer * 0.02;
          const blueShift = Math.min(255, 140 + layer * 30);
          ctx.strokeStyle = `rgba(${50 + layer * 15}, ${blueShift}, ${210 + layer * 10}, ${alpha})`;
          ctx.lineWidth = 3.5 - layer * 0.4;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      });

      // --- STARS with CONCENTRIC RING HALOS (like in the painting) ---
      stars.forEach(star => {
        star.phase += star.speed;
        const pulse = 0.85 + Math.sin(star.phase) * 0.15;
        const sx = star.x + px * 1.2;
        const sy = star.y + py * 0.8;

        // Concentric ring halos (Van Gogh painted circular ring-like halos)
        for (let ring = star.rings; ring >= 1; ring--) {
          const ringR = star.haloR * (ring / star.rings) * pulse;
          const alpha = (0.06 + (star.rings - ring) * 0.03) * pulse;
          ctx.beginPath();
          ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(253, 216, 53, ${alpha})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          // Filled glow ring
          ctx.beginPath();
          ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(253, 220, 80, ${alpha * 0.3})`;
          ctx.fill();
        }

        // Bright core
        const coreGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, star.r * 2 * pulse);
        coreGrad.addColorStop(0, `rgba(255, 250, 210, ${0.95 * pulse})`);
        coreGrad.addColorStop(0.5, `rgba(253, 216, 53, ${0.6 * pulse})`);
        coreGrad.addColorStop(1, 'rgba(253, 216, 53, 0)');
        ctx.beginPath();
        ctx.arc(sx, sy, star.r * 2 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, star.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 250, 220, ${0.9 * pulse})`;
        ctx.fill();
      });

      // --- CRESCENT MOON (upper right, large warm glow) ---
      const mx = moon.x + px * 1.5;
      const my = moon.y + py;
      const mp = 0.92 + Math.sin(t * 0.8) * 0.08;
      // Large halo
      for (let ring = 4; ring >= 1; ring--) {
        const rr = moon.r * (1 + ring * 0.6) * mp;
        ctx.beginPath();
        ctx.arc(mx, my, rr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(253, 220, 80, ${0.02 * ring})`;
        ctx.fill();
      }
      // Moon body
      ctx.beginPath();
      ctx.arc(mx, my, moon.r * mp, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(253, 235, 130, 0.9)';
      ctx.fill();
      // Crescent cut
      ctx.beginPath();
      ctx.arc(mx + 9, my - 5, moon.r * mp * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = '#0f1f4a';
      ctx.fill();

      // --- ROLLING HILLS ---
      // Hill 1 (back, lighter)
      ctx.beginPath();
      ctx.moveTo(-10, skyLine);
      for (let x = -10; x <= W + 10; x += 2) {
        const y = skyLine + Math.sin(x * 0.005 + 1) * 15 + Math.sin(x * 0.012) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 10, H); ctx.lineTo(-10, H); ctx.closePath();
      ctx.fillStyle = '#1a3a28';
      ctx.fill();

      // Hill 2 (front, darker)
      ctx.beginPath();
      ctx.moveTo(-10, skyLine + 18);
      for (let x = -10; x <= W + 10; x += 2) {
        const y = skyLine + 18 + Math.sin(x * 0.006 + 2.5) * 12 + Math.sin(x * 0.015 + 1) * 6;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 10, H); ctx.lineTo(-10, H); ctx.closePath();
      ctx.fillStyle = '#14301e';
      ctx.fill();

      // --- VILLAGE BASE (ground) ---
      ctx.fillStyle = '#101a12';
      ctx.fillRect(0, hillLine, W, H - hillLine);

      // --- VILLAGE BUILDINGS ---
      buildings.forEach(b => {
        const by = hillLine - b.h;
        // Building body
        ctx.fillStyle = '#0e1810';
        ctx.fillRect(b.x, by, b.w, b.h);
        // Roof
        ctx.beginPath();
        ctx.moveTo(b.x - 3, by);
        ctx.lineTo(b.x + b.w / 2, by - 8 - Math.random() * 2);
        ctx.lineTo(b.x + b.w + 3, by);
        ctx.closePath();
        ctx.fillStyle = '#121e14';
        ctx.fill();
        // Warm window glow
        if (b.hasWindow) {
          b.windowGlow += 0.02;
          const gAlpha = 0.5 + Math.sin(b.windowGlow) * 0.2;
          const wx = b.x + b.w * 0.3;
          const wy = by + b.h * b.windowY;
          // Window
          ctx.fillStyle = `rgba(255, 200, 80, ${gAlpha})`;
          ctx.fillRect(wx, wy, 5, 5);
          // Glow around window
          const wGrad = ctx.createRadialGradient(wx + 2.5, wy + 2.5, 0, wx + 2.5, wy + 2.5, 12);
          wGrad.addColorStop(0, `rgba(255, 200, 80, ${gAlpha * 0.2})`);
          wGrad.addColorStop(1, 'rgba(255, 200, 80, 0)');
          ctx.beginPath();
          ctx.arc(wx + 2.5, wy + 2.5, 12, 0, Math.PI * 2);
          ctx.fillStyle = wGrad;
          ctx.fill();
        }
      });

      // --- CHURCH STEEPLE (tallest, central point of village) ---
      const cy = hillLine - church.h;
      ctx.fillStyle = '#0c150e';
      ctx.fillRect(church.x, cy + 15, church.w, church.h - 15);
      // Pointed steeple
      ctx.beginPath();
      ctx.moveTo(church.x - 1, cy + 15);
      ctx.lineTo(church.x + church.w / 2, cy);
      ctx.lineTo(church.x + church.w + 1, cy + 15);
      ctx.closePath();
      ctx.fillStyle = '#0c150e';
      ctx.fill();

      // --- CYPRESS TREE (left foreground, large dark flame shape) ---
      const treeX = W * 0.08;
      const treeBase = H;
      const treeTop = H * 0.15;
      const treeW = W * 0.04;
      // Draw as layered flame shapes
      for (let layer = 0; layer < 4; layer++) {
        const wobble = Math.sin(t * 1.5 + layer * 0.7) * 3;
        const lx = treeX + wobble * (layer % 2 === 0 ? 1 : -1);
        const spread = 1 + layer * 0.08;
        ctx.beginPath();
        ctx.moveTo(lx, treeBase);
        ctx.quadraticCurveTo(lx - treeW * spread, treeBase * 0.6, lx - treeW * 0.5 * spread + wobble, treeTop + layer * 15);
        ctx.quadraticCurveTo(lx, treeTop - 10 + layer * 10, lx + treeW * 0.5 * spread + wobble, treeTop + layer * 15);
        ctx.quadraticCurveTo(lx + treeW * spread, treeBase * 0.6, lx, treeBase);
        ctx.closePath();
        const alphas = [0.6, 0.4, 0.25, 0.15];
        const greens = ['#0a1f0e', '#0d2812', '#122e16', '#183a1e'];
        ctx.fillStyle = greens[layer];
        ctx.globalAlpha = alphas[layer];
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // --- SHOOTING STAR (occasional extra animation) ---
      if (!shootingStar && Math.random() < 0.002) spawnShootingStar();
      if (shootingStar) {
        const ss = shootingStar;
        ss.trail.unshift({ x: ss.x, y: ss.y });
        if (ss.trail.length > 20) ss.trail.pop();
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life -= 0.015;
        // Draw trail
        ss.trail.forEach((pt, i) => {
          const a = (1 - i / ss.trail.length) * ss.life * 0.6;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2 - i * 0.08, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 250, 200, ${a})`;
          ctx.fill();
        });
        if (ss.life <= 0 || ss.x > W || ss.y > skyLine) shootingStar = null;
      }

      // --- FIREFLIES near village (warm particles, extra animation) ---
      fireflies.forEach(ff => {
        ff.phase += ff.speed;
        ff.x += Math.sin(ff.phase * 3) * ff.drift;
        const a = 0.2 + Math.sin(ff.phase) * 0.2;
        if (a > 0.05) {
          ctx.beginPath();
          ctx.arc(ff.x, ff.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 210, 100, ${a})`;
          ctx.fill();
          // Tiny glow
          ctx.beginPath();
          ctx.arc(ff.x, ff.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 210, 100, ${a * 0.15})`;
          ctx.fill();
        }
      });

      this.animId = requestAnimationFrame(animate);
    };
    animate();
  }

  // Ukiyo-e — gentle falling cherry blossoms
  initUkiyoE() {
    const petals = Array.from({ length: 30 }, () => this.newPetal());
    const animate = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      petals.forEach((p, i) => {
        p.y += p.vy;
        p.x += Math.sin(p.sway) * 0.5;
        p.sway += 0.01;
        p.rot += p.rotSpeed;
        if (p.y > this.canvas.height + 20) Object.assign(petals[i], this.newPetal());
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rot);
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(193, 18, 31, ${p.alpha})`;
        this.ctx.fill();
        this.ctx.restore();
      });
      this.animId = requestAnimationFrame(animate);
    };
    animate();
  }

  newPetal() {
    return {
      x: Math.random() * this.canvas.width,
      y: -20 - Math.random() * 100,
      r: Math.random() * 5 + 3,
      vy: Math.random() * 0.8 + 0.3,
      sway: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      alpha: Math.random() * 0.2 + 0.1
    };
  }

  // Art Deco — rotating gold geometric lines
  initArtDeco() {
    let angle = 0;
    const animate = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
      angle += 0.002;
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 / 12) * i + angle;
        const len = Math.min(cx, cy) * 0.9;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        this.ctx.strokeStyle = `rgba(212, 175, 55, ${0.06 + Math.sin(angle * 2 + i) * 0.03})`;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
      // concentric circles
      for (let r = 60; r < Math.max(cx, cy); r += 80) {
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(212, 175, 55, 0.04)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
      this.animId = requestAnimationFrame(animate);
    };
    animate();
  }

  // Bauhaus — floating geometric shapes
  initBauhaus() {
    const shapes = Array.from({ length: 15 }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 30 + 15,
      type: ['circle', 'square', 'triangle'][Math.floor(Math.random() * 3)],
      color: ['rgba(230,57,70,0.12)', 'rgba(69,123,157,0.12)', 'rgba(244,162,97,0.12)'][Math.floor(Math.random() * 3)],
      rot: Math.random() * Math.PI
    }));
    const animate = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      shapes.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.rot += 0.003;
        if (s.x < -50 || s.x > this.canvas.width + 50) s.vx *= -1;
        if (s.y < -50 || s.y > this.canvas.height + 50) s.vy *= -1;
        this.ctx.save();
        this.ctx.translate(s.x, s.y);
        this.ctx.rotate(s.rot);
        this.ctx.fillStyle = s.color;
        if (s.type === 'circle') {
          this.ctx.beginPath(); this.ctx.arc(0, 0, s.size, 0, Math.PI * 2); this.ctx.fill();
        } else if (s.type === 'square') {
          this.ctx.fillRect(-s.size, -s.size, s.size * 2, s.size * 2);
        } else {
          this.ctx.beginPath();
          this.ctx.moveTo(0, -s.size); this.ctx.lineTo(s.size, s.size); this.ctx.lineTo(-s.size, s.size);
          this.ctx.closePath(); this.ctx.fill();
        }
        this.ctx.restore();
      });
      this.animId = requestAnimationFrame(animate);
    };
    animate();
  }

  // Impressionist — soft light particles like dappled water
  initImpressionist() {
    const dots = Array.from({ length: 60 }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      r: Math.random() * 20 + 10,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.01 + 0.003,
      color: ['rgba(139,92,246,', 'rgba(244,114,182,', 'rgba(181,228,140,', 'rgba(162,210,255,'][Math.floor(Math.random() * 4)]
    }));
    const animate = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      dots.forEach(d => {
        d.phase += d.speed;
        const alpha = 0.04 + Math.sin(d.phase) * 0.03;
        this.ctx.beginPath();
        this.ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        this.ctx.fillStyle = d.color + alpha + ')';
        this.ctx.fill();
      });
      this.animId = requestAnimationFrame(animate);
    };
    animate();
  }

  // Cyberpunk — neon grid + rain
  initCyberpunk() {
    const drops = Array.from({ length: 50 }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      len: Math.random() * 15 + 5,
      speed: Math.random() * 3 + 1,
      alpha: Math.random() * 0.3 + 0.1
    }));
    const animate = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // Grid
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.03)';
      this.ctx.lineWidth = 1;
      for (let x = 0; x < this.canvas.width; x += 60) {
        this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke();
      }
      for (let y = 0; y < this.canvas.height; y += 60) {
        this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); this.ctx.stroke();
      }
      // Rain drops
      drops.forEach(d => {
        d.y += d.speed;
        if (d.y > this.canvas.height) { d.y = -d.len; d.x = Math.random() * this.canvas.width; }
        this.ctx.beginPath();
        this.ctx.moveTo(d.x, d.y);
        this.ctx.lineTo(d.x, d.y + d.len);
        this.ctx.strokeStyle = `rgba(0, 240, 255, ${d.alpha})`;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      });
      this.animId = requestAnimationFrame(animate);
    };
    animate();
  }
}

// ============================
//  POMODORO TIMER
// ============================
class PomodoroTimer {
  constructor(store) {
    this.store = store;
    this.focusDuration = 25 * 60;
    this.breakDuration = 5 * 60;
    this.isBreak = false;
    this.remaining = this.focusDuration;
    this.isRunning = false;
    this.interval = null;
  }

  start() {
    if (this.isRunning) { this.pause(); return; }
    this.isRunning = true;
    document.getElementById('pomodoro-start').textContent = 'Pause';
    this.interval = setInterval(() => this.tick(), 1000);
  }

  pause() {
    this.isRunning = false;
    clearInterval(this.interval);
    document.getElementById('pomodoro-start').textContent = 'Resume';
  }

  reset() {
    this.pause();
    this.isBreak = false;
    this.remaining = this.focusDuration;
    document.getElementById('pomodoro-start').textContent = 'Start';
    this.updateDisplay();
  }

  tick() {
    this.remaining--;
    if (this.remaining <= 0) {
      clearInterval(this.interval);
      this.isRunning = false;
      if (!this.isBreak) {
        this.store.state.pomodoroSessions++;
        this.store.save();
        this.isBreak = true;
        this.remaining = this.breakDuration;
        document.getElementById('pomodoro-label').textContent = 'Break Time';
      } else {
        this.isBreak = false;
        this.remaining = this.focusDuration;
        document.getElementById('pomodoro-label').textContent = 'Focus Time';
      }
      document.getElementById('pomodoro-start').textContent = 'Start';
      this.playSound();
    }
    this.updateDisplay();
  }

  updateDisplay() {
    const min = Math.floor(this.remaining / 60).toString().padStart(2, '0');
    const sec = (this.remaining % 60).toString().padStart(2, '0');
    document.getElementById('pomodoro-time').textContent = `${min}:${sec}`;
    document.getElementById('pomodoro-sessions-text').textContent = `Sessions completed: ${this.store.state.pomodoroSessions}`;
    // Ring
    const total = this.isBreak ? this.breakDuration : this.focusDuration;
    const pct = this.remaining / total;
    const circ = 565.49;
    document.getElementById('pomodoro-ring-fill').setAttribute('stroke-dashoffset', circ * pct);
    document.getElementById('pomodoro-label').textContent = this.isBreak ? 'Break Time' : 'Focus Time';
  }

  playSound() {
    try {
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.15;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
      osc.stop(ac.currentTime + 0.5);
    } catch { }
  }
}

// ============================
//  STATISTICS
// ============================
class Statistics {
  constructor(store) {
    this.store = store;
  }

  render() {
    const p = this.store.getProgress();
    document.getElementById('stat-total').textContent = p.total;
    document.getElementById('stat-completed').textContent = p.done;
    document.getElementById('stat-streak').textContent = this.store.state.streak.count;
    document.getElementById('stat-rate').textContent = p.pct + '%';
    this.drawChart();
  }

  drawChart() {
    const canvas = document.getElementById('stats-chart');
    const ctx = canvas.getContext('2d');
    const data = this.store.getWeeklyStats();
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(1, ...data.map(d => Math.max(d.added, d.completed)));
    const barW = W / 7 * 0.35;
    const gap = W / 7;
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent-primary').trim();
    const secondary = style.getPropertyValue('--accent-secondary').trim();
    const textCol = style.getPropertyValue('--text-secondary').trim();

    data.forEach((d, i) => {
      const x = i * gap + gap / 2;
      // Added bars
      const h1 = (d.added / maxVal) * (H - 40);
      ctx.fillStyle = secondary + '66';
      ctx.beginPath();
      ctx.roundRect(x - barW - 2, H - 30 - h1, barW, h1, 3);
      ctx.fill();
      // Completed bars
      const h2 = (d.completed / maxVal) * (H - 40);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(x + 2, H - 30 - h2, barW, h2, 3);
      ctx.fill();
      // Label
      ctx.fillStyle = textCol;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x, H - 8);
    });
  }
}

// ============================
//  MAIN APP
// ============================
class App {
  constructor() {
    this.store = new Store();
    this.themeManager = new ThemeManager();
    this.pomodoro = new PomodoroTimer(this.store);
    this.stats = new Statistics(this.store);
    this.currentFilter = 'all';
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.editingTaskId = null;
    this.modalSubtasks = [];

    this.quotes = [
      '"Every artist was first an amateur." — Ralph Waldo Emerson',
      '"Art is not what you see, but what you make others see." — Edgar Degas',
      '"Creativity takes courage." — Henri Matisse',
      '"The chief enemy of creativity is good sense." — Pablo Picasso',
      '"Have no fear of perfection — you\'ll never reach it." — Salvador Dalí',
      '"Art washes away from the soul the dust of everyday life." — Pablo Picasso',
      '"The purpose of art is washing the dust of daily life off our souls." — Pablo Picasso',
      '"Color is my daylong obsession, joy, and torment." — Claude Monet',
    ];

    this.init();
  }

  init() {
    this.themeManager.setTheme(this.store.state.theme);
    this.bindEvents();
    this.render();
    this.pomodoro.updateDisplay();
  }

  bindEvents() {
    // Quick add
    document.getElementById('quick-add-btn').addEventListener('click', () => this.quickAdd());
    document.getElementById('quick-add-input').addEventListener('keydown', e => { if (e.key === 'Enter') this.quickAdd(); });

    // Filters
    document.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderTasks();
      });
    });

    // Search
    document.getElementById('search-input').addEventListener('input', e => {
      this.searchQuery = e.target.value;
      this.renderTasks();
    });

    // Theme modal
    document.getElementById('theme-btn').addEventListener('click', () => this.openModal('theme-modal'));
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        this.store.state.theme = card.dataset.theme;
        this.store.save();
        this.themeManager.setTheme(card.dataset.theme);
      });
    });

    // Pomodoro
    document.getElementById('pomodoro-btn').addEventListener('click', () => this.openModal('pomodoro-modal'));
    document.getElementById('pomodoro-start').addEventListener('click', () => this.pomodoro.start());
    document.getElementById('pomodoro-reset').addEventListener('click', () => this.pomodoro.reset());

    // Stats
    document.getElementById('stats-btn').addEventListener('click', () => { this.stats.render(); this.openModal('stats-modal'); });

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.close));
    });

    // Click overlay to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) this.closeModal(overlay.id);
      });
    });

    // Task modal save
    document.getElementById('modal-save-btn').addEventListener('click', () => this.saveTask());
    document.getElementById('modal-delete-btn').addEventListener('click', () => this.deleteEditingTask());

    // Modal priority buttons
    document.querySelectorAll('#priority-buttons .priority-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#priority-buttons .priority-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Add category
    document.getElementById('add-category-btn').addEventListener('click', () => this.addNewCategory());
    document.getElementById('new-category-input').addEventListener('keydown', e => { if (e.key === 'Enter') this.addNewCategory(); });

    // Add subtask
    document.getElementById('add-subtask-btn').addEventListener('click', () => this.addModalSubtask());
    document.getElementById('subtask-input').addEventListener('keydown', e => { if (e.key === 'Enter') this.addModalSubtask(); });

    // Task list delegation — clicks
    document.getElementById('task-list').addEventListener('click', e => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      const id = card.dataset.id;
      if (e.target.closest('.task-checkbox')) { this.toggleTask(id, card); return; }
      if (e.target.closest('.task-action-btn.edit')) { this.openEditTask(id); return; }
      if (e.target.closest('.task-action-btn.delete')) { this.deleteTaskAnim(id, card); return; }
    });

    // Drag & drop
    const list = document.getElementById('task-list');
    list.addEventListener('dragstart', e => {
      const card = e.target.closest('.task-card');
      if (card) { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.dataset.id); }
    });
    list.addEventListener('dragend', e => {
      const card = e.target.closest('.task-card');
      if (card) card.classList.remove('dragging');
      list.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
    });
    list.addEventListener('dragover', e => {
      e.preventDefault();
      const card = e.target.closest('.task-card');
      if (card && !card.classList.contains('dragging')) card.classList.add('drag-over');
    });
    list.addEventListener('dragleave', e => {
      const card = e.target.closest('.task-card');
      if (card) card.classList.remove('drag-over');
    });
    list.addEventListener('drop', e => {
      e.preventDefault();
      const targetCard = e.target.closest('.task-card');
      list.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
      if (!targetCard) return;
      const draggedId = e.dataTransfer.getData('text/plain');
      const tasks = this.store.state.tasks;
      const fromIdx = tasks.findIndex(t => t.id === draggedId);
      const toIdx = tasks.findIndex(t => t.id === targetCard.dataset.id);
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        this.store.reorder(fromIdx, toIdx);
        this.renderTasks();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => this.closeModal(m.id));
      }
      if (e.key === '/' && !e.target.closest('input, textarea, select')) {
        e.preventDefault();
        document.getElementById('search-input').focus();
      }
    });

    // Category chips delegation
    document.getElementById('category-chips').addEventListener('click', e => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this.currentCategory = chip.dataset.category;
      this.renderTasks();
    });
  }

  // ---- Rendering ----
  render() {
    this.renderTasks();
    this.renderProgress();
    this.renderCategories();
    this.renderStreak();
  }

  renderTasks() {
    const tasks = this.store.getTasks(this.currentFilter, this.currentCategory, this.searchQuery);
    const list = document.getElementById('task-list');
    const empty = document.getElementById('empty-state');

    if (tasks.length === 0) {
      list.innerHTML = '';
      empty.classList.add('visible');
      document.getElementById('empty-quote').textContent = this.quotes[Math.floor(Math.random() * this.quotes.length)];
      return;
    }
    empty.classList.remove('visible');

    list.innerHTML = tasks.map((t, i) => {
      const cat = this.store.state.categories.find(c => c.id === t.category);
      const dueClass = this.getDueClass(t.dueDate);
      const dueText = this.formatDue(t.dueDate);
      const subDone = t.subtasks ? t.subtasks.filter(s => s.done).length : 0;
      const subTotal = t.subtasks ? t.subtasks.length : 0;
      const subPct = subTotal ? (subDone / subTotal * 100) : 0;

      return `<div class="task-card ${t.completed ? 'completed' : ''}" data-id="${t.id}" draggable="true" style="animation-delay:${i * 0.05}s">
        <div class="priority-dot ${t.priority || 'medium'}"></div>
        <button class="task-checkbox ${t.completed ? 'checked' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <div class="task-info">
          <div class="task-title">${this.escHtml(t.title)}</div>
          <div class="task-meta">
            ${cat ? `<span class="task-category-tag" style="background:${cat.color}22;color:${cat.color}">${cat.name}</span>` : ''}
            ${dueText ? `<span class="task-due ${dueClass}">${dueText}</span>` : ''}
          </div>
          ${subTotal > 0 ? `<div class="subtask-progress">
            <div class="progress-bar"><div class="progress-fill" style="width:${subPct}%"></div></div>
            <span class="subtask-count">${subDone}/${subTotal}</span>
          </div>` : ''}
        </div>
        <div class="task-actions">
          <button class="task-action-btn edit" title="Edit">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="task-action-btn delete" title="Delete">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
  }

  renderProgress() {
    const p = this.store.getProgress();
    const offset = 113.1 - (113.1 * p.pct / 100);
    document.getElementById('progress-ring-fill').setAttribute('stroke-dashoffset', offset);
    document.getElementById('progress-text').textContent = p.pct + '%';
  }

  renderCategories() {
    const cats = this.store.state.categories;
    const container = document.getElementById('category-chips');
    container.innerHTML = `<button class="category-chip ${this.currentCategory === 'all' ? 'active' : ''}" data-category="all">All</button>` +
      cats.map(c => `<button class="category-chip ${this.currentCategory === c.id ? 'active' : ''}" data-category="${c.id}" style="border-color:${c.color}44">${c.name}</button>`).join('');

    // Update selects
    const optionsHtml = '<option value="">No category</option>' + cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('quick-category').innerHTML = optionsHtml;
    document.getElementById('modal-category').innerHTML = optionsHtml;
  }

  renderStreak() {
    const streak = this.store.state.streak;
    const banner = document.getElementById('streak-banner');
    if (streak.count > 0) {
      banner.style.display = 'block';
      document.getElementById('streak-text').textContent = `${streak.count} day streak! Keep going!`;
    } else {
      banner.style.display = 'none';
    }
  }

  // ---- Task Actions ----
  quickAdd() {
    const input = document.getElementById('quick-add-input');
    const title = input.value.trim();
    if (!title) return;

    this.store.addTask({
      title,
      priority: document.getElementById('quick-priority').value,
      category: document.getElementById('quick-category').value,
      dueDate: document.getElementById('quick-due').value || '',
      description: '',
      subtasks: []
    });

    input.value = '';
    document.getElementById('quick-due').value = '';
    this.playTickSound();
    this.render();
  }

  toggleTask(id, card) {
    const task = this.store.toggleTask(id);
    if (task && task.completed) {
      card.style.animation = 'none';
      card.offsetHeight; // reflow
      this.createConfetti(card);
      this.playTickSound();
    }
    setTimeout(() => this.render(), 300);
  }

  deleteTaskAnim(id, card) {
    card.style.animation = 'taskSlideOut 0.3s ease forwards';
    setTimeout(() => { this.store.deleteTask(id); this.render(); }, 300);
  }

  openEditTask(id) {
    const task = this.store.state.tasks.find(t => t.id === id);
    if (!task) return;
    this.editingTaskId = id;
    document.getElementById('modal-title').textContent = 'Edit Task';
    document.getElementById('modal-task-title').value = task.title;
    document.getElementById('modal-task-desc').value = task.description || '';
    document.getElementById('modal-due-date').value = task.dueDate || '';
    document.getElementById('modal-category').value = task.category || '';
    document.getElementById('modal-delete-btn').style.display = 'block';

    // Priority
    document.querySelectorAll('#priority-buttons .priority-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.priority === (task.priority || 'medium'));
    });

    // Subtasks
    this.modalSubtasks = task.subtasks ? task.subtasks.map(s => ({ ...s })) : [];
    this.renderModalSubtasks();
    this.openModal('task-modal');
  }

  saveTask() {
    const title = document.getElementById('modal-task-title').value.trim();
    if (!title) return;

    const priority = document.querySelector('#priority-buttons .priority-btn.active')?.dataset.priority || 'medium';
    const data = {
      title,
      description: document.getElementById('modal-task-desc').value.trim(),
      priority,
      category: document.getElementById('modal-category').value,
      dueDate: document.getElementById('modal-due-date').value,
      subtasks: this.modalSubtasks
    };

    if (this.editingTaskId) {
      this.store.updateTask(this.editingTaskId, data);
    } else {
      this.store.addTask(data);
    }

    this.closeModal('task-modal');
    this.render();
  }

  deleteEditingTask() {
    if (this.editingTaskId) {
      this.store.deleteTask(this.editingTaskId);
      this.closeModal('task-modal');
      this.render();
    }
  }

  // ---- Subtasks in modal ----
  addModalSubtask() {
    const input = document.getElementById('subtask-input');
    const text = input.value.trim();
    if (!text) return;
    this.modalSubtasks.push({ text, done: false });
    input.value = '';
    this.renderModalSubtasks();
  }

  renderModalSubtasks() {
    const container = document.getElementById('modal-subtasks');
    container.innerHTML = this.modalSubtasks.map((s, i) => `
      <div class="subtask-item">
        <input type="checkbox" ${s.done ? 'checked' : ''} data-idx="${i}">
        <span class="${s.done ? 'done' : ''}">${this.escHtml(s.text)}</span>
        <button class="delete-subtask" data-idx="${i}">&times;</button>
      </div>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', e => {
        this.modalSubtasks[parseInt(e.target.dataset.idx)].done = e.target.checked;
        this.renderModalSubtasks();
      });
    });
    container.querySelectorAll('.delete-subtask').forEach(btn => {
      btn.addEventListener('click', e => {
        this.modalSubtasks.splice(parseInt(e.target.dataset.idx), 1);
        this.renderModalSubtasks();
      });
    });
  }

  // ---- Category ----
  addNewCategory() {
    const input = document.getElementById('new-category-input');
    const name = input.value.trim();
    if (!name) return;
    this.store.addCategory(name);
    input.value = '';
    this.renderCategories();
  }

  // ---- Modals ----
  openModal(id) {
    if (id === 'task-modal' && !this.editingTaskId) {
      document.getElementById('modal-title').textContent = 'New Task';
      document.getElementById('modal-task-title').value = '';
      document.getElementById('modal-task-desc').value = '';
      document.getElementById('modal-due-date').value = '';
      document.getElementById('modal-category').value = '';
      document.getElementById('modal-delete-btn').style.display = 'none';
      document.querySelectorAll('#priority-buttons .priority-btn').forEach(b => b.classList.toggle('active', b.dataset.priority === 'medium'));
      this.modalSubtasks = [];
      this.renderModalSubtasks();
    }
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
    document.body.style.overflow = '';
    if (id === 'task-modal') this.editingTaskId = null;
  }

  // ---- Helpers ----
  getDueClass(date) {
    if (!date) return '';
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) return 'overdue';
    if (date === today) return 'today';
    return '';
  }

  formatDue(date) {
    if (!date) return '';
    const today = new Date().toISOString().slice(0, 10);
    if (date === today) return '📅 Today';
    const d = new Date(date + 'T00:00:00');
    const diff = Math.ceil((d - new Date(today + 'T00:00:00')) / 86400000);
    if (diff === 1) return '📅 Tomorrow';
    if (diff === -1) return '📅 Yesterday';
    if (diff < -1) return `📅 ${Math.abs(diff)}d overdue`;
    return '📅 ' + d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  createConfetti(card) {
    const rect = card.getBoundingClientRect();
    const colors = ['#f0c040', '#5b86e5', '#e63946', '#2a9d8f', '#8b5cf6', '#ff006e'];
    for (let i = 0; i < 8; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        position:fixed; width:6px; height:6px; border-radius:50%;
        background:${colors[i % colors.length]};
        left:${rect.left + rect.width * 0.3 + Math.random() * rect.width * 0.4}px;
        top:${rect.top + rect.height / 2}px;
        z-index:1000; pointer-events:none;
        animation: confetti 0.7s ease-out forwards;
      `;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 700);
    }
  }

  playTickSound() {
    try {
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.frequency.value = 1200;
      osc.type = 'sine';
      gain.gain.value = 0.08;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
      osc.stop(ac.currentTime + 0.12);
    } catch { }
  }
}

// ===== LAUNCH =====
document.addEventListener('DOMContentLoaded', () => new App());
