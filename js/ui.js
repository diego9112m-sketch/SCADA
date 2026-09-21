/**
 * Módulo de UI (Gestión de DOM, Gauges y Charts)
 */

const UI = {
    gauges: {},
    charts: {},

    init() {
        this.startClock();
    },

    startClock() {
        const timeDisplay = document.getElementById('system-time');
        const homeTime = document.getElementById('home-time');
        setInterval(() => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('es-ES', { hour12: false });
            if (timeDisplay) timeDisplay.textContent = timeStr;
            if (homeTime) homeTime.textContent = timeStr;
        }, 1000);
    },

    renderHomeGrid(installations, onSelectInstallation) {
        const grid = document.getElementById('installations-grid');
        grid.innerHTML = '';
        installations.forEach(inst => {
            const card = document.createElement('div');
            card.className = 'inst-card card-shadow';
            card.innerHTML = `
                <div class="card-icon">⚡</div>
                <div class="card-info">
                    <h3 class="card-title">${inst.name}</h3>
                    <p class="card-meta">Nivel de Tensión: ${inst.level}</p>
                    <p class="card-meta">${inst.meters.length} medidores asociados</p>
                </div>
            `;
            card.onclick = () => onSelectInstallation(inst);
            grid.appendChild(card);
        });
    },

    // Llena el Dropdown de Medidores en el Topbar
    populateMeterDropdown(meters, onSelectMeter) {
        const select = document.getElementById('meter-dropdown');
        select.innerHTML = '<option value="">Seleccione Medidor...</option>';
        
        meters.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            select.appendChild(opt);
        });

        // Evento change del dropdown
        select.onchange = (e) => {
            const val = e.target.value;
            if(val) {
                const meter = meters.find(m => m.id === val);
                onSelectMeter(meter.id, meter);
            }
        };
    },

    // Establece el valor del dropdown programáticamente (ej: al clicar desde el unifilar)
    setDropdownValue(meterId, meterName) {
        const select = document.getElementById('meter-dropdown');
        if(select) select.value = meterId;
    },

    setupMeasurementsMenu(onViewChange) {
        const menuItems = document.querySelectorAll('#measurements-menu .menu-item');
        const btnUnifilar = document.getElementById('btn-show-unifilar');

        menuItems.forEach(item => {
            item.onclick = () => {
                menuItems.forEach(el => el.classList.remove('active'));
                btnUnifilar.classList.remove('active');
                item.classList.add('active');
                
                const viewId = item.dataset.view;
                this.switchDataView(viewId);
                onViewChange(viewId);
            };
        });

        btnUnifilar.onclick = () => {
            menuItems.forEach(el => el.classList.remove('active'));
            btnUnifilar.classList.add('active');
            this.switchDataView('unifilar');
            onViewChange('unifilar');
        };
    },

    switchDataView(viewId) {
        document.querySelectorAll('.data-view').forEach(v => v.classList.add('hidden'));
        const activeView = document.getElementById(`view-${viewId}`);
        if(activeView) activeView.classList.remove('hidden');
    },

    renderTimeTabs(onTimeChange) {
        const containers = document.querySelectorAll('.time-tabs');
        containers.forEach(container => {
            container.innerHTML = `
                <button class="tab-btn active" data-range="day">Día</button>
                <button class="tab-btn" data-range="week">Semana</button>
                <button class="tab-btn" data-range="month">Mes</button>
                <button class="tab-btn" data-range="year">Año</button>
            `;
            const targetType = container.dataset.target;
            const btns = container.querySelectorAll('.tab-btn');
            btns.forEach(btn => {
                btn.onclick = (e) => {
                    btns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    onTimeChange(targetType, e.target.dataset.range);
                };
            });
        });
    },

    // --- Gauges ---
    initGauges() {
        if(this.gauges.voltage) return; // Ya inicializados

        try {
            const commonOptions = {
                width: 220, height: 220, units: false, colorPlate: "transparent",
                colorMajorTicks: "#64748b", colorMinorTicks: "#94a3b8", colorTitle: "#1e293b",
                colorNumbers: "#64748b", colorNeedle: "rgba(239, 68, 68, 1)",
                colorNeedleEnd: "rgba(239, 68, 68, .9)", valueBox: true,
                colorValueBoxRect: "#f1f5f9", colorValueBoxRectEnd: "#f1f5f9",
                colorValueText: "#1e293b", animationRule: "bounce", animationDuration: 500,
                borders: false, borderShadowWidth: 0, needleType: "arrow",
                needleWidth: 3, needleCircleSize: 7, needleCircleOuter: true, needleCircleInner: false
            };

            this.gauges.voltage = new RadialGauge({ ...commonOptions, renderTo: 'gauge-voltage', title: "Voltaje", units: "V", minValue: 0, maxValue: 1000, colorValueText: "#0284c7" }).draw();
            this.gauges.current = new RadialGauge({ ...commonOptions, renderTo: 'gauge-current', title: "Corriente", units: "A", minValue: 0, maxValue: 600, colorValueText: "#f59e0b" }).draw();
            this.gauges.frequency = new RadialGauge({
                ...commonOptions, renderTo: 'gauge-frequency', title: "Frecuencia", units: "Hz",
                minValue: 57, maxValue: 63, majorTicks: ["57", "58", "59", "60", "61", "62", "63"], minorTicks: 10,
                highlights: [
                    { from: 57, to: 59.8, color: "rgba(239, 68, 68, 0.2)" },
                    { from: 59.8, to: 60.2, color: "rgba(16, 185, 129, 0.3)" },
                    { from: 60.2, to: 63, color: "rgba(239, 68, 68, 0.2)" }
                ], colorValueText: "#10b981"
            }).draw();
        } catch(e) {
            console.error("Error inicializando gauges:", e);
        }
    },

    configureGaugesForMeter(meter) {
        let vMax = meter.maxV;
        let vTicks = [];
        for(let i=0; i<=5; i++) vTicks.push((i*(vMax/5)).toString());
        this.gauges.voltage.update({
            maxValue: vMax, majorTicks: vTicks,
            highlights: [
                { from: meter.nominalV * 1.05, to: vMax, color: "rgba(239, 68, 68, 0.3)" },
                { from: meter.nominalV * 0.95, to: meter.nominalV * 1.05, color: "rgba(16, 185, 129, 0.2)" }
            ]
        });

        let iMax = meter.maxI;
        let iTicks = [];
        for(let i=0; i<=6; i++) iTicks.push((i*(iMax/6)).toFixed(0));
        this.gauges.current.update({
            maxValue: iMax, majorTicks: iTicks,
            highlights: [{ from: iMax * 0.85, to: iMax, color: "rgba(245, 158, 11, 0.3)" }]
        });
    },

    updateGauges(data) {
        this.gauges.voltage.value = data.voltage;
        this.gauges.current.value = data.current;
        this.gauges.frequency.value = data.frequency;
    },

    // --- Charts ---
    renderChart(canvasId, historicalData, type) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        Chart.defaults.color = '#64748b';
        Chart.defaults.font.family = "'Inter', sans-serif";

        const colors = ['#0284c7', '#f59e0b', '#10b981']; 
        const datasets = historicalData.datasets.map((ds, idx) => {
            const isBar = ds.type === 'bar';
            const baseColor = colors[idx % colors.length];
            return {
                ...ds, type: isBar ? 'bar' : 'line', borderColor: baseColor,
                backgroundColor: isBar ? baseColor : `${baseColor}20`, borderWidth: 2,
                tension: 0.4, fill: !isBar
            };
        });

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: { labels: historicalData.labels, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
                scales: { x: { grid: { color: '#f1f5f9' } }, y: { beginAtZero: type !== 'voltage' && type !== 'harmonics', grid: { color: '#f1f5f9' } } }
            }
        });
    }
};

window.UI = UI;
