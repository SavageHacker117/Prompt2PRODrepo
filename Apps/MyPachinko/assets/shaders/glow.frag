#ifdef GL_ES
precision mediump float;
#endif
varying vec2 vUv;
uniform float time;
void main() {
  float d = distance(vUv, vec2(0.5));
  float glow = 0.35/(d*10.0 + 0.1);
  gl_FragColor = vec4(glow, glow*0.7, 1.0, glow);
}
