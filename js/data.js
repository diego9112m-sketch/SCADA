/**
 * Módulo de Datos (Simulación)
 */

const DB_MOCK = {
    installations: [
        {
            id: 'inst-1',
            name: 'Planta Norte',
            level: '13.8 kV',
            meters: [
                { id: 'm-01', name: 'Medidor General M-01', type: 'MV', nominalV: 13800, maxV: 16000, maxI: 600, nominalP: 6000 },
                { id: 'm-02', name: 'Alimentador Principal M-02', type: 'MV', nominalV: 13800, maxV: 16000, maxI: 400, nominalP: 4000 }
            ]
        },
        {
            id: 'inst-2',
            name: 'Subestación Sur',
            level: '480 V',
            meters: [
                { id: 'm-03', name: 'Tablero General T-01', type: 'LV', nominalV: 480, maxV: 600, maxI: 1000, nominalP: 400 },
                { id: 'm-04', name: 'Fuerza Motriz M-04', type: 'LV', nominalV: 480, maxV: 600, maxI: 800, nominalP: 300 }
            ]
        },
        {
            id: 'inst-3',
            name: 'Planta Este - Renovables',
            level: '34.5 kV',
            meters: [
                { id: 'm-05', name: 'Interconexión Red', type: 'HV', nominalV: 34500, maxV: 40000, maxI: 200, nominalP: 10000 }
            ]
        }
    ]
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const DataService = {
    async getInstallations() {
        await delay(300);
        return DB_MOCK.installations;
    },

    async getMeterInfo(meterId) {
        for (const inst of DB_MOCK.installations) {
            const meter = inst.meters.find(m => m.id === meterId);
            if (meter) return meter;
        }
        return null;
    },

    async getCurrentReadings(meterId) {
        const meter = await this.getMeterInfo(meterId);
        if (!meter) throw new Error("Meter not found");

        const vNoise = (Math.random() - 0.5) * 2 * (meter.nominalV * 0.02);
        const v = meter.nominalV + vNoise;

        if(!window._simI) window._simI = {};
        if(!window._simI[meterId]) window._simI[meterId] = meter.maxI * 0.5;
        
        let iNoise = (Math.random() - 0.5) * (meter.maxI * 0.05);
        window._simI[meterId] += iNoise;
        if(window._simI[meterId] < meter.maxI * 0.1) window._simI[meterId] = meter.maxI * 0.1;
        if(window._simI[meterId] > meter.maxI * 0.9) window._simI[meterId] = meter.maxI * 0.9;
        
        const fNoise = (Math.random() - 0.5) * 0.1;

        return {
            timestamp: new Date().toISOString(),
            voltage: parseFloat(v.toFixed(2)),
            current: parseFloat(window._simI[meterId].toFixed(2)),
            frequency: parseFloat((60 + fNoise).toFixed(3))
        };
    },

    // Obtiene datos para gráficas específicas según "type" (voltage, current, power, energy, harmonics)
    async getHistoricalData(meterId, range, type) {
        const meter = await this.getMeterInfo(meterId);
        if (!meter) throw new Error("Meter not found");
        await delay(400); 

        let dataPoints = 24;
        let timeLabels = [];
        const now = new Date();

        if (range === 'day') {
            dataPoints = 24;
            for(let i=dataPoints; i>=0; i--) {
                const t = new Date(now.getTime() - i*60*60*1000);
                timeLabels.push(`${t.getHours().toString().padStart(2,'0')}:00`);
            }
        } else if (range === 'week') {
            dataPoints = 7;
            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            for(let i=dataPoints-1; i>=0; i--) {
                const t = new Date(now.getTime() - i*24*60*60*1000);
                timeLabels.push(days[t.getDay()]);
            }
        } else if (range === 'month') {
            dataPoints = 30;
            for(let i=dataPoints-1; i>=0; i--) {
                const t = new Date(now.getTime() - i*24*60*60*1000);
                timeLabels.push(`${t.getDate()}/${t.getMonth()+1}`);
            }
        } else if (range === 'year') {
            dataPoints = 12;
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            for(let i=dataPoints-1; i>=0; i--) {
                let mIndex = now.getMonth() - i;
                if(mIndex < 0) mIndex += 12;
                timeLabels.push(months[mIndex]);
            }
        }

        const loadFactors = timeLabels.map(lbl => {
            if(range === 'day') {
                const h = parseInt(lbl.split(':')[0]);
                if(h >= 8 && h <= 18) return 0.8 + Math.random()*0.1;
                return 0.3 + Math.random()*0.1;
            }
            return 0.5 + (Math.random() * 0.4);
        });

        let datasets = [];

        if (type === 'voltage') {
            datasets.push({
                label: 'Voltaje Fase A',
                data: loadFactors.map(() => meter.nominalV * (1 + (Math.random() * 0.02 - 0.01)))
            });
            datasets.push({
                label: 'Voltaje Fase B',
                data: loadFactors.map(() => meter.nominalV * (1 + (Math.random() * 0.02 - 0.01)))
            });
            datasets.push({
                label: 'Voltaje Fase C',
                data: loadFactors.map(() => meter.nominalV * (1 + (Math.random() * 0.02 - 0.01)))
            });
        }
        else if (type === 'current') {
            datasets.push({
                label: 'Corriente Fase A',
                data: loadFactors.map(f => meter.maxI * f * (1 + Math.random()*0.05))
            });
            datasets.push({
                label: 'Corriente Fase B',
                data: loadFactors.map(f => meter.maxI * f * (1 + Math.random()*0.05))
            });
            datasets.push({
                label: 'Corriente Fase C',
                data: loadFactors.map(f => meter.maxI * f * (1 + Math.random()*0.05))
            });
        }
        else if (type === 'power') {
            const act = loadFactors.map(f => meter.nominalP * f);
            const react = act.map(p => p * (0.2 + Math.random()*0.1)); // FP ~0.95
            const app = act.map((p, i) => Math.sqrt(p*p + react[i]*react[i]));
            datasets.push({ label: 'Potencia Activa (kW)', data: act });
            datasets.push({ label: 'Potencia Reactiva (kVAR)', data: react });
            datasets.push({ label: 'Potencia Aparente (kVA)', data: app });
        }
        else if (type === 'energy') {
            let accu = 0;
            const energyData = loadFactors.map(f => {
                accu += meter.nominalP * f * (range === 'day' ? 1 : range === 'week' ? 24 : 24);
                return accu;
            });
            datasets.push({ label: 'Energía Acumulada (kWh)', data: energyData, type: 'bar' });
        }
        else if (type === 'harmonics') {
            datasets.push({ label: 'THDv (%)', data: loadFactors.map(() => 1.5 + Math.random()*1.5) }); // 1.5 a 3.0%
            datasets.push({ label: 'THDi (%)', data: loadFactors.map(f => (1-f)*10 + 2 + Math.random()*3) }); // A menor carga, mayor THDi
        }

        return { labels: timeLabels, datasets: datasets };
    }
};

window.DataService = DataService;
