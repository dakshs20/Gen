// This console log will appear if the script file is even loaded and parsed.
console.log(Date.now(), "script.js: File started parsing.");

// Import Firebase functions directly as a module
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, addDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log(Date.now(), "script.js: Firebase imports attempted.");

// --- Firebase Configuration (Declared at top level) ---
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y", // REPLACE WITH YOUR ACTUAL API KEY
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.firebasestorage.app",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};
console.log(Date.now(), "script.js: Firebase config defined at top level.");

// --- Firebase App and Service Variables (Declared at top level, initialized later) ---
let firebaseApp;
let auth;
let db;
let googleProvider;

// --- State variables (Declared at top level and initialized) ---
let currentUser = null; // Stores Firebase User object
let freeGenerationsLeft = localStorage.getItem('freeGenerationsLeft') ? parseInt(localStorage.getItem('freeGenerationsLeft')) : 3;
let prompt = ''; // For image generator
let imageUrl = ''; // For generated image
let loading = false; // For image generation
let currentError = ''; // Error message for display
let currentPage = 'home'; // 'home', 'generator'
let isSigningIn = false; // New state for sign-in loading
let isAuthReady = false; // Flag to indicate if Firebase Auth state has been checked and services initialized

let aspectRatio = '1:1'; // Default aspect ratio

let enhancedPrompt = '';
let loadingEnhancePrompt = false;
let variationIdeas = [];
let loadingVariationIdeas = false;

// IMPORTANT: Your Google Cloud API Key for Imagen/Gemini (Declared at top level)
// REPLACE "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE" WITH THE KEY YOU OBTAINED FROM GOOGLE CLOUD CONSOLE
const IMAGEN_GEMINI_API_KEY = "AIzaSyBZxXWl9s2AeSCzMrfoEfnYWpGyfvP7jqs";
console.log(Date.now(), "script.js: IMAGEN_GEMINI_API_KEY value set at top level.");


// --- UI Element References (Will be populated in initApp) ---
let homePageElement;
let generatorPageElement;
let allPageElements = []; // Group for easy iteration

let persistentDebugMessage;
let closeDebugMessageBtn;

let promptInput;
let copyPromptBtn;
let clearPromptBtn;
let aspectRatioSelectionDiv;
let generateBtn;
let enhanceBtn;
let variationBtn;
let useEnhancedPromptBtn;
let downloadBtn;
let errorDisplay;
let imageDisplayContainer;
let generatedImageElement;
let enhancedPromptDisplay;
let enhancedPromptText;
let variationIdeasDisplay;
let variationIdeasList;

let userDisplayDesktop;
let signInBtnDesktop;
let signOutBtnDesktop;
let userDisplayMobile;
let signInBtnMobile;
let signOutBtnMobile;
let freeGenerationsDisplay;
let signinRequiredModal;
let modalSignInBtn;
let closeSigninModalBtn;
let startCreatingBtn;
let logoBtn;

let hamburgerBtn;
let hamburgerIcon;
let mobileMenu;
let mobileMenuOverlay;
let closeMobileMenuBtn;
let mobileNavLinks;

let toastContainer;


// --- Helper function to get elements and log if not found (Declared at top level) ---
const getElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(Date.now(), `getElement: Element with ID '${id}' NOT FOUND in the DOM.`);
    } else {
        console.log(Date.now(), `getElement: Element with ID '${id}' FOUND.`);
    }
    return element;
};

