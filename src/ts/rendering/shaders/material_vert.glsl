precision highp float;
precision highp int;

#include <definitions>

attribute vec3 position;
attribute vec3 normal;
attribute vec4 tangent;
attribute vec2 uv;
attribute float meshInfoIndex;

uniform highp sampler2D meshInfos;
uniform int meshInfoTextureWidth;
uniform int meshInfoTextureHeight;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 inverseProjectionMatrix;
uniform bool skipTransparent;
uniform mat4 directionalLightTransform;
uniform vec3 eyePosition;
uniform float materialOpacity;
uniform vec3 pointLightColor[32];
uniform vec4 pointLightPositionRange[32];
uniform int pointLightCount;

varying vec4 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vOpacity;
varying vec4 vShadowPosition;
varying vec3 vReflect;
#ifdef USE_NORMAL_MAP
varying mat3 vTbn;
#endif
varying float vFragDepth;
varying float vIsPerspective;
varying vec3 eyeDirection;

#ifdef IS_WEBGL1
    mat3 transpose(mat3 inMatrix) {
        vec3 i0 = inMatrix[0];
        vec3 i1 = inMatrix[1];
        vec3 i2 = inMatrix[2];
        return mat3(
            vec3(i0.x, i1.x, i2.x),
            vec3(i0.y, i1.y, i2.y),
            vec3(i0.z, i1.z, i2.z)
        );
    }
    mat3 inverse(mat3 M) {
        mat3 M_t = transpose(M);
        float det = dot(cross(M_t[0], M_t[1]), M_t[2]);
        mat3 adjugate = mat3(cross(M_t[1], M_t[2]), cross(M_t[2], M_t[0]), cross(M_t[0], M_t[1]));
        return adjugate / det;
    }
#endif

int _mod(int a, int n) {
    #ifdef IS_WEBGL1
        return a - n * (a / n);
    #else
        return a % n;
    #endif
}

mat4 getMeshInfo(int index) {
    ivec2 coords = ivec2(
        _mod(4 * index, meshInfoTextureWidth),
        (4 * index) / meshInfoTextureWidth
    );
    #ifdef IS_WEBGL1
        return mat4(
            texture2D(meshInfos, vec2(coords + ivec2(0, 0)) / vec2(meshInfoTextureWidth, meshInfoTextureHeight)),
            texture2D(meshInfos, vec2(coords + ivec2(1, 0)) / vec2(meshInfoTextureWidth, meshInfoTextureHeight)),
            texture2D(meshInfos, vec2(coords + ivec2(2, 0)) / vec2(meshInfoTextureWidth, meshInfoTextureHeight)),
            texture2D(meshInfos, vec2(coords + ivec2(3, 0)) / vec2(meshInfoTextureWidth, meshInfoTextureHeight))
        );
    #else
        return mat4(
            texelFetch(meshInfos, coords + ivec2(0, 0), 0),
            texelFetch(meshInfos, coords + ivec2(1, 0), 0),
            texelFetch(meshInfos, coords + ivec2(2, 0), 0),
            texelFetch(meshInfos, coords + ivec2(3, 0), 0)
        );
    #endif
}

bool isPerspectiveMatrix(mat4 m) {
    return m[2][3] == -1.0;
}

float lambert(vec3 normal, vec3 lightDir) {
    return max(dot(normal, lightDir), 0.0);
}

void main() {
    #ifdef IS_SKY
        mat4 inverseProjection = inverseProjectionMatrix;
        mat3 inverseModelView = transpose(mat3(viewMatrix));
        vec3 unprojected = (inverseProjection * vec4(position, 1.0)).xyz;
        eyeDirection = inverseModelView * unprojected;
        gl_Position = vec4(position, 1.0);
vNormal = vec3(0.0);
vOpacity = 1.0;
vPosition = vec4(0.0);
vUv = vec2(0.0);
vShadowPosition = vec4(0.0);
vReflect = vec3(0.0);
vFragDepth = 0.0;
vIsPerspective = 0.0;
    #else
        mat4 meshInfo = getMeshInfo(int(meshInfoIndex + 0.1));
        mat4 transform = meshInfo;
        transform[0][3] = 0.0;
        transform[1][3] = 0.0;
        transform[2][3] = 0.0;
        transform[3][3] = 1.0;
        float opacity = meshInfo[0][3];
int meshFlags = int(meshInfo[1][3]);
opacity *= materialOpacity;
        vOpacity = opacity;

        if (skipTransparent && opacity < 1.0) {
            gl_Position = vec4(0.0);
            return;
        }

        vec4 worldPosition = transform * vec4(position, 1.0);
        vPosition = worldPosition;
        mat4 mvp = projectionMatrix * viewMatrix * transform;
gl_Position = mvp * vec4(position, 1.0);

        vUv = uv;
        #ifdef FLIP_Y
            vUv.y = 1.0 - vUv.y;
        #endif

        mat3 normalTransform = transpose(inverse(mat3(transform)));
        vec3 transformedNormal = normalTransform * normal;
#ifdef NORMALIZE_NORMALS
    transformedNormal = normalize(transformedNormal);
#endif
		#ifdef NORMALIZE_NORMALS
    transformedNormal = normalize(transformedNormal);
#endif
        vNormal = transformedNormal;

        #ifdef USE_NORMAL_MAP
            vec3 N = transformedNormal;
            vec3 T = normalize((transform * vec4(tangent.xyz, 0.0)).xyz);
            T = normalize(T - dot(T, N) * N);
            vec3 B = cross(N, T) * tangent.w;
            vTbn = mat3(T, B, N);
        #endif

        #if defined(RECEIVE_SHADOWS) || defined(IS_SHADOW)
            vShadowPosition = directionalLightTransform * worldPosition;
        #endif

        #if defined(USE_ENV_MAP) && !defined(USE_ACCURATE_REFLECTION_RAY)
            vec3 incidentRay = normalize(worldPosition.xyz - eyePosition);
            vReflect = reflect(incidentRay, normalize(transformedNormal));
        #endif

        #ifdef LOG_DEPTH_BUF
            vFragDepth = 1.0 + gl_Position.w;
            vIsPerspective = float(isPerspectiveMatrix(projectionMatrix));
        #endif

        // Per‑vertex point light accumulation
        vec3 pointLightAccum = vec3(0.0);
        for (int pi = 0; pi < 32; pi++) {
            if (pi >= pointLightCount) break;
            vec3 pointLightDir = pointLightPositionRange[pi].xyz - worldPosition.xyz;
            float lightDist = length(pointLightDir);
            if (lightDist < pointLightPositionRange[pi].w && lightDist > 0.0) {
                pointLightDir = normalize(pointLightDir);
                float attenuation = 1.0 - (lightDist / pointLightPositionRange[pi].w);
                pointLightAccum += pointLightColor[pi] * lambert(transformedNormal, pointLightDir) * attenuation * attenuation;
            }
        }
        #if !defined(USE_ENV_MAP) || defined(USE_ACCURATE_REFLECTION_RAY)
    vReflect = pointLightAccum;
#endif
    #endif
}
