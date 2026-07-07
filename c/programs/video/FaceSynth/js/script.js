import * as THREE from "/c/libs/threejs/0.181/three.js"
import { FBXLoader } from '/c/libs/threejs/0.181/addons/loaders/FBXLoader.js';
import { VERTECS } from "./../assets/vertecs.js";

const video = document.getElementById("video");
const container = document.getElementById("container");

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
camera.position.set(0, 0, 1);

const ambientLight = new THREE.AmbientLight(0xFFFFFF, 1.0);
scene.add(ambientLight);
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 1).normalize();
scene.add(light);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.domElement.classList.add('layers');
container.appendChild(renderer.domElement);

const geometry = new THREE.BufferGeometry();
const material = new THREE.PointsMaterial({
    color: 0x000000,
    size: 2,
    sizeAttenuation: false
});
const pointsMesh = new THREE.Points(geometry, material);
pointsMesh.visible = true;
scene.add(pointsMesh);

function updateFaceMesh(points3D) {
    const positions = new Float32Array(points3D.length * 3);
    points3D.forEach((p, i) => {
        positions[i * 3] = (p.x - 0.5) * 2;
        positions[i * 3 + 1] = -(p.y - 0.5) * 2;
        positions[i * 3 + 2] = p.z * 2;
    });
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
}

function adjustCanvasSize() {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const videoRatio = videoWidth / videoHeight;
    const windowRatio = windowWidth / windowHeight;
    if (windowRatio > videoRatio) {
        video.style.width = "100%";
        video.style.height = "auto";
        const renderWidth = windowWidth;
        const renderHeight = (renderWidth / videoWidth) * videoHeight;
        renderer.setSize(renderWidth, renderHeight);
    } else {
        video.style.width = "auto";
        video.style.height = "100%";
        const renderHeight = windowHeight;
        const renderWidth = (renderHeight / videoHeight) * videoWidth;
        renderer.setSize(renderWidth, renderHeight);
    }
}

const webCam = new Camera(video, {
    onFrame: async () => {
        await faceMesh.send({ image: video });
    },
    width: { ideal: 4096 },
    height: { ideal: 2160 }
});
webCam.start();

