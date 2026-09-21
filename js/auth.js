/**
 * Módulo de Autenticación
 */

const AuthService = {
    // Verifica si hay sesión activa
    isAuthenticated() {
        return localStorage.getItem('scada_session') !== null;
    },

    // Realiza el login mockeado
    async login(username, password, role) {
        // En un futuro, esto será un fetch a /api/auth/login
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (username.trim() !== '' && password.trim() !== '') {
                    const sessionData = {
                        user: username,
                        role: role,
                        token: 'mock-jwt-token-12345',
                        loginTime: new Date().getTime()
                    };
                    localStorage.setItem('scada_session', JSON.stringify(sessionData));
                    resolve(sessionData);
                } else {
                    reject(new Error('Credenciales inválidas'));
                }
            }, 800); // Simulando delay de red
        });
    },

    // Cierra sesión
    logout() {
        localStorage.removeItem('scada_session');
        window.location.reload();
    },

    // Obtiene datos de sesión
    getSession() {
        const data = localStorage.getItem('scada_session');
        return data ? JSON.parse(data) : null;
    }
};

window.AuthService = AuthService;
