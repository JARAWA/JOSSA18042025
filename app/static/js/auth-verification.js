// auth-verification.js - Add this to both destination applications
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Firebase configuration - Use the same config as your main site
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

// Allowed origins (your main site)
const ALLOWED_ORIGINS = ['https://nextstep-nexn.onrender.com'];

export default class AuthVerification {
    static isVerified = false;
    static user = null;

    static async init() {
        // Check if we have a token in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const source = urlParams.get('source');

        // Check referrer
        const referrer = document.referrer;
        const referrerOrigin = referrer ? new URL(referrer).origin : null;
        
        // For development, you might want to log these values
        console.log('Source param:', source);
        console.log('Referrer:', referrerOrigin);

        // Verify both referrer and token
        if (!this.verifyReferrer(referrerOrigin, source)) {
            this.handleUnauthorizedAccess("Invalid referrer or source");
            return false;
        }

        if (!token) {
            this.handleUnauthorizedAccess("No authentication token provided");
            return false;
        }

        try {
            // Verify token with Firebase
            await this.verifyToken(token);
            this.isVerified = true;
            
            // Set a cookie or localStorage if needed for persistent state
            localStorage.setItem('authVerified', 'true');
            
            return true;
        } catch (error) {
            console.error('Authentication error:', error);
            this.handleUnauthorizedAccess("Invalid authentication token");
            return false;
        }
    }

    static verifyReferrer(referrerOrigin, source) {
        // Check if referrer is from allowed origin or source parameter is valid
        return (
            // Check directly against allowed origins list
            ALLOWED_ORIGINS.includes(referrerOrigin) || 
            // Or check source parameter (for cases where referrer might be stripped)
            source === 'nextstep-nexn'
        );
    }

    static async verifyToken(token) {
        try {
            // Verify with Firebase Auth
            // Option 1: If you have backend, use a more secure approach
            // by verifying token on server-side
            
            // Option 2: Client-side verification (less secure but simpler)
            const userCredential = await auth.signInWithIdToken(token);
            this.user = userCredential.user;
            
            console.log('User authenticated:', this.user.email);
            return true;
        } catch (error) {
            console.error('Token verification failed:', error);
            throw new Error('Invalid authentication token');
        }
    }

    static handleUnauthorizedAccess(message) {
        // Redirect to error page or show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'auth-error';
        errorDiv.innerHTML = `
            <h2>Access Denied</h2>
            <p>${message}</p>
            <p>Please access this application through the <a href="https://nextstep-nexn.onrender.com">NextStep</a> website.</p>
        `;
        
        // Clear any existing content
        document.body.innerHTML = '';
        document.body.appendChild(errorDiv);
        
        // Add some basic styling
        const style = document.createElement('style');
        style.textContent = `
            .auth-error {
                font-family: 'Poppins', sans-serif;
                max-width: 500px;
                margin: 100px auto;
                padding: 20px;
                background-color: #fff;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                text-align: center;
            }
            .auth-error h2 {
                color: #e53935;
                margin-bottom: 20px;
            }
            .auth-error a {
                color: #1e88e5;
                text-decoration: none;
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
        
        // Disable functionality
        this.disableAppFunctionality();
    }
    
    static disableAppFunctionality() {
        // Disable all interactive elements
        const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
        interactiveElements.forEach(el => {
            if (el.closest('.auth-error') === null) { // Don't disable elements inside our error message
                el.disabled = true;
                el.style.pointerEvents = 'none';
                el.style.opacity = '0.5';
            }
        });
        
        // Stop any ongoing processes or data loading
        // This would be application-specific
        if (window.stopAllProcesses) {
            window.stopAllProcesses();
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    AuthVerification.init().then(isVerified => {
        if (isVerified) {
            console.log('Authentication verified, application can continue');
            // Continue with normal app initialization
            if (window.initializeApp) {
                window.initializeApp();
            }
        } else {
            console.error('Authentication failed, application disabled');
        }
    });
});

// Export globally
window.AuthVerification = AuthVerification;
