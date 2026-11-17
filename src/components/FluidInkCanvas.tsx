"use client";

import React, { useEffect, useRef, useState } from "react";

// Concept: Client-Only WebGL Fluid Ink Shader with Reduced-Motion & No-WebGL Fallback
// Renders an interactive dark fluid ink swirl behind the landing page hero.
// Never loaded inside the meeting room so video calls keep 100% of GPU resources.

export function FluidInkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      setUseFallback(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      setUseFallback(true);
      return;
    }

    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Domain-warped fluid ink fragment shader reacting smoothly to cursor coordinates
    const fragmentShaderSource = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.02 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 aspectUv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        vec2 mouseInfluence = (u_mouse - uv) * 0.35;

        vec2 q = vec2(
          fbm(aspectUv * 2.2 + u_time * 0.08 + mouseInfluence),
          fbm(aspectUv * 2.2 + vec2(5.2, 1.3) - u_time * 0.06)
        );
        vec2 r = vec2(
          fbm(aspectUv * 2.8 + 3.5 * q + vec2(1.7, 9.2) + 0.12 * u_time),
          fbm(aspectUv * 2.8 + 3.5 * q + vec2(8.3, 2.8) + 0.10 * u_time)
        );
        float f = fbm(aspectUv * 2.0 + 3.0 * r);

        vec3 baseDark = vec3(0.02, 0.02, 0.035);
        vec3 inkIndigo = vec3(0.09, 0.11, 0.24);
        vec3 inkCyan = vec3(0.06, 0.20, 0.28);

        vec3 color = mix(baseDark, inkIndigo, clamp(f * f * 2.2, 0.0, 1.0));
        color = mix(color, inkCyan, clamp(length(q) * 0.45, 0.0, 1.0));
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) {
      setUseFallback(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setUseFallback(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const mouseLoc = gl.getUniformLocation(program, "u_mouse");

    let mouseX = 0.5;
    let mouseY = 0.5;
    const onPointerMove = (e: PointerEvent) => {
      mouseX = e.clientX / window.innerWidth;
      mouseY = 1.0 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onPointerMove);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let animId = 0;
    const start = performance.now();
    const render = (now: number) => {
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, (now - start) * 0.001);
      gl.uniform2f(mouseLoc, mouseX, mouseY);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (useFallback) {
    return (
      <div
        aria-hidden="true"
        data-testid="fluid-fallback"
        className="fixed inset-0 -z-20 bg-gradient-to-br from-[#050508] via-[#0c1024] to-[#050508]"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="fluid-webgl-canvas"
      className="fixed inset-0 -z-20 h-full w-full pointer-events-none"
    />
  );
}