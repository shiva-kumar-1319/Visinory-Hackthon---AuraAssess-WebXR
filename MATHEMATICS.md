# Telemetry, Physics, and Scoring Formulations

This document outlines the core mathematical framework of AuraAssess WebXR. It details the algorithms used to convert raw physical device telemetry, 3D spatial transformations, and visual validation states into objective, reproducible candidate scores.

These formulations provide the mathematical engine displayed on Slide 6 of the pitch deck (PPT) and are validated in real time during the live demonstration video.

---

## I. Kinematic Spatial Path Efficiency ($E_{\text{path}}$)

To assess manual dexterity and path precision (e.g., micro-tool handling in surgery or physical panel checks in aviation), the engine tracks the 3D translation vector of the candidate's camera in coordinate space, comparing it to an optimized expert trajectory.

### 1. Mathematical Formulation

Let $\mathbf{x}_{\text{user}}(t) = [x_{\text{u}}(t), y_{\text{u}}(t), z_{\text{u}}(t)]^T$ be the time-varying position vector of the user's WebXR camera frame at timestamp $t$. Let $\mathbf{x}_{\text{expert}}(t) = [x_{\text{e}}(t), y_{\text{e}}(t), z_{\text{e}}(t)]^T$ be the corresponding coordinate on the expert baseline trajectory.

The path efficiency is computed as an exponential decay function of the integrated Euclidean distance ($L_2$ norm) over the total evaluation window $T$:

$$E_{\text{path}} = \exp\left( -\gamma \int_{t=0}^{T} \left\| \mathbf{x}_{\text{user}}(t) - \mathbf{x}_{\text{expert}}(t) \right\|_2 \, dt \right)$$

Where:
*   $\left\| \cdot \right\|_2$ represents the Euclidean distance metric in 3D Euclidean space:
    $$\left\| \mathbf{x}_{\text{user}}(t) - \mathbf{x}_{\text{expert}}(t) \right\|_2 = \sqrt{(x_{\text{u}} - x_{\text{e}})^2 + (y_{\text{u}} - y_{\text{e}})^2 + (z_{\text{u}} - z_{\text{e}})^2}$$
*   $\gamma$ is a scaling normalizer coefficient adjusted to match the spatial boundaries of different testing tasks.

The output score is bounded dynamically to a range of $[0.0, 1.0]$ (which translates directly to the percentage meter shown on the live HUD).

### 2. Practical Application and Video Sync

During the live demonstration video, as the phone moves across target coordinate spaces, the background tracker continuously samples these position matrices at a rate of 60 Hz. Clumsy or erratic movements increase the value of the distance integral, causing the live efficiency score to drop (as seen on the HUD transitioning from 100.0% to 87.7% in the pilot cockpit demo).

---

## II. Sliding-Window Tremor Filtration ($\text{Var}(\|a\|)$)

In high-stress assessment environments, candidate hand tremors or sudden movements produce blurry WebGL frame captures, which are ungradable by cloud vision systems. AuraAssess WebXR uses an on-device mathematical filter to block camera transmission until the camera remains steady.

### 1. Mathematical Formulation

Let $a_i = [a_{x,i}, a_{y,i}, a_{z,i}]^T$ be the linear acceleration vector retrieved from the phone's physical accelerometer sensor at frame $i$. The absolute magnitude of acceleration is calculated as:

$$\|a_i\| = \sqrt{a_{x,i}^2 + a_{y,i}^2 + a_{z,i}^2}$$

The system maintains a sliding history window of $M = 30$ frames (equivalent to $500\text{ ms}$ of sensor data at a sampling rate of 60 Hz). The window mean acceleration $\mu$ is defined as:

$$\mu = \frac{1}{M} \sum_{i=1}^{M} \|a_i\|$$

The statistical variance of the acceleration magnitude over the sliding window is calculated as:

$$\text{Var}(\|a\|) = \sigma^2 = \frac{1}{M} \sum_{i=1}^{M} (\|a_i\| - \mu)^2$$

### 2. Trigger Thresholds and Interception Loop

*   **Unstable State ($\sigma^2 \ge 0.04\text{ m/s}^2$)**: Indicates active hand shaking or rapid movement. The state machine blocks frame capture and updates the HUD to "UNSTABLE" (Red).
*   **Stable State ($\sigma^2 < 0.04\text{ m/s}^2$)**: Indicates the camera is steady. If this condition is met for a consecutive $500\text{ ms}$, the filter triggers "STABLE" (Green), allowing the app to automatically capture and transmit a clear image to the vision API.

### 3. Real-World Application in the Demo Video

In the demonstration video, this logic is showcased directly: when the device is deliberately shaken, the stability bar drops and turns red, locking the interface. The moment the shaking stops, the variance falls below the $0.04\text{ m/s}^2$ threshold, the HUD turns green, and the camera automatically snaps a blur-free picture of the brain model or flight console without requiring any manual input from the user.

---

## III. Composite Assessment Grading ($G_{\text{composite}}$)

To calculate the final grade, the platform combines physical coordination telemetry with visual task accuracy.

### 1. Mathematical Formulation

Once all task steps are completed, the composite score aggregator calculates the overall grade:

$$G_{\text{composite}} = \alpha \cdot E_{\text{path}} + (1 - \alpha) \cdot A_{\text{visual}}$$

Where:
*   $E_{\text{path}}$ is the Kinematic Spatial Path Efficiency score calculated during the movement phase.
*   $A_{\text{visual}}$ is the Visual Task Accuracy score returned as structured JSON from the cloud vision evaluation:
    $$A_{\text{visual}} = \frac{1}{N} \sum_{k=1}^{N} w_k \cdot \delta_k$$
    Where $N$ is the number of manual steps, $w_k$ is the weight of step $k$, and $\delta_k \in \{0, 1\}$ is the binary validation result returned by the API.
*   $\alpha$ is the weighting coefficient (default is set to $0.40$ in main.js, allocating 40% of the grade to physical kinematic speed and path efficiency, and 60% to visual step precision).

The final output $G_{\text{composite}}$ is printed on the completion screen of the HUD (e.g., 85.4 / 100) and stored securely in the database.
