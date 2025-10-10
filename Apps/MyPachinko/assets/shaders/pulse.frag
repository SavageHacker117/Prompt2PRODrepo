#ifdef GL_ES
precision mediump float;
#endif
varying vec2 vUv;
uniform float time;
void main() {
  float v = 0.5 + 0.5*sin(6.2831*(vUv.x+vUv.y)+time*2.0);
  gl_FragColor = vec4(v*0.2, v*0.5, 1.0, 1.0);
}
