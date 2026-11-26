precision mediump float;

#define SHADOW_RADIUS 2
#include <definitions>

// Keep varyings trimmed to stay under iOS/WebGL1 limits
#ifdef IS_SKY
varying vec3 eyeDirection;
#else
varying highp vec4 vPosition;
varying vec2 vUv;
varying vec3 vNormal;
varying float vOpacity;
varying vec4 vShadowPosition;
varying vec3 vReflect;
#ifdef USE_NORMAL_MAP
varying mat3 vTbn;
#endif
varying float vFragDepth;
varying float vIsPerspective;

#endif

uniform sampler2D diffuseMap;
uniform samplerCube envMap;
uniform sampler2D normalMap;
uniform sampler2D specularMap;
uniform sampler2D noiseMap;

uniform float reflectivity;
uniform highp vec3 eyePosition;
uniform float specularIntensity;
uniform float shininess;
uniform float logDepthBufFC;
uniform float secondaryMapUvFactor;
uniform int debugMode;

uniform vec3 ambientLight;
uniform vec3 directionalLightColor;
uniform vec3 directionalLightDirection;
uniform vec3 explosionPosition;    // The world-space position of the explosion
uniform float explosionRadius;      // The maximum radius of the effect
uniform vec3 explosionColor;       // The RGB color of the light
uniform sampler2D falloffTexture;  // 1D or 2D texture for custom brightness curves
uniform bool useExplosion;

// Point lights
uniform highp vec3 pointLightColor[32];
uniform highp vec4 pointLightPositionRange[32];
uniform highp int pointLightCount;
uniform highp float vertexLightSnap; // >0: vertex-lit material; light computed in vert shader, carried in vReflect :)
uniform mediump sampler2D directionalLightShadowMap;

#if defined(LOG_DEPTH_BUF) && defined(IS_WEBGL1)
	#extension GL_EXT_frag_depth : enable
#endif

float lambert(vec3 normal, vec3 lightPosition) {
	float result = dot(normal, lightPosition);
	return max(result, 0.0);
}

#ifdef IS_WEBGL1
	mat3 transpose(mat3 inMatrix) {
		vec3 i0 = inMatrix[0];
		vec3 i1 = inMatrix[1];
		vec3 i2 = inMatrix[2];

		mat3 outMatrix = mat3(
			vec3(i0.x, i1.x, i2.x),
			vec3(i0.y, i1.y, i2.y),
			vec3(i0.z, i1.z, i2.z)
		);

		return outMatrix;
	}
#endif

vec4 sampleCubeTexture(samplerCube tex, vec3 uvw) {
	#ifdef ENV_MAP_Z_UP
		uvw.yz = vec2(uvw.z, -uvw.y);
	#endif
	return textureCube(tex, uvw);
}

float getShadowIntensity(sampler2D map, vec4 shadowPosition, int mapSize) {
	vec3 projectedTexcoord = shadowPosition.xyz / shadowPosition.w;
	projectedTexcoord = (projectedTexcoord + vec3(1.0)) / 2.0;

	bool inBounds =
		min(projectedTexcoord.x, min(projectedTexcoord.y, projectedTexcoord.z)) > 0.0 &&
		max(projectedTexcoord.x, max(projectedTexcoord.y, projectedTexcoord.z)) < 1.0;

	if (!inBounds) return 0.0;

	float mapSizeF = float(mapSize);
	float total = 0.0;

	for (int x = -SHADOW_RADIUS; x <= SHADOW_RADIUS; x++) {
		for (int y = -SHADOW_RADIUS; y <= SHADOW_RADIUS; y++) {
			vec2 uv = projectedTexcoord.xy + vec2(float(x) / mapSizeF, float(y) / mapSizeF);
			float depthValue = texture2D(map, uv.xy).r;
			if (depthValue < projectedTexcoord.z) total += 1.0;
		}
	}

	return mix(total / float((SHADOW_RADIUS*2+1)*(SHADOW_RADIUS*2+1)), 0.0, projectedTexcoord.z * projectedTexcoord.z);
}

