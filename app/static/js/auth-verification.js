// auth-verification.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC7tvZe9NeHRhYuTVrQnkaSG7Nkj3ZS40U",
    authDomain: "nextstep-log.firebaseapp.com",
    projectId: "nextstep-log",
    storageBucket: "nextstep-log.firebasestorage.app",
    messagingSenderId: "9308831285",
    appId: "1:9308831285:web:d55ed6865804c50f743b7c",
    measurementId: "G-BPGP3TBN3N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Allowed origins
const ALLOWED_ORIGINS = [
    'https://nextstep-nexn.onrender.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

export default class AuthVerification {
    static isVerified = false;
    static user = null;
    static initializationTimeout = 30000; // 30 seconds timeout

    static async init() {
        try {
            this.showLoadingState();

            // Development mode check
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('Development mode: Bypassing authentication');
                this.isVerified = true;
                this.user = { email: 'dev@example.com' };
                await this.initializeApplication();
                return true;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token') || sessionStorage.getItem('josaa_auth_token');
            const source = urlParams.get('source');
            const uid = urlParams.get('uid');
            const referrer = document.referrer;
            const referrerOrigin = referrer ? new URL(referrer).origin : null;

            console.log('Init started:', { source, referrerOrigin, hasToken: !!token, hasUid: !!uid });

            if (!this.verifyReferrer(referrerOrigin, source)) {
                console.log('Referrer verification failed');
                this.handleUnauthorizedAccess("Invalid referrer or source");
                return false;
            }

            if (!token) {
                console.log('No token found');
                this.handleUnauthorizedAccess("No authentication token provided");
                return false;
            }

            await this.verifyToken(token, uid);
            this.isVerified = true;
            localStorage.setItem('authVerified', 'true');
            localStorage.setItem('authToken', token);
            sessionStorage.removeItem('josaa_auth_token');

            await this.initializeApplication();
            return true;

        } catch (error) {
            console.error('Authentication initialization error:', error);
            this.handleUnauthorizedAccess(error.message);
            return false;
        } finally {
            this.removeLoadingState();
        }
    }

    static async initializeApplication() {
        if (!window.initializeApp) {
            console.warn('No initialization function found');
            return;
        }

        const initPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Application initialization timed out'));
            }, this.initializationTimeout);

            Promise.resolve(window.initializeApp())
                .then(() => {
                    clearTimeout(timeout);
                    resolve();
                })
                .catch(reject);
        });

        try {
            await initPromise;
            this.showAlert('Application initialized successfully', 'success');
        } catch (error) {
            console.error('Application initialization error:', error);
            this.showAlert('Failed to initialize application. Please refresh the page.', 'error');
            throw error;
        }
    }

    static showLoadingState() {
        // Create loading element if it doesn't exist
        let loadingElement = document.getElementById('auth-loading');
        if (!loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.id = 'auth-loading';
            loadingElement.className = 'auth-loading';
            loadingElement.innerHTML = `
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p>Verifying authentication...</p>
            `;
            document.body.appendChild(loadingElement);
        }
        loadingElement.style.display = 'block';

        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            .auth-loading {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                z-index: 1000;
                background: rgba(255, 255, 255, 0.9);
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            .auth-loading p {
                margin-top: 10px;
                color: #666;
            }
        `;
        document.head.appendChild(style);
    }

    static removeLoadingState() {
        const loadingElement = document.getElementById('auth-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        // Show main content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = 'block';
        }
    }

    // ... (keep existing methods: verifyReferrer, verifyToken, handleUnauthorizedAccess, etc.)

    static showAlert(message, type = 'danger') {
        // Create alert container if it doesn't exist
        let alertContainer = document.getElementById('error-alert-container');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'error-alert-container';
            alertContainer.style.position = 'fixed';
            alertContainer.style.top = '20px';
            alertContainer.style.right = '20px';
            alertContainer.style.zIndex = '1000';
            document.body.appendChild(alertContainer);
        }

        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type} alert-dismissible fade show`;
        alertElement.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        alertContainer.appendChild(alertElement);

        // Auto-remove alert after 5 seconds
        setTimeout(() => {
            alertElement.remove();
        }, 5000);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    AuthVerification.init().then(isVerified => {
        if (isVerified) {
            console.log('Authentication verified, application can continue');
        } else {
            console.error('Authentication failed, application disabled');
        }
    }).catch(error => {
        console.error('Authentication initialization failed:', error);
        AuthVerification.handleUnauthorizedAccess("Authentication failed");
    });
});

// Export globally
window.AuthVerification = AuthVerification;