// --- Firebase Initialization Function (Called by initApp) ---
function initFirebase() {
    console.log(Date.now(), "initFirebase: Initializing Firebase services...");
    try {
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        googleProvider = new GoogleAuthProvider();
        console.log(Date.now(), "initFirebase: Firebase services initialized successfully.");
        isAuthReady = true; // Set to true immediately after Firebase services are initialized
        console.log(Date.now(), "initFirebase: isAuthReady set to true.");

        // Firebase Auth State Listener - Moved here to ensure 'auth' is defined
        onAuthStateChanged(auth, async (user) => {
            console.log(Date.now(), "onAuthStateChanged: Auth state change detected. User:", user ? user.uid : "null");
            currentUser = user;
            if (user) {
                console.log(Date.now(), "onAuthStateChanged: User logged in. Attempting to fetch user data from Firestore.");
                console.time("fetchUserData"); // Start timer for data fetch
                try {
                    await fetchUserData(user.uid); // Fetch user data from Firestore
                    console.log(Date.now(), "onAuthStateChanged: User data fetch completed successfully.");
                } catch (dataFetchError) {
                    console.error(Date.now(), "onAuthStateChanged: Error fetching user data:", dataFetchError);
                    setError(`Failed to load user data: ${dataFetchError.message}. Some features may be limited.`);
                    showToast(`Failed to load user data: ${dataFetchError.message}`, "error", 5000);
                } finally {
                    console.timeEnd("fetchUserData"); // End timer for data fetch
                }
            } else {
                console.log(Date.now(), "onAuthStateChanged: User logged out or no user detected. Checking local storage for free generations.");
                currentUser = null;
                if (localStorage.getItem('freeGenerationsLeft') === null || parseInt(localStorage.getItem('freeGenerationsLeft')) < 0) {
                    freeGenerationsLeft = 3;
                    localStorage.setItem('freeGenerationsLeft', freeGenerationsLeft);
                    console.log(Date.now(), "onAuthStateChanged: Reset freeGenerationsLeft to 3 for unauthenticated user (local storage).");
                } else {
                    freeGenerationsLeft = parseInt(localStorage.getItem('freeGenerationsLeft'));
                    console.log(Date.now(), "onAuthStateChanged: Loaded freeGenerationsLeft from local storage:", freeGenerationsLeft);
                }
            }
            isAuthReady = true; // Confirm auth state is fully processed
            console.log(Date.now(), "onAuthStateChanged: isAuthReady confirmed true. Updating UI.");
            updateUI(); // Update UI immediately after auth state is determined
            console.log(Date.now(), "onAuthStateChanged: Auth state processing complete.");
        });

    } catch (e) {
        console.error(Date.now(), "initFirebase: CRITICAL ERROR: Error initializing Firebase:", e);
        currentError = `Firebase initialization failed: ${e.message}. App may not function correctly.`;
        // Attempt to show persistent debug message within initApp's scope
        if (persistentDebugMessage) {
            persistentDebugMessage.classList.remove('hidden');
            const msgP = persistentDebugMessage.querySelector('p');
            if (msgP) msgP.textContent = currentError + " Please check console (F12) for details.";
        }
        throw e; // Re-throw to propagate to initApp's catch block
    }
}

// --- Toast Notification System (Declared at top level) ---
function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        console.warn(Date.now(), "showToast: Toast container not found. Cannot display toast.");
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    let iconClass = '';
    if (type === 'success') iconClass = 'fas fa-check-circle text-green-400';
    else if (type === 'error') iconClass = 'fas fa-times-circle text-red-500';
    else iconClass = 'fas fa-info-circle text-blue-400';

    const icon = document.createElement('i');
    icon.className = iconClass;
    toast.prepend(icon);

    toastContainer.appendChild(toast);
    console.log(Date.now(), `showToast: Displaying ${type} toast: "${message}"`);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.addEventListener('transitionend', () => {
            toast.remove();
            console.log(Date.now(), "showToast: Toast removed.");
        }, { once: true });
    }, duration);
}

// --- Mobile Menu Toggle Function (Declared at top level) ---
function toggleMobileMenu() {
    console.log(Date.now(), "toggleMobileMenu: Function called.");
    if (mobileMenu && mobileMenuOverlay && hamburgerBtn && hamburgerIcon) {
        const isMenuOpen = mobileMenu.classList.contains('translate-x-0');
        
        mobileMenu.classList.toggle('translate-x-full', isMenuOpen);
        mobileMenu.classList.toggle('translate-x-0', !isMenuOpen);
        
        mobileMenuOverlay.classList.toggle('hidden', isMenuOpen);
        
        hamburgerBtn.setAttribute('aria-expanded', !isMenuOpen);
        hamburgerIcon.classList.toggle('fa-bars', isMenuOpen);
        hamburgerIcon.classList.toggle('fa-times', !isMenuOpen);
        
        console.log(Date.now(), "toggleMobileMenu: Mobile menu toggled. Current state:", !isMenuOpen ? "OPEN" : "CLOSED");
    } else {
        console.error(Date.now(), "toggleMobileMenu: One or more mobile menu elements not found. Cannot toggle.");
    }
}

