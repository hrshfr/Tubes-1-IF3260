<template>
	<div id="app">
		<canvas width="900" @click="(e) => clickResponse(e)"></canvas>
		<div id="container-menu">
			<div class="information">
				<h3>{{ info }}</h3>
			</div>
			<button
				style="margin-top: 0.3rem; width: fit-content"
				@click="printObject"
			>
				Show all object
			</button>
			<span> Files</span>
			<div style="display: flex; gap: 0.5rem; margin-top: 0.3rem">
				<button @click="saveFile">Save</button>
				<input
					id="load"
					type="file"
					accept=".json"
					@input="(e) => loadFile()"
				/>
			</div>

			<span style="margin-top: 1rem">Clear Screen:</span>
			<button style="margin-top: 0.3rem; width: fit-content" @click="clear">
				Clear
			</button>

			<span style="margin-top: 1rem">Action: </span>
			<div style="display: flex; gap: 0.5rem; margin-top: 0.3rem">
				<select
					name="actions"
					id="actions"
					style="width: 10rem"
					@change="
						(e) => {
							this.currentSelectedObject =
								e.target.options[e.target.options.selectedIndex].value;
						}
					"
				>
					<option value="select">Select Object</option>
					<option value="line">Line</option>
					<option value="square">Square</option>
					<option value="rectangle">Rectangle</option>
					<option value="polygon">Polygon</option>
				</select>
				<button
					v-if="currentSelectedObject == 'polygon'"
					@click="stopDrawingPolygon()"
				>
					Stop Drawing Polygon
				</button>
			</div>

			<span style="margin-top: 1rem">Color:</span>
			<input
				type="color"
				id="color-picker"
				style="margin-top: 0.3rem"
				@input="(e) => handleColor(e)"
			/>

			<div id="container-slider" style="margin-top: 1rem">
				<label for="tx">Translation X</label>
				<input
					id="tx"
					class="slider"
					type="range"
					min="0"
					max="900"
					value="0"
					oninput="txoutput.value = tx.value"
					@input="(e) => this.updatePositionX(e)"
				/>
				<output id="txoutput">0</output>
			</div>
			<div id="container-slider" style="margin-top: 1rem">
				<label for="ty">Translation Y</label>
				<input
					id="ty"
					class="slider"
					type="range"
					min="0"
					value="0"
					oninput="tyoutput.value = ty.value"
					@input="(e) => this.updatePositionY(e)"
				/>
				<output id="tyoutput">0</output>
			</div>
			<div id="container-slider" style="margin-top: 1rem">
				<label for="lenOrSide">Length/Side</label>
				<input
					id="lenOrSide"
					v-model="lenOrSide"
					class="slider"
					type="range"
					min="0"
					max="2000"
					@input="(e) => this.updateLength(e)"
				/>
				<output>{{ lenOrSide }}</output>
			</div>
		</div>
	</div>
</template>

<script>
/*eslint no-mixed-spaces-and-tabs: ["error", "smart-tabs"]*/
import { isInside, euclideanDistance, gradient } from "./utils.js";

