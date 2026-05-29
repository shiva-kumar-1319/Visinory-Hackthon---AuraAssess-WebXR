# Mobile Performance Ledger & Asset Optimization Pipeline

This document outlines the performance constraints, asset compilation workflows, and rendering optimizations implemented to maintain a consistent 60 FPS on mobile web browsers (Safari on iOS and Chrome on Android).

---

## I. Render Loop and Draw Call Management

Mobile GPUs are highly sensitive to draw call overhead. If a scene exceeds 100 draw calls per frame, performance degradation occurs rapidly due to CPU-to-GPU context-switching bottlenecks.

### 1. Geometry Instancing

The virtual industrial pump assembly contains duplicate high-fidelity components, specifically six flange-mounting bolts.

*   **Standard Method**: Creating six distinct `THREE.Mesh` objects results in six individual draw calls.
*   **Optimized Method**: AuraAssess WebXR uses `THREE.InstancedMesh` to render all six bolts. This reduces the GPU draw call overhead to a complexity of **O(1)**.

### 2. Material Sharing and Batching

To ensure Three.js can batch rendering calls, all geometries in the virtual scene share references to a minimal set of pre-compiled PBR materials (`castIronMat` and `steelMat`). The application avoids creating unique material instances dynamically inside the render loop to prevent shader re-compilation stalls.

---

## II. Asset Compression and Memory Optimization

A 50MB uncompressed 3D file will exceed mobile browser memory limits and crash the page. The asset compilation pipeline enforces strict file size and VRAM budgets.

### 1. Draco Mesh Compression

Raw 3D geometries are compressed using Draco algorithm structures. This compresses the physical mesh data, normal coordinates, and vertex arrays by up to 90–95%.

*   **Thread Isolation**: Decompression is handled inside a separate Web Worker thread. This prevents mesh parsing and vertex decoding from blocking the main JavaScript execution thread, ensuring the HUD remains responsive during load time.

### 2. KTX2 Basis Universal Texture Transcoding

Standard PNG or JPEG textures must be fully decompressed into VRAM to render, causing a 200KB file to expand to over 20MB of VRAM on mobile browsers.

*   **GPU-Resident Compression**: AuraAssess WebXR uses KTX2 containers with Basis Universal compression. These textures stay compressed directly in GPU memory, reducing texture VRAM footprint by up to 75%.
*   **Format Selection**:
    *   **UASTC Compression**: Used for normal maps and high-contrast displacement maps to prevent visual artifacts and maintain precise spatial alignment coordinates.
    *   **ETC1S Compression**: Used for diffuse color maps to optimize file size with minimal visual degradation.

### 3. Command-Line Compilation Workflow

All assets are processed through the `gltf-transform` CLI tool prior to production deployment:

```bash
# 1. Compress mesh geometry using Draco compression (level 7 strength)
gltf-transform draco input.glb output_draco.glb --compressionLevel 7

# 2. Transcode textures to GPU-compressed KTX2 format (ETC1S / UASTC)
gltf-transform etc1s output_draco.glb output_etc1s.glb --quality 75

# 3. Deduplicate geometries and optimize structural nodes
gltf-transform optimize output_etc1s.glb asset_production.glb
```

---

## III. Lighting and Shading Optimization

Real-time shadow mapping consumes 30–40% of mobile GPU performance. AuraAssess WebXR replaces dynamic shadow passes with optimized lighting techniques:

*   **Baked Ambient Occlusion (AO) Maps**: Pre-computed shadow values are baked directly into the material's lightmap channels. This provides realistic shadows in crevices and joints at zero real-time GPU computation cost.
*   **WebXR Light Estimation API**: The engine subscribes to the WebXR Light Estimation session. It retrieves the physical environment's actual illumination coordinates using spherical harmonics:

$$L(\theta, \phi) = \sum_{l=0}^{2} \sum_{m=-l}^{l} c_{l,m} Y_{l,m}(\theta, \phi)$$

The renderer applies these spherical harmonic coefficients (**c**<sub>**l,m**</sub>) to the virtual materials in real-time. This allows the virtual model's lighting to match the physical room's lighting conditions without performing intensive real-time shadow rendering.
