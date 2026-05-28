export class SensorStabilityDetector {
  constructor(threshold = 0.05, timeWindowMs = 500) {
    this.threshold = threshold; // Acceleration magnitude variance limit
    this.timeWindowMs = timeWindowMs;
    this.history = [];
    this.isStable = false;
    this.onStabilityChange = null;
    this.lastStableChangeTime = performance.now();
  }

  initialize() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      return DeviceMotionEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            window.addEventListener('devicemotion', this.handleMotion.bind(this));
            return true;
          }
          return false;
        })
        .catch(err => {
          console.error("DeviceMotion access rejected:", err);
          return false;
        });
    } else {
      window.addEventListener('devicemotion', this.handleMotion.bind(this));
      return Promise.resolve(true);
    }
  }

  handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;
    
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const now = performance.now();

    this.history.push({ time: now, val: magnitude });
    
    // Purge outdated entries past sliding window
    const cutoff = now - this.timeWindowMs;
    while (this.history.length > 0 && this.history[0].time < cutoff) {
      this.history.shift();
    }

    if (this.history.length < 5) return;

    // Calculate statistical variance of spatial acceleration
    const values = this.history.map(h => h.val);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    const currentlyStable = variance < this.threshold;
    
    if (currentlyStable !== this.isStable) {
      this.isStable = currentlyStable;
      this.lastStableChangeTime = now;
      if (this.onStabilityChange) {
        this.onStabilityChange(this.isStable, variance);
      }
    }
  }
  
  getVariance() {
    if (this.history.length < 2) return 1.0;
    const values = this.history.map(h => h.val);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }
}
