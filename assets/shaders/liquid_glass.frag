#version 460 core
#include <flutter/runtime_effect.glsl>

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uTime;
uniform float WIDTH;
uniform float HEIGHT;
uniform float RADIUS;
uniform float BLUR;

// Rounded rectangle SDF
float sdRoundedRect(vec2 pos, vec2 halfSize, vec4 cornerRadius) {
    cornerRadius.xy = (pos.x > 0.0) ? cornerRadius.xy : cornerRadius.zw;
    cornerRadius.x = (pos.y > 0.0) ? cornerRadius.x : cornerRadius.y;
    vec2 q = abs(pos) - halfSize + cornerRadius.x;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - cornerRadius.x;
}

float boxSDF(vec2 uv) {
    return sdRoundedRect(uv, vec2(WIDTH * 0.99, HEIGHT * 0.99), vec4(RADIUS * 2));
}

vec2 randomVec2(vec2 co) {
    return fract(sin(vec2(
    dot(co, vec2(10.1, 30.7)),
    dot(co, vec2(20.5, 20.3))
    )) * 100000.5453);
}

vec3 sampleWithNoise(vec2 uv, float timeOffset, float mipLevel) {
    vec2 offset = randomVec2(uv + vec2(uTime + timeOffset)) / uResolution.x;
    return texture(uTexture, uv + offset * pow(BLUR, mipLevel)).rgb;
}

vec3 getBlurredColor(vec2 uv, float mipLevel) {
    return (
    sampleWithNoise(uv, 0.0, mipLevel) +
    sampleWithNoise(uv, 0.25, mipLevel) +
    sampleWithNoise(uv, 0.5, mipLevel) +
    sampleWithNoise(uv, 0.75, mipLevel) +
    sampleWithNoise(uv, 1.0, mipLevel) +
    sampleWithNoise(uv, 1.25, mipLevel) +
    sampleWithNoise(uv, 1.5, mipLevel) +
    sampleWithNoise(uv, 1.75, mipLevel) +
    sampleWithNoise(uv, 2.0, mipLevel)
    ) * 0.1;
}

vec3 saturate(vec3 color, float factor) {
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(vec3(gray), color, factor);
}

vec2 computeRefractOffset(float sdf) {
    if (sdf < 0.1) return vec2(0.0);
    vec2 grad = normalize(vec2(dFdx(sdf), dFdy(sdf)));
    float offsetAmount = pow(abs(sdf), 12.0) * -0.2;
    return grad * offsetAmount;
}

float highlight(float sdf) {
    if (sdf < 0.1) return 0.0;
    vec2 grad = normalize(vec2(dFdx(sdf), dFdy(sdf)));
    return 1.0 - clamp(pow(1.0 - abs(dot(grad, vec2(-1.0, 1.0))), 0.5), 0.0, 1.0);
}

out vec4 fragColor;

void main() {
    vec2 fragCoord = FlutterFragCoord().xy;
    float androidOffset = 0.85; // Adjust for Android devices
    vec2 centeredUV = fragCoord - uCenter + (vec2(WIDTH, HEIGHT) * -1.00);

    float sdf = boxSDF(centeredUV);
    float normalizedInside = (sdf / HEIGHT) + 1;
    float edgeBlendFactor = pow(normalizedInside, 20.0);

    vec2 uv = fragCoord / uResolution;
    vec3 baseTex = texture(uTexture, uv).rgb;

    vec2 sampleUV = uv + computeRefractOffset(normalizedInside);
    float mipLevel = mix(3.5, 1.5, edgeBlendFactor);
    vec3 blurredTex = getBlurredColor(sampleUV, mipLevel) * 0.9 + 0.1;
    blurredTex = mix(blurredTex, pow(saturate(blurredTex, 2.0), vec3(0.5)), edgeBlendFactor);
    blurredTex += mix(0.0, 0.5, clamp(highlight(normalizedInside) * pow(edgeBlendFactor, 5.0), 0.0, 1.0));

    float boxMask = 1.0 - clamp(sdf, 0.0, 1.0);
    fragColor = vec4(mix(baseTex, blurredTex, vec3(boxMask)), 1.0);
}