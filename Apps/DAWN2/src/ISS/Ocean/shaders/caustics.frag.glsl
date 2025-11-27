precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uCenterXZ;    // world center (meters)
uniform float uWorldSize;   // meters covered by this RT

uniform vec3  uSunDir;      // from surface to sun (unit)
uniform float uDepthAtten;  // higher -> faster darkening with depth
uniform float uSunSharpness;// streak sharpness

// Waves (same layout as ocean)
uniform int   uWaveCount;
uniform vec2  uWaveDirs[16];
uniform float uWaveAmplitudes[16];
uniform float uWaveWavelengths[16];

const float PI = 3.14159265;
const float G  = 9.81;

vec2 heightGradient(vec2 xz, float t) {
  float dHx = 0.0;
  float dHz = 0.0;
  for (int i = 0; i < 16; ++i) {
    if (i >= uWaveCount) break;
    float L = uWaveWavelengths[i];
    float k = 2.0 * PI / L;
    float A = uWaveAmplitudes[i];
    vec2  D = normalize(uWaveDirs[i]);
    float omega = sqrt(G * k);
    float phase = k * dot(D, xz) - omega * t;
    float c = cos(phase);
    dHx += A * c * k * D.x;
    dHz += A * c * k * D.y;
  }
  return vec2(dHx, dHz);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // Map pixel to world XZ
  vec2 worldXZ = uCenterXZ + (vUv - 0.5) * uWorldSize;

  // Gradient magnitude as focusing proxy (bigger slope -> stronger caustic)
  vec2 grad = heightGradient(worldXZ, uTime);
  float slope = length(grad);

  // Sun alignment term (caustics stronger under overhead rays)
  vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
  float align = pow(max(dot(N, normalize(uSunDir)), 0.0), uSunSharpness);

  // Depth attenuation: at the edges of the RT fade by "depth"
  float r = length(vUv - 0.5) * 2.0; // 0 at center, ~1 at edges
  float depthFalloff = exp(-uDepthAtten * r * uWorldSize * 0.02);

  // Noise to break symmetry
  float n = mix(0.8, 1.2, hash(worldXZ * 0.05));

  float intensity = slope * align * depthFalloff * n;
  vec3 col = vec3(intensity);

  gl_FragColor = vec4(col, 1.0);
}
