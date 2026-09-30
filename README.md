# task-chatbot

Im making a task chatbot that has a databse so that when a user launches this webdite it can interact with him and arrange his tasks and save it in a database

  1.The database schema :its constructed of three main Tables
  \n
  A:Users
  \n
  B:Conversations
  C:Messages
  
2. User Authentication: When a user logs in we need him to stay logged in across diffrent page reloads by verifying their credintials in the backend; when user enters their email and password the backend checks the users
table , if it matches it send a JSON web-token and sends it to the fron end, so the front end stores this token so that for every reload or loading chats (request) the frontend attaches this token so the backend knows
exactly whos making the request

        
