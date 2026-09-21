/**
 * Archivo Principal
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // Views & Layout
    const loginOverlay = document.getElementById('login-overlay');
    const homeView = document.getElementById('home-view');
    const appContainer = document.getElementById('app-container');
    const appSidebar = document.getElementById('app-sidebar');
    
    // Forms/Buttons
    const loginForm = document.getElementById('login-form');
    const logoutBtns = document.querySelectorAll('.logout-btn');
    const btnBackHome = document.getElementById('btn-back-home');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');

    // State
    let pollingInterval = null;
    let currentPlantMeters = [];
    let currentMeterInfo = null;
    let currentActiveView = 'unifilar'; 
    let activeRanges = { voltage: 'day', current: 'day', power: 'day', energy: 'day', harmonics: 'day' };

    // 1. Init
    if (AuthService.isAuthenticated()) {
        showHome();
    } else {
        loginOverlay.classList.add('active');
        homeView.classList.add('hidden');
        appContainer.classList.add('hidden');
    }

    // 2. Auth Listeners
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const role = document.querySelector('input[name="role"]:checked').value;
        
        const btn = loginForm.querySelector('button');
        btn.textContent = 'Verificando...'; btn.disabled = true;

        try {
            await AuthService.login(user, pass, role);
            showHome();
        } catch (err) { alert(err.message); } 
        finally { btn.textContent = 'Iniciar Sesión'; btn.disabled = false; }
    });

    logoutBtns.forEach(btn => btn.addEventListener('click', () => {
        if(pollingInterval) clearInterval(pollingInterval);
        AuthService.logout();
    }));

    // Toggle Sidebar
    toggleSidebarBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('collapsed');
    });

    // 3. Navigation Home <-> Dashboard
    async function showHome() {
        loginOverlay.classList.remove('active');
        appContainer.classList.add('hidden');
        homeView.classList.remove('hidden');

        if(pollingInterval) clearInterval(pollingInterval);

        const session = AuthService.getSession();
        document.querySelectorAll('.display-username').forEach(el => el.textContent = session.user);
        document.querySelectorAll('.display-role').forEach(el => el.textContent = session.role);

        UI.init();
        
        const installations = await DataService.getInstallations();
        UI.renderHomeGrid(installations, (inst) => {
            showDashboard(inst);
        });
    }

    btnBackHome.addEventListener('click', () => {
        showHome();
    });

    // 4. Dashboard Logic
    function showDashboard(installation) {
        homeView.classList.add('hidden');
        appContainer.classList.remove('hidden');

        document.getElementById('sidebar-inst-name').textContent = installation.name;
        currentPlantMeters = installation.meters;

        // Limpiar estado
        currentMeterInfo = null;
        if(pollingInterval) clearInterval(pollingInterval);

        UI.initGauges();
        
        UI.renderTimeTabs((targetType, range) => {
            activeRanges[targetType] = range;
            if(currentActiveView === targetType && currentMeterInfo) {
                loadChartForView(targetType);
            }
        });

        UI.setupMeasurementsMenu((viewId) => {
            currentActiveView = viewId;
            if(viewId !== 'unifilar' && viewId !== 'instant' && currentMeterInfo) {
                loadChartForView(viewId);
            }
        });

        // Configurar Dropdown de Medidores en el Header
        UI.populateMeterDropdown(installation.meters, (meterId, meterInfo) => {
            onMeterSelected(meterId, meterInfo);
        });

        const session = AuthService.getSession();
        const role = session ? session.role : 'Tecnico';

        // Adaptar textos y permisos según rol
        if (role === 'Cliente') {
            document.getElementById('btn-edit-unifilar').style.display = 'none';
            document.querySelector('#view-unifilar .view-title').textContent = 'Esquema Eléctrico de Planta';
            document.querySelector('#view-unifilar .view-desc').textContent = 'Monitoreo en tiempo real de la red eléctrica. Haz clic en un medidor para acceder a sus analíticas detalladas.';
        } else {
            document.getElementById('btn-edit-unifilar').style.display = '';
            document.querySelector('#view-unifilar .view-title').textContent = 'Diseñador Unifilar';
            document.querySelector('#view-unifilar .view-desc').textContent = 'Selecciona una herramienta y haz clic en la cuadrícula para diseñar la planta. Haz clic en un medidor para ver sus gráficas.';
        }

        // Iniciar Unifilar Builder pasándole el ID de la instalación y el rol
        Unifilar.init('unifilar-workspace', installation.meters, installation.id, role);
        
        // Cuando se hace clic en un medidor dentro del unifilar
        Unifilar.onMeterClicked = (meterId) => {
            const meterInfo = installation.meters.find(m => m.id === meterId);
            if (meterInfo) {
                // Actualizar UI Dropdown para reflejar la selección
                UI.setDropdownValue(meterId, meterInfo.name);
                onMeterSelected(meterId, meterInfo);
                
                // Cambiar vista a Tiempo Real
                document.querySelector('#measurements-menu .menu-item[data-view="instant"]').click();
            }
        };

        // Forzar vista inicial a Unifilar
        document.getElementById('btn-show-unifilar').click();
    }

    function onMeterSelected(meterId, meterInfo) {
        currentMeterInfo = meterInfo;
        
        if(pollingInterval) clearInterval(pollingInterval);

        UI.configureGaugesForMeter(meterInfo);

        const fetchInstantData = async () => {
            try {
                // Actualiza gráficas del medidor seleccionado
                const data = await DataService.getCurrentReadings(meterId);
                UI.updateGauges(data);
                
                // Actualiza el estado visual de TODOS los medidores en el unifilar
                for(let m of installation.meters) {
                    const mData = m.id === meterId ? data : await DataService.getCurrentReadings(m.id);
                    Unifilar.updateMeterStatus(m.id, mData);
                }
            } catch (err) { console.error(err); }
        };

        fetchInstantData();
        pollingInterval = setInterval(fetchInstantData, 2000);

        if(currentActiveView !== 'instant' && currentActiveView !== 'unifilar') {
            loadChartForView(currentActiveView);
        }
    }

    async function loadChartForView(viewType) {
        if(!currentMeterInfo) return;
        const range = activeRanges[viewType];
        
        try {
            const histData = await DataService.getHistoricalData(currentMeterInfo.id, range, viewType);
            UI.renderChart(`chart-${viewType}`, histData, viewType);
        } catch (err) {
            console.error("Error cargando gráfica", err);
        }
    }
});
