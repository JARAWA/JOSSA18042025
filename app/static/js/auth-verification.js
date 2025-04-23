// auth-verification.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

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

    static async init() {
        try {
            // Development mode check
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('Development mode: Bypassing authentication');
                this.isVerified = true;
                this.user = { email: 'dev@example.com' };
                if (window.initializeApp) {
                    window.initializeApp();
                }
                return true;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            const source = urlParams.get('source');
            const referrer = document.referrer;
            const referrerOrigin = referrer ? new URL(referrer).origin : null;

            console.log('Init started:', { source, referrerOrigin, hasToken: !!token });

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

            await this.verifyToken(token);
            this.isVerified = true;
            localStorage.setItem('authVerified', 'true');
            
            // Show success message
            this.showAlert(`Welcome! You're logged in successfully.`, 'success');
            
            if (window.initializeApp) {
                window.initializeApp();
            }
            return true;

        } catch (error) {
            console.error('Authentication initialization error:', error);
            this.handleUnauthorizedAccess(error.message);
            return false;
        }
    }

    static verifyReferrer(referrerOrigin, source) {
        return (
            ALLOWED_ORIGINS.includes(referrerOrigin) || 
            source === 'nextstep-nexn'
        );
    }

    static async verifyToken(token) {
        try {
            const userCredential = await signInWithCustomToken(auth, token);
            this.user = userCredential.user;
            console.log('User authenticated:', this.user.email);
            return true;
        } catch (error) {
            console.error('Token verification failed:', error);
            throw new Error('Invalid authentication token');
        }
    }

    static handleUnauthorizedAccess(message) {
        const errorContainer = document.getElementById('auth-error-container');
        if (errorContainer) {
            errorContainer.style.display = 'block';
            errorContainer.innerHTML = `
                <h2>Access Denied</h2>
                <p>${message}</p>
                <p>Please access this application through the <a href="https://nextstep-nexn.onrender.com">NextStep</a> website.</p>
            `;
        }
        
        this.showAlert(message, 'danger');
        this.disableAppFunctionality();
    }

    static showAlert(message, type = 'danger') {
        const alertContainer = document.getElementById('error-alert-container');
        if (alertContainer) {
            alertContainer.innerHTML = `
                <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
        }
    }
    
    static disableAppFunctionality() {
        const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
        interactiveElements.forEach(el => {
            if (el.closest('.auth-error') === null) {
                el.disabled = true;
                el.style.pointerEvents = 'none';
                el.style.opacity = '0.5';
            }
        });
        
        if (window.stopAllProcesses) {
            window.stopAllProcesses();
        }
    }

    static isAuthenticated() {
        return this.isVerified && this.user !== null;
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
