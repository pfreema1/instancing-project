import * as THREE from 'three';
import glslify from 'glslify';
import TouchTexture from './TouchTexture';
import {
	EffectComposer,
	BrightnessContrastEffect,
	EffectPass,
	RenderPass,
	ShaderPass,
	BlendFunction,
} from 'postprocessing';

import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';

import { TweenLite } from 'gsap/TweenMax';

export default class WebGLView {

	constructor(app) {
		this.app = app;
		this.imageUrl = 'images/sample-02.png';
		this.container = new THREE.Object3D();

		this.initThree();
		this.loadImage();
		// this.initObject();
		this.initControls();
		this.initPostProcessing();
	}

	initThree() {
		this.scene = new THREE.Scene();

		this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10000);
		this.camera.position.z = 300;

		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

		this.clock = new THREE.Clock();
	}

	loadImage() {
		const loader = new THREE.TextureLoader();

		loader.load(this.imageUrl, (texture) => {
			this.texture = texture;
			this.texture.minFilter = THREE.LinearFilter;
			this.texture.magFilter = THREE.LinearFilter;
			this.texture.format = THREE.RGBFormat;

			this.width = texture.image.width;
			this.height = texture.image.height;

			this.initPoints(true);
			this.initHitArea();
			this.initTouch();
			this.show();
			// debugger;
		})
	}

	show(time = 1.0) {
		TweenLite.fromTo(this.object3D.material.uniforms.uSize, time, {
			value: 0.5
		}, {
			value: 1.5
		});

	}

	initPoints(discard) {
		this.numPoints = this.width * this.height;

		let numVisible = this.numPoints;
		let threshold = 0;
		let originalColors;

		if (discard) {
			numVisible = 0;
			threshold = 34;

			const img = this.texture.image;
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			canvas.width = this.width;
			canvas.height = this.height;
			ctx.scale(1, -1);
			ctx.drawImage(img, 0, 0, this.width, this.height * -1);

			const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			originalColors = Float32Array.from(imgData.data);

			for (let i = 0; i < this.numPoints; i++) {
				if (originalColors[i * 4] > threshold) numVisible++;
			}
		}

		const uniforms = {
			uTime: { value: 0 },
			uRandom: { value: 1.0 },
			uDepth: { value: 2.0 },
			uSize: { value: 0.0 },
			uTextureSuze: { value: new THREE.Vector2(this.width, this.height) },
			uTexture: { value: this.texture },
			uTouch: { value: null }
		};

		const material = new THREE.RawShaderMaterial({
			uniforms,
			vertexShader: glslify(require('../../shaders/default.vert')),
			fragmentShader: glslify(require('../../shaders/default.frag')),
			depthTest: false,
			transparent: true,
			blending: THREE.AdditiveBlending
		});

		const geometry = new THREE.InstancedBufferGeometry();

		// positions
		const positions = new THREE.BufferAttribute(new Float32Array(4 * 3), 3);
		positions.setXYZ(0, -0.5, 0.5, 0.0);
		positions.setXYZ(1, 0.5, 0.5, 0.0);
		positions.setXYZ(2, -0.5, -0.5, 0.0);
		positions.setXYZ(3, 0.5, -0.5, 0.0);
		geometry.addAttribute('position', positions);

		// uvs
		const uvs = new THREE.BufferAttribute(new Float32Array(4 * 2), 2);
		uvs.setXYZ(0, 0.0, 0.0);
		uvs.setXYZ(1, 1.0, 0.0);
		uvs.setXYZ(2, 0.0, 1.0);
		uvs.setXYZ(3, 1.0, 1.0);
		geometry.addAttribute('uv', uvs);

		// index
		geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 2, 1, 2, 3, 1]), 1));

		const indices = new Uint16Array(numVisible);
		const offsets = new Float32Array(numVisible * 3);
		const angles = new Float32Array(numVisible);

		for (let i = 0, j = 0; i < this.numPoints; i++) {
			if (discard && originalColors[i * 4 + 0] <= threshold) continue;

			offsets[j * 3 + 0] = i % this.width;
			offsets[j * 3 + 1] = Math.floor(i / this.width);

			indices[j] = i;

			angles[j] = Math.random() * Math.PI;

			j++;
		}

		geometry.addAttribute('pindex', new THREE.InstancedBufferAttribute(indices, 1, false));
		geometry.addAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3, false));
		geometry.addAttribute('angle', new THREE.InstancedBufferAttribute(angles, 1, false));

		this.object3D = new THREE.Mesh(geometry, material);
		this.container.add(this.object3D);
	}

	initHitArea() {
		const geometry = new THREE.PlaneGeometry(this.width, this.height, 1, 1);
		const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, wireframe: true, depthTest: false });
		material.visible = false;
		this.hitArea = new THREE.Mesh(geometry, material);
		this.container.add(this.hitArea);

	}

	initTouch() {
		if (!this.touch) this.touch = new TouchTexture(this);
		this.object3D.material.uniforms.uTouch.value = this.touch.texture;
	}

	initControls() {
		this.trackball = new TrackballControls(this.camera, this.renderer.domElement);
		this.trackball.rotateSpeed = 2.0;
		this.trackball.enabled = true;
	}

	// initObject() {
	// 	const geometry = new THREE.IcosahedronBufferGeometry(50, 1);

	// 	const material = new THREE.ShaderMaterial({
	// 		uniforms: {},
	// 		vertexShader: glslify(require('../../shaders/default.vert')),
	// 		fragmentShader: glslify(require('../../shaders/default.frag')),
	// 		// wireframe: true
	// 	});

	// 	this.object3D = new THREE.Mesh(geometry, material);
	// 	this.scene.add(this.object3D);
	// }

	initPostProcessing() {
		this.composer = new EffectComposer(this.renderer);
		this.composer.enabled = false;

		const renderPass = new RenderPass(this.scene, this.camera);
		renderPass.renderToScreen = false;

		const contrastEffect = new BrightnessContrastEffect({ contrast: 1 });
		const contrastPass = new EffectPass(this.camera, contrastEffect);
		contrastPass.renderToScreen = true;

		this.composer.addPass(renderPass);
		this.composer.addPass(contrastPass);

		// kickstart composer
		this.composer.render(1);
	}

	// ---------------------------------------------------------------------------------------------
	// PUBLIC
	// ---------------------------------------------------------------------------------------------

	update() {
		const delta = this.clock.getDelta();

		if (this.trackball) this.trackball.update();
	}

	draw() {
		if (this.composer && this.composer.enabled) this.composer.render();
		else this.renderer.render(this.scene, this.camera);
	}

	// ---------------------------------------------------------------------------------------------
	// EVENT HANDLERS
	// ---------------------------------------------------------------------------------------------

	resize() {
		if (!this.renderer) return;
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.fovHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 180 / 2) * this.camera.position.z;
		this.fovWidth = this.fovHeight * this.camera.aspect;

		this.renderer.setSize(window.innerWidth, window.innerHeight);

		this.composer.setSize(window.innerWidth, window.innerHeight);

		if (this.trackball) this.trackball.handleResize();
	}
}
