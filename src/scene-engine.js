import * as THREE from 'three';

export class SceneEngine {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    this.renderer = null;
    this.xrSession = null;
    this.hitTestSource = null;
    this.localReferenceSpace = null;
    this.reticle = null;
    this.assemblyModel = null;
    this.isAnchored = false;
    this.lightProbe = null;
    this.isFallbackMode = false;
    this.videoElement = null;

    this.initRenderer();
    this.setupScene();
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setClearAlpha(0);
    this.renderer.xr.enabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  setupScene() {
    // Basic ambient and directional fallback lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 4, 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    // Build spatial placement reticle
    const ringGeo = new THREE.RingGeometry(0.12, 0.15, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4f46e5, side: THREE.DoubleSide });
    this.reticle = new THREE.Mesh(ringGeo, ringMat);
    this.reticle.visible = false;
    this.scene.add(this.reticle);
  }

  async startWebXR() {
    try {
      if (!navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') {
        throw new Error('WebXR not available in this browser environment.');
      }

      const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (!isSupported) {
        throw new Error('Immersive AR session is not supported on this device.');
      }

      const sessionInit = { requiredFeatures: ['hit-test', 'light-estimation'] };
      const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
      this.xrSession = session;
      this.renderer.xr.setSession(session);

      const refSpace = await session.requestReferenceSpace('viewer');
      this.hitTestSource = await session.requestHitTestSource({ space: refSpace });
      this.localReferenceSpace = await session.requestReferenceSpace('local');

      // Light estimation subscription
      if (typeof session.requestLightProbe === 'function') {
        try {
          const lightProbeSystem = await session.requestLightProbe();
          this.lightProbe = lightProbeSystem;
        } catch (err) {
          console.warn("Failed to request WebXR light probe:", err);
        }
      }

      session.addEventListener('end', () => {
        this.xrSession = null;
        this.hitTestSource = null;
      });

      this.isFallbackMode = false;
    } catch (err) {
      console.warn('WebXR start failed or unsupported — launching Camera Fallback Mode:', err.message);
      await this.startFallbackCameraMode();
    }
  }

  async startFallbackCameraMode() {
    this.isFallbackMode = true;
    this.isAnchored = false;
    
    // Disable WebXR overrides on the renderer so standard camera updates are respected
    this.renderer.xr.enabled = false;

    // Create full screen background video element for camera feed
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    this.videoElement.style.position = 'absolute';
    this.videoElement.style.top = '0';
    this.videoElement.style.left = '0';
    this.videoElement.style.width = '100%';
    this.videoElement.style.height = '100%';
    this.videoElement.style.objectFit = 'cover';
    this.videoElement.style.zIndex = '0';
    
    // Insert background video before canvas container in the DOM
    this.container.parentNode.insertBefore(this.videoElement, this.container);
    
    // Force canvas and container transparent overlays
    this.container.style.zIndex = '2';
    this.renderer.setClearColor(0x000000, 0);

    // Request back-facing camera streams with constraint fallbacks
    try {
      const constraints = {
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = stream;
      await this.videoElement.play();
    } catch (err) {
      console.warn("First camera constraint failed, retrying with basic constraints:", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.videoElement.srcObject = stream;
        await this.videoElement.play();
      } catch (retryErr) {
        console.error("Camera hardware access denied:", retryErr);
        this.renderer.setClearColor(0x0b0f19, 1); // Restore solid background
        
        // Output detailed permission/hardware diagnostic feedback inside the UI
        const prompt = document.getElementById('reticle-indicator');
        if (prompt) {
          const text = prompt.querySelector('p');
          if (text) {
            text.innerHTML = `<strong>Camera Error:</strong> ${retryErr.name} (${retryErr.message}).<br>Please clear browser permission blocks for this site.`;
            prompt.className = "self-center flex flex-col items-center gap-3 text-center max-w-sm";
            text.className = "text-xs font-semibold bg-rose-950/90 px-4 py-2.5 rounded-xl border border-rose-800 text-rose-200 shadow-xl pointer-events-auto leading-relaxed";
          }
        }
      }
    }

    // Set up standard 3D reticle directly in front of the camera view
    this.reticle.position.set(0, -0.4, -1.2);
    this.reticle.rotation.x = -Math.PI / 2.5;
    this.reticle.visible = true;

    // Add a helper grid to visualize space
    const gridHelper = new THREE.GridHelper(10, 10, 0x4f46e5, 0x1e293b);
    gridHelper.position.y = -0.5;
    gridHelper.position.z = -1.2;
    this.scene.add(gridHelper);

    // Update screen instructions
    const prompt = document.getElementById('reticle-indicator');
    if (prompt) {
      prompt.classList.remove('hidden');
      const text = prompt.querySelector('p');
      if (text) text.innerText = "Tap screen to place pump on your desk";
    }
  }

  buildIndustrialPumpModel() {
    this.assemblyModel = new THREE.Group();

    const castIronMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.6, metalness: 0.8 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.2, metalness: 0.9 });

    // Primary casing geometry
    const mainBodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.35, 32);
    const mainBody = new THREE.Mesh(mainBodyGeo, castIronMat);
    mainBody.position.y = 0.175;
    this.assemblyModel.add(mainBody);

    // Rotor housing flange
    const flangeGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.04, 32);
    const flange = new THREE.Mesh(flangeGeo, castIronMat);
    flange.position.y = 0.35;
    this.assemblyModel.add(flange);

    // Dynamic central drive shaft
    const shaftGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 16);
    this.shaftMesh = new THREE.Mesh(shaftGeo, steelMat);
    this.shaftMesh.position.y = 0.225;
    this.assemblyModel.add(this.shaftMesh);

    // Assembly Connector Bolts (Optimized InstancedMesh to maintain draw calls below 100)
    const boltGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.05, 8);
    const boltCount = 6;
    const instancedBolts = new THREE.InstancedMesh(boltGeo, steelMat, boltCount);
    
    const dummy = new THREE.Object3D();
    for (let i = 0; i < boltCount; i++) {
      const angle = (i / boltCount) * Math.PI * 2;
      const radius = 0.21;
      dummy.position.set(Math.cos(angle) * radius, 0.36, Math.sin(angle) * radius);
      dummy.updateMatrix();
      instancedBolts.setMatrixAt(i, dummy.matrix);
    }
    this.assemblyModel.add(instancedBolts);

    // Anchor visual feedback representation
    this.assemblyModel.position.copy(this.reticle.position);
    this.assemblyModel.quaternion.copy(this.reticle.quaternion);
    this.scene.add(this.assemblyModel);
    
    this.isAnchored = true;
    this.reticle.visible = false;
    document.getElementById('reticle-indicator').classList.add('hidden');
  }

  updateXR(frame) {
    if (this.isFallbackMode) {
      if (this.isAnchored && this.shaftMesh) {
        this.shaftMesh.rotation.y += 0.02;
      }
      return;
    }

    if (!this.xrSession || !frame) return;

    if (!this.isAnchored && this.hitTestSource) {
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(this.localReferenceSpace);
        this.reticle.visible = true;
        this.reticle.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
        this.reticle.updateMatrixWorld(true);
      } else {
        this.reticle.visible = false;
      }
    }
    
    // Rotate drive shaft to prove running rendering cycle
    if (this.isAnchored && this.shaftMesh) {
      this.shaftMesh.rotation.y += 0.02;
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
