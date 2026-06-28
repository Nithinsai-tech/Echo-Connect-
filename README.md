# Echo Connect – Production-Grade Scalable Real-Time Chat System

Echo Connect is a full-stack, enterprise-grade, horizontally scalable real-time chat application. It features a stunning glassmorphic React web client and a highly secure, modular Node.js backend containerized for production deployment.

---

## 🚀 Key Features

* **Real-time Bidirectional WebSockets**: Instantaneous text messages, stickers, media attachments, and read status indicators driven by **Socket.IO**.
* **Horizontal Socket Scaling**: Integrated with a **Redis Pub/Sub adapter** to sync websocket events across multiple clustered backend nodes seamlessly.
* **Persistent Chat History**: Core message streams, participant arrays, and conversation logs are indexed and stored in **MongoDB Atlas**.
* **JWT Session Security**: Secure token rotation using in-memory `accessToken` and cookie-less `refreshToken` storage with Axios authorization interceptors.
* **Google OAuth 2.0 Integration**: Built-in Google Passport strategy for hassle-free authentication, auto-creating user profiles, and linking with local registration credentials.
* **Personalization Engine**: Global context-driven client styling allowing real-time adjustment of:
  * Theme mode (Light / Dark)
  * Customized Accent Colors (Orange, Blue, Green, Purple, Pink)
  * Chat Bubble Styles & Background Wallpaper
  * Chat text sizing (Small, Medium, Large, Extra Large)
  * High Contrast Mode for accessibility
* **WebRTC Calling Signaling**: Full peer-to-peer audio and video signaling pipelines built directly into the Socket.IO protocol.
* **Message Controls**: Enhanced timeline utilities including:
  * Message Star/Favorite logs (persisted locally)
  * Direct replies and forwards across rooms
  * Pinned messaging systems
  * Delete For Me (REST endpoint) and Delete For Everyone (real-time socket sync)
  * Sticker & Custom emoji picker
* **Cloudinary Media Streaming**: Stream-based uploads that bypass intermediate server disk writes, utilizing Multer memory buffers to directly push files to Cloudinary.
* **Security & Defense**: Built-in security headers via **Helmet**, **CORS** configurations, and IP-based rate limiting on sensitive auth routes to prevent spam.

---

## 🛠️ Tech Stack & Dependencies

* **Frontend**: React (Vite), TailwindCSS, custom HSL style system, Lucide Icons, Date-fns, React Window (list virtualization for 100+ message logs).
* **Backend**: Node.js, Express.js REST API.
* **Real-Time Layer**: Socket.IO client & server.
* **Database & Storage**: MongoDB (Mongoose ODM), Cloudinary.
* **Orchestration**: Docker, Docker Compose, Redis.

---

## 📦 System Architecture Diagram

```
                                 +--------------------------------+
                                 |     React Frontend Client      |
                                 +--------------------------------+
                                  /       |                      \
                     REST APIs   /        | Theme/Config          \ WebSockets & WebRTC
                                v         v                        v
                  +-------------------+ +-------------------+  +------------------+
                  |  Express Servers  | |  LocalStorage &   |  | Socket.IO nodes  |
                  +-------------------+ |  Visual State     |  +------------------+
                  | Passport Google,  | +-------------------+  | presence, DMs,   |
                  | Rate Limiters     |                        | read receipts    |
                  +-------------------+                        +------------------+
                            |                                           |
                            v                                           v
                  +-------------------+                        +------------------+
                  |  MongoDB / Atlas  |                        |  Redis Pub/Sub   |
                  | (Persistent logs) |                        |  Adapter Sync    |
                  +-------------------+                        +------------------+
                            |
                            v
                  +-------------------+
                  |  Cloudinary API   |
                  | (Media Storage)   |
                  +-------------------+
```

---

## 📂 Directory Map

```
/
├── backend/
│   ├── src/
│   │   ├── config/          # Database connection, Passport OAuth loaders
│   │   ├── controllers/     # Authentication, Room, and Message business logic
│   │   ├── middleware/      # JWT guards, Multer uploaders, Rate Limiters
│   │   ├── models/          # Persistent Schemas (User, ChatRoom, Message)
│   │   ├── routes/          # Express REST endpoint mappings
│   │   ├── services/        # Presence trackers, Cloudinary handlers
│   │   ├── socket/          # WebSocket event registrations (messaging, calling)
│   │   └── app.js           # Express app initialization
│   ├── uploads/             # Temp disk assets directory (if configured)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client configuration & REST calls
│   │   ├── components/      # UI: Sidebar, ChatWindow, Modals, ProtectedRoute
│   │   ├── context/         # Auth, Chat, Socket, Theme, and Toast Contexts
│   │   ├── hooks/           # useAuth, useSocket, useChat hooks
│   │   ├── pages/           # Chat Workspace, Login, Register, AuthCallback
│   │   ├── utils/           # Time formatters, initials/avatar helper generators
│   │   └── App.jsx          # Router & Global Context wraps
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       # Orchestrates multi-node backend, Redis & MongoDB
└── README.md
```

