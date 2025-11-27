// src/ISS/Ocean/shaders/ocean.vert.glsl
precision highp float;
precision highp int;

#define PI 3.1415926535897932384626433832795

#ifndef WAVES_MAX
  #define WAVES_MAX 16
#endif

// ---- Shared uniforms (MUST match fragment) ----
uniform float uTime;
uniform vec3  uCameraPos;
uniform vec3  uSunDir;

uniform float uWaterLevel;
uniform float uShallowDepth;
uniform float uMaxDepth;

uniform highp int uWaveCount;
uniform vec2  uWaveDirs[WAVES_MAX];
uniform float uWaveAmplitudes[WAVES_MAX];
uniform float uWaveWavelengths[WAVES_MAX];
uniform float uWaveSteepness[WAVES_MAX];

// Appearance (parity with fragment)
uniform vec3  uShallowColor;
uniform vec3  uDeepColor;
uniform float uTurbidity;
uniform float uAbsorption;
uniform float uFoamIntensity;
uniform float uFoamThreshold;

// Caustics (forwarded to FS if needed)
uniform sampler2D uCausticsMap;
uniform vec2      uCausticsCenter;
uniform float     uCausticsScale;
uniform float     uCausticsStrength;

// Attributes are injected by three.js for ShaderMaterial (don’t redeclare).
//   position / normal / uv
// Built-in uniforms are also injected:
//   modelMatrix, modelViewMatrix, projectionMatrix, normalMatrix ...

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vSunDir;
varying float vWaveSlope;
varying float vWaterHeight;

float gerstnerHeight(vec2 xz, out vec2 ddx_dz) {
  float h = 0.0;
  vec2 slope = vec2(0.0);
  for (int i = 0; i < WAVES_MAX; i++) {
    if (i >= uWaveCount) break;
    vec2  d = normalize(uWaveDirs[i]);
    float A = uWaveAmplitudes[i];
    float L = max(uWaveWavelengths[i], 1e-3);
    float k = 2.0 * PI / L;
    float w = sqrt(9.81 * k);
    float Q = clamp(uWaveSteepness[i], 0.0, 1.0);

    float phase = dot(d, xz) * k - w * uTime;
    float s = sin(phase);
    float c = cos(phase);

    h += A * s;
    slope += vec2(-A * k * d.x * c, -A * k * d.y * c);
  }
  ddx_dz = slope;
  return h;
}

void main() {
  // 'position' is provided by ShaderMaterial
  vec3 wp = position;
  vec2 slope;
  float h = gerstnerHeight(wp.xz, slope);
  wp.y = uWaterLevel + h;

  // Estimate normal from slope
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));

  vWorldPos = (modelMatrix * vec4(wp, 1.0)).xyz;
  vWorldNormal = normalize((modelMatrix * vec4(n, 0.0)).xyz);
  vViewDir = normalize(uCameraPos - vWorldPos);
  vSunDir = normalize(uSunDir);
  vWaterHeight = h;
  vWaveSlope = length(slope);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
}
