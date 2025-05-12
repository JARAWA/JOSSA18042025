// firestore-usage-tracker.js

import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Import the existing Firestore instance from your usage-limiter.js
// This avoids re-initializing Firebase

class FirestoreUsageTracker {
    static DAILY_LIMIT = 5; // Match the limit in UsageLimiter
    static UNLIMITED_EMAILS = ['49.jayesh@gmail.com', 'kapil.mems@gmail.com']; // Match the unlimited emails list
    static DEBUG_MODE = true; // Enable debugging
    
    /**
     * Initialize the Firestore usage tracker
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    static async init() {
        console.log("Initializing FirestoreUsageTracker...");
        
        // Check if we're in development environment
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log("Development environment: Firestore usage tracking in simulation mode");
            return true;
        }
        
        // Check if Firestore is available from usage-limiter.js
        if (!window.db) {
            console.error("Firestore instance not available. Make sure usage-limiter.js is loaded first.");
            return false;
        }
        
        // Display initial usage information if element exists
        await this.displayRemainingUses();
        
        return true;
    }
    
    /**
     * Get the current authenticated user information
     * @returns {Object|null} User object or null if not authenticated
     */
    static getCurrentUser() {
        // Use the AuthVerification user info
        if (!window.AuthVerification || !window.AuthVerification.isAuthenticated()) {
            return null;
        }
        
        return window.AuthVerification.user;
    }
    
    /**
     * Get today's date in YYYY-MM-DD format
     * @returns {string} Today's date string
     */
    static getTodayString() {
        const today = new Date();
        return today.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    
    /**
     * Check and update usage limits in Firestore
     * @param {boolean} updateCount - Whether to increment the usage count
     * @returns {Promise<Object>} Usage information
     */
    static async checkAndUpdateUsage(updateCount = false) {
        try {
            // In development mode, use localStorage simulation
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return await UsageLimiter.checkAndUpdateUsage(updateCount);
            }
            
            // Get current user
            const user = this.getCurrentUser();
            if (!user || !user.uid || !user.email) {
                console.warn("User not authenticated, cannot track usage in Firestore");
                return { 
                    allowed: false, 
                    remainingUses: 0, 
                    message: "Please log in to use this feature" 
                };
            }
            
            // Check for unlimited emails
            if (this.UNLIMITED_EMAILS.includes(user.email)) {
                console.log(`Unlimited access granted for ${user.email}`);
                return { 
                    allowed: true, 
                    remainingUses: Infinity, 
                    message: "Unlimited access" 
                };
            }
            
            const today = this.getTodayString();
            
            // Reference to the user's usage document
            const userUsageRef = doc(window.db, "userUsage", user.uid);
            
            // Get the current document
            let userUsageDoc;
            try {
                userUsageDoc = await getDoc(userUsageRef);
            } catch (fetchError) {
                console.error("Error fetching usage document:", fetchError);
                // Fallback to localStorage
                return await UsageLimiter.checkAndUpdateUsage(updateCount);
            }
            
            // Handle the document based on whether it exists
            let usage = 0;
            
            if (!userUsageDoc.exists()) {
                // Document doesn't exist - create if needed
                if (this.DEBUG_MODE) console.log(`No usage document found for user ${user.uid}`);
                
                if (updateCount) {
                    usage = 1; // Start with 1 for new document + update
                    
                    try {
                        await setDoc(userUsageRef, {
                            email: user.email,
                            josaaApp: {
                                [today]: usage
                            },
                            lastUpdated: new Date().toISOString()
                        });
                        console.log(`Created new usage document for ${user.email} with initial count ${usage}`);
                    } catch (createError) {
                        console.error("Error creating usage document:", createError);
                        // Fallback to localStorage
                        return await UsageLimiter.checkAndUpdateUsage(updateCount);
                    }
                }
            } else {
                // Document exists - get/update the usage count
                const userData = userUsageDoc.data();
                
                // Get josaaApp data or initialize if not present
                const josaaApp = userData.josaaApp || {};
                
                // Get today's usage or initialize to 0
                usage = josaaApp[today] || 0;
                
                if (updateCount) {
                    // Increment usage
                    usage += 1;
                    
                    // Update the document
                    josaaApp[today] = usage;
                    
                    try {
                        await updateDoc(userUsageRef, {
                            josaaApp: josaaApp,
                            lastUpdated: new Date().toISOString()
                        });
                        console.log(`Updated usage for ${user.email} to ${usage} for ${today}`);
                    } catch (updateError) {
                        console.error("Error updating usage document:", updateError);
                        // Still increment local count but report error
                        return { 
                            allowed: true, 
                            remainingUses: this.DAILY_LIMIT - usage,
                            message: `Usage tracking partially failed. You have about ${this.DAILY_LIMIT - usage} uses remaining.`,
                            error: updateError.message
                        };
                    }
                }
            }
            
            // Check if limit reached
            const remainingUses = Math.max(0, this.DAILY_LIMIT - usage);
            const allowed = remainingUses > 0;
            
            return {
                allowed,
                remainingUses,
                usage,
                message: allowed 
                    ? `You have ${remainingUses} generations remaining today` 
                    : `You have reached the daily limit of ${this.DAILY_LIMIT} generations. Please try again tomorrow.`
            };
        } catch (error) {
            console.error("Error in Firestore usage tracking:", error);
            // Fallback to localStorage tracking
            return await UsageLimiter.checkAndUpdateUsage(updateCount);
        }
    }
    
