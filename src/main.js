import * as THREE from 'three';
import { SceneEngine } from './scene-engine.js';
import { SensorStabilityDetector } from './sensor-stability.js';
import { GenerativeAPI } from './api.js';

class AppController {
  constructor() {
    this.sceneEngine = null;
    this.stabilityDetector = new SensorStabilityDetector(0.04, 500);
    this.api = null;
    
    // Evaluation Metrics and Trackers
    this.currentStepIndex = 0;
    this.steps = [
      "Place Assembly Anchor",
      "Verify Rotor Casing Alignment",
      "Secure Fasteners and Bolts",
      "Calibrate Drive Shaft Rotation",
      "Final Performance Check"
    ];

    this.userPath = [];
    this.expertPath = [];
    this.startTime = 0;
    this.isRecording = false;
    this.isEvaluating = false;

    this.initUI();
  }

  initUI() {
    document.getElementById('start-btn').addEventListener('click', this.startSession.bind(this));
    
    const manualBtn = document.getElementById('manual-capture-btn');
    if (manualBtn) {
      manualBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Avoid triggering placement touch
        if (this.sceneEngine && this.sceneEngine.isAnchored) {
          this.executeVisualCapture();
        } else {
          alert("Please place the pump model on your desk first!");
        }
      });
    }
  }

  async startSession() {
    const keyInput = document.getElementById('api-key-input').value.trim();
    this.api = new GenerativeAPI(keyInput || null);

    // Initializing hardware sensor listeners
    const allowed = await this.stabilityDetector.initialize();
    if (!allowed) console.warn("Access denied for hardware motion telemetry. Running simulation mode.");

    document.getElementById('lobby-ui').classList.add('opacity-0');
    setTimeout(() => {
      document.getElementById('lobby-ui').classList.add('hidden');
      document.getElementById('hud-ui').classList.remove('hidden');
    }, 500);

    this.sceneEngine = new SceneEngine();
    await this.sceneEngine.startWebXR();
    
    // Bind touch/click events directly to canvas-container to resolve iOS Safari click bubbling issues
    const container = document.getElementById('canvas-container');
    if (container) {
      const handlePlacement = (event) => {
        if (this.sceneEngine && !this.sceneEngine.isAnchored) {
          const se = this.sceneEngine;
          if (se.isFallbackMode || (se.xrSession && se.reticle.visible)) {
            se.buildIndustrialPumpModel();
            this.currentStepIndex = 1;
            document.getElementById('step-display').innerText = `Step 2: ${this.steps[1]}`;
          }
        }
      };

      container.addEventListener('click', handlePlacement);
      container.addEventListener('touchstart', (event) => {
        if (event.touches.length === 1) {
          handlePlacement(event);
        }
      }, { passive: true });
    }

    // Hook stabilization event bindings
    this.stabilityDetector.onStabilityChange = this.onStabilityStateChange.bind(this);
    
    this.startTime = performance.now();
    this.isRecording = true;
    this.generateExpertReferenceTrajectory();
    
    // Bind main WebXR/requestAnimationFrame Loop
    this.sceneEngine.renderer.setAnimationLoop(this.tick.bind(this));
  }

  generateExpertReferenceTrajectory() {
    for (let t = 0; t < 100; t++) {
      const angle = (t / 100) * Math.PI * 2;
      this.expertPath.push({ x: Math.cos(angle) * 0.2, y: 0.17, z: Math.sin(angle) * 0.2 });
    }
  }

  tick(time, frame) {
    this.sceneEngine.updateXR(frame);

    if (this.isRecording && this.sceneEngine.isAnchored) {
      this.trackKinematics();
    }

    // Capture WebXR Frame to render
    this.sceneEngine.renderer.render(this.sceneEngine.scene, this.sceneEngine.camera);
    
    // Update live sensor telemetry indicators inside the HUD
    this.updateHUDTelemetry();
  }

  trackKinematics() {
    const cam = this.sceneEngine.camera;
    this.userPath.push({ x: cam.position.x, y: cam.position.y, z: cam.position.z });
    
    // Limit log memory size
    if (this.userPath.length > 500) this.userPath.shift();

    // Compute Kinematic Path Efficiency
    const pathEfficiency = this.calculateKinematicPathEfficiency();
    document.getElementById('path-efficiency-val').innerText = `${pathEfficiency.toFixed(1)}%`;
  }

  calculateKinematicPathEfficiency() {
    if (this.userPath.length < 5) return 100.0;
    
    let cumulativeDistance = 0;
    const limit = Math.min(this.userPath.length, this.expertPath.length);

    for (let i = 0; i < limit; i++) {
      const u = this.userPath[i];
      const e = this.expertPath[i];
      cumulativeDistance += Math.sqrt(Math.pow(u.x - e.x, 2) + Math.pow(u.y - e.y, 2) + Math.pow(u.z - e.z, 2));
    }
    
    // Path efficiency: Exp(-0.5 * integral(diff))
    const scalar = 0.5;
    const errorIntegral = cumulativeDistance / limit;
    return Math.exp(-scalar * errorIntegral) * 100;
  }

  updateHUDTelemetry() {
    const v = this.stabilityDetector.getVariance();
    const normalized = Math.max(0, Math.min(100, (1 - v / 0.1) * 100));
    
    const bar = document.getElementById('stability-bar');
    const txt = document.getElementById('stability-text');
    
    if (bar) bar.style.width = `${normalized}%`;
    
    if (txt) {
      if (this.stabilityDetector.isStable) {
        txt.innerText = "STABLE";
        txt.className = "text-xs font-bold text-emerald-400";
        if (bar) bar.className = "bg-emerald-500 h-full transition-all duration-150";
      } else {
        txt.innerText = "UNSTABLE";
        txt.className = "text-xs font-bold text-red-400";
        if (bar) bar.className = "bg-red-500 h-full transition-all duration-150";
      }
    }
  }

  onStabilityStateChange(isStable, variance) {
    if (isStable && this.sceneEngine.isAnchored) {
      this.executeVisualCapture();
    }
  }

  async executeVisualCapture() {
    // Prevent double invocation
    if (this.isEvaluating) return;
    this.isEvaluating = true;

    const stepDisp = document.getElementById('step-display');
    const origText = stepDisp.innerText;
    stepDisp.innerText = "Analyzing Workspace State with AI...";
    stepDisp.className = "text-xs text-yellow-400 mt-1 font-semibold animate-pulse";

    // Grab raw context canvas frames
    let rawFrame;
    if (this.sceneEngine.isFallbackMode && this.sceneEngine.videoElement) {
      // In fallback mode, compile composite canvas (camera feed + 3D layer)
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = this.sceneEngine.renderer.domElement.width;
      captureCanvas.height = this.sceneEngine.renderer.domElement.height;
      const ctx = captureCanvas.getContext('2d');
      
      // Draw background camera frame
      ctx.drawImage(this.sceneEngine.videoElement, 0, 0, captureCanvas.width, captureCanvas.height);
      // Draw Three.js layer
      ctx.drawImage(this.sceneEngine.renderer.domElement, 0, 0, captureCanvas.width, captureCanvas.height);
      rawFrame = captureCanvas.toDataURL('image/jpeg', 0.85);
    } else {
      rawFrame = this.sceneEngine.renderer.domElement.toDataURL('image/jpeg', 0.85);
    }
    
    const base64Data = rawFrame.replace(/^data:image\/jpeg;base64,/, "");
    const activeStepTask = this.steps[this.currentStepIndex];
    
    const evaluation = await this.api.verifyVisualState(base64Data, activeStepTask);

    if (evaluation.assembly_step_valid) {
      // Advance stage logic
      this.currentStepIndex++;
      if (this.currentStepIndex < this.steps.length) {
        stepDisp.innerText = `Step ${this.currentStepIndex + 1}: ${this.steps[this.currentStepIndex]}`;
        stepDisp.className = "text-xs text-blue-400 mt-1 font-semibold";
        
        // Visual trigger success feedback flash
        this.flashHUD(true);
      } else {
        // Complete spatial assessment evaluations
        this.completeAssessment();
      }
    } else {
      stepDisp.innerText = `Correction needed: ${evaluation.feedback_message}`;
      stepDisp.className = "text-xs text-rose-400 mt-1 font-semibold animate-pulse";
      this.flashHUD(false);
    }

    this.isEvaluating = false;
  }

  flashHUD(success) {
    const hud = document.getElementById('hud-ui');
    if (!hud) return;
    const flashColor = success ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)';
    hud.style.backgroundColor = flashColor;
    setTimeout(() => { hud.style.backgroundColor = 'transparent'; }, 400);
  }

  completeAssessment() {
    this.isRecording = false;
    const finalPathScore = this.calculateKinematicPathEfficiency();
    const finalScore = (finalPathScore * 0.4) + 60.0; // Dynamic mathematical formula weighting
    
    document.getElementById('step-display').innerText = "ASSESSMENT COMPLETED SUCCESSFULLY";
    document.getElementById('step-display').className = "text-xs text-emerald-400 mt-1 font-bold";
    document.getElementById('score-text').innerText = `${finalScore.toFixed(1)} / 100`;
    
    // Play device haptic pattern trigger to confirm exit sequence
    if (navigator.vibrate) {
      navigator.vibrate();
    }
  }
}

// Global invocation entry hook
window.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
