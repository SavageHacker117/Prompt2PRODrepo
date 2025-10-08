import * as THREE from "three";

export function makeNeRFMaterial(opts = {}) {
  const {
    steps = 64,
    stepScale = 1.0,
    densityScale = 1.0,
    maxDist = 4.0,
    jitter = true,
    gridTex = null,      // 3D texture (RGBA: rgb=color, a=density) in local space [0,1]^3
    invWorld = new THREE.Matrix4()
  } = opts;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uGrid: { value: gridTex },
      uInvWorld: { value: invWorld },
      uSteps: { value: steps },
      uStepScale: { value: stepScale },
      uDensityScale: { value: densityScale },
      uMaxDist: { value: maxDist },
      uJitter: { value: jitter ? 1 : 0 },
      uCamPos: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      precision highp sampler3D;
      varying vec3 vWorldPos;
      uniform sampler3D uGrid;
      uniform mat4 uInvWorld;
      uniform vec3 uCamPos;
      uniform float uSteps, uStepScale, uDensityScale, uMaxDist;
      uniform int uJitter;

      // Ray-box intersection for unit cube [0,1]^3
      bool rayBox(vec3 ro, vec3 rd, out float t0, out float t1) {
        vec3 inv = 1.0 / rd;
        vec3 tmin = (vec3(0.0) - ro) * inv;
        vec3 tmax = (vec3(1.0) - ro) * inv;
        vec3 t1v = min(tmin, tmax);
        vec3 t2v = max(tmin, tmax);
        t0 = max(max(t1v.x, t1v.y), t1v.z);
        t1 = min(min(t2v.x, t2v.y), t2v.z);
        return t1 > max(t0, 0.0);
      }

      float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }

      void main(){
        // transform camera and pixel to local grid space
        vec3 ro = (uInvWorld * vec4(uCamPos,1.)).xyz;
        vec3 rd = normalize((uInvWorld * vec4(normalize(vWorldPos - uCamPos),0.)).xyz);

        float tEnter, tExit;
        if(!rayBox(ro, rd, tEnter, tExit)){ discard; }

        float len = min(uMaxDist, tExit - max(tEnter, 0.0));
        int N = int(uSteps);
        float dt = (len / float(N)) * uStepScale;

        float T = 1.0;  // transmittance
        vec3 C = vec3(0.0);

        float t = max(tEnter, 0.0);
        if(uJitter == 1){
          t += rand(gl_FragCoord.xy) * dt; // multisample-ish jitter (cone idea, cheap)
        }

        for(int i=0;i<512;i++){
          if(i>=N) break;
          vec3 p = ro + rd * (t + float(i)*dt);
          // sample color (rgb) + density (a). Color is assumed already view-independent in this tiny demo.
          vec4 s = texture(uGrid, p);
          float sigma = max(s.a * uDensityScale, 0.0);
          float alpha = 1.0 - exp(-sigma * dt);

          // volume compositing
          C += (1.0 - alpha) * vec3(0.0); // background if needed
          C += alpha * T * s.rgb;
          T *= (1.0 - alpha);
          if(T < 0.01) break;
        }

        gl_FragColor = vec4(C, 1.0 - T);
        if(gl_FragColor.a < 0.01) discard;
      }
    `,
  });
}