// --- Authentication Functions (Declared at top level) ---
async function signInWithGoogle() {
    console.log(Date.now(), "signInWithGoogle: Function entered.");
    clearError();

    if (isSigningIn) {
        console.log(Date.now(), "signInWithGoogle: Already signing in, ignoring multiple clicks.");
        return;
    }

    isSigningIn = true;
    updateSignInButtons(true);
    
    const testWindow = window.open('', '_blank', 'width=1,height=1,left=0,top=0');
    if (testWindow) {
        testWindow.close();
        console.log(Date.now(), "signInWithGoogle: Popup blocker check passed.");
    } else {
        console.warn(Date.now(), "signInWithGoogle: Popup blocker check failed. Popups might be blocked.");
        setError("Your browser might be blocking the sign-in popup. Please allow popups for this site and try again.");
        isSigningIn = false;
        updateSignInButtons(false);
        return;
    }

    console.time("signInWithPopup");
    try {
        if (!auth || !googleProvider) {
            console.error(Date.now(), "signInWithGoogle: Firebase Auth or Google Provider not initialized. Cannot sign in.");
            setError("Firebase services not ready. Please refresh and try again.");
            return;
        }
        console.log(Date.now(), "signInWithGoogle: Attempting signInWithPopup call...");
        const result = await signInWithPopup(auth, googleProvider);
        console.log(Date.now(), "signInWithGoogle: signInWithPopup successful. User:", result.user.uid, result.user.displayName || result.user.email);
        signinRequiredModal?.classList.add('hidden');
    } catch (error) {
        console.error(Date.now(), "signInWithGoogle: Error during Google Sign-In:", error);
        console.error(Date.now(), "signInWithGoogle: Error code:", error.code);
        console.error(Date.now(), "signInWithGoogle: Error message:", error.message);
        if (error.code === 'auth/popup-closed-by-user') {
            setError('Sign-in popup closed. Please try again.');
        } else if (error.code === 'auth/cancelled-popup-request') {
            setError('Sign-in popup was already open or another request was pending. Please try again.');
        } else if (error.code === 'auth/network-request-failed') {
            setError('Network error during sign-in. Check your internet connection.');
        } else if (error.code === 'auth/unauthorized-domain') {
            setError('Authentication failed: Unauthorized domain. Please check Firebase Console -> Authentication -> Sign-in method -> Authorized domains and add your current domain (e.g., localhost, or your preview URL).');
        } else if (error.code === 'auth/popup-blocked') {
            setError('Sign-in popup was blocked by your browser. Please disable popup blockers for this site and try again.');
        }
        else {
            setError(`Failed to sign in: ${error.message}`);
        }
    } finally {
        console.timeEnd("signInWithPopup");
        isSigningIn = false;
        updateSignInButtons(false);
        updateUI();
    }
}

// Function to update sign-in button states with loading spinner (Declared at top level)
function updateSignInButtons(loadingState) {
    console.log(Date.now(), "updateSignInButtons: Updating sign-in button state to loading:", loadingState);
    const signInButtons = [signInBtnDesktop, signInBtnMobile, modalSignInBtn];
    const buttonText = 'Sign In With Google';
    const loadingText = `
        <span class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing In...
        </span>
    `;

    signInButtons.forEach(btn => {
        if (btn) {
            btn.innerHTML = loadingState ? loadingText : buttonText;
            btn.disabled = loadingState;
            btn.classList.toggle('opacity-70', loadingState);
            btn.classList.toggle('cursor-not-allowed', loadingState);
        }
    });
}

