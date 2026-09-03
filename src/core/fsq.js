import * as THREE from 'three';
/** Minimal fullscreen-quad pass. No dependency on three/examples. */
export class FSQuad {
  constructor(fragmentShader, uniforms = {}){
    this.material = new THREE.RawShaderMaterial({
      uniforms,
      glslVersion: THREE.GLSL3,
      vertexShader: `in vec3 position; in vec2 uv; out vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `precision highp float; precision highp int;\n${fragmentShader}`,
      depthTest: false, depthWrite: false
    });
    this._mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), this.material);
    this._scene = new THREE.Scene().add(this._mesh);
    this._cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  }
  get u(){ return this.material.uniforms; }
  render(renderer, target = null){
    renderer.setRenderTarget(target);
    renderer.render(this._scene, this._cam);
  }
}
export function rt(w, h, opts = {}){
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter,
    depthBuffer: false, ...opts
  });
}
