/**
 * DMG Profile Authentication Helper
 * Include this in any widget that needs to know who's logged in
 *
 * Usage:
 * <script src="profile-auth.js"></script>
 * <script>
 *   const user = await DMGAuth.getUser();
 *   if (user) {
 *     console.log('Logged in as:', user.name);
 *   } else {
 *     console.log('Not logged in');
 *   }
 * </script>
 */

const DMGAuth = (function() {
    const STORAGE_KEY = 'dmg_profile_session';
    const REMEMBER_KEY = 'dmg_profile_remember';

    // Firebase config
    const firebaseConfig = {
        apiKey: "AIzaSyBrV1NuvPO-_CLtQPyOhR_ERsRvE2dxDlY",
        authDomain: "dmg-command-centre-native.firebaseapp.com",
        projectId: "dmg-command-centre-native",
        storageBucket: "dmg-command-centre-native.appspot.com",
        messagingSenderId: "223535956454",
        appId: "1:223535956454:web:b25e5bc69d8a4a7f209627"
    };
    const appId = "dmg-command-centre-native";

    let cachedUser = null;
    let db = null;

    // Get current logged in user
    async function getUser() {
        // Return cached if available
        if (cachedUser) return cachedUser;

        // Check localStorage
        const remembered = localStorage.getItem(REMEMBER_KEY);
        const session = localStorage.getItem(STORAGE_KEY);

        if (!remembered || !session) return null;

        try {
            const sessionData = JSON.parse(session);
            if (!sessionData.staffId) return null;

            // Initialize Firebase if needed
            if (!db) {
                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
                const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const { getAuth, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

                const app = initializeApp(firebaseConfig, 'dmg-auth-helper');
                db = getFirestore(app);
                const auth = getAuth(app);
                await signInAnonymously(auth);
            }

            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

            // Fetch staff member
            const staffDoc = await getDoc(doc(db, "artifacts", appId, "public", "data", "staff_directory", sessionData.staffId));

            if (staffDoc.exists()) {
                cachedUser = {
                    id: staffDoc.id,
                    ...staffDoc.data(),
                    email: sessionData.email
                };
                return cachedUser;
            }

            return null;
        } catch (e) {
            console.log('DMGAuth: Failed to get user', e);
            return null;
        }
    }

    // Check if logged in (quick check, no Firebase call)
    function isLoggedIn() {
        const remembered = localStorage.getItem(REMEMBER_KEY);
        const session = localStorage.getItem(STORAGE_KEY);
        return !!(remembered && session);
    }

    // Get session data (quick, no Firebase)
    function getSession() {
        const session = localStorage.getItem(STORAGE_KEY);
        if (!session) return null;
        try {
            return JSON.parse(session);
        } catch (e) {
            return null;
        }
    }

    // Clear session (logout)
    function logout() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(REMEMBER_KEY);
        cachedUser = null;
        window.postMessage({ type: 'DMG_PROFILE_LOGOUT' }, '*');
    }

    // Listen for login/logout events from other widgets
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'DMG_PROFILE_LOGIN') {
            cachedUser = e.data.staffMember;
        } else if (e.data?.type === 'DMG_PROFILE_LOGOUT') {
            cachedUser = null;
        }
    });

    return {
        getUser,
        isLoggedIn,
        getSession,
        logout
    };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DMGAuth;
}