async function signOutUser() {
    console.log(Date.now(), "signOutUser: Attempting signOutUser...");
    clearError();
    console.time("signOut");
    try {
        if (!auth) {
            console.error(Date.now(), "signOutUser: Firebase Auth not initialized. Cannot sign out.");
            setError("Firebase services not ready. Cannot sign out.");
            return;
        }
        await signOut(auth);
        console.log(Date.now(), "signOutUser: User signed out successfully.");
        showToast("Signed out successfully!", "info");
    } catch (error) {
        console.error(Date.now(), "signOutUser: Error signing out:", error);
        setError(`Failed to sign out: ${error.message}`);
        showToast(`Failed to sign out: ${error.message}`, "error");
    } finally {
        console.timeEnd("signOut");
        updateUI();
    }
}

async function fetchUserData(uid) {
    console.log(Date.now(), `fetchUserData: Entering fetchUserData for UID: ${uid}`);
    clearError();
    if (!db) {
        console.error(Date.now(), "fetchUserData: Firestore DB not initialized. Cannot fetch user data.");
        setError("Database not ready. Please refresh.");
        return;
    }
    const userDocRef = doc(db, 'users', uid);
    try {
        console.log(Date.now(), `fetchUserData: Attempting to get document for UID: ${uid}`);
        const userDocSnap = await getDoc(userDocRef);
        console.log(Date.now(), `fetchUserData: Document snapshot received. Exists: ${userDocSnap.exists()}`);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            freeGenerationsLeft = userData.freeGenerationsLeft !== undefined ? userData.freeGenerationsLeft : 0;
            console.log(Date.now(), "fetchUserData: Fetched existing user data:", userData);
            showToast(`Welcome back, ${currentUser.displayName || currentUser.email}!`, "success");
        } else {
            console.log(Date.now(), "fetchUserData: User document does not exist for UID:", uid, ". Initializing new user data in Firestore with 3 free generations.");
            await setDoc(userDocRef, {
                freeGenerationsLeft: 3,
                createdAt: serverTimestamp()
            });
            freeGenerationsLeft = 3;
            console.log(Date.now(), "fetchUserData: New user data initialized in Firestore for UID:", uid);
            showToast(`Welcome, ${currentUser.displayName || currentUser.email}! You have 3 free generations.`, "success");
        }
        localStorage.removeItem('freeGenerationsLeft');
        console.log(Date.now(), "fetchUserData: Removed freeGenerationsLeft from local storage for authenticated user.");
    } catch (error) {
        console.error(Date.now(), "fetchUserData: Error fetching/initializing user data:", error);
        throw error;
    } finally {
        console.log(Date.now(), "fetchUserData: Exiting fetchUserData.");
    }
}

function updateUIForAuthStatus() {
    console.log(Date.now(), "updateUIForAuthStatus: Updating UI for auth status. Current user:", currentUser ? currentUser.displayName || currentUser.email : "None");

    if (userDisplayDesktop) {
        if (currentUser) {
            userDisplayDesktop.textContent = `Welcome, ${currentUser.displayName || currentUser.email}!`;
            userDisplayDesktop.classList.remove('hidden');
        } else {
            userDisplayDesktop.classList.add('hidden');
        }
    }
    if (signInBtnDesktop) signInBtnDesktop.classList.toggle('hidden', !!currentUser);
    if (signOutBtnDesktop) signOutBtnDesktop.classList.toggle('hidden', !currentUser);

    if (userDisplayMobile) {
        if (currentUser) {
            userDisplayMobile.textContent = `Welcome, ${currentUser.displayName || currentUser.email}!`;
            userDisplayMobile.classList.remove('hidden');
        } else {
            userDisplayMobile.classList.add('hidden');
        }
    }
    if (signInBtnMobile) signInBtnMobile.classList.toggle('hidden', !!currentUser);
    if (signOutBtnMobile) signOutBtnMobile.classList.toggle('hidden', !currentUser);

    console.log(Date.now(), "updateUIForAuthStatus: UI updated based on auth status.");
}

