import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. Firebase Configuration (Replace with your Firebase Project settings)
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// AI API Configuration (e.g., OpenRouter or Gemini)
const AI_API_KEY = "YOUR_AI_API_KEY"; 

// DOM Elements
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const taskList = document.getElementById('task-list');
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');

let currentUser = null;
let currentTasks = [];

// 2. Authentication Logic
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginContainer.classList.remove('active');
        dashboardContainer.classList.add('active');
        loadTasks();
        loadChats();
    } else {
        currentUser = null;
        loginContainer.classList.add('active');
        dashboardContainer.classList.remove('active');
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
        .catch(err => document.getElementById('auth-error').innerText = err.message);
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// 3. Database Sync (Tasks & Chats)
function loadTasks() {
    const q = query(collection(db, `users/${currentUser.uid}/tasks`));
    onSnapshot(q, (snapshot) => {
        taskList.innerHTML = '';
        currentTasks = [];
        snapshot.forEach((docSnap) => {
            const task = docSnap.data();
            task.id = docSnap.id;
            currentTasks.push(task);
            
            const div = document.createElement('div');
            div.className = 'task-item';
            div.innerHTML = `
                <span>${task.title}</span>
                <button class="delete-task" data-id="${task.id}">X</button>
            `;
            taskList.appendChild(div);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-task').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await deleteDoc(doc(db, `users/${currentUser.uid}/tasks`, e.target.dataset.id));
            });
        });
    });
}

function loadChats() {
    const q = query(collection(db, `users/${currentUser.uid}/messages`), orderBy('timestamp', 'asc'));
    onSnapshot(q, (snapshot) => {
        chatHistory.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            const div = document.createElement('div');
            div.className = `message ${msg.role}`;
            div.innerText = msg.content;
            chatHistory.appendChild(div);
        });
        chatHistory.scrollTop = chatHistory.scrollHeight;
    });
}

// 4. Chatbot & AI Logic
document.getElementById('send-btn').addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';

    // Save user message to Firebase
    await addDoc(collection(db, `users/${currentUser.uid}/messages`), {
        role: 'user', content: text, timestamp: new Date()
    });

    // Call AI API
    const systemPrompt = `You are a task manager assistant. The user's current tasks are: ${JSON.stringify(currentTasks)}. 
    Respond in strict JSON format: { "reply": "Your message to the user", "action": "add" | "delete" | "none", "taskTitle": "Task name if adding/deleting, else null" }`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${AI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "google/gemini-flash-1.5",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ]
            })
        });

        const data = await response.json();
        // Parse the AI's JSON output
        const aiJson = JSON.parse(data.choices[0].message.content.replace(/```json|```/g, ''));

        // Save AI reply to Firebase
        await addDoc(collection(db, `users/${currentUser.uid}/messages`), {
            role: 'bot', content: aiJson.reply, timestamp: new Date()
        });

        // Execute AI actions on the database
        if (aiJson.action === 'add' && aiJson.taskTitle) {
            await addDoc(collection(db, `users/${currentUser.uid}/tasks`), { title: aiJson.taskTitle });
        }
    } catch (error) {
        console.error("AI Error:", error);
    }
});