const faceMesh = new FaceMesh({
    locateFile: (file) => `./js/lib/mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
    static_image_mode: false,
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

function createFaceMesh(points3D, indices) {
    const positions = new Float32Array(points3D.length * 3);
    const faces = new Uint16Array(indices);
    points3D.forEach((p, i) => {
        positions[i * 3] = (p.x - 0.5) * 2;
        positions[i * 3 + 1] = -(p.y - 0.5) * 2;
        positions[i * 3 + 2] = p.z * 2;
    });
    const faceGeometry = new THREE.BufferGeometry();
    faceGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    faceGeometry.setIndex(new THREE.BufferAttribute(faces, 1));
    faceGeometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
        color: 0xff8888,
        side: THREE.DoubleSide,
        metalness: 0.1,
        roughness: 0.8,
    });
    const faceMesh = new THREE.Mesh(faceGeometry, material);
    scene.add(faceMesh);
    return faceMesh;
}

function updateFaceMeshLive(faceMesh, points3D) {
    const positions = faceMesh.geometry.attributes.position.array;
    points3D.forEach((p, i) => {
        positions[i * 3] = (p.x - 0.5) * 2;
        positions[i * 3 + 1] = -(p.y - 0.5) * 2;
        positions[i * 3 + 2] = p.z * 2;
    });
    faceMesh.geometry.attributes.position.needsUpdate = true;
    faceMesh.geometry.computeVertexNormals();
}

faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const points3D = results.multiFaceLandmarks[0].map(p => ({
            x: p.x,
            y: p.y,
            z: p.z || 0
        }));
        updateFaceMesh(points3D);
        if (faceModel != null) {
            faceModel.visible = document.getElementById('model').checked;
            faceModelWire.visible = document.getElementById('wireframe').checked;
            faceModelMap.visible = document.getElementById('mask').value != 'none';
            faceModelOrifices.visible = document.getElementById('orifices').value != 'none';
            pointsMesh.visible = document.getElementById('points').checked;
            const multiFaceLandmarks = results.multiFaceLandmarks;
            for (const index in multiFaceLandmarks) {
                const faceLandmark = multiFaceLandmarks[index];
                const vertices = [];
                for (const idx in VERTECS) {
                    const landmarksIndex = VERTECS[idx];
                    const newVec = faceLandmark[landmarksIndex - 1];
                    vertices.push((newVec.x - 0.5) * 2, -(newVec.y - 0.5) * 2, newVec.z);
                }
                const verticesArray = new Float32Array(vertices);
                faceModel.children[0].geometry.attributes.position.copyArray(verticesArray);
                faceModel.children[0].geometry.attributes.position.needsUpdate = true;
                faceModelWire.children[0].geometry.attributes.position.copyArray(verticesArray);
                faceModelWire.children[0].geometry.attributes.position.needsUpdate = true;
                faceModelMap.children[0].geometry.attributes.position.copyArray(verticesArray);
                faceModelMap.children[0].geometry.attributes.position.needsUpdate = true;
                faceModelOrifices.children[0].geometry.attributes.position.copyArray(verticesArray);
                faceModelOrifices.children[0].geometry.attributes.position.needsUpdate = true;
                faceModelWire.position.z = faceModel.position.z + 0.05;
            }
        }
        detectMouthShape(results.multiFaceLandmarks[0]);
        adjustFilterWithMouth(results.multiFaceLandmarks[0]);
        detectSyllables(results.multiFaceLandmarks[0]);
    } else {
        faceModel.visible = false;
        faceModelWire.visible = false;
        faceModelMap.visible = false;
        faceModelOrifices.visible = false;
        pointsMesh.visible = false;
        noteOff();
    }
});

const fbxLoader = new FBXLoader();
let faceModel = null;
let faceModelWire = null;
let faceModelMap = null;
let faceModelOrifices = null;

fbxLoader.load('./assets/canonical_face_model.fbx', function (object) {
    faceModel = object.clone();
    faceModel.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
                color:  new THREE.Color(document.getElementById('modelColor').value), // wireColor
                wireframe: false,
                emissive: 0X000000,
                roughness: 0.1,
                metalness: 0.1,
                flatShading: true,
                side: THREE.FrontFace,
                depthTest: true,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });
        }
    });
    scene.add(faceModel);

    faceModelMap = object.clone();
    faceModelMap.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshPhongMaterial({
                color: new THREE.Color(document.getElementById('mapColor').value),
                wireframe: false,
                emissive: 0X000000,
                roughness: 0,
                metalness: 0,
                flatShading: false,
                side: THREE.FrontFace,
                depthTest: true,
                depthWrite: false,
            });
        }
    });
    faceModelMap.visible = false;
    scene.add(faceModelMap);
    setupMaskTexture("facepaint");

    faceModelOrifices = object.clone();
    faceModelOrifices.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(document.getElementById('plainColor').value),
                wireframe: false,
                emissive: 0XFFFFFF,
                roughness: 0,
                metalness: 0,
                flatShading: true,
                side: THREE.FrontFace,
            });
        }
    });
    faceModelOrifices.visible = false;
    scene.add(faceModelOrifices);
    setupMaskOrificesTexture("orifices");

    faceModelWire = object.clone();
    faceModelWire.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(document.getElementById('wireColor').value),      
                wireframe: true,     
                transparent: true,
                side: THREE.FrontSide, 
                depthTest: true,
                depthWrite: true,
                polygonOffset: true,
                polygonOffsetFactor: 0,
                polygonOffsetUnits: 0,
                fog: false
            });
        }
    });
    scene.add(faceModelWire);

},
    function (xhr) {
    },
    function (error) {
    });

const masks = {
    "none": "./assets/faces/b.png",
    "facepaint": "./assets/faces/facepaint.png",
    "canonical": "./assets/faces/canonical.png",
    "anime": "./assets/faces/anime.png",
    "Anonymous": "./assets/faces/vendetta.png",
    "smiley": "./assets/faces/smiley.png",
    "jcvd": "./assets/faces/jcvd.png",
    "b": "./assets/faces/b.png",
    "orifices": "./assets/faces/orifices.png",
    "eyes": "./assets/faces/eyes.png",
    "mouth": "./assets/faces/mouth.png",
    "uv": "./assets/faces/uv.png",
    "sd3": "./assets/faces/sd3.png",
    "sd4": "./assets/faces/sd4.png",
    "sd5": "./assets/faces/sd5.png",
    "sd7": "./assets/faces/sd7.png",
    "sd9": "./assets/faces/sd9.png",
    "sda": "./assets/faces/sda.png",
    "casimir": "./assets/faces/sdf.png",
    "paul": "./assets/faces/paul.png",
};

const maskSelect = document.getElementById("mask");

Object.keys(masks).forEach(maskName => {
    const option = document.createElement("option");
    option.value = maskName;
    option.textContent = maskName;
    maskSelect.appendChild(option);
});

const orificesSelect = document.getElementById("orifices");

Object.keys(masks).forEach(maskName => {
    const option = document.createElement("option");
    option.value = maskName;
    option.textContent = maskName;
    orificesSelect.appendChild(option);
});
orificesSelect.value = "orifices";

function setupMaskTexture(mask) {
    const texture = new THREE.TextureLoader().load(masks[mask]);
    faceModelMap.children[0].material.map = texture;
    faceModelMap.children[0].material.transparent = true;
    faceModelMap.children[0].material.needsUpdate = true;
    faceModelMap.visible = document.getElementById('mask').value != 'none';
}

function setupMaskOrificesTexture(mask) {
    const texture = new THREE.TextureLoader().load(masks[mask]);
    faceModelOrifices.children[0].material.map = texture;
    faceModelOrifices.children[0].material.transparent = true;
    faceModelOrifices.children[0].material.needsUpdate = true;
    faceModelOrifices.visible = document.getElementById('orifices').value != 'none';
}

let emotion = "neutral"

async function loadFaceAPI() {
    await faceapi.nets.tinyFaceDetector.loadFromUri('./js/face-api/models');
    await faceapi.nets.faceExpressionNet.loadFromUri('./js/face-api/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('./js/face-api/models');
}
loadFaceAPI();

async function detectEmotions() {
    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
    if (detections) {
        const expressions = detections.expressions;
        const detectedEmotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
        if (detectedEmotion != emotion) {
            emotion = detectedEmotion;
            document.getElementById('emotion').value = emotion;
        }
    }
    requestAnimationFrame(detectEmotions);
}
video.addEventListener("loadeddata", detectEmotions);

let lastMouthHeight = 0;
let lastChangeTime = 0;
const syllableThreshold = 0.5; 
const minTimeBetweenSyllables = 0.1; 

function detectSyllables(landmarks) {
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const eyeDistance = Math.abs(leftEye.x - rightEye.x);
    const mouthHeight = Math.abs(upperLip.y - lowerLip.y) / eyeDistance;
    const now = audioContext.currentTime;
    if (Math.abs(mouthHeight - lastMouthHeight) > syllableThreshold && (now - lastChangeTime) > minTimeBetweenSyllables) {
        randomFreq();
        lastChangeTime = now;
    }
    lastMouthHeight = mouthHeight;
}

let shape = "";
let mouth = false;
function detectMouthShape(landmarks) {
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];
    const leftLip = landmarks[78];
    const rightLip = landmarks[308];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const eyeDistance = Math.abs(leftEye.x - rightEye.x);
    const mouthHeight = Math.abs(upperLip.y - lowerLip.y) / eyeDistance;
    const mouthWidth = Math.abs(leftLip.x - rightLip.x) / eyeDistance;
    const aspectRatio = mouthHeight / mouthWidth;
    let detectedShape = "";
    const marginA = 0.08;
    const marginI = 0.05;
    const marginO = 0.05;
    if (aspectRatio > 1 - marginA && mouthHeight > 0.55 - marginA && mouthWidth > 0.55 - marginA) {
        detectedShape = "A";
    }
    else if (aspectRatio > 0.25 - marginI && mouthHeight <= 0.4 + marginI && mouthWidth > 0.6 - marginI) {
        detectedShape = "I";
    }
    else if (aspectRatio > 0.5 - marginO && mouthHeight > 0.2 && mouthHeight <= 0.4 && mouthWidth <= 0.55 + marginO) {
        detectedShape = "O";
    }
    else if (aspectRatio > 0.25 && aspectRatio <= 0.45 && mouthHeight <= 0.2 && mouthWidth > 0.4 && mouthWidth <= 0.5) {
        detectedShape = "U";
    }
    if (detectedShape != "" && detectedShape != shape) {
        shape = detectedShape;
        document.getElementById("shape").value = shape;
    }
    const openThresholdHeight = 0.1;
    const openThresholdAspectRatio = 0.2;
    let detectedMouth = mouthHeight > openThresholdHeight && aspectRatio > openThresholdAspectRatio;
    if (detectedMouth != mouth) {
        mouth = detectedMouth;
        if (mouth) {
            noteOn()
        } else {
            noteOff()
        }
    }
}

function noteOn() {
    randomFreq();
    adjustVolume(1);
}

function noteOff() {
    adjustVolume(0);
}

function randomFreq() {
    let type = document.getElementById("pitchType").value;
    const types = {
        "robot": { "min": 22, "max": 110 },
        "man": { "min": 85, "max": 180 },
        "woman": { "min": 165, "max": 255 },
        "child": { "min": 250, "max": 400 },
        "baby": { "min": 400, "max": 1200 },
    };
    const randomNote = Math.random() * (types[type].max - types[type].min) + types[type].min;
    oscillator.frequency.setValueAtTime(randomNote, audioContext.currentTime);
}

let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let oscillator = audioContext.createOscillator();
let gainNode = audioContext.createGain();
let filterNode = audioContext.createBiquadFilter();
let noteFrequency = 440;

let master = audioContext.createGain();
master.gain.value = 2;

oscillator.connect(filterNode);
filterNode.connect(gainNode);
gainNode.connect(master);
master.connect(audioContext.destination);

filterNode.type = "bandpass";
filterNode.Q.setValueAtTime(10, audioContext.currentTime);

function startOscillator() {
    oscillator.type = document.getElementById("synthType").value;
    oscillator.frequency.setValueAtTime(noteFrequency, audioContext.currentTime);
    oscillator.start();
}

gainNode.gain.value = 0.0002;

let lfo = audioContext.createOscillator(); 
let lfoGain = audioContext.createGain(); 
lfo.type = "sine";
lfo.frequency.setValueAtTime(5, audioContext.currentTime); 
lfoGain.gain.setValueAtTime(3, audioContext.currentTime); 

lfo.connect(lfoGain);
lfoGain.connect(oscillator.frequency);

startOscillator();
lfo.start();

function adjustVolume(value) {
    const fadeTime = 0.1;
    if (value > 0) {
        if (gainNode.gain.value < 0.0002) {
            gainNode.gain.setValueAtTime(0.0002, audioContext.currentTime);
        }
        gainNode.gain.exponentialRampToValueAtTime(value, audioContext.currentTime + fadeTime);
    }
    else {
        if (gainNode.gain.value > 0.0002) {
            gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0002, audioContext.currentTime + fadeTime);
        } else {
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        }
    }
}

function adjustFilterFrequency(shape) {
    const formants = {
        "A": [730, 2200, 2800],  // A
        "I": [300, 2500, 3000],  // I
        "O": [400, 1800, 2700],  // O
        "U": [350, 900, 2400],   // U
    };
    const formant = formants[shape] || [440, 440, 440];
    const fadeTime = 0.1;
    const QValue = 10;
    const smoothFactor = 0.05;
    filterNode.frequency.setTargetAtTime(formant[0], audioContext.currentTime, smoothFactor); // 1er formant
    filterNode.Q.setTargetAtTime(QValue, audioContext.currentTime, smoothFactor); // Largeur de bande

    setTimeout(() => {
        filterNode.frequency.setTargetAtTime(formant[1], audioContext.currentTime, smoothFactor);
    }, fadeTime * 500);  

    setTimeout(() => {
        filterNode.frequency.setTargetAtTime(formant[2], audioContext.currentTime, smoothFactor);
    }, fadeTime * 1000); 
}

function adjustFilterWithMouth(landmarks) {
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];
    const leftLip = landmarks[78];
    const rightLip = landmarks[308];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const eyeDistance = Math.abs(leftEye.x - rightEye.x);
    const mouthHeight = Math.abs(upperLip.y - lowerLip.y) / eyeDistance;
    const mouthWidth = Math.abs(leftLip.x - rightLip.x) / eyeDistance;
    const aspectRatio = mouthHeight / mouthWidth;
    const minFreq = 200, maxFreq = 1000;
    const minQ = 1, maxQ = 15;
    let freq = minFreq + (maxFreq - minFreq) * (1 - Math.exp(-mouthHeight * 5));
    let qValue = minQ + (maxQ - minQ) * Math.exp(-mouthWidth * 3);
    const smoothFactor = 0.05;
    filterNode.frequency.setTargetAtTime(freq, audioContext.currentTime, smoothFactor);
    filterNode.Q.setTargetAtTime(qValue, audioContext.currentTime, smoothFactor);
}







document.getElementById('wireframe').addEventListener('change', function (event) {
    faceModelWire.traverse((child) => {
        child.visible = event.target.checked;
    });
});

document.getElementById('model').addEventListener('change', function (event) {
    faceModel.traverse((child) => {
        child.visible = event.target.checked;
    });
});

document.getElementById('points').addEventListener('change', function (event) {
    pointsMesh.visible = event.target.checked;
});

document.getElementById('camera').addEventListener('change', function (event) {
    document.getElementById("video").style.display = event.target.checked ? "block" : "none";
});

document.getElementById('mask').addEventListener('change', function (event) {
    setupMaskTexture(event.target.value);
});

document.getElementById('orifices').addEventListener('change', function (event) {
    setupMaskOrificesTexture(event.target.value);
});

document.getElementById('modelColor').addEventListener('change', updateModelColor);
document.getElementById('modelColor').addEventListener('input', updateModelColor);
function updateModelColor(event) {
    faceModel.traverse((child) => {
        if (child.isMesh) {
            child.material.color.set(event.target.value);
            child.material.needsUpdate = true;
        }
    });
}

document.getElementById('wireColor').addEventListener('change', updateWireColor);
document.getElementById('wireColor').addEventListener('input', updateWireColor);
function updateWireColor(event) {
    faceModelWire.traverse((child) => {
        if (child.isMesh) {
            child.material.color.set(event.target.value);
            child.material.needsUpdate = true;
        }
    });
}

document.getElementById('mapColor').addEventListener('change', updateMapColor);
document.getElementById('mapColor').addEventListener('input', updateMapColor);
function updateMapColor(event) {
    faceModelMap.traverse((child) => {
        if (child.isMesh) {
            child.material.color.set(event.target.value);
            child.material.needsUpdate = true;
        }
    });
}

document.getElementById('plainColor').addEventListener('change', updatePlainColor);
document.getElementById('plainColor').addEventListener('input', updatePlainColor);
function updatePlainColor(event) {
    faceModelOrifices.traverse((child) => {
        if (child.isMesh) {
            child.material.color.set(event.target.value);
            child.material.needsUpdate = true;
        }
    });
}

document.getElementById('synthType').addEventListener('change', function (event) {
    oscillator.type = event.target.value;
});


// LFO Type (synthLfoType)
document.getElementById('synthLfoType').addEventListener('change', updateLfoType);
document.getElementById('synthLfoType').addEventListener('input', updateLfoType);

function updateLfoType(event) {
    lfo.type = event.target.value;
}

// LFO Frequency (synthLfoFrequency)
document.getElementById('synthLfoFrequency').addEventListener('change', updateLfoFrequency);
document.getElementById('synthLfoFrequency').addEventListener('input', updateLfoFrequency);

function updateLfoFrequency(event) {
    lfo.frequency.setValueAtTime(event.target.value, audioContext.currentTime);
}

// LFO Gain (synthLfoGain)
document.getElementById('synthLfoGain').addEventListener('change', updateLfoGain);
document.getElementById('synthLfoGain').addEventListener('input', updateLfoGain);

function updateLfoGain(event) {
    lfoGain.gain.setValueAtTime(event.target.value, audioContext.currentTime);
}




window.addEventListener('resize', adjustCanvasSize);
video.addEventListener('loadeddata', adjustCanvasSize);

adjustCanvasSize();

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();