function populateAspectRatioRadios() {
    console.log(Date.now(), "populateAspectRatioRadios: Populating aspect ratio radios.");
    if (aspectRatioSelectionDiv) {
        aspectRatioSelectionDiv.innerHTML = '';
        ['1:1', '4:5', '9:16', '16:9'].forEach(ratio => {
            const label = document.createElement('label');
            label.className = 'inline-flex items-center cursor-pointer';
            label.innerHTML = `
                <input type="radio" name="aspectRatio" value="${ratio}" class="form-radio h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500" ${aspectRatio === ratio ? 'checked' : ''}>
                <span class="ml-2 text-gray-200 font-helvetica text-sm">${ratio}</span>
            `;
            const radioInput = label.querySelector('input');
            if (radioInput) {
                radioInput.addEventListener('change', (e) => {
                    aspectRatio = e.target.value;
                    console.log(Date.now(), "Event: Aspect ratio changed to:", aspectRatio);
                });
            }
            aspectRatioSelectionDiv.appendChild(label);
        });
        console.log(Date.now(), "populateAspectRatioRadios: Aspect ratio radios populated.");
    } else {
        console.error(Date.now(), "populateAspectRatioRadios: aspectRatioSelectionDiv element not found.");
    }
}

// --- Page Visibility Logic (Declared at top level) ---
async function setPage(newPage) {
    console.log(Date.now(), `setPage: Attempting to switch to page: ${newPage}. Current page: ${currentPage}`);
    if (currentPage === newPage) {
        console.log(Date.now(), `setPage: Already on page ${newPage}, no change needed.`);
        return;
    }

    allPageElements.forEach(element => {
        if (element) {
            element.classList.add('hidden');
            element.classList.remove('animate-fade-in-up');
        }
    });

    let newPageElement;
    if (newPage === 'home') {
        newPageElement = homePageElement;
    } else if (newPage === 'generator') {
        newPageElement = generatorPageElement;
    }

    if (newPageElement) {
        newPageElement.classList.remove('hidden');
        void newPageElement.offsetWidth; // Trigger reflow for animation
        newPageElement.classList.add('animate-fade-in-up');
        console.log(Date.now(), `setPage: Displayed page '${newPage}' and applied animation.`);
    } else {
        console.error(Date.now(), `setPage: New page element for '${newPage}' not found.`);
    }

    currentPage = newPage;
    updateUI();
    console.log(Date.now(), `setPage: Page switched to: ${currentPage}.`);
}

function updateUI() {
    console.log(Date.now(), `updateUI: Updating UI for current page: ${currentPage}. Auth Ready: ${isAuthReady}`);

    const interactiveElements = [
        homePageElement, generatorPageElement, logoBtn,
        hamburgerBtn, closeMobileMenuBtn, mobileMenuOverlay,
        startCreatingBtn, promptInput, copyPromptBtn, clearPromptBtn, generateBtn,
        enhanceBtn, variationBtn, useEnhancedPromptBtn,
        downloadBtn, signInBtnDesktop, signOutBtnDesktop,
        signInBtnMobile, signOutBtnMobile, modalSignInBtn,
        closeSigninModalBtn
    ];

    interactiveElements.forEach(el => {
        if (el) {
            const isAuthButton = el.id && (el.id.includes('sign-in-btn') || el.id.includes('sign-out-btn') || el.id.includes('modal-sign-in-btn'));
            const isGeneratorButton = el.id && (el.id === 'generate-image-btn' || el.id === 'enhance-prompt-btn' || el.id === 'generate-variation-ideas-btn');
            
            if (isAuthButton) {
                el.disabled = isSigningIn;
                el.classList.toggle('opacity-50', isSigningIn);
                el.classList.toggle('cursor-not-allowed', isSigningIn);
            } else if (isGeneratorButton) {
                // Buttons are enabled if isAuthReady is true AND (user is logged in OR has free generations)
                const shouldDisableGenerator = !isAuthReady || (!currentUser && freeGenerationsLeft <= 0);
                el.disabled = loading || loadingEnhancePrompt || loadingVariationIdeas || shouldDisableGenerator;
                el.classList.toggle('opacity-50', el.disabled);
                el.classList.toggle('cursor-not-allowed', el.disabled);
            } else {
                // Other general buttons are enabled if isAuthReady is true
                el.disabled = !isAuthReady;
                el.classList.toggle('opacity-50', !isAuthReady);
                el.classList.toggle('cursor-not-allowed', !isAuthReady);
            }
        }
    });

    homePageElement?.classList.toggle('bg-white/10', currentPage === 'home');
    homePageElement?.classList.toggle('text-blue-100', currentPage === 'home');
    homePageElement?.classList.toggle('text-gray-300', currentPage !== 'home');

    generatorPageElement?.classList.toggle('bg-white/10', currentPage === 'generator');
    generatorPageElement?.classList.toggle('text-blue-100', currentPage === 'generator');
    generatorPageElement?.classList.toggle('text-gray-300', currentPage !== 'generator');
    console.log(Date.now(), "updateUI: Header button states updated.");

    if (currentPage === 'generator') {
        updateGeneratorPageUI();
    }
    updateUIForAuthStatus();
    console.log(Date.now(), "updateUI: Finished general UI update.");
}