    /**
     * Display remaining uses in UI
     */
    static async displayRemainingUses() {
        const usageInfoElement = document.getElementById('usage-info');
        if (!usageInfoElement) return;
        
        try {
            const usageInfo = await this.checkAndUpdateUsage(false);
            
            if (usageInfo.remainingUses === Infinity) {
                usageInfoElement.innerHTML = `<span class="unlimited-badge"><i class="fas fa-infinity"></i> Unlimited Access</span>`;
            } else if (usageInfo.remainingUses === "unknown") {
                usageInfoElement.innerHTML = `<span class="usage-badge"><i class="fas fa-exclamation-triangle"></i> Usage tracking unavailable</span>`;
            } else {
                usageInfoElement.innerHTML = `<span class="usage-badge"><i class="fas fa-bolt"></i> ${usageInfo.remainingUses} generations remaining today</span>`;
            }
            
            // Add color coding based on remaining uses
            if (usageInfo.remainingUses <= 1) {
                usageInfoElement.querySelector('.usage-badge')?.classList.add('low-usage');
            } else if (usageInfo.remainingUses <= 2) {
                usageInfoElement.querySelector('.usage-badge')?.classList.add('medium-usage');
            }
        } catch (error) {
            console.error("Error displaying usage info:", error);
            usageInfoElement.innerHTML = `<span class="usage-badge"><i class="fas fa-exclamation-triangle"></i> Usage tracking unavailable</span>`;
        }
    }
    
