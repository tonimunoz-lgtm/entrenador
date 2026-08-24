/* ==========================================================================
   FORJA21 — Sincronización en la nube (Firebase Auth + Firestore)

   Esto NO hace nada hasta que pegues tu configuración real de Firebase
   aquí abajo. Mientras tanto la app sigue funcionando 100% en local
   (localStorage), exactamente igual que hasta ahora.

   Cómo activarlo:
   1. Sustituye los valores de FIREBASE_CONFIG por los de tu proyecto
      (Firebase Console → Configuración del proyecto → General → Tus apps).
   2. Activa el proveedor "Google" en Authentication → Sign-in method.
   3. Crea la base de datos en Firestore (modo producción).
   4. Pega las reglas de seguridad de más abajo en Firestore → Reglas.
   ========================================================================== */

// ⚠️ PEGA AQUÍ TU CONFIGURACIÓN REAL DE FIREBASE ⚠️
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCIWY-_Sv-Bi5PHYy-IUKX3LrC0VxMcxGg",
  authDomain: "impostor-f0c2d.firebaseapp.com",
  projectId: "impostor-f0c2d",
  storageBucket: "impostor-f0c2d.firebasestorage.app",
  messagingSenderId: "323566797024",
  appId: "1:323566797024:web:bb7651fe1f8bc08f7a1085"
};

/* ---------------------------------------------------------------------
   Reglas de seguridad de Firestore — pégalas en Firebase Console →
   Firestore Database → Reglas. Cada usuario solo puede leer/escribir
   su propia ruta (users/{su-propio-uid}/...).

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
         match /{document=**} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
   }
   --------------------------------------------------------------------- */

const FIREBASE_ENABLED = FIREBASE_CONFIG.apiKey !== "PEGA_TU_API_KEY" && typeof firebase !== "undefined";

let fbAuth = null, fbDb = null;

if (FIREBASE_ENABLED) {
  firebase.initializeApp(FIREBASE_CONFIG);
  fbAuth = firebase.auth();
  fbDb = firebase.firestore();
  fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {
    // Falla en pestañas múltiples o navegadores sin soporte — no es grave,
    // Firestore sigue funcionando, solo sin caché offline avanzada.
  });
}

const CloudSync = {
  enabled: FIREBASE_ENABLED,
  user: null,
  syncing: false,
  _authListeners: [],

  onAuthChange(cb) {
    this._authListeners.push(cb);
    if (this.user !== null) cb(this.user); // por si ya hay sesión al suscribirse
  },

  async signUpWithEmail(email, password) {
    if (!FIREBASE_ENABLED) return;
    await fbAuth.createUserWithEmailAndPassword(email, password);
  },

  async signInWithEmail(email, password) {
    if (!FIREBASE_ENABLED) return;
    await fbAuth.signInWithEmailAndPassword(email, password);
  },

  async resetPassword(email) {
    if (!FIREBASE_ENABLED) return;
    await fbAuth.sendPasswordResetEmail(email);
  },

  async signOutUser() {
    if (!FIREBASE_ENABLED) return;
    await fbAuth.signOut();
  },

  userRef(uid) { return fbDb.collection("users").doc(uid); },

  async pullAll(uid) {
    const userDoc = await this.userRef(uid).get();
    const settings = userDoc.exists ? userDoc.data().settings || null : null;

    const [weightsSnap, workoutsSnap, suppsSnap] = await Promise.all([
      this.userRef(uid).collection("weights").get(),
      this.userRef(uid).collection("workouts").orderBy("date", "desc").get(),
      this.userRef(uid).collection("supps").get()
    ]);

    const weights = weightsSnap.docs.map(d => d.data());
    const workouts = workoutsSnap.docs.map(d => d.data());
    const supps = {};
    suppsSnap.docs.forEach(d => { supps[d.id] = d.data().checked || []; });

    return { settings, weights, workouts, supps };
  },

  async pushSettings(uid, settings) {
    if (!FIREBASE_ENABLED || !uid) return;
    await this.userRef(uid).set({ settings }, { merge: true });
  },

  /* ---------------------------------------------------------------
     Datos del nuevo sistema personalizado.
     Se guardan aparte de settings para no mezclar nunca los perfiles
     legacy de Toni/Beizga con el onboarding de usuarios nuevos.
     --------------------------------------------------------------- */
  async pullPersonalizedOnboarding(uid) {
    if (!FIREBASE_ENABLED || !uid) return null;
    const snap = await this.userRef(uid).collection("personalized").doc("onboarding").get();
    return snap.exists ? snap.data() : null;
  },

  async pushPersonalizedOnboarding(uid, payload) {
    if (!FIREBASE_ENABLED || !uid) return;
    await this.userRef(uid).collection("personalized").doc("onboarding").set(payload, { merge: true });
  },

  async pullPersonalizedPlan(uid) {
    if (!FIREBASE_ENABLED || !uid) return null;
    const snap = await this.userRef(uid).collection("personalized").doc("plan").get();
    return snap.exists ? snap.data() : null;
  },

  async pushPersonalizedPlan(uid, payload) {
    if (!FIREBASE_ENABLED || !uid) return;
    await this.userRef(uid).collection("personalized").doc("plan").set(payload, { merge: false });
  },
  async pushWeight(uid, entry) {
    if (!FIREBASE_ENABLED || !uid) return;
    await this.userRef(uid).collection("weights").doc(String(entry.week)).set(entry);
  },
  async pushWorkout(uid, entry) {
    if (!FIREBASE_ENABLED || !uid) return;
    await this.userRef(uid).collection("workouts").doc(entry.id).set(entry);
  },
  async pushSupps(uid, dk, checkedArr) {
    if (!FIREBASE_ENABLED || !uid) return;
    await this.userRef(uid).collection("supps").doc(dk).set({ checked: checkedArr });
  },
  async deleteAllCloudData(uid) {
    if (!FIREBASE_ENABLED || !uid) return;
    const cols = ["weights", "workouts", "supps", "personalized"];
    for (const col of cols) {
      const snap = await this.userRef(uid).collection(col).get();
      await Promise.all(snap.docs.map(d => d.ref.delete()));
    }
    await this.userRef(uid).delete();
  },
  // Borra los datos Y la cuenta de Firebase Authentication (no solo los datos).
  // Firebase exige un login "reciente" para esta operación; si ha pasado tiempo
  // desde el último inicio de sesión, lanza auth/requires-recent-login y hay que
  // pedir que vuelva a iniciar sesión antes de reintentar.
  async deleteAccount(uid) {
    if (!FIREBASE_ENABLED || !uid) return;
    await this.deleteAllCloudData(uid);
    if (fbAuth.currentUser) await fbAuth.currentUser.delete();
  }
};

if (FIREBASE_ENABLED) {
  fbAuth.onAuthStateChanged(user => {
    CloudSync.user = user;
    CloudSync._authListeners.forEach(cb => cb(user));
  });
  // Recoge el resultado si veníamos de un signInWithRedirect
  fbAuth.getRedirectResult().catch(() => {});
}

window.CloudSync = CloudSync;
