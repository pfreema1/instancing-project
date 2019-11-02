// @author brunoimbrizi / http://brunoimbrizi.com

varying vec2 vUv;

void main() {
	vUv = uv;
	vec4 pos = vec4(position, 1.0);
	gl_Position = projectionMatrix * modelViewMatrix * pos;
}
