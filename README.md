# AuraAssess WebXR | Mercer Mettl VISIONARY Hackathon 2.0

Live Access link of App: https://auraassess-webxr.web.app


PPT link: https://docs.google.com/presentation/d/14LREXdYD9kksankqFoH4QtaQezAF1axc/edit?usp=sharing&ouid=106167570344382569655&rtpof=true&sd=true

AuraAssess WebXR is a zero-install, browser-based vocational skill evaluation platform that turns physical spaces into high-fidelity candidate testing environments. The system uses spatial telemetry, edge stability computations, and cloud artificial intelligence to automate hands-on skill scoring for technical fields.

---

## 🏗️ System Architecture

```
+---------------------------------------------------------------------------------+
|                        Mobile Browser Candidate Onboarding                      |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                       WebXR Device API Immersive Session                        |
|             (Renders optimized Three.js assembly scenes & anchors)              |
+---------------------------------------------------------------------------------+
             |                                                       |
             v (Real-time device kinematic logs)                     v (Camera Feed)
+---------------------------------------------------+  +------------------------------+
|        Sensor-Stabilization Detector              |  |   WebXR Rendering pipeline   |
|  (Sliding-window accelerometer variance filter)   |  |  (InstancedMesh optimization)|
+---------------------------------------------------+  +------------------------------+
             |                                                       |
             +--------------> Triggers capture when steady (Var < 0.04) <----+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                       VLM Cloud Analysis Interface                              |
|          (Analyzes manual spatial adjustments & verifies precision)             |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                       Composite Skill Score Aggregator                          |
|         (Evaluates Kinematic Path Efficiency and assembly accuracy metrics)     |
+---------------------------------------------------------------------------------+
```

---

## 🧮 Mathematical Scoring Formulas

To maintain strict objectivity, candidate skill levels are scored using separate physical and visual parameters.

### 1. Kinematic Spatial Path Efficiency (**E**<sub>path</sub>)
This metric scores how closely the candidate’s movement paths follow the baseline coordinate trajectory of an expert:

$$E_{\text{path}} = e^{-\gamma \int_{0}^{T} \|\mathbf{x}_{\text{user}}(t) - \mathbf{x}_{\text{expert}}(t)\|_2 dt}$$

Where **x**<sub>user</sub>(*t*) and **x**<sub>expert</sub>(*t*) are 3D position matrices mapped over testing period *T*, and **&gamma;** (gamma) is a tracking normalizer.

### 2. Physical Acceleration Stabilization Variance (Var(||*a*||))
To protect bandwidth and prevent blurry images, camera capture only fires when device motion remains steady within a 500 ms threshold:

$$\sigma^2 = \frac{1}{M}\sum_{i=1}^{M} (\|a_i\| - \mu)^2$$

Where ||*a*<sub>i</sub>|| is the acceleration magnitude at frame *i*, &mu; (mu) is the window average, and *M* is the sliding limit (30 frames).

### 3. Composite Assessment Grade (**G**<sub>composite</sub>)
The overall rating is calculated by balancing kinetic movement speed with target execution accuracy:

$$G_{\text{composite}} = \alpha \cdot E_{\text{path}} + (1 - \alpha) \cdot A_{\text{visual}}$$

Where **&alpha;** (alpha) is a weighting coefficient customized for specific industrial job criteria.

---

## ⚙️ Optimization & Performance Implementations

Mobile web systems have limited resources. AuraAssess WebXR achieves a locked $60\text{ FPS}$ on standard mobile devices through the following optimizations:

- **InstancedMesh Rendering**: Repeats standard objects (screws, fasteners, bolts) in a single GPU draw call, keeping total render draw calls below $100$.
- **Edge Stabilization Filters**: Computes movement stability locally on the client device. This prevents continuous image uploads, reducing VRAM usage and cloud API costs.
- **WebXR Light Estimation**: Uses spherical harmonics to capture real-world room lighting, casting realistic shadows without intensive real-time lighting calculations.

---

 

## 📝 Technical & API Specifications

To ensure robust schema safety and strict visual data typing for judges' review, AuraAssess WebXR implements compile-time type interfaces and strict API response schemas.

### 1. TypeScript Interface Definitions

The following interface is defined in [types.ts](file:///c:/Users/kaval/Desktop/Visionary%20Hackathon/src/types.ts) to guarantee type safety when handling cloud model visual evaluations:

```typescript
export interface AIEvaluationResponse {
  /**
   * True if the candidate has completed the current assembly step correctly 
   * according to industrial specifications, false otherwise.
   */
  assembly_step_valid: boolean;

  /**
   * A float value from 0.0 to 1.0 representing the VLM's confidence 
   * in its visual assessment.
   */
  confidence_score: number;

  /**
   * Detailed explanation of the visual validation result, or constructive 
   * feedback detailing what corrections the candidate must make.
   */
  feedback_message: string;

  /**
   * List of specific assembly errors observed (e.g., "rotor casing misaligned").
   */
  identified_errors: string[];
}
```

### 2. Gemini 2.0 Strict `responseSchema` Configuration

To force the Gemini VLM model to output structured JSON data conforming exactly to our types (rather than raw descriptive text), we pass this strict OpenAPI schema payload in the `generationConfig` parameter during the API request:

```json
{
  "type": "OBJECT",
  "properties": {
    "assembly_step_valid": {
      "type": "BOOLEAN",
      "description": "True if the candidate's assembly step is visually correct and aligned, false otherwise."
    },
    "confidence_score": {
      "type": "NUMBER",
      "description": "VLM grading confidence level between 0.0 and 1.0."
    },
    "feedback_message": {
      "type": "STRING",
      "description": "Structured evaluation feedback explaining the rationale of visual grading and helpful instructions for corrections if needed."
    },
    "identified_errors": {
      "type": "ARRAY",
      "items": {
        "type": "STRING"
      },
      "description": "List of specific observed assembly errors."
    }
  },
  "required": [
    "assembly_step_valid",
    "confidence_score",
    "feedback_message",
    "identified_errors"
  ]
}
```
