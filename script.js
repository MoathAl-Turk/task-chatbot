// Import Firebase SDKs from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    updateDoc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Replace with your actual Firebase project configuration values
const firebaseConfig = {
 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const emailAuthForm = document.getElementById('email-auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const googleAuthBtn = document.getElementById('google-auth-btn');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');
const userDisplayEmail = document.getElementById('user-display-email');

const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

let unsubscribeTasks = null;

// Authentication State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userDisplayEmail.textContent = user.email;
        loadUserTasks(user.uid);
    } else {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        userDisplayEmail.textContent = '';
        taskList.innerHTML = '';
        if (unsubscribeTasks) unsubscribeTasks();
    }
});

// Email / Password Login & Registration Handler
emailAuthForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    const email = authEmailInput.value;
    const password = authPasswordInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (createError) {
            authError.textContent = createError.message;
        }
    }
});

// Google Sign-In Handler
googleAuthBtn.addEventListener('click', async () => {
    authError.textContent = '';
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        authError.textContent = error.message;
    }
});

// Logout Handler
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// Firestore: Load and Display Tasks for Current User Only
function loadUserTasks(uid) {
    const tasksRef = collection(db, `users/${uid}/tasks`);
    
    unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
        taskList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const taskData = docSnap.data();
            const li = document.createElement('li');
            li.className = `task-item ${taskData.completed ? 'completed' : ''}`;
            li.innerHTML = `
                <span>${escapeHtml(taskData.text)}</span>
                <div class="task-actions">
                    <button class="secondary-btn" onclick="window.toggleTask('${docSnap.id}', ${!taskData.completed})">${taskData.completed ? 'Undo' : 'Done'}</button>
                    <button class="delete-btn" onclick="window.deleteTask('${docSnap.id}')">✕</button>
                </div>
            `;
            taskList.appendChild(li);
        });
    });
}

// Add Task Handler
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text || !auth.currentUser) return;

    try {
        await addDoc(collection(db, `users/${auth.currentUser.uid}/tasks`), {
            text: text,
            completed: false,
            createdAt: new Date()
        });
        taskInput.value = '';
    } catch (error) {
        console.error("Error adding task: ", error);
    }
});

// Global helpers for task actions
window.toggleTask = async (taskId, newStatus) => {
    if (!auth.currentUser) return;
    try {
        await updateDoc(doc(db, `users/${auth.currentUser.uid}/tasks`, taskId), {
            completed: newStatus
        });
    } catch (error) {
        console.error("Error updating task: ", error);
    }
};

window.deleteTask = async (taskId) => {
    if (!auth.currentUser) return;
    try {
        await deleteDoc(doc(db, `users/${auth.currentUser.uid}/tasks`, taskId));
    } catch (error) {
        console.error("Error deleting task: ", error);
    }
};

// Secure OpenRouter API Key Handling & Chat Integration
document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('openrouter-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');

    const storedKey = localStorage.getItem('openrouter_api_key');
    if (storedKey && apiKeyInput) {
        apiKeyInput.value = storedKey;
    }

    saveKeyBtn?.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('openrouter_api_key', key);
            alert('OpenRouter API key saved securely in your browser!');
        } else {
            localStorage.removeItem('openrouter_api_key');
            alert('API key removed.');
        }
    });
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    const apiKeyInput = document.getElementById('openrouter-key-input');
    const savedApiKey = localStorage.getItem('openrouter_api_key');
    const apiKey = savedApiKey || apiKeyInput?.value.trim();

    if (!apiKey) {
        appendMessage("Please enter and save your OpenRouter API key above before chatting.", 'assistant');
        return;
    }

    appendMessage(prompt, 'user');
    chatInput.value = '';

    const typingMsg = appendMessage('Thinking...', 'assistant');

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "deepseek/deepseek-chat",
                "messages": [
                    { "role": "system", "content": "You are a helpful task management assistant." },
                    { "role": "user", "content": prompt }
                ]
            })
        });

        const data = await response.json();
        
        if (response.status === 401) {
            typingMsg.textContent = "Error: Invalid OpenRouter API key. Please check your key.";
            return;
        }

        const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
        typingMsg.textContent = reply;
    } catch (error) {
        typingMsg.textContent = "Error communicating with AI assistant.";
    }
});

function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
