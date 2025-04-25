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
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

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

// Initialize Firebase
let app;
try {
    // Don't try to access global firebase - use the imported initializeApp instead
    app = initializeApp(firebaseConfig);
} catch (initError) {
    console.error("Error initializing Firebase:", initError);
}

// Initialize Firestore and Auth
let db, auth;
try {
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Error initializing Firestore/Auth:", error);
}

export default class UsageLimiter {
    static DAILY_LIMIT = 5;
    static UNLIMITED_EMAILS = ['49.jayesh@gmail.com'];
    static DEBUG_MODE = true; // Set to true to enable more verbose logging
    
    /**
     * Ensure Firebase Auth is ready and user is authenticated
     * @returns {Promise<firebase.User|null>}
     */
    static async ensureAuthReady() {
        if (!auth) return null;
        
        return new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }
    
    /**
     * Sign in to Firebase Auth using email
     * This is a workaround method - in production, use proper authentication
     * @param {string} userId - User ID
     * @param {string} email - User's email
     * @returns {Promise<Object>}
     */
    static async signInForFirestore(userId, email) {
        // For development environment, use a known user
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.includes('local') ||
            window.location.hostname.includes('dev') ||
            window.location.hostname.includes('render.com')) {
            
            // In development, bypass authentication and use a dummy user
            console.log("Development environment: Using dummy Firebase auth");
            return {
                uid: userId || "dev-user-id",
                email: email || "dev@example.com"
            };
        }
        