function updateGeneratorPageUI() {
    console.log(Date.now(), "updateGeneratorPageUI: Updating dynamic generator UI.");
    if (promptInput) promptInput.value = prompt;

    if (freeGenerationsDisplay) {
        if (currentUser) {
            freeGenerationsDisplay.textContent = `You have unlimited generations!`;
            freeGenerationsDisplay.classList.remove('text-red-400', 'text-gray-400');
            freeGenerationsDisplay.classList.add('text-green-400');
            console.log(Date.now(), "updateGeneratorPageUI: Displaying unlimited generations for authenticated user.");
        } else {
            freeGenerationsDisplay.textContent = `You have ${freeGenerationsLeft} generations left without sign in.`;
            if (freeGenerationsLeft <= 0) {
                freeGenerationsDisplay.classList.remove('text-green-400', 'text-gray-400');
                freeGenerationsDisplay.classList.add('text-red-400');
                console.log(Date.now(), "updateGeneratorPageUI: Displaying 0 generations left, red text.");
            } else {
                freeGenerationsDisplay.classList.remove('text-red-400', 'text-gray-400');
                freeGenerationsDisplay.classList.add('text-green-400');
                console.log(Date.now(), "updateGeneratorPageUI: Displaying free generations left, green text.");
            }
        }
    }

    populateAspectRatioRadios();

    if (generateBtn) {
        let buttonText = 'Generate Image';
        let loadingText = 'Generating...';

        if (!currentUser && freeGenerationsLeft <= 0) {
            buttonText = 'Sign In to Generate More';
        }

        generateBtn.innerHTML = loading ? `
            <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
                ${loadingText}
            </span>
        ` : buttonText;

        generateBtn.classList.toggle('bg-gray-700', loading);
        generateBtn.classList.toggle('cursor-not-allowed', loading);
        generateBtn.classList.toggle('bg-gradient-to-r', !loading);

        generateBtn.classList.remove('from-blue-700', 'to-indigo-800', 'hover:from-blue-800', 'hover:to-indigo-900',
                                   'from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800',
                                   'from-gray-600', 'to-gray-700', 'hover:from-gray-700', 'hover:to-gray-800');


        if (loading) {
            // Handled above
        } else if (!currentUser && freeGenerationsLeft <= 0) {
            generateBtn.classList.add('from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800');
            generateBtn.disabled = false;
        } else {
            generateBtn.classList.add('from-blue-700', 'to-indigo-800', 'hover:from-blue-800', 'hover:to-indigo-900');
            generateBtn.disabled = false;
        }
        console.log(Date.now(), "updateGeneratorPageUI: Generate button state updated.");
    }

    if (errorDisplay) {
        errorDisplay.textContent = currentError;
        errorDisplay.classList.toggle('hidden', !currentError);
        console.log(Date.now(), "updateGeneratorPageUI: Error display updated. Hidden:", !currentError);
    }

    if (imageDisplayContainer &&