export default {
	name: "App",
	data: () => ({
		vertexSource: `
      attribute vec2 a_position;
      uniform vec2 u_resolution;

      void main() {
        vec2 zeroToOne = a_position / u_resolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 clipSpace = zeroToTwo - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      }`,

		fragmentSource: `
      precision highp float;

      uniform vec4 u_color;
      void main() {
        gl_FragColor = u_color;
      }`,

		gl: "",
		positionLocation: "",
		resolutionUniformLocation: "",
		colorUniformLocation: "",
		currentColor: [],
		currentClickedPos: [],
		currentSelectedObject: "",
		currentSelectedObjectId: "",
		allObjects: [],
		currPolygonVertex: [],
		mouseClicked: false,
		startClickedCanvas: [],
		mouseMoveCoordinate: [],
		canvas: null,
		info: "",
		lenOrSide: 0,
	}),

	mounted() {
		this.canvas = document.querySelector("canvas");
		this.gl = this.canvas.getContext("webgl", { preserveDrawingBuffer: true });

		this.canvas.height = window.innerHeight;
		document.getElementById("ty").max = window.innerHeight;

		if (!this.gl) {
			throw new Error("WebGL not supported");
		}

		const vertexShader = this.createShader(
			this.gl,
			this.gl.VERTEX_SHADER,
			this.vertexSource
		);
		const fragmentShader = this.createShader(
			this.gl,
			this.gl.FRAGMENT_SHADER,
			this.fragmentSource
		);
		const program = this.createProgram(this.gl, vertexShader, fragmentShader);

		this.positionLocation = this.gl.getAttribLocation(program, "a_position");
		this.resolutionUniformLocation = this.gl.getUniformLocation(
			program,
			"u_resolution"
		);
		this.colorUniformLocation = this.gl.getUniformLocation(program, "u_color");

		const buffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
		this.gl.useProgram(program);
		this.gl.enableVertexAttribArray(this.positionLocation);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		this.gl.vertexAttribPointer(
			this.positionLocation,
			2,
			this.gl.FLOAT,
			false,
			0,
			0
		);
		this.gl.uniform2f(
			this.resolutionUniformLocation,
			this.gl.canvas.width,
			this.gl.canvas.height
		);
		this.canvas.addEventListener(
			"mousedown",
			function (e) {
				this.startClickedCanvas = [e.offsetX, e.offsetY];
				this.mouseClicked = true;
				if (this.currentSelectedObject === "line") {
					this.allObjects.unshift({
						id: this.allObjects.length + 1,
						object: "line",
						v: [this.startClickedCanvas, [e.offsetX, e.offsetY]],
						color: this.currentColor,
					});
				}
				if (this.currentSelectedObject === "square") {
					this.allObjects.unshift({
						id: this.allObjects.length + 1,
						object: "square",
						x: e.offsetX,
						y: e.offsetY,
						x1: e.offsetX,
						y1: e.offsetY,
						side: 0,
						color: this.currentColor,
					});
				}
				if (this.currentSelectedObject === "rectangle") {
					this.allObjects.unshift({
						id: this.allObjects.length + 1,
						object: "rectangle",
						x: e.offsetX,
						y: e.offsetY,
						width: 0,
						height: 0,
						color: this.currentColor,
					});
				}
			}.bind(this),
			false
		);
		this.canvas.addEventListener(
			"mouseup",
			function () {
				this.mouseClicked = false;
			}.bind(this),
			false
		);
		this.canvas.addEventListener(
			"mousemove",
			function (e) {
				if (this.mouseClicked) {
					this.mouseMoveCoordinate = [e.offsetX, e.offsetY];
					if (this.currentSelectedObject === "line") {
						this.allObjects.shift();
						this.allObjects.unshift({
							id: this.allObjects.length + 1,
							object: "line",
							v: [this.startClickedCanvas, [e.offsetX, e.offsetY]],
							color: this.currentColor,
						});
						this.drawLine(this.allObjects[0]);
					}
					if (this.currentSelectedObject === "square") {
						this.allObjects.shift();
						this.allObjects.unshift({
							id: this.allObjects.length + 1,
							object: "square",
							x: this.startClickedCanvas[0],
							y: this.startClickedCanvas[1],
							x1: e.offsetX,
							y1: e.offsetY,
							color: this.currentColor,
							side: Math.max(
								Math.abs(e.offsetX - this.startClickedCanvas[0]),
								Math.abs(e.offsetY - this.startClickedCanvas[1])
							),
						});
						this.drawSquare(this.allObjects[0]);
					}
					if (this.currentSelectedObject === "rectangle") {
						this.allObjects.shift();
						this.allObjects.unshift({
							id: this.allObjects.length + 1,
							object: "rectangle",
							x: this.startClickedCanvas[0],
							y: this.startClickedCanvas[1],
							width: e.offsetX - this.startClickedCanvas[0],
							height: e.offsetY - this.startClickedCanvas[1],
							color: this.currentColor,
						});
						this.drawRectangle(this.allObjects[0]);
					}
				}
			}.bind(this),
			false
		);
	},
	watch: {
		allObjects() {
			this.drawScene();
		},
		mouseMoveCoordinate() {
			if (this.currentSelectedObject == "select") {
				if (this.mouseClicked) {
					let obj = this.allObjects.find(
						(item) => item.id == this.currentSelectedObjectId
					);
					if (obj.object == "line") {
						let v0distance = euclideanDistance(
							this.startClickedCanvas[0],
							this.startClickedCanvas[1],
							obj.v[0][0],
							obj.v[0][1]
						);
						let v1distance = euclideanDistance(
							this.startClickedCanvas[0],
							this.startClickedCanvas[1],
							obj.v[1][0],
							obj.v[1][1]
						);
						if (this.mouseMoveCoordinate.length !== 0) {
							if (Math.max(v0distance, v1distance) === v1distance) {
								obj.v[0] = obj.v[1];
							}
							obj.v[1] = [
								this.mouseMoveCoordinate[0],
								this.mouseMoveCoordinate[1],
							];
						}
					}
					// if (obj.object == "square") {
					// 	let v0 = [obj.x,obj.y];
					// 	let v1 = [obj.x,obj.y];
					// 	let v2 = [obj.x,obj.y];
					// 	let v3 = [obj.x,obj.y];
					// 	obj.x1 = this.mouseMoveCoordinate[0];
					// 	obj.y1 = this.mouseMoveCoordinate[1];
					// 	obj.side = Math.max(
					// 		Math.abs(this.mouseMoveCoordinate[0] - obj.x),
					// 		Math.abs(this.mouseMoveCoordinate[1] - obj.y)
					// 	);
					// }
					this.drawScene();
				}
			}
		},
	},
	methods: {
		clear() {
			this.allObjects = [];
			this.gl.clearColor(0, 0, 0, 0);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		},

		createShader(gl, type, source) {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
			if (success) {
				return shader;
			}

			console.log(gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
		},

		createProgram(gl, vertexShader, fragmentShader) {
			const program = gl.createProgram();
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, fragmentShader);
			gl.linkProgram(program);
			var success = gl.getProgramParameter(program, gl.LINK_STATUS);
			if (success) {
				return program;
			}

			console.log(gl.getProgramInfoLog(program));
			gl.deleteProgram(program);
		},

		drawRectangle(rect) {
			var x1 = rect.x;
			var x2 = rect.x + rect.width;
			var y1 = rect.y;
			var y2 = rect.y + rect.height;

			const vertexData = [x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2];

			let color = this.hexToRGB(rect.color);
			this.gl.bufferData(
				this.gl.ARRAY_BUFFER,
				new Float32Array(vertexData),
				this.gl.STATIC_DRAW
			);
			this.gl.uniform4f(
				this.colorUniformLocation,
				color[0],
				color[1],
				color[2],
				1
			);
			this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
		},

		drawSquare(square) {
			let x1 = 0;
			let x2 = 0;
			let y1 = 0;
			let y2 = 0;

			if (square.x1 > square.x) {
				if (square.y1 > square.y) {
					x1 = square.x;
					x2 = square.x + square.side;
					y1 = square.y;
					y2 = square.y + square.side;
				} else {
					x1 = square.x;
					x2 = square.x + square.side;
					y1 = square.y;
					y2 = square.y - square.side;
				}
			} else {
				if (square.y1 > square.y) {
					x1 = square.x;
					x2 = square.x - square.side;
					y1 = square.y;
					y2 = square.y + square.side;
				} else {
					x1 = square.x;
					x2 = square.x - square.side;
					y1 = square.y;
					y2 = square.y - square.side;
				}
			}

			const vertexData = [x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2];

			let color = this.hexToRGB(square.color);
			this.gl.bufferData(
				this.gl.ARRAY_BUFFER,
				new Float32Array(vertexData),
				this.gl.STATIC_DRAW
			);
			this.gl.uniform4f(
				this.colorUniformLocation,
				color[0],
				color[1],
				color[2],
				1
			);
			this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
		},
		drawLine(line) {
			const vertexData = [
				line.v[0][0],
				line.v[0][1],
				line.v[1][0],
				line.v[1][1],
			];

			let color = this.hexToRGB(line.color);
			this.gl.bufferData(
				this.gl.ARRAY_BUFFER,
				new Float32Array(vertexData),
				this.gl.STATIC_DRAW
			);
			this.gl.uniform4f(
				this.colorUniformLocation,
				color[0],
				color[1],
				color[2],
				1
			);
			this.gl.drawArrays(this.gl.LINES, 0, 2);
		},

		hexToRGB(hex) {
			var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
			return result
				? [
						parseInt(result[1], 16) / 255,
						parseInt(result[2], 16) / 255,
						parseInt(result[3], 16) / 255,
				  ]
				: null;
		},

		handleColor(e) {
			this.currentColor = e.target.value;

			if (this.currentClickedPos != []) {
				this.allObjects[this.currentClickedPos[1]].color = e.target.value;
				this.drawScene();
			}
		},

		clickResponse(e) {
			if (this.currentSelectedObject == "select") {
				this.selectObject(e);
			} else if (this.currentSelectedObject == "polygon") {
				if (this.currPolygonVertex.length < 6) {
					this.currPolygonVertex.push(e.offsetX, e.offsetY);
				} else {
					this.currPolygonVertex.push(
						this.currPolygonVertex[0],
						this.currPolygonVertex[1],
						this.currPolygonVertex[this.currPolygonVertex.length - 2],
						this.currPolygonVertex[this.currPolygonVertex.length - 1],
						e.offsetX,
						e.offsetY
					);
				}
				if (this.currPolygonVertex.length >= 6) {
					this.drawPolygon(this.currPolygonVertex, this.currentColor);
				}
			}
		},

		drawPolygon(vertexData, colorHex) {
			let color = this.hexToRGB(colorHex);
			this.gl.bufferData(
				this.gl.ARRAY_BUFFER,
				new Float32Array(vertexData),
				this.gl.STATIC_DRAW
			);
			this.gl.uniform4f(
				this.colorUniformLocation,
				color[0],
				color[1],
				color[2],
				1
			);
			this.gl.drawArrays(this.gl.TRIANGLES, 0, vertexData.length / 2);
		},

		stopDrawingPolygon() {
			this.allObjects.unshift({
				id: this.allObjects.length + 1,
				object: "polygon",
				vertex: this.currPolygonVertex,
				color: this.currentColor,
			});
			this.currPolygonVertex = [];
		},

		vertexPicking(e, objIdx) {
			if (objIdx == null) {
				this.currentClickedPos = [null, null];
			}

			let nearestIdx = null;
			let minDist = 10;

			// line
			if (this.allObjects[objIdx].object == "line") {
				const line = this.allObjects[objIdx];
				let v1 = euclideanDistance(
					e.offsetX,
					e.offsetY,
					line.v[0][0],
					line.v[0][1]
				);
				let v2 = euclideanDistance(
					e.offsetX,
					e.offsetY,
					line.v[1][0],
					line.v[1][1]
				);

				if (v1 < minDist) {
					minDist = v1;
					nearestIdx = 0;
				}
				if (v2 < minDist) {
					minDist = v2;
					nearestIdx = 1;
				}
			}

			//  square
			else if (this.allObjects[objIdx].object == "square") {
				const rect = this.allObjects[objIdx];
				let vertices = [
					[rect.x, rect.y],
					[rect.x + rect.side, rect.y],
					[rect.x + rect.side, rect.y + rect.side],
					[rect.x, rect.y + rect.side],
				];

				for (let i = 0; i < vertices.length; i++) {
					let v = euclideanDistance(
						e.offsetX,
						e.offsetY,
						vertices[i][0],
						vertices[i][1]
					);

					if (v < minDist) {
						minDist = v;
						nearestIdx = i;
					}
				}
			}
			//  rectangle
			else if (this.allObjects[objIdx].object == "rectangle") {
				const rect = this.allObjects[objIdx];
				let vertices = [
					[rect.x, rect.y],
					[rect.x + rect.width, rect.y],
					[rect.x + rect.width, rect.y + rect.height],
					[rect.x, rect.y + rect.height],
				];

				for (let i = 0; i < vertices.length; i++) {
					let v = euclideanDistance(
						e.offsetX,
						e.offsetY,
						vertices[i][0],
						vertices[i][1]
					);

					if (v < minDist) {
						minDist = v;
						nearestIdx = i;
					}
				}
			} else if (this.allObjects[objIdx].object == "polygon") {
				// polygon
			}

			// output
			console.log([nearestIdx, objIdx]);
			this.currentClickedPos = [nearestIdx, objIdx];
		},
		getMoveVertex(e) {
			return e;
		},
		selectObject(e) {
			let objIdx = null;
			for (let i = 0; i < this.allObjects.length; i++) {
				// line
				if (this.allObjects[i].object == "line") {
					const line = this.allObjects[i];
					let m1 = gradient(
						line.v[0][0],
						line.v[0][1],
						line.v[1][0],
						line.v[1][1]
					);
					let m2 = gradient(line.v[0][0], line.v[0][1], e.offsetX, e.offsetY);

					if (Math.abs(m2 - m1) < 0.05) {
						objIdx = i;
					}
				}

				// rectangle and square
				if (this.allObjects[i].object === "square") {
					const square = this.allObjects[i];
					let vertices = [];
					if (square.x1 > square.x) {
						if (square.y1 > square.y) {
							vertices = [
								[square.x + square.side, square.y],
								[square.x, square.y],
								[square.x, square.y + square.side],
								[square.x + square.side, square.y + square.side],
							];
						} else {
							vertices = [
								[square.x + square.side, square.y - square.side],
								[square.x, square.y - square.side],
								[square.x, square.y],
								[square.x + square.side, square.y],
							];
						}
					} else {
						if (square.y1 > square.y) {
							vertices = [
								[square.x - square.side, square.y],
								[square.x, square.y],
								[square.x, square.y + square.side],
								[square.x - square.side, square.y + square.side],
							];
						} else {
							vertices = [
								[square.x - square.side, square.y],
								[square.x, square.y],
								[square.x, square.y - square.side],
								[square.x - square.side, square.y - square.side],
							];
						}
					}

					let mousePos = [e.offsetX, e.offsetY];

					if (isInside(vertices, mousePos)) {
						objIdx = i;
					}
				}
				if (this.allObjects[i].object === "rectangle") {
					const rect = this.allObjects[i];
					let vertices = [
						[rect.x, rect.y],
						[rect.x + rect.width, rect.y],
						[rect.x + rect.width, rect.y + rect.height],
						[rect.x, rect.y + rect.height],
					];
					let mousePos = [e.offsetX, e.offsetY];

					if (isInside(vertices, mousePos)) {
						objIdx = i;
					}
				}

				if (this.allObjects[i].object == "polygon") {
					let mousePos = [e.offsetX, e.offsetY];
					let vertices = [
						[this.allObjects[i].vertex[0], this.allObjects[i].vertex[1]],
						[this.allObjects[i].vertex[2], this.allObjects[i].vertex[3]],
						[this.allObjects[i].vertex[4], this.allObjects[i].vertex[5]],
					];

					for (let j = 10; j < this.allObjects[i].vertex.length; j += 6) {
						vertices.push([
							this.allObjects[i].vertex[j],
							this.allObjects[i].vertex[j + 1],
						]);
					}

					if (isInside(vertices, mousePos)) {
						objIdx = i;
					}
					console.log(this.allObjects[i].vertex);
					console.log(vertices);
				}
			}

			if (objIdx != null) {
				this.vertexPicking(e, objIdx);

				let obj = this.allObjects[objIdx];
				document.getElementById("color-picker").value = obj.color;

				if (obj.object == "line") {
					this.info = "Line #" + obj.id + " selected";
					this.currentSelectedObjectId = obj.id;

					document.getElementById("lenOrSide").disabled = true;
					document.getElementById("tx").value = obj.v[0][0];
					document.getElementById("txoutput").innerHTML = obj.v[0][0];
					document.getElementById("ty").value = obj.v[0][1];
					document.getElementById("tyoutput").innerHTML = obj.v[0][1];
				} else if (obj.object == "rectangle") {
					this.info = "Rectangle #" + obj.id + " selected";
					this.currentSelectedObjectId = obj.id;
					this.lenOrSide = obj.width;
					document.getElementById("tx").value = obj.x;
					document.getElementById("txoutput").innerHTML = obj.x;
					document.getElementById("ty").value = obj.y;
					document.getElementById("tyoutput").innerHTML = obj.y;
				} else if (obj.object == "square") {
					this.info = "Square #" + obj.id + " selected";
					this.currentSelectedObjectId = obj.id;
					this.lenOrSide = obj.side;
					document.getElementById("tx").value = obj.x;
					document.getElementById("txoutput").innerHTML = obj.x;
					document.getElementById("ty").value = obj.y;
					document.getElementById("tyoutput").innerHTML = obj.y;
				} else if (obj.object == "polygon") {
					this.info = "Polygon #" + obj.id + " selected";
					this.currentSelectedObjectId = obj.id;
					document.getElementById("tx").value = obj.vertex[0];
					document.getElementById("txoutput").innerHTML = obj.vertex[0];
					document.getElementById("ty").value = obj.vertex[1];
					document.getElementById("tyoutput").innerHTML = obj.vertex[1];
				}
			} else {
				this.info = "";
				this.currentClickedPos = [];
				document.getElementById("tx").value = 0;
				document.getElementById("txoutput").innerHTML = 0;
				document.getElementById("ty").value = 0;
				document.getElementById("tyoutput").innerHTML = 0;
				this.lenOrSide = 0;
				document.getElementById("color-picker").value = "#000000";
			}
			//return objIdx;
		},

		updatePositionX(e) {
			if (this.currentClickedPos != []) {
				let obj = this.allObjects[this.currentClickedPos[1]];
				if (obj.object == "line") {
					let diff = obj.v[1][0] - obj.v[0][0];
					obj.v[0][0] = parseFloat(e.target.value);
					obj.v[1][0] = parseFloat(e.target.value) + diff;
				} else if (obj.object == "square" || obj.object == "rectangle") {
					obj.x = parseFloat(e.target.value);
				} else if (obj.object == "polygon") {
					let ref = obj.vertex[0];
					for (let i = 0; i < obj.vertex.length; i++) {
						if (i % 2 == 0) {
							obj.vertex[i] = obj.vertex[i] + (e.target.value - ref);
						}
					}
				}
				this.drawScene();
			}
		},

		updatePositionY(e) {
			if (this.currentClickedPos != []) {
				let obj = this.allObjects[this.currentClickedPos[1]];
				if (obj.object == "line") {
					let diff = obj.v[1][1] - obj.v[0][1];

					obj.v[0][1] = parseFloat(e.target.value);
					obj.v[1][1] = parseFloat(e.target.value) + diff;
				} else if (obj.object == "square" || obj.object == "rectangle") {
					obj.y = parseFloat(e.target.value);
				} else if (obj.object == "polygon") {
					let ref = obj.vertex[1];
					for (let i = 0; i < obj.vertex.length; i++) {
						if (i % 2 == 1) {
							obj.vertex[i] = obj.vertex[i] + (e.target.value - ref);
						}
					}
				}

				this.drawScene();
			}
		},

		updateLength(e) {
			let obj = this.allObjects.find(
				(item) => item.id == this.currentSelectedObjectId
			);

			if (obj.object == "square") {
				obj.side = parseFloat(e.target.value);
				this.drawScene();
			}
			if (obj.object == "rectangle") {
				obj.width = parseFloat(e.target.value);
				this.drawScene();
			}
			if (obj.object == "line") {
				let x = Math.sqrt(
					Math.abs(
						parseFloat(e.target.value) -
							Math.pow(Math.abs(obj.v[0][0] - obj.v[1][0]), 2)
					)
				);
				let y = Math.sqrt(
					Math.abs(
						parseFloat(e.target.value) -
							Math.pow(Math.abs(obj.v[0][1] - obj.v[1][1]), 2)
					)
				);
				if (obj.v[1][0] > obj.v[0][0]) {
					if (obj.v[1][1] > obj.v[0][1]) {
						obj.v[1][0] = obj.v[0][0] + x;
						obj.v[1][1] = obj.v[0][1] + y;
					} else {
						obj.v[1][0] = obj.v[0][0] + x;
						obj.v[1][1] = obj.v[0][1] - y;
					}
				} else {
					if (obj.v[1][1] > obj.v[0][1]) {
						obj.v[1][0] = obj.v[0][0] - x;
						obj.v[1][1] = obj.v[0][1] + y;
					} else {
						obj.v[1][0] = obj.v[0][0] - x;
						obj.v[1][1] = obj.v[0][1] - y;
					}
				}
				this.drawScene();
			}
		},

		drawScene() {
			this.gl.clearColor(0, 0, 0, 0);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);

			for (let i = this.allObjects.length - 1; i >= 0; i--) {
				if (this.allObjects[i].object == "rectangle") {
					this.drawRectangle(this.allObjects[i]);
				} else if (this.allObjects[i].object == "square") {
					this.drawSquare(this.allObjects[i]);
				} else if (this.allObjects[i].object == "line") {
					this.drawLine(this.allObjects[i]);
				} else if (this.allObjects[i].object == "polygon") {
					this.drawPolygon(this.allObjects[i].vertex, this.allObjects[i].color);
				}
			}
		},

		saveFile() {
			const filename = "drawing.json";
			const jsonStr = JSON.stringify(this.allObjects);

			let element = document.createElement("a");
			element.setAttribute(
				"href",
				"data:text/plain;charset=utf-8," + encodeURIComponent(jsonStr)
			);
			element.setAttribute("download", filename);

			element.style.display = "none";
			document.body.appendChild(element);

			element.click();

			document.body.removeChild(element);
		},
		printObject() {
			console.log(this.allObjects);
		},
		loadFile() {
			var file = document.getElementById("load").files[0];
			if (file) {
				var reader = new FileReader();
				reader.readAsText(file, "UTF-8");

				reader.onload = (e) => {
					this.clear();
					this.allObjects = JSON.parse(e.target.result);
					// console.log(this.allObjects)
					this.drawScene();
				};
			}
		},
	},
};
</script>

<style>
#app {
	display: flex;
}

#container-menu {
	width: 100%;
	display: flex;
	flex-flow: column;
	justify-content: center;
	padding: 0 2rem 0 2rem;
}

body {
	margin: 0 0 0 0;
	overflow: hidden;
}
canvas {
	width: 900px;
	height: 100%;
	background-color: black;
}

#container-canvas-button {
	display: flex;
	flex-direction: column;
}

#container-button {
	display: flex;
	gap: 0.5rem;
}
.information {
	display: flex;
	justify-content: center;
	margin: 0 2em;
	border: 2px solid black;
	border-radius: 8px;
}
</style>
