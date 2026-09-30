import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// 1. Firebase & API Config
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const OPENROUTER_API_KEY = "YOUR_OPENROUTER_API_KEY";

// DOM Elements
const ui = {
    login: document.getElementById('login-container'),
    dash: document.getElementById('dashboard-container'),
    email: document.getElementById('email'),
    pass: document.getElementById('password'),
    tasks: document.getElementById('task-list'),
    chats: document.getElementById('chat-history'),
    input: document.getElementById('chat-input'),
    profilePic: document.getElementById('user-profile-pic'),
    displayName: document.getElementById('user-display-name')
};

let currentUser = null;
let currentTasks = [];

// 2. Authentication Logic
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        ui.login.classList.remove('active');
        ui.dash.classList.add('active');
        
        // Update header with Google Profile info if it exists
        if (user.displayName) ui.displayName.innerText = `${user.displayName}'s Schedule`;
        if (user.photoURL) {
            ui.profilePic.src = user.photoURL;
            ui.profilePic.style.display = 'block';
        }
        
        loadData();
    } else {
        currentUser = null;
        ui.login.classList.add('active');
        ui.dash.classList.remove('active');
        ui.profilePic.style.display = 'none';
        ui.displayName.innerText = 'My Schedule';
    }
});

// Email/Password Logins
document.getElementById('login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, ui.email.value, ui.pass.value)
        .catch(err => document.getElementById('auth-error').innerText = err.message);
});
document.getElementById('register-btn').addEventListener('click', () => {
    createUserWithEmailAndPassword(auth, ui.email.value, ui.pass.value)
        .catch(err => document.getElementById('auth-error').innerText = err.message);
});

// Google Popup Login
document.getElementById('google-login-btn').addEventListener('click', () => {
    signInWithPopup(auth, googleProvider)
        .catch(err => document.getElementById('auth-error').innerText = err.message);
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// 3. Database Sync (Tasks & Chats)
function loadData() {
    onSnapshot(query(collection(db, `users/${currentUser.uid}/tasks`)), (snapshot) => {
        ui.tasks.innerHTML = '';
        currentTasks = [];
        snapshot.forEach((docSnap) => {
            const task = { id: docSnap.id, ...docSnap.data() };
            currentTasks.push(task);
            
            const div = document.createElement('div');
            div.className = 'task-item';
            div.innerHTML = `<span>${task.title}</span><button class="delete-task" data-id="${task.id}">X</button>`;
            ui.tasks.appendChild(div);
        });

        document.querySelectorAll('.delete-task').forEach(btn => {
            btn.addEventListener('click', (e) => deleteDoc(doc(db, `users/${currentUser.uid}/tasks`, e.target.dataset.id)));
        });
    });

    onSnapshot(query(collection(db, `users/${currentUser.uid}/messages`), orderBy('timestamp', 'asc')), (snapshot) => {
        ui.chats.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            ui.chats.innerHTML += `<div class="message ${msg.role}">${msg.content}</div>`;
        });
        ui.chats.scrollTop = ui.chats.scrollHeight;
    });
}

// 4. AI Communication Loop
document.getElementById('send-btn').addEventListener('click', async () => {
    const text = ui.input.value.trim();
    if (!text) return;
    ui.input.value = '';

    await addDoc(collection(db, `users/${currentUser.uid}/messages`), { role: 'user', content: text, timestamp: new Date() });

    const prompt = `You are a task manager. The user's tasks are: ${JSON.stringify(currentTasks)}. 
    Respond in strict JSON: {"reply": "Chat response to user", "action": "add|delete|none", "taskTitle": "Task name if adding, else null"}`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "google/gemini-flash-1.5",
                messages: [{ role: "system", content: prompt }, { role: "user", content: text }]
            })
        });

        const data = await response.json();
        const aiJson = JSON.parse(data.choices[0].message.content.replace(/```json|```/g, ''));

        await addDoc(collection(db, `users/${currentUser.uid}/messages`), { role: 'bot', content: aiJson.reply, timestamp: new Date() });

        if (aiJson.action === 'add' && aiJson.taskTitle) {
            await addDoc(collection(db, `users/${currentUser.uid}/tasks`), { title: aiJson.taskTitle });
        }
    } catch (error) {
        console.error("Error:", error);
    }
});
