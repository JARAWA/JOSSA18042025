// usage-limiter.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { 
    getFirestore,
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Use the same Firebase config that's in auth-verification.js
const firebaseConfig = {
    apiKey: "AIzaSyC7tvZe9NeHRhYuTVrQnkaSG7Nkj3ZS40U",
    authDomain: "nextstep-log.firebaseapp.com",
    projectId: "nextstep-log",
    storageBucket: "nextstep-log.firebasestorage.app",
    messagingSenderId: "9308831285",
    appId: "1:9308831285:web:d55ed6865804c50f743b7c",
    measurementId: "G-BPGP3TBN3N"
};

// Initialize Firebase if not already initialized
let app;
try {
    app = firebase.app();
} catch (e) {
    app = initializeApp(firebaseConfig);
}

// Initialize Firestore
const db = getFirestore(app);

export default class UsageLimiter {
    static DAILY_LIMIT = 5;
    static UNLIMITED_EMAILS = ['49.jayesh@gmail.com'];
    
    /**
     * Check if the user can generate preferences and update usage count
     * @returns {Promise<{allowed: boolean, remainingUses: number, message: string}>}
     */
    static async checkAndUpdateUsage() {
        try {
            // Get the authenticated user from AuthVerification
            if (!window.AuthVerification || !window.AuthVerification.isAuthenticated()) {
                return { allowed: false, remainingUses: 0, message: 'Not authenticated' };
            }
            
            const user = window.AuthVerification.user;
            if (!user || !user.uid || !user.email) {
                return { allowed: false, remainingUses: 0, message: 'User information not available' };
            }

            // Check if user has unlimited access - add console logging for debugging
            if (this.UNLIMITED_EMAILS.includes(user.email)) {
            console.log(`Unlimited access granted for ${user.email}`);
            return { allowed: true, remainingUses: Infinity, message: 'Unlimited access' };
            }
                        
            // Get current date in YYYY-MM-DD format (in user's timezone)
            const today = new Date().toISOString().split('T')[0];
            
            // Reference to the user's usage document
            const userUsageRef = doc(db, "userUsage", user.uid);
            const usageDoc = await getDoc(userUsageRef);
            
            if (!usageDoc.exists()) {
                // First time user, create usage document
                await setDoc(userUsageRef, {
                    josaaApp: {
                        [today]: 1
                    },
                    lastUpdated: serverTimestamp(),
                    email: user.email
                });
                
                const remainingUses = this.DAILY_LIMIT - 1;
                return { 
                    allowed: true, 
                    remainingUses, 
                    message: `You have ${remainingUses} generations remaining today` 
                };
            } else {
                // User exists, get current usage
                const userData = usageDoc.data();
                const josaaUsage = userData.josaaApp || {};
                const todayUsage = josaaUsage[today] || 0;
                
                // Check if user has reached the daily limit
                if (todayUsage >= this.DAILY_LIMIT) {
                    return { 
                        allowed: false, 
                        remainingUses: 0, 
                        message: 'You have reached the daily limit of 5 generations. Please try again tomorrow.' 
                    };
                }
                
                // Update usage count
                const newUsage = todayUsage + 1;
                await updateDoc(userUsageRef, {
                    [`josaaApp.${today}`]: newUsage,
                    lastUpdated: serverTimestamp()
                });
                
                const remainingUses = this.DAILY_LIMIT - newUsage;
                return { 
                    allowed: true, 
                    remainingUses,
                    message: `You have ${remainingUses} generations remaining today` 
                };
            }
        } catch (error) {
            console.error("Error checking user usage:", error);
            // In case of error, allow the user but with a warning
            return { 
                allowed: true, 
                remainingUses: "unknown", 
                message: "Usage tracking is currently unavailable",
                error: error.message 
            };
        }
    }
    
    /**
     * Apply usage limiting to a button
     * @param {HTMLElement} buttonElement - The button to limit
     * @param {Function} generateFunction - The function to call when generation is allowed
     */
    static applyToButton(buttonElement, generateFunction) {
        if (!buttonElement) {
            console.error("Button element not found");
            return;
        }
        
        // Store the original click handler if any
        const originalClickHandler = buttonElement.onclick;
        
        // Replace with our handler
buttonElement.onclick = async function(event) {
    event.preventDefault();
    
    // Show loading state
    const originalText = buttonElement.innerText;
    buttonElement.innerText = "Checking limits...";
    buttonElement.disabled = true;
    
    try {
        const usageResult = await UsageLimiter.checkAndUpdateUsage();
        console.log("Usage check result:", usageResult); // Add this for debugging
        
        // Reset button state
        buttonElement.innerText = originalText;
        buttonElement.disabled = false;
        
        if (usageResult.allowed) {
            // Show remaining uses if not unlimited
            if (usageResult.remainingUses !== Infinity) {
                UsageLimiter.showNotification(usageResult.message, "info");
            }
            
            // Call the original form submit handler directly
            if (typeof generateFunction === 'function') {
                generateFunction();
            } else {
                // Submit the form directly if no function was provided
                const form = buttonElement.closest('form');
                if (form) {
                    const formSubmitEvent = new Event('submit', { bubbles: true, cancelable: true });
                    form.dispatchEvent(formSubmitEvent);
                } else if (typeof originalClickHandler === 'function') {
                    originalClickHandler.call(buttonElement, event);
                }
            }
        } else {
            // Show limit reached message
            UsageLimiter.showNotification(usageResult.message, "warning");
        }
    } catch (error) {
        console.error("Error in usage limiter:", error);
        buttonElement.innerText = originalText;
        buttonElement.disabled = false;
        
        // On error, still allow the action to proceed
        if (typeof generateFunction === 'function') {
            generateFunction();
        } else {
            const form = buttonElement.closest('form');
            if (form) {
                const formSubmitEvent = new Event('submit', { bubbles: true, cancelable: true });
                form.dispatchEvent(formSubmitEvent);
            } else if (typeof originalClickHandler === 'function') {
                originalClickHandler.call(buttonElement, event);
            }
        }
    }
};
                } else {
                    // Show limit reached message
                    buttonElement.innerText = "Limit Reached";
                    buttonElement.disabled = true;
                    UsageLimiter.showNotification(usageResult.message, "warning");
                    
                    // Reset button after 3 seconds
                    setTimeout(() => {
                        buttonElement.innerText = originalText;
                    }, 3000);
                }
            } catch (error) {
                console.error("Error in usage limiter:", error);
                buttonElement.innerText = originalText;
                buttonElement.disabled = false;
                UsageLimiter.showNotification("An error occurred while checking usage limits", "error");
            }
        };
    }
    
    /**
     * Get remaining uses for the current day
     * @returns {Promise<number>} Number of remaining uses
     */
    static async getRemainingUses() {
        const result = await this.checkAndUpdateUsage(false);
        return result.remainingUses;
    }
    
    /**
     * Display a notification to the user
     * @param {string} message - Message to display
     * @param {string} type - Type of notification (info, warning, error)
     */
    static showNotification(message, type = 'info') {
        // Reuse the alert functionality from AuthVerification
        if (window.AuthVerification && window.AuthVerification.showAlert) {
            const alertType = type === 'info' ? 'info' : 
                            type === 'warning' ? 'warning' : 'danger';
            window.AuthVerification.showAlert(message, alertType);
        } else {
            // Fallback if AuthVerification is not available
            alert(message);
        }
    }
}

// Export globally
window.UsageLimiter = UsageLimiter;
