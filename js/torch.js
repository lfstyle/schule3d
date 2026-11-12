// Taschenlampe (Taste F). Das Licht selbst rechnet der Raumlicht-Shader (js/light-zones.js);
// hier wird nur geschaltet und der Lichtkegel folgt dem Blick mit leichter Verzögerung.
import * as THREE from 'three';

const COLOR = new THREE.Color(1.0, 0.95, 0.86);   // warmweiße LED
const INTENSITY = 18;                              // Candela-ähnlich, wie die Raumlampen
const HAND = new THREE.Vector3(0.09, -0.13, 0);    // rechts unten vor dem Auge (Kameraraum)

export class Torch {
  constructor({ uniforms, camera, audio }) {
    this.u = uniforms;
    this.camera = camera;
    this.audio = audio;
    this.on = false;
    this.level = 0;
    this.u.kseTorchPos.value.copy(HAND);
    // Kegel als Kosinus: außen 25°, innen 15°, heller Kern 5°; Reichweite 22 m
    const cos = (deg) => Math.cos(THREE.MathUtils.degToRad(deg));
    this.u.kseTorchCone.value.set(cos(25), cos(15), cos(5), 22);
    this.aim = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    this._forward = new THREE.Vector3();
  }

  toggle() {
    this.on = !this.on;
    this.audio.click();
  }

  update(dt) {
    this.level += ((this.on ? 1 : 0) - this.level) * Math.min(1, dt * 25);
    if (Math.abs(this.level - (this.on ? 1 : 0)) < 0.002) this.level = this.on ? 1 : 0;
    this.u.kseTorchColor.value.copy(COLOR).multiplyScalar(INTENSITY * this.level);
    this._forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    if (!this.level) { this.aim.copy(this._forward); return; }
    // Lichtkegel hängt beim schnellen Umsehen minimal nach, wie eine Lampe in der Hand.
    this.aim.lerp(this._forward, Math.min(1, dt * 16)).normalize();
    this.camera.updateMatrixWorld();
    this.u.kseTorchDir.value.copy(this.aim).transformDirection(this.camera.matrixWorldInverse);
  }
}