---

## ⚙️ Setup & Installation

### Option A: Local Run (Out of the Box)

#### 1. Setup Backend Node Server
Configure `backend/.env` using the fields from `backend/.env.example`:
```bash
cd backend
npm install
npm run dev
```
*Backend listener spins up on: `http://localhost:5000`*

#### 2. Setup React Web Client
Configure `frontend/.env` if custom API paths are required:
```bash
cd ../frontend
npm install
npm run dev
```
*Vite dev server launches on: `http://localhost:5173`*

---

### Option B: Docker Compose (Horizontal Cluster Scaling)

To test event synchronization between multiple nodes:
1. Ensure **Docker Desktop** is open and running.
2. In the repository root directory, run:
   ```bash
   docker-compose up --build
   ```
3. Open your browser:
   * **Frontend Client UI**: `http://localhost:8080`
   * **Backend Node 1 Instance**: `http://localhost:5001`
   * **Backend Node 2 Instance**: `http://localhost:5002`

---

## 📡 API Reference

### 1. REST Endpoints

| Category | Method | Path | Description | Protected |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Register profile & get JWT tokens | No |
| **Auth** | `POST` | `/api/auth/login` | Validate user & get JWT tokens | No |
| **Auth** | `POST` | `/api/auth/refresh` | Rotate access and refresh tokens | No |
| **Auth** | `POST` | `/api/auth/logout` | Revoke tokens & clear session | No |
| **Auth** | `GET` | `/api/auth/google` | Trigger Google OAuth flow redirection | No |
| **Auth** | `GET` | `/api/auth/google/callback` | Google OAuth callback handler | No |
| **Users** | `GET` | `/api/users/me` | Retrieve active credentials profile | **Yes** |
| **Users** | `GET` | `/api/users` | List all registered users | **Yes** |
| **Rooms** | `POST` | `/api/rooms` | Create DM or Group Chat room | **Yes** |
| **Rooms** | `GET` | `/api/rooms` | Get recent conversations lists | **Yes** |
| **Messages**| `GET` | `/api/rooms/:roomId/messages`| Get chat history (Cursor Paginated) | **Yes** |
| **Messages**| `DELETE`| `/api/messages/:messageId`| Delete a message for active user | **Yes** |
| **Uploads** | `POST` | `/api/uploads` | Upload media attachment to Cloudinary | **Yes** |

### 2. Socket.IO Events

| Client-to-Server Event | Payload | Description |
| :--- | :--- | :--- |
| **`room:join`** | `{ roomId }` | Join specific room channel |
| **`room:leave`** | `{ roomId }` | Leave specific room channel |
| **`message:send`** | `{ roomId, content, type, mediaUrl }` | Dispatch message to a room |
| **`message:delivered`** | `{ messageId, roomId }` | Signal that a message has arrived |
| **`message:read`** | `{ roomId }` | Mark all unread messages as read |
| **`typing:start`** | `{ roomId }` | Broadcast user typing indicator |
| **`typing:stop`** | `{ roomId }` | Dismiss user typing indicator |
| **`call:initiate`** | `{ roomId, targetUserId, type, offer }` | Initialize WebRTC connection |
| **`call:answer`** | `{ callerId, answer }` | Answer incoming WebRTC call |
| **`call:reject`** | `{ callerId }` | Reject incoming WebRTC call |
| **`call:candidate`** | `{ targetUserId, candidate }` | Share ICE Candidate signaling |
| **`call:end`** | `{ targetUserId }` | Terminate active WebRTC session |

---

## 🧪 Integration Testing & Verification

Echo Connect features an automated testing framework (`backend/test_suite.js`) to assert connection logic under load. To run the suite:
```bash
cd backend
node test_suite.js
```
The suite verifies REST APIs, JWT authentication, typing status indicators, message delivery receipts, read receipts, cursor-based pagination, and message deletions.
