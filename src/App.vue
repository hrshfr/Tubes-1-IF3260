<template>
  <div id="app">
    <div id="container-canvas-button">
      <div id="container-button">
        <button @click="(e)=>{this.currentSelectedObject='rectangle'}" class="button">Rectangle</button>
        <button @click="(e)=>{this.currentSelectedObject='square'}" class="button">Square</button>
        <button @click="(e)=>{this.currentSelectedObject='line'}" class="button">Line</button>
        <button @click="(e)=>{this.currentSelectedObject='select'}" class="button">Select</button>
        <input type="color" id="color-picker" @change="(e)=>{this.currentColor = e.target.value}">
        <button class="button" @click="saveFile">Save</button>
        <input id="load" class="button" type="file" accept=".json" @input="(e)=>loadFile()">
      </div>
      <canvas width="800" height="550" @click="(e)=>drawCanvas(e)"></canvas>
    </div>
  </div>
</template>

<script>
import { isInside, euclideanDistance } from './utils.js';

export default {
  name: 'App',
  data: ()=>({
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
    
    gl:'',
    positionLocation:'',
    resolutionUniformLocation:'',
    colorUniformLocation:'',
    currentColor:[],
    currentClickedPos:[],
    currentSelectedObject:'',
    allObjects:[]
  }),

  mounted(){
    const canvas = document.querySelector('canvas');
    this.gl = canvas.getContext('webgl', {preserveDrawingBuffer: true});

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    const vertexShader = this.createShader(this.gl,this.gl.VERTEX_SHADER,this.vertexSource)
    const fragmentShader = this.createShader(this.gl, this.gl.FRAGMENT_SHADER, this.fragmentSource)
    const program = this.createProgram(this.gl, vertexShader, fragmentShader)

    this.positionLocation = this.gl.getAttribLocation(program, "a_position");
    this.resolutionUniformLocation = this.gl.getUniformLocation(program, "u_resolution");
    this.colorUniformLocation = this.gl.getUniformLocation(program, "u_color");

    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER,buffer);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.useProgram(program);
    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER,buffer);
    this.gl.vertexAttribPointer(this.positionLocation, 2 , this.gl.FLOAT, false, 0, 0);
    this.gl.uniform2f(this.resolutionUniformLocation, this.gl.canvas.width, this.gl.canvas.height);
  },

  methods:{
    createShader(gl, type, source){
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

    createProgram(gl, vertexShader, fragmentShader){
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

    drawRectangle(x,y,width,height,color){
      var x1 = x;
      var x2 = x + width;
      var y1 = y;
      var y2 = y + height;

      const vertexData = [
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2,        
      ]

      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertexData), this.gl.STATIC_DRAW);

      this.gl.uniform4f(this.colorUniformLocation, color[0], color[1], color[2], 1);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
      this.allObjects.unshift({'object':'rectangle','x':x,'y':y,'width':width,'height':height,'color':color})
      console.log(this.allObjects)
    },
    drawSquare(x,y,side,color){
      var x1 = x;
      var x2 = x + side;
      var y1 = y;
      var y2 = y + side;

      const vertexData = [
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2,        
      ]

      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertexData), this.gl.STATIC_DRAW);

      this.gl.uniform4f(this.colorUniformLocation, color[0], color[1], color[2], 1);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
      this.allObjects.unshift({'object':'square','x':x,'y':y,'width':side,'height':side,'color':color})
      console.log(this.allObjects)
    },

    drawLine(x1,y1,x2,y2,color){
      
      const vertexData = [
        x1, y1,
        x2, y2,        
      ]

      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertexData), this.gl.STATIC_DRAW);

      this.gl.uniform4f(this.colorUniformLocation, color[0], color[1], color[2], 1);
      this.gl.drawArrays(this.gl.LINES, 0, 2);
      this.allObjects.unshift({'object':'line','v':[[x1,y1],[x2,y2]],'color':color})
      console.log(this.allObjects)
    },

    hexToRGB(hex){
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [parseInt(result[1], 16)/255,parseInt(result[2], 16)/255,parseInt(result[3], 16)/255] : null;
    },

    drawCanvas(e){
      if (this.currentSelectedObject == 'rectangle'){
        this.drawRectangle(e.offsetX, e.offsetY, 200, 150, this.hexToRGB(this.currentColor))
      }if (this.currentSelectedObject == 'square'){
        this.drawSquare(e.offsetX, e.offsetY, 200, this.hexToRGB(this.currentColor))
      } else if (this.currentSelectedObject == 'line'){
        this.drawLine(e.offsetX, e.offsetY, e.offsetX+100, e.offsetY, this.hexToRGB(this.currentColor))
      } else if (this.currentSelectedObject == 'select'){
        this.selectObject(e);
      }
    },

    vertexPicking(e, objIdx) {
      
      if (objIdx == null){
        console.log([null, null]);
        return [null, null];
      }

      let nearestIdx = null;
      let minDist = 10;

      // line
      if (this.allObjects[objIdx].object == 'line') {
        const line = this.allObjects[objIdx];
        let v1 = euclideanDistance(e.offsetX, e.offsetY, line.v[0][0], line.v[0][1]);
        let v2 = euclideanDistance(e.offsetX, e.offsetY, line.v[1][0], line.v[1][1]);

        if (v1 < minDist) {
          minDist = v1;
          nearestIdx = 0;
        }
        if (v2 < minDist) {
          minDist = v2;
          nearestIdx = 1;
        }

      }

      // square and rectangle
      else if (this.allObjects[objIdx].object == 'square' || this.allObjects[objIdx].object == 'rectangle') {
        const rect = this.allObjects[objIdx];
        let vertices = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]]
        
        for (let i = 0; i < vertices.length; i++) {
          let v = euclideanDistance(e.offsetX, e.offsetY, vertices[i][0], vertices[i][1]);
          console.log(v);
          if (v < minDist) {
            minDist = v;
            nearestIdx = i;
          }
        }
      }

      else if (this.allObjects[objIdx].object == 'polygon') {
        // polygon
      }
      
      // output
      console.log([nearestIdx, objIdx]);
      return [nearestIdx, objIdx];

    },

    selectObject(e) {
      let objIdx = null;

      for (let i = 0; i < this.allObjects.length; i++) {
        // line
        if (this.allObjects[i].object == 'line') {
          const line = this.allObjects[i];
          let eq = Math.abs((e.offsetY - line.v[0][1]) * (line.v[1][0] - line.v[0][0]) - (e.offsetX - line.v[0][0]) * (line.v[1][1] - line.v[0][1]))
          
          if (eq < 500) {
            objIdx = i;
          }

        }

        // rectangle and square
        else if (this.allObjects[i].object == 'rectangle' || this.allObjects[i].object == 'square') {
          const rect = this.allObjects[i];
          let vertices = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]]
          let mousePos = [e.offsetX, e.offsetY]

          if (isInside(vertices, mousePos)) {
            objIdx = i;
          }

        }

        else if (this.allObjects[i].object == 'polygon') {
          // polygon
        }

      }

      if (objIdx != null) {
        this.vertexPicking(e, objIdx);
      }
      //return objIdx;
    },

    saveFile(){
      const filename = 'drawing.json';
      const jsonStr = JSON.stringify(this.allObjects);

      let element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(jsonStr));
      element.setAttribute('download', filename);

      element.style.display = 'none';
      document.body.appendChild(element);

      element.click();

      document.body.removeChild(element);
    },

    loadFile(){
      var file = document.getElementById("load").files[0];
      if (file) {
        var reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        
        reader.onload = (e) => {
          const data = JSON.parse(e.target.result);

          for (let i=0;i<data.length;i++){
            console.log(data[i])
            if (data[i]['object']=='rectangle'){
              this.drawRectangle(data[i]['x'],data[i]['y'],data[i]['width'],data[i]['height'], data[i]['color'])
            }
          }

        }
      }
    }
  }
}

</script>

<style>

body{
  margin:2rem 0 0 2rem;
}
canvas{
  width: 800px;
  height: 550px;
  background-color: black;
  margin-top:1rem;
}

#container-canvas-button{
  display: flex;
  flex-direction: column;
}

#container-button{
  display: flex;
  gap: 0.5rem;
}

.button{
  width: fit-content;
  padding:5px 10px 5px 10px;
  font-size:1rem;
}
</style>