float fresnel(vec3 direction, vec3 normal, bool invert) {
	vec3 nDirection = normalize(direction);
	vec3 nNormal = normalize(normal);
	vec3 halfDirection = normalize(nNormal + nDirection);

	float exponent = 5.0;
	float cosine = dot(halfDirection, nDirection);
	float product = max(cosine, 0.0);
	float factor = invert ? 1.0 - pow(product, exponent) : pow(product, exponent);

	return factor;
}

// Sum of all point lights at one world position
vec3 pointLightsAt(vec3 p, vec3 n) {
	vec3 acc = vec3(0.0);
	for (int pi = 0; pi < 32; pi++) {
		if (pi >= pointLightCount) break;
		vec3 dir = pointLightPositionRange[pi].xyz - p;
		float dist = length(dir);
		if (dist < pointLightPositionRange[pi].w && dist > 0.0) {
			dir /= dist;
			float att = 1.0 - (dist / pointLightPositionRange[pi].w);
			acc += pointLightColor[pi] * lambert(n, dir) * att * att;
		}
	}
	return acc;
}

void main() {
	#if defined(LOG_DEPTH_BUF) && !defined(IS_SKY)
		gl_FragDepthEXT = (vIsPerspective != 0.0)? log2(vFragDepth) * logDepthBufFC * 0.5 : gl_FragCoord.z;
	#endif

	#ifdef IS_SKY
		vec4 sampled = sampleCubeTexture(envMap, eyeDirection);
		gl_FragColor = sampled;
	#elif defined(IS_SHADOW)
		bool hasDirectionalLight = dot(directionalLightDirection, directionalLightDirection) > 0.0;
		float intensity = getShadowIntensity(directionalLightShadowMap, vShadowPosition, 250);
		if (!hasDirectionalLight) intensity = 0.0;
		gl_FragColor = vec4(vec3(0.0), intensity * 0.25);
	#else
		vec4 diffuse = vec4(1.0);

		#ifdef USE_DIFFUSE_MAP
			diffuse = texture2D(diffuseMap, vUv);
			#ifndef TRANSPARENT
				diffuse.a = 1.0;
			#endif
		#endif

		#ifdef USE_NOISE_MAP
			vec2 noiseIndex;
			vec4 noiseColor[4];
			vec2 halfPixel = vec2(1.0 / 64.0, 1.0 / 64.0);

			noiseIndex.x = floor(vUv.x - halfPixel.x) / 63.0 + 0.5/64.0;
			noiseIndex.y = floor(vUv.y - halfPixel.y) / 63.0 + 0.5/64.0;
			noiseColor[0] = texture2D(noiseMap, noiseIndex) * 1.0 - 0.5;

			noiseIndex.x = floor(vUv.x - halfPixel.x) / 63.0 + 0.5/64.0;
			noiseIndex.y = floor(vUv.y + halfPixel.y) / 63.0 + 0.5/64.0;
			noiseColor[1] = texture2D(noiseMap, noiseIndex) * 1.0 - 0.5;

			noiseIndex.x = floor(vUv.x + halfPixel.x) / 63.0 + 0.5/64.0;
			noiseIndex.y = floor(vUv.y + halfPixel.y) / 63.0 + 0.5/64.0;
			noiseColor[2] = texture2D(noiseMap, noiseIndex) * 1.0 - 0.5;

			noiseIndex.x = floor(vUv.x + halfPixel.x) / 63.0 + 0.5/64.0;
			noiseIndex.y = floor(vUv.y - halfPixel.y) / 63.0 + 0.5/64.0;
			noiseColor[3] = texture2D(noiseMap, noiseIndex) * 1.0 - 0.5;

			vec4 finalNoiseCol = (noiseColor[0] + noiseColor[1] + noiseColor[2] + noiseColor[3]) / 4.0;
			diffuse.rgb *= 1.0 + finalNoiseCol.r;
		#endif

		diffuse.a *= vOpacity;

		vec3 incomingLight = vec3(0.0);
		vec3 specularLight = vec3(0.0);

		#ifdef EMISSIVE
			incomingLight = vec3(1.0);
		#else
			incomingLight += ambientLight;

			vec3 normal = vNormal;

			#ifdef USE_NORMAL_MAP
				vec3 map = texture2D(normalMap, secondaryMapUvFactor * vUv).xyz;
				map = map * 255.0/127.0 - 128.0/127.0;
				#ifdef INVERT_U
					map.x = -map.x;
				#endif
				normal = vTbn * map;
			#endif

			vec3 addedLight = directionalLightColor * lambert(normal, -directionalLightDirection);

			#ifdef SATURATE_INCOMING_LIGHT
				addedLight = min(vec3(1.0), incomingLight + addedLight) - incomingLight;
			#endif

			#ifdef RECEIVE_SHADOWS
				bool hasDirectionalLight = dot(directionalLightDirection, directionalLightDirection) > 0.0;
				float intensity = getShadowIntensity(directionalLightShadowMap, vShadowPosition, 250);
				if (!hasDirectionalLight) intensity = 0.0;
				addedLight *= mix(1.0, 0.666, intensity);
			#endif

			incomingLight += addedLight;

			// Point lights
			{
				vec3 pNormal = normalize(normal);
				if (!gl_FrontFacing) pNormal = -pNormal;
				#if !defined(USE_ENV_MAP) || defined(USE_ACCURATE_REFLECTION_RAY)
					if (vertexLightSnap > 0.0) {
						incomingLight += vReflect; // classic vertex lighting,
					} else {
						incomingLight += pointLightsAt(vPosition.xyz, pNormal);
					}
				#else
					incomingLight += pointLightsAt(vPosition.xyz, pNormal);
				#endif
			}

			#ifdef USE_SPECULAR
				vec3 viewDir = normalize(eyePosition - vPosition.xyz);
				vec3 halfwayDir = normalize(-directionalLightDirection + viewDir);
				float spec = pow(max(dot(normal, halfwayDir), 0.0), shininess);
				#ifdef USE_SPECULAR_MAP
					spec *= texture2D(specularMap, secondaryMapUvFactor * vUv).r;
				#endif
				specularLight += vec3(specularIntensity * spec);
			#endif
		#endif
		if (useExplosion) {
        float dist = distance(vPosition.xyz, explosionPosition);
        if (dist < explosionRadius) {
            float normalizedDist = dist / explosionRadius;
            
            // Sample falloff from texture (using red channel)
            float falloff = texture2D(falloffTexture, vec2(normalizedDist, 0.5)).r;
            
            // ADD INTENSITY MULTIPLIER
            // 4.5 is a strong value that will make the center pop against the world textures
            float intensity = 3.5; 
            incomingLight += (explosionColor * falloff * intensity);
        }
    }

		vec4 shaded = diffuse * vec4(incomingLight, 1.0);
		shaded.rgb += specularLight;

		#ifdef USE_ENV_MAP
			#ifdef USE_FRESNEL
				vec3 viewDir = normalize(eyePosition - vPosition.xyz);
				float fac = fresnel(viewDir, normal, true);
			#else
				float fac = 1.0;
			#endif

			#ifdef USE_ACCURATE_REFLECTION_RAY
				vec3 incidentRay = normalize(vPosition.xyz - eyePosition);
				vec3 reflectionRay = reflect(incidentRay, normalize(vNormal));
			#else
				vec3 reflectionRay = vReflect;
			#endif

			vec4 sampled = sampleCubeTexture(envMap, reflectionRay);
			sampled.a *= vOpacity;
			shaded = mix(shaded, sampled, fac * reflectivity);
		#endif

		gl_FragColor = shaded;
		#ifdef USE_PREMULTIPLIED_ALPHA
			gl_FragColor.rgb *= gl_FragColor.a;
		#endif
	#endif
}