        try {
            // Check if already signed in
            await this.ensureAuthReady();
            if (auth && auth.currentUser) {
                console.log("Already signed in to Firebase Auth:", auth.currentUser.email);
                return auth.currentUser;
            }
            
            // In a real implementation, you would need to securely authenticate
            // This is a placeholder and won't work without proper implementation
            console.warn("Firebase Auth sign-in would happen here");
            
            // Return the AuthVerification user info instead as a fallback
            return { uid: userId, email };
        } catch (error) {
            console.error("Error signing in to Firebase Auth:", error);
            // Return the AuthVerification user as a fallback
            return { uid: userId, email };
        }
    }
    
    /**
     * Check if the user can generate preferences and update usage count
     * @returns {Promise<{allowed: boolean, remainingUses: number, message: string}>}
     */
    static async checkAndUpdateUsage(updateCount = false) {
        try {
            // Get the authenticated user from AuthVerification
            if (!window.AuthVerification || !window.AuthVerification.isAuthenticated()) {
                if (this.DEBUG_MODE) console.log("Auth verification not available or user not authenticated");
                return { allowed: true, remainingUses: this.DAILY_LIMIT, message: 'Auth tracking unavailable - operations allowed' };
            }
            
            const authUser = window.AuthVerification.user;
            if (!authUser || !authUser.uid || !authUser.email) {
                if (this.DEBUG_MODE) console.log("Auth user information not available");
                return { allowed: true, remainingUses: this.DAILY_LIMIT, message: 'User tracking unavailable - operations allowed' };
            }

            // Check if user has unlimited access
            if (this.UNLIMITED_EMAILS.includes(authUser.email)) {
                console.log(`Unlimited access granted for ${authUser.email}`);
                return { allowed: true, remainingUses: Infinity, message: 'Unlimited access' };
            }
            
            // Skip Firestore checks if db is not available
            if (!db) {
                console.warn("Firestore not available, skipping usage tracking");
                return { allowed: true, remainingUses: this.DAILY_LIMIT, message: 'Usage tracking unavailable - operations allowed' };
            }
            
            // Try to get a Firebase Auth user
            const firebaseUser = await this.signInForFirestore(authUser.uid, authUser.email);
            
            // Get current date in YYYY-MM-DD format (in user's timezone)
            const today = new Date().toISOString().split('T')[0];
            
            // Reference to the user's usage document
            try {
                const userUsageRef = doc(db, "userUsage", firebaseUser.uid);
                
                // Try with more detailed error logging
                try {
                    if (this.DEBUG_MODE) console.log("Attempting to read document:", `userUsage/${firebaseUser.uid}`);
                    const usageDoc = await getDoc(userUsageRef);
                    
                    if (!usageDoc.exists()) {
                        // First time user, create usage document
                        if (updateCount) {
                            try {
                                await setDoc(userUsageRef, {
                                    josaaApp: {
                                        [today]: 1
                                    },
                                    lastUpdated: serverTimestamp(),
                                    email: firebaseUser.email
                                });
                            } catch (writeError) {
                                console.error("Error creating user document:", writeError);
                                // Fallback to allowing the user if we can't write
                                return { 
                                    allowed: true, 
                                    remainingUses: this.DAILY_LIMIT - 1, 
                                    message: `Tracking unavailable. Assuming ${this.DAILY_LIMIT - 1} uses remaining.` 
                                };
                            }
                            
                            const remainingUses = this.DAILY_LIMIT - 1;
                            return { 
                                allowed: true, 
                                remainingUses, 
                                message: `You have ${remainingUses} generations remaining today` 
                            };
                        } else {
                            // Just checking, don't update
                            return { 
                                allowed: true, 
                                remainingUses: this.DAILY_LIMIT, 
                                message: `You have ${this.DAILY_LIMIT} generations remaining today` 
                            };
                        }
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

                        // Update usage count only if updateCount is true
                        if (updateCount) {
                            const newUsage = todayUsage + 1;
                            try {
                                await updateDoc(userUsageRef, {
                                    [`josaaApp.${today}`]: newUsage,
                                    lastUpdated: serverTimestamp()
                                });
                            } catch (updateError) {
                                console.error("Error updating usage count:", updateError);
                                // Fallback to allowing the user if we can't update
                                return { 
                                    allowed: true, 
                                    remainingUses: this.DAILY_LIMIT - todayUsage - 1, 
                                    message: `Tracking unavailable. Assuming ${this.DAILY_LIMIT - todayUsage - 1} uses remaining.` 
                                };
                            }
                            
                            const remainingUses = this.DAILY_LIMIT - newUsage;
                            return { 
                                allowed: true, 
                                remainingUses,
                                message: `You have ${remainingUses} generations remaining today` 
                            };
                        } else {
                            // Just checking, don't update
                            const remainingUses = this.DAILY_LIMIT - todayUsage;
                            return { 
                                allowed: true, 
                                remainingUses,
                                message: `You have ${remainingUses} generations remaining today` 
                            };
                        }
                    }
                } catch (readError) {
                    console.error("Error reading user usage:", readError);
                    console.log("Firebase auth state:", auth?.currentUser ? "Signed in" : "Not signed in");
                    console.log("Document path:", `userUsage/${firebaseUser.uid}`);
                    
                    // ALWAYS allow the operation when there's a Firestore error
                    return { 
                        allowed: true, 
                        remainingUses: "unknown", 
                        message: "Usage tracking is currently unavailable",
                        error: readError.message 
                    };
                }
            } catch (docError) {
                console.error("Error creating document reference:", docError);
                return { 
                    allowed: true, 
                    remainingUses: "unknown", 
                    message: "Usage tracking is currently unavailable",
                    error: docError.message 
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
                // First check WITHOUT updating the count
                const checkResult = await UsageLimiter.checkAndUpdateUsage(false);
                console.log("Usage check result:", checkResult);
                
                // Reset button state
                buttonElement.innerText = originalText;
                buttonElement.disabled = false;
                
                if (checkResult.allowed) {
                    // Show remaining uses if not unlimited
                    if (checkResult.remainingUses !== Infinity) {
                        UsageLimiter.showNotification(checkResult.message, "info");
                    }
                    
                    // Call the original form submit handler directly
                    if (typeof generateFunction === 'function') {
                        const success = await generateFunction();
                        // Update count only if generation was successful
                        if (success !== false) {
                            await UsageLimiter.checkAndUpdateUsage(true);
                            // Refresh the counter display if function exists
                            if (typeof window.displayRemainingUses === 'function') {
                                window.displayRemainingUses();
                            }
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
                    UsageLimiter.showNotification(checkResult.message, "warning");
                    
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
                UsageLimiter.showNotification("An error occurred while checking usage limits", "error");
                
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
     * Get remaining uses for the current day
     * @returns {Promise<number>} Number of remaining uses
     */
    static async getRemainingUses() {
        const result = await this.checkAndUpdateUsage(false); // Pass false to prevent updating
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
