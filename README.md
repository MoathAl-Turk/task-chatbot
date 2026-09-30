# task-chatbot

Im making a task-manager-chatbot using a new approach i learned called the firebase authentication ; its a managed backend service by Google that handles user identity, secure login flows, and session management entirely outside of your application's code. Instead of you writing the security logic to protect passwords and manage tokens, Google provides a pre-built system that connects directly to your frontend JavaScript.

## Core Features

*   **Serverless Architecture:** Hosted purely as static files (HTML/CSS/JS) without the need to deploy or maintain a Node.js server.
*   **Google Sign-In integration:** Allows users to create an account with email and password or use Firebase's native OAuth to log in securely with their Google account in one click.
*   **Real-time Firestore Database:** A NoSQL database that automatically syncs the user's task board across devices the moment the AI edits them.
*   **AI Context Awareness:** The chatbot reads your current schedule invisibly and responds with structured JSON commands to programmatically add and delete tasks on your visual board based on conversational commands.

        
