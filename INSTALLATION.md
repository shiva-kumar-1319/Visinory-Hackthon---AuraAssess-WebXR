# Local Installation & Secure Mobile WebXR Setup

This document provides the technical protocols required to establish, deploy, and locally debug AuraAssess WebXR on target mobile testing hardware.

---

## I. Cryptographic & Security Constraints (HTTPS Requirement)

Modern mobile browser engines (Safari on iOS and Chrome on Android) enforce strict secure context policies. The following APIs are permanently blocked over unencrypted HTTP connections:

*   **WebXR Device API** (Immersive AR session tracking)
*   **Device Orientation & Motion APIs** (Sliding-window accelerometer/gyroscope telemetry)
*   **MediaDevices API** (WebGL background video texture stream)

To run local evaluations on physical smartphones during testing, the local development server must compile using self-signed Secure Socket Layer (SSL) certificates.

---

## II. Local Environment Configuration

### 1. Prerequisites

Ensure the development environment has Node.js (v18.0.0 or higher) and npm (v9.0.0 or higher) installed globally.

### 2. Project Scaffolding & Installation

Navigate to your local root workspace directory in VS Code and execute the dependency installer:

```bash
# Clone/download the project files, enter the directory and run:
npm install
```

### 3. SSL Configuration on Vite

The `vite.config.js` file is configured to dynamically spin up a local HTTPS server using `@vitejs/plugin-basic-ssl`:

```javascript
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl()
  ],
  server: {
    host: true,
    port: 3000,
    https: true
  }
});
```

---

## III. Mobile Deployment and LAN Handshake Protocols

To test the live WebXR workspace on your physical mobile phone, the phone and your development computer must reside on the same local area network (LAN/Wi-Fi).

### 1. Launching the Local Engine

Execute the following run command in your VS Code terminal:

```bash
npm run dev
```

The Vite compiler will output two secure access addresses:
*   **Local**: `https://localhost:3000/` (for desktop testing)
*   **Network**: `https://192.168.X.X:3000/` (your local computer's IP address)

*(Note: If port 3000 is in use, Vite will automatically increment the port to 3001, 3002, etc.)*

### 2. Resolving Browser Certificate Interceptions

When you enter the Network URL (e.g. `https://192.168.X.X:3000/`) into Chrome Mobile or iOS Safari:

1.  **SSL Alert**: The browser will block initial loading and show a "Your connection is not private" or "Untrusted Certificate" warning. This occurs because the local Vite server uses an unsigned local certificate.
2.  **Bypass Protocol**: Click **"Advanced"** (on Chrome) or **"Show Details"** (on Safari) and select **"Proceed to 192.168.X.X (unsafe)"** or **"Trust Certificate"**.
3.  **Sensor Authorization**: The candidate onboarding UI (lobby screen) will render. Upon clicking "Enter Spatial Assessment", authorize the prompts requesting permissions for **Camera Access** and **Motion & Orientation Sensors**.

---

## IV. Real-Time Remote Debugging and Diagnostic Loops

To log physical coordinate matrices and debug the on-device accelerometer variance formulas in real time, configure standard remote debugging tunnels.

### 1. Android Remote Debugging (Chrome DevTools)

1.  On your Android mobile device, enable **USB Debugging** inside **Developer Options**.
2.  Connect the device to your computer via USB.
3.  Open Chrome on your computer and navigate to `chrome://inspect/#devices`.
4.  Locate your running webapp tab under your connected device, and click **"Inspect"** to open a shared terminal console displaying physical telemetry outputs.

### 2. iOS Remote Debugging (Safari Web Inspector)

1.  On your iPhone, navigate to **Settings > Safari > Advanced** and toggle **"Web Inspector"** to active.
2.  Connect the iPhone to your macOS desktop.
3.  Launch Safari on macOS, click **"Develop"** on the menu bar, select your connected iPhone, and click your live WebXR address to view coordinate logs and console prints in real-time.
