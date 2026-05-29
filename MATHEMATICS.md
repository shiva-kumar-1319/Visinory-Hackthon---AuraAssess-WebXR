# Telemetry, Physics, and Scoring Formulations

This document outlines the core mathematical framework of AuraAssess WebXR. It details the algorithms used to convert raw physical device telemetry, 3D spatial transformations, and visual validation states into objective, reproducible candidate scores.

These formulations provide the mathematical engine displayed on Slide 6 of the pitch deck (PPT) and are validated in real time during the live demonstration video.

---

## I. Kinematic Spatial Path Efficiency (**E**<sub>path</sub>)

To assess manual dexterity and path precision (e.g., micro-tool handling in surgery or physical panel checks in aviation), the engine tracks the 3D translation vector of the candidate's camera in coordinate space, comparing it to an optimized expert trajectory.

### 1. Mathematical Formulation

Let **x**<sub>user</sub>(*t*) = [*x*<sub>u</sub>(*t*), *y*<sub>u</sub>(*t*), *z*<sub>u</sub>(*t*)]<sup>T</sup> be the time-varying position vector of the user's WebXR camera frame at timestamp *t*. Let **x**<sub>expert</sub>(*t*) = [*x*<sub>e</sub>(*t*), *y*<sub>e</sub>(*t*), *z*<sub>e</sub>(*t*)]<sup>T</sup> be the corresponding coordinate on the expert baseline trajectory.

The path efficiency is computed as an exponential decay function of the integrated Euclidean distance (L2 norm) over the total evaluation window *T*:

$$E_{\text{path}} = e^{-\gamma \int_{0}^{T} \|\mathbf{x}_{\text{user}}(t) - \mathbf{x}_{\text{expert}}(t)\|_2 dt}$$

Where:
*   **|| • ||<sub>2</sub>** represents the Euclidean distance metric in 3D Euclidean space:
    $$\|\mathbf{x}_{\text{user}}(t) - \mathbf{x}_{\text{expert}}(t)\|_2 = \sqrt{(x_{\text{u}} - x_{\text{e}})^2 + (y_{\text{u}} - y_{\text{e}})^2 + (z_{\text{u}} - z_{\text{e}})^2}$$
*   **&gamma;** (gamma) is a scaling normalizer coefficient adjusted to match the spatial boundaries of different testing tasks.

The output score is bounded dynamically to a range of [0.0, 1.0] (which translates directly to the percentage meter shown on the live HUD).

### 2. Practical Application and Video Sync

During the live demonstration video, as the phone moves across target coordinate spaces, the background tracker continuously samples these position matrices at a rate of 60 Hz. Clumsy or erratic movements increase the value of the distance integral, causing the live efficiency score to drop (as seen on the HUD transitioning from 100.0% to 87.7% in the pilot cockpit demo).

---

## II. Sliding-Window Tremor Filtration (Var(||*a*||))

In high-stress assessment environments, candidate hand tremors or sudden movements produce blurry WebGL frame captures, which are ungradable by cloud vision systems. AuraAssess WebXR uses an on-device mathematical filter to block camera transmission until the camera remains steady.

### 1. Mathematical Formulation

Let *a*<sub>i</sub> = [*a*<sub>x,i</sub>, *a*<sub>y,i</sub>, *a*<sub>z,i</sub>]<sup>T</sup> be the linear acceleration vector retrieved from the phone's physical accelerometer sensor at frame *i*. The absolute magnitude of acceleration is calculated as:

$$\|a_i\| = \sqrt{a_{x,i}^2 + a_{y,i}^2 + a_{z,i}^2}$$

The system maintains a sliding history window of *M* = 30 frames (equivalent to 500 ms of sensor data at a sampling rate of 60 Hz). The window mean acceleration &mu; (mu) is defined as:

$$\mu = \frac{1}{M} \sum_{i=1}^{M} \|a_i\|$$

The statistical variance of the acceleration magnitude over the sliding window is calculated as:

$$\sigma^2 = \frac{1}{M} \sum_{i=1}^{M} (\|a_i\| - \mu)^2$$

### 2. Trigger Thresholds and Interception Loop

*   **Unstable State (&sigma;<sup>2</sup> &ge; 0.04 m/s<sup>2</sup>)**: Indicates active hand shaking or rapid movement. The state machine blocks frame capture and updates the HUD to "UNSTABLE" (Red).
*   **Stable State (&sigma;<sup>2</sup> < 0.04 m/s<sup>2</sup>)**: Indicates the camera is steady. If this condition is met for a consecutive 500 ms, the filter triggers "STABLE" (Green), allowing the app to automatically capture and transmit a clear image to the vision API.

### 3. Real-World Application in the Demo Video

In the demonstration video, this logic is showcased directly: when the device is deliberately shaken, the stability bar drops and turns red, locking the interface. The moment the shaking stops, the variance falls below the 0.04 m/s<sup>2</sup> threshold, the HUD turns green, and the camera automatically snaps a blur-free picture of the pump model without requiring any manual input from the user.

---

## III. Composite Assessment Grading (**G**<sub>composite</sub>)

To calculate the final grade, the platform combines physical coordination telemetry with visual task accuracy.

### 1. Mathematical Formulation

Once all task steps are completed, the composite score aggregator calculates the overall grade:

$$G_{\text{composite}} = \alpha \cdot E_{\text{path}} + (1 - \alpha) \cdot A_{\text{visual}}$$

Where:
*   **E**<sub>path</sub> is the Kinematic Spatial Path Efficiency score calculated during the movement phase.
*   **A**<sub>visual</sub> is the Visual Task Accuracy score returned as structured JSON from the cloud vision evaluation:
    $$A_{\text{visual}} = \frac{1}{N} \sum_{k=1}^{N} w_k \cdot \delta_k$$
    Where *N* is the number of manual steps, **w<sub>k</sub>** is the weight of step *k*, and **&delta;<sub>k</sub>** (delta) &in; {0, 1} is the binary validation result returned by the API.
*   **&alpha;** (alpha) is the weighting coefficient (default is set to 0.40 in main.js, allocating 40% of the grade to physical kinematic speed and path efficiency, and 60% to visual step precision).

The final output **G**<sub>composite</sub> is printed on the completion screen of the HUD (e.g., 95.1 / 100) and stored securely in the database.
