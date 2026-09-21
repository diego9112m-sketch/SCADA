/**
 * Módulo para el Editor de Diagrama Unifilar
 */

const Unifilar = {
    currentTool: 'select',
    workspace: null,
    metersOfPlant: [],
    gridState: {}, // Estado usando coordenadas "x,y"
    onMeterClicked: null,
    
    isEditing: false,
    plantId: null,
    userRole: 'Tecnico',

    // Límites de la cuadrícula
    bounds: { minX: 0, maxX: 19, minY: 0, maxY: 14 },
    CELL_SIZE: 60,

    init(workspaceId, meters, plantId, userRole) {
        this.workspace = document.getElementById(workspaceId);
        this.metersOfPlant = meters;
        this.plantId = plantId;
        this.userRole = userRole || 'Tecnico';
        
        this.setupToolbar();
        
        const hasData = this.loadFromLocal();
        this.setEditMode(this.userRole !== 'Cliente' && !hasData);
    },

    setupToolbar() {
        const btns = document.querySelectorAll('.tool-btn');
        btns.forEach(btn => {
            btn.onclick = () => {
                if(!this.isEditing && btn.dataset.tool !== 'select') return;
                
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
            };
        });

        const btnEdit = document.getElementById('btn-edit-unifilar');
        const btnSave = document.getElementById('btn-save-unifilar');

        btnEdit.onclick = () => this.setEditMode(true);
        btnSave.onclick = () => {
            this.saveToLocal();
            this.setEditMode(false);
        };
    },

    setEditMode(editing) {
        this.isEditing = editing;
        const toolsGroup = document.getElementById('unifilar-tools');
        const btnEdit = document.getElementById('btn-edit-unifilar');
        const btnSave = document.getElementById('btn-save-unifilar');

        if(editing) {
            this.workspace.classList.remove('view-mode');
            toolsGroup.classList.remove('hidden');
            btnEdit.classList.add('hidden');
            btnSave.classList.remove('hidden');
            
            // Forzar herramienta interactuar al entrar a editar
            document.querySelector('.tool-btn[data-tool="select"]').click();
            
            // Expandir un poco el lienzo para permitir dibujo
            this.expandForEditing();
        } else {
            this.workspace.classList.add('view-mode');
            toolsGroup.classList.add('hidden');
            btnEdit.classList.remove('hidden');
            btnSave.classList.add('hidden');
            this.currentTool = 'select';
            
            // Recortar espacios vacíos (Auto-trim)
            this.trimBounds();
        }
    },

    expandForEditing() {
        // Asegurar que siempre hay margen para seguir dibujando
        this.bounds.minX -= 2;
        this.bounds.maxX += 2;
        this.bounds.minY -= 2;
        this.bounds.maxY += 2;
        this.renderGrid();
    },

    trimBounds() {
        let keys = Object.keys(this.gridState);
        if(keys.length === 0) {
            // Si está vacío, resetear a por defecto
            this.bounds = { minX: 0, maxX: 19, minY: 0, maxY: 14 };
            this.renderGrid();
            return;
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        keys.forEach(k => {
            const [x, y] = k.split(',').map(Number);
            if(x < minX) minX = x;
            if(x > maxX) maxX = x;
            if(y < minY) minY = y;
            if(y > maxY) maxY = y;
        });

        // Aplicar padding de 1 celda para que no quede pegado a los bordes visualmente
        this.bounds = { 
            minX: minX - 1, 
            maxX: maxX + 1, 
            minY: minY - 1, 
            maxY: maxY + 1 
        };
        this.renderGrid();
    },

    renderGrid() {
        this.workspace.innerHTML = '';
        
        const cols = this.bounds.maxX - this.bounds.minX + 1;
        const rows = this.bounds.maxY - this.bounds.minY + 1;

        this.workspace.style.gridTemplateColumns = `repeat(${cols}, ${this.CELL_SIZE}px)`;
        this.workspace.style.gridTemplateRows = `repeat(${rows}, ${this.CELL_SIZE}px)`;
        this.workspace.style.backgroundSize = `${this.CELL_SIZE}px ${this.CELL_SIZE}px`;

        for (let y = this.bounds.minY; y <= this.bounds.maxY; y++) {
            for (let x = this.bounds.minX; x <= this.bounds.maxX; x++) {
                const cell = document.createElement('div');
                cell.className = 'uf-cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                
                cell.onclick = (e) => this.handleCellClick(e, x, y, cell);
                
                this.workspace.appendChild(cell);

                const stateKey = `${x},${y}`;
                if(this.gridState[stateKey]) {
                    this.placeSymbol(x, y, cell, this.gridState[stateKey].type, this.gridState[stateKey].meterId, true, this.gridState[stateKey].rotation || 0);
                }
            }
        }
        
        this.updateConnections();
    },

    handleCellClick(e, x, y, cell) {
        if (!this.isEditing && this.currentTool !== 'select') return;

        const stateKey = `${x},${y}`;

        if (this.currentTool === 'select') {
            if (this.gridState[stateKey] && this.gridState[stateKey].type === 'meter') {
                if (this.onMeterClicked && this.gridState[stateKey].meterId) {
                    this.onMeterClicked(this.gridState[stateKey].meterId);
                }
            }
            return;
        }

        if (this.currentTool === 'erase') {
            cell.innerHTML = '';
            cell.classList.remove('interactive');
            delete this.gridState[stateKey];
            this.updateConnections();
            return;
        }

        if (this.currentTool === 'rotate') {
            if (this.gridState[stateKey]) {
                let currentRot = this.gridState[stateKey].rotation || 0;
                currentRot = (currentRot + 90) % 360;
                this.gridState[stateKey].rotation = currentRot;
                const container = cell.querySelector('.sym-container');
                if(container) {
                    // Mantener las clases de pines existentes
                    let classes = Array.from(container.classList).filter(c => !c.startsWith('rot-')).join(' ');
                    container.className = `${classes} rot-${currentRot}`;
                }
            }
            return;
        }

        this.placeSymbol(x, y, cell, this.currentTool);
    },

    placeSymbol(x, y, cell, tool, existingMeterId = null, fromRender = false, rotation = 0) {
        cell.innerHTML = ''; 
        cell.classList.remove('interactive');
        
        let containerClass = `sym-container rot-${rotation}`;
        if (['trafo', 'gen', 'meter'].includes(tool)) {
            containerClass += ' with-pins pin-top pin-bottom';
        } else if (tool === 'load') {
            containerClass += ' with-pins pin-top';
        }
        
        let container = document.createElement('div');
        container.className = containerClass;

        let sym = document.createElement('div');
        const stateKey = `${x},${y}`;
        
        switch(tool) {
            case 'bus': sym.className = 'sym-bus'; break;
            case 'trafo': 
                sym.className = 'sym-trafo'; 
                sym.innerHTML = '<div class="t-circ top"></div><div class="t-circ bottom"></div>';
                break;
            case 'gen': sym.className = 'sym-gen'; break;
            case 'load': sym.className = 'sym-load'; break;
            case 'line-v': sym.className = 'sym-line-v'; break;
            case 'line-h': sym.className = 'sym-line-h'; break;
            case 'corner': sym.className = 'sym-corner'; break;
            case 't-join': sym.className = 'sym-t-join'; break;
            case 'meter': 
                sym.className = 'sym-meter'; 
                cell.classList.add('interactive');
                
                let indConn = document.createElement('div');
                indConn.className = 'meter-indicator ind-conn';
                let indAlert = document.createElement('div');
                indAlert.className = 'meter-indicator ind-alert';
                
                sym.appendChild(indConn);
                sym.appendChild(indAlert);

                if(existingMeterId) {
                    this.finalizeMeterPlacement(x, y, cell, existingMeterId);
                } else if (!fromRender) {
                    this.promptLinkMeter(x, y, cell);
                }
                break;
        }

        container.appendChild(sym);
        cell.appendChild(container);
        
        if(!existingMeterId && tool !== 'meter') {
            this.gridState[stateKey] = { type: tool, rotation: rotation };
            if(!fromRender && this.isEditing) {
                this.checkAutoExpand(x, y);
                this.updateConnections();
            }
        }
    },

    updateConnections() {
        // Conectar automáticamente líneas verticales a barras infinitas (bus)
        for(let key in this.gridState) {
            const [xStr, yStr] = key.split(',');
            const x = parseInt(xStr), y = parseInt(yStr);
            const item = this.gridState[key];
            const cell = this.workspace.querySelector(`.uf-cell[data-x="${x}"][data-y="${y}"]`);
            if(!cell) continue;

            const container = cell.querySelector('.sym-container');
            if(!container) continue;

            if(item.type === 'bus') {
                container.classList.remove('with-pins', 'pin-top', 'pin-bottom');
                let hasTop = false;
                let hasBottom = false;

                const above = this.gridState[`${x},${y-1}`];
                if(above && ['line-v', 'trafo', 'gen', 'meter', 'load', 't-join', 'corner'].includes(above.type)) {
                    hasTop = true;
                }
                const below = this.gridState[`${x},${y+1}`];
                if(below && ['line-v', 'trafo', 'gen', 'meter', 'load', 't-join', 'corner'].includes(below.type)) {
                    hasBottom = true;
                }

                if(hasTop || hasBottom) container.classList.add('with-pins');
                if(hasTop) container.classList.add('pin-top');
                if(hasBottom) container.classList.add('pin-bottom');
            }
        }
    },

    promptLinkMeter(x, y, cell) {
        const modal = document.getElementById('link-meter-modal');
        const select = document.getElementById('modal-meter-select');
        const btnSave = document.getElementById('modal-btn-save');
        const btnCancel = document.getElementById('modal-btn-cancel');

        select.innerHTML = '<option value="">-- Selecciona --</option>';
        this.metersOfPlant.forEach(m => {
            select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        });

        modal.classList.add('active');

        btnSave.onclick = () => {
            const val = select.value;
            if (val) {
                this.finalizeMeterPlacement(x, y, cell, val);
                if(this.isEditing) this.checkAutoExpand(x, y);
            }
            modal.classList.remove('active');
        };

        btnCancel.onclick = () => {
            modal.classList.remove('active');
            const stateKey = `${x},${y}`;
            if (!this.gridState[stateKey] || !this.gridState[stateKey].meterId) {
                cell.innerHTML = '';
                cell.classList.remove('interactive');
                delete this.gridState[stateKey];
            }
        };
    },

    finalizeMeterPlacement(x, y, cell, meterId) {
        const meter = this.metersOfPlant.find(m => m.id === meterId);
        if(!meter) return;

        const stateKey = `${x},${y}`;
        this.gridState[stateKey] = { type: 'meter', meterId: meterId };
        
        let lbl = document.createElement('div');
        lbl.className = 'meter-label';
        lbl.textContent = meter.name;
        cell.appendChild(lbl);
    },

    checkAutoExpand(x, y) {
        let expanded = false;
        if(x <= this.bounds.minX + 1) { this.bounds.minX -= 2; expanded = true; }
        if(x >= this.bounds.maxX - 1) { this.bounds.maxX += 2; expanded = true; }
        if(y <= this.bounds.minY + 1) { this.bounds.minY -= 2; expanded = true; }
        if(y >= this.bounds.maxY - 1) { this.bounds.maxY += 2; expanded = true; }
        
        if(expanded) {
            this.renderGrid(); // Redibuja con los nuevos límites y vuelve a colocar los divs
        }
    },

    saveToLocal() {
        if(!this.plantId) return;
        localStorage.setItem(`unifilar_v2_${this.plantId}`, JSON.stringify({
            bounds: this.bounds,
            state: this.gridState
        }));
    },

    loadFromLocal() {
        if(!this.plantId) return false;
        const data = localStorage.getItem(`unifilar_v2_${this.plantId}`);
        if(data) {
            try {
                const parsed = JSON.parse(data);
                this.bounds = parsed.bounds;
                this.gridState = parsed.state;
                return Object.keys(this.gridState).length > 0;
            } catch(e) {
                console.error("Error al cargar datos del unifilar", e);
            }
        }
        return false;
    },

    updateMeterStatus(meterId, data) {
        for(let key in this.gridState) {
            if(this.gridState[key].type === 'meter' && this.gridState[key].meterId === meterId) {
                const [x, y] = key.split(',');
                const cell = this.workspace.querySelector(`.uf-cell[data-x="${x}"][data-y="${y}"]`);
                if(cell) {
                    const alertInd = cell.querySelector('.ind-alert');
                    const meterInfo = this.metersOfPlant.find(m => m.id === meterId);
                    
                    if(alertInd && meterInfo) {
                        const vLimit = meterInfo.nominalV * 1.05;
                        const iLimit = meterInfo.maxI * 0.95;
                        
                        if(data.voltage > vLimit || data.current > iLimit) {
                            alertInd.classList.add('alarm');
                        } else {
                            alertInd.classList.remove('alarm');
                        }
                    }
                }
            }
        }
    }
};

window.Unifilar = Unifilar;