    /**
     * Apply usage limiting to a button
     * Extends the UsageLimiter functionality to use Firestore
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
                // First check WITHOUT updating the count
                const checkResult = await FirestoreUsageTracker.checkAndUpdateUsage(false);
                console.log("Usage check result:", checkResult);
                
                // Reset button state
                buttonElement.innerText = originalText;
                buttonElement.disabled = false;
                
                if (checkResult.allowed) {
                    // Show remaining uses if not unlimited
                    if (checkResult.remainingUses !== Infinity) {
                        FirestoreUsageTracker.showNotification(checkResult.message, "info");
                    }
                    
                    // Call the original form submit handler directly
                    if (typeof generateFunction === 'function') {
                        const success = await generateFunction();
                        // Update count only if generation was successful
                        if (success !== false) {
                            await FirestoreUsageTracker.checkAndUpdateUsage(true);
                            // Refresh the counter display
                            FirestoreUsageTracker.displayRemainingUses();
                        }
                    } else {
                        // Submit the form directly if no function was provided
                        const form = buttonElement.closest('form');
                        if (form) {
                            const formSubmitEvent = new Event('submit', { bubbles: true, cancelable: true });
                            form.dispatchEvent(formSubmitEvent);
                            // Form handling will update the usage count if successful
                        } else if (typeof originalClickHandler === 'function') {
                            originalClickHandler.call(buttonElement, event);
                        }
                    }
                } else {
                    // Show limit reached message
                    buttonElement.innerText = "Limit Reached";
                    buttonElement.disabled = true;
                    FirestoreUsageTracker.showNotification(checkResult.message, "warning");
                    
                    // Reset button after 3 seconds
                    setTimeout(() => {
                        buttonElement.innerText = originalText;
                        buttonElement.disabled = false;
                    }, 3000);
                }
            } catch (error) {
                console.error("Error in usage limiter:", error);
                buttonElement.innerText = originalText;
                buttonElement.disabled = false;
                FirestoreUsageTracker.showNotification("An error occurred while checking usage limits", "error");
                
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
    }
    
    /**
     * Show a notification to the user
     * Reuses the existing notification function
     * @param {string} message - Message to display
     * @param {string} type - Type of notification (info, warning, error)
     */
    static showNotification(message, type = 'info') {
        if (window.UsageLimiter && window.UsageLimiter.showNotification) {
            window.UsageLimiter.showNotification(message, type);
        } else if (window.AuthVerification && window.AuthVerification.showAlert) {
            const alertType = type === 'info' ? 'info' : 
                            type === 'warning' ? 'warning' : 'danger';
            window.AuthVerification.showAlert(message, alertType);
        } else {
            // Fallback if neither is available
            alert(message);
        }
    }
    
    /**
     * CSS styles for usage badges
     */
    static addStyles() {
        if (document.getElementById('firestore-usage-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'firestore-usage-styles';
        style.textContent = `
            .usage-badge {
                display: inline-block;
                padding: 0.25rem 0.5rem;
                background-color: #e9ecef;
                border-radius: 0.25rem;
                font-size: 0.75rem;
                font-weight: bold;
            }
            
            .unlimited-badge {
                display: inline-block;
                padding: 0.25rem 0.5rem;
                background-color: #d1e7dd;
                color: #0f5132;
                border-radius: 0.25rem;
                font-size: 0.75rem;
                font-weight: bold;
            }
            
            .low-usage {
                background-color: #f8d7da;
                color: #842029;
            }
            
            .medium-usage {
                background-color: #fff3cd;
                color: #664d03;
            }
        `;
        document.head.appendChild(style);
    }
}

// Add styles
FirestoreUsageTracker.addStyles();

// Initialize on page load - after AuthVerification and UsageLimiter
document.addEventListener('DOMContentLoaded', async () => {
    // Make sure AuthVerification and UsageLimiter are ready
    const waitForDependencies = async () => {
        return new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (window.AuthVerification && window.UsageLimiter && window.db) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(false);
            }, 10000);
        });
    };
    
    const dependenciesReady = await waitForDependencies();
    if (dependenciesReady) {
        await FirestoreUsageTracker.init();
        console.log("FirestoreUsageTracker initialized");
        
        // Create a usage info element if not present
        if (!document.getElementById('usage-info')) {
            const navbarRight = document.querySelector('.navbar-right, .navbar .ms-auto, .nav-right');
            if (navbarRight) {
                const usageInfoContainer = document.createElement('li');
                usageInfoContainer.className = 'nav-item';
                usageInfoContainer.innerHTML = '<div id="usage-info" class="nav-link"></div>';
                navbarRight.appendChild(usageInfoContainer);
                await FirestoreUsageTracker.displayRemainingUses();
            }
        }
    } else {
        console.error("Could not initialize FirestoreUsageTracker - dependencies not loaded");
    }
});

// Replace UsageLimiter.applyToButton with our version for all future calls
const originalApplyToButton = window.UsageLimiter?.applyToButton;
if (originalApplyToButton) {
    window.UsageLimiter.applyToButton = function(buttonElement, generateFunction) {
        FirestoreUsageTracker.applyToButton(buttonElement, generateFunction);
    };
    console.log("Enhanced UsageLimiter.applyToButton with Firestore tracking");
}

// Also expose globally
window.FirestoreUsageTracker = FirestoreUsageTracker;

// Export
export default FirestoreUsageTracker;
