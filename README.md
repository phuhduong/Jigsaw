![Jigsaw Logo](assets/logo_w_text.png)

**From natural language to a verified component list in minutes.**

[Devpost](https://devpost.com/software/jigsaw-make-your-pcb-board-click) • [Pitch Deck](https://www.figma.com/slides/94eWyD99wBcK8kr5nobDi2/Jigsaw?node-id=1-510&t=PplOcCx70slVACQC-1) • [Installation](#installation)

---

Jigsaw automates PCB component selection. Describe your circuit in natural language and it searches DigiKey for real parts, checks voltage and interface compatibility, and generates a BOM with pricing.

---

## Installation

You'll need three things running: the MCP server (DigiKey), the backend (Flask + Gemini), and the frontend.

### Prerequisites

- Python 3.11+
- Node.js 18+ and Yarn
- A free [Gemini API key](https://aistudio.google.com/apikey)
- Free [DigiKey API credentials](https://developer.digikey.com/) (register an app to get a client ID and secret)

### 1. MCP Server

```bash
cd mcp-server
cp .env.template .env
# Fill in DIGIKEY_CLIENT_ID and DIGIKEY_CLIENT_SECRET in .env
npm install
npm run build
npm start
```

The MCP server runs on `http://localhost:8080`.

### 2. Backend

```bash
cd backend
cp .env.template .env
# Fill in GEMINI_API_KEY in .env
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The backend runs on `http://localhost:3001`.

### 3. Frontend

```bash
cd frontend
yarn install
yarn dev
```

Open `http://localhost:5173`.

---

## Team

**Charles Muehlberger** • **Luke Sanborn** • **Phu Duong**

Built at **HackPrinceton Spring 2025** — Winner, Best Business + Enterprise Hack
