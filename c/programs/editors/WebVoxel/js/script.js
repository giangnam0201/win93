class Voxel {
  constructor(x, y, z, color) {
    this.x = round(x, 1)
    this.y = round(y, 1)
    this.z = round(z, 1)
    if (x < -127 || x > 128) { return }
    if (y < 0 || y > 255) { return }
    if (z < -128 || z > 127) { return }
    this.color = color
    if (this.color == '0') { this.color = 255 }
    var colour = new THREE.Color()
    colour.setHex(`0x${colors[color].hexString.substring(1)}`)
    if (colour < 500) {
      colour.setHex(500)
    }
    var material = new THREE.MeshLambertMaterial({ color: colour })
    var halfExtents = new CANNON.Vec3(w, w, w)
    var boxShape = new CANNON.Box(halfExtents)
    var boxGeometry = new THREE.BoxGeometry(
      halfExtents.x * 2,
      halfExtents.y * 2,
      halfExtents.z * 2
    )
    this.box = new CANNON.Body({ mass: boxBodyMass, type: 1 })
    this.box.addShape(boxShape)
    this.boxMesh = new THREE.Mesh(boxGeometry, material)
    this.boxMesh.DefaultMatrixAutoUpdate = false
    world.addBody(this.box)
    voxelsGroup.add(this.boxMesh)
    this.box.position.set(this.x, this.y, this.z)
    this.boxMesh.position.set(this.x, this.y, this.z)
    this.boxMesh.castShadow = false
    this.boxMesh.receiveShadow = false
    this.uuid = this.boxMesh.uuid
    this.boxMesh = this.boxMesh
    voxels.push(this)
  }
  destroy(purge) {
    world.remove(this.box)
    voxelsGroup.remove(this.boxMesh)
    if (purge !== false) voxels.splice(voxels.indexOf(this), 1)
  }
}

function setAllVoxelMass(mass) {
  boxBodyMass = mass;
  voxels.forEach((voxel, index) => {
    voxel.box.mass = boxBodyMass;
    voxel.box.updateMassProperties();
  });
}

function toggleMass() {
  boxBodyMass = boxBodyMass === 1 ? 0 : 1;
  voxels.forEach((voxel) => {
    voxel.box.mass = boxBodyMass;
    voxel.box.updateMassProperties();
  });
  const massButton = document.querySelector("#mass");
  if (massButton) {
    massButton.setAttribute("aria-pressed", boxBodyMass === 1 ? "true" : "false");
  }
}

function clearVoxels() {
  for (const voxel of voxels) voxel.destroy(false)
  voxels.length = 0
}

function loadVoxels(array) {
  for (const [x, y, z, color] of array) {
    new Voxel(x, y, z, color)
  }
}

function loadVoxelsVoxFormat(array, size) {
  for (const [x, y, z, color] of array) {
    const centerX = round(size.x / 2, 1);
    const centerY = round(size.y / 2, 1);
    const adjustedX = (size.x % 2 === 0) ? centerX : centerX + 0.5;
    const adjustedY = (size.y % 2 === 0) ? centerY : centerY + 0.5;
    new Voxel(-x + adjustedX, z, y - adjustedY, color);
  }
}

function serializeVoxels() {
  var temp = []
  for (const voxel of voxels) {
    temp.push([voxel.x, voxel.y, voxel.z, voxel.color])
  }
  return temp
}

function autosave() {
  if (!socket) localStorage["voxels"] = JSON.stringify(serializeVoxels())
}

// NETWORK
if ("io" in window) {
  var socket = io()
  socket.on("update voxel", function ([x, y, z, color, removed]) {
    new Voxel(x, y, z, color)
    if (removed) {
      for (const voxel of voxels) {
        if (
          removed[0] === voxel.x &&
          removed[1] === voxel.y &&
          removed[2] === voxel.z
        ) {
          voxel.destroy()
          break
        }
      }
    }
  })

  socket.on("remove voxel", function ([x, y, z]) {
    for (const voxel of voxels) {
      if (x === voxel.x && y === voxel.y && z === voxel.z) {
        voxel.destroy()
        break
      }
    }
  })

  socket.on("scene", function (data) {
    clearVoxels()
    loadVoxels(data.voxels)
  })
}

//

function round(num, decimals = 2, op = Math.round) {
  const n = String(num)
  const index = n.indexOf("e")
  return (
    (index === -1
      ? op(`${n}e${decimals}`)
      : op(`${n.slice(0, index)}e${Number(n.slice(index + 1)) + decimals}`)) /
    10 ** decimals
  )
}

var w = 0.5
var sphereShape,
  sphereBody,
  world,
  physicsMaterial,
  walls = [],
  balls = [],
  ballMeshes = []
var voxels = []
var voxelsGroup
var targetMesh
var fill = "r"
var alt = false
var ctrl = false
var boxBodyMass = 0;

if (localStorage["voxels"] == undefined) {
  localStorage["voxels"] = JSON.stringify([])
}

if (localStorage["palette"] == undefined) {
  localStorage["palette"] = JSON.stringify(colors)
} else {
  colors = JSON.parse(localStorage["palette"])
}

var camera, scene, renderer
var light
var geometry, material, mesh, plane
var controls, time = Date.now()
var blocker = document.getElementById("blocker")
var instructions = document.getElementById("instructions")
var startButton = document.getElementById("start")
var havePointerLock =
  "pointerLockElement" in document ||
  "mozPointerLockElement" in document ||
  "webkitPointerLockElement" in document

if (havePointerLock) {
  var element = document.body
  var pointerlockchange = function (event) {
    if (
      document.pointerLockElement === element ||
      document.mozPointerLockElement === element ||
      document.webkitPointerLockElement === element
    ) {
      controls.enabled = true
      blocker.style.display = "none"
    } else {
      controls.enabled = false
      blocker.style.display = "-webkit-box"
      blocker.style.display = "-moz-box"
      blocker.style.display = "box"
      instructions.style.display = ""
    }
  }

  var pointerlockerror = function (event) {
    instructions.style.display = ""
  }
  document.addEventListener("pointerlockchange", pointerlockchange, false)
  document.addEventListener("mozpointerlockchange", pointerlockchange, false)
  document.addEventListener("webkitpointerlockchange", pointerlockchange, false)
  document.addEventListener("pointerlockerror", pointerlockerror, false)
  document.addEventListener("mozpointerlockerror", pointerlockerror, false)
  document.addEventListener("webkitpointerlockerror", pointerlockerror, false)
  document.addEventListener("click", function (event) {
    if (event.target != blocker && !event.target.classList.contains("colorPicker")) {
      return;
    }
    instructions.style.display = "none"
    element.requestPointerLock =
      element.requestPointerLock ||
      element.mozRequestPointerLock ||
      element.webkitRequestPointerLock
    if (/Firefox/i.test(navigator.userAgent)) {
      var fullscreenchange = function (event) {
        if (
          document.fullscreenElement === element ||
          document.mozFullscreenElement === element ||
          document.mozFullScreenElement === element
        ) {
          document.removeEventListener("fullscreenchange", fullscreenchange)
          document.removeEventListener(
            "mozfullscreenchange",
            fullscreenchange
          )
          element.requestPointerLock()
        }
      }
      document.addEventListener("fullscreenchange", fullscreenchange, false)
      document.addEventListener(
        "mozfullscreenchange",
        fullscreenchange,
        false
      )
      element.requestFullscreen =
        element.requestFullscreen ||
        element.mozRequestFullscreen ||
        element.mozRequestFullScreen ||
        element.webkitRequestFullscreen
      element.requestFullscreen()
    } else {
      element.requestPointerLock()
    }
  },
    false
  )
} else {
  instructions.innerHTML =
    "Your browser doesn't seem to support Pointer Lock API"
}

initPalette()
initCannon()
init()
animate()


function initCannon() {
  world = new CANNON.World()
  world.quatNormalizeSkip = 0
  world.quatNormalizeFast = false
  var solver = new CANNON.GSSolver()
  world.defaultContactMaterial.contactEquationStiffness = 1e9
  world.defaultContactMaterial.contactEquationRelaxation = 4
  solver.iterations = 7
  solver.tolerance = 0.1
  var split = true
  if (split) world.solver = new CANNON.SplitSolver(solver)
  else world.solver = solver
  world.gravity.set(0, -30, 0)
  world.broadphase = new CANNON.NaiveBroadphase()
  physicsMaterial = new CANNON.Material("slipperyMaterial")
  var physicsContactMaterial = new CANNON.ContactMaterial(
    physicsMaterial,
    physicsMaterial
  )
  world.addContactMaterial(physicsContactMaterial)
  physicsContactMaterial.friction = 0
  var mass = 100,
    radius = w * 2
  sphereShape = new CANNON.Sphere(radius)
  groundMaterial = new CANNON.Material()
  groundMaterial.friction = 0
  groundMaterial.restitution = 0
  sphereBody = new CANNON.Body({ mass: mass, material: groundMaterial })
  sphereBody.addShape(sphereShape)
  sphereBody.position.set(0, 1, -20);
  sphereBody.linearDamping = 0.9
  world.addBody(sphereBody)
  var groundShape = new CANNON.Plane()
  var groundBody = new CANNON.Body({ mass: 0 })
  groundBody.addShape(groundShape)
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  world.addBody(groundBody)
}

function init() {
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    128
  )
  scene = new THREE.Scene()
  voxelsGroup = new THREE.Group()
  targetMesh = new THREE.Group()
  scene.add(targetMesh)
  scene.add(voxelsGroup)
  scene.background = new THREE.Color(0xcccccc)
  scene.fog = new THREE.Fog(0xcccccc, 0, 100)
  var ambient = new THREE.AmbientLight(0x888888)
  scene.add(ambient)
  light = new THREE.HemisphereLight(0xffffbb, 0x080820, 1)
  light.position.set(1, 1, 1).normalize()
  var spotLight = new THREE.SpotLight(0xffffff);
  spotLight.position.set(200, 400, 300);
  scene.add(spotLight);
  var spotLight2 = new THREE.SpotLight(0xffffff);
  spotLight2.position.set(-200, -400, -300);
  scene.add(spotLight2);
  controls = new PointerLockControls(camera, sphereBody)
  scene.add(controls.getObject())
  geometry = new THREE.PlaneGeometry(256, 256, 1, 1)
  geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
  d = w
  texture = new THREE.TextureLoader().load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAD5JREFUeNrs0bENADAIA0HITOy/AN7JzICUNNF/bXQF2d2xqapW+xOPAwAAAAC4UdpeHUjiBwAAAAD/ASPAAMUPCJ3xc4q1AAAAAElFTkSuQmCC');
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(128, 128)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearMipMapLinearFilter
  texture.anisotropy = 1
  material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: texture,
    side: THREE.DoubleSide,
  })
  plane = new THREE.Mesh(geometry, material)
  plane.castShadow = false
  plane.receiveShadow = false
  voxelsGroup.add(plane)
  plane.position.x = w
  plane.position.y = -w;
  plane.position.z = -w
  renderer = new THREE.WebGLRenderer()
  renderer.shadowMap.enabled = false
  renderer.shadowMapSoft = false
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(scene.fog.color, 1)
  renderer.domElement.classList.add("inset");
  document.body.appendChild(renderer.domElement)
  window.addEventListener("resize", onWindowResize, false)
  material = new THREE.MeshBasicMaterial({
    color: parseInt("FFFFFF", 16),
  })

  initMeshTarget()

  if (!socket) {
    if (localStorage["voxels"] != undefined) {
      var data = JSON.parse(localStorage["voxels"])
      if (data.length > 0) loadVoxels(data)
    }
    if (localStorage["palette"] == undefined) {
      localStorage["palette"] = JSON.stringify(colors)
    } else {
      colors = JSON.parse(localStorage["palette"])
    }
  }

}

function getFill() {
  color = fill
  if (fill == "r") {
    color = Math.floor(Math.random() * colors.length)
  }
  return parseInt(color)
}

function getDateString() {
  var date = new Date()
  var year = date.getFullYear()
  var month = `${date.getMonth() + 1}`.padStart(2, "0")
  var hour = `${date.getHours()}`.padStart(2, "0")
  var minute = `${date.getMinutes()}`.padStart(2, "0")
  var second = `${date.getSeconds()}`.padStart(2, "0")
  var day = `${date.getDate()}`.padStart(2, "0")
  return `${year}${month}${day}${hour}${minute}${second}`
}

function save() {
  var temp = serializeVoxels()
  var dataStr =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(temp))
  var a = document.getElementById("downloadAnchorElem")
  a.setAttribute("href", dataStr)
  a.setAttribute("download", "voxels_" + getDateString() + ".json")
  a.click()
}

function exportVox() {
  var temp = serializeVoxels()
  var dataStr =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(temp))
  return dataStr;
}

function nu() {
  localStorage.clear()
  clearVoxels()
}

function dropHandler(ev) {
  ev.preventDefault();
  if (ev.dataTransfer.items) {
    [...ev.dataTransfer.items].forEach((item, i) => {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        readFile(file);
      }
    });
  } else {
    [...ev.dataTransfer.files].forEach((file, i) => {
      readFile(file);
    });
  }
}

function dragOverHandler(ev) {
  ev.preventDefault();
}

function round(num, decimals = 2, op = Math.round) {
  const n = String(num)
  const index = n.indexOf("e")
  return (
    (index === -1
      ? op(`${n}e${decimals}`)
      : op(`${n.slice(0, index)}e${Number(n.slice(index + 1)) + decimals}`)) /
    10 ** decimals
  )
}

function ReadRGB(obj) {
  return '#' + obj.r.toString(16) + obj.g.toString(16) + obj.b.toString(16)
}

function RGBToHexA(r, g, b) {
  r = r.toString(16);
  g = g.toString(16);
  b = b.toString(16);
  if (r.length == 1)
    r = "0" + r;
  if (g.length == 1)
    g = "0" + g;
  if (b.length == 1)
    b = "0" + b;

  return "#" + r + g + b;
}

async function readFile(file) {
  if (file.name.split('.').pop() == 'vox') {
    let reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async function () {
      let parsedData = parseMagicaVoxel(reader.result);
      let newPalette = parsedData.RGBA;
      for (let i = 0; i < colors.length - 1; i++) {
        colors[i + 1].hexString = RGBToHexA(newPalette[i].r, newPalette[i].g, newPalette[i].b);
      }
      colors[0].hexString = '#000000';
      localStorage["palette"] = JSON.stringify(colors);
      initPalette();
      clearVoxels();
      let data = parsedData.XYZI.map((obj) => [obj.x, obj.y, obj.z, obj.c]);
      let size = parsedData.SIZE;
      if (data.length > 100000) {
        const res = await sys42.confirm('The file you\'re trying to open seems very large. Let\'s not open it as it might crash your browser.', {
          agree: "Ok",
          decline: "Try anyway",
          icon: "warning",
          label: "How about no",
        })
        if (res === true) return
      }
      loadVoxelsVoxFormat(data, size);
      autosave();
    };
    reader.onerror = function () {
      // console.log(reader.error);
    };
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

var dt = 1 / 60
function animate() {
  requestAnimationFrame(animate)
  if (controls.enabled) {
    world.step(dt)
    for (var i = 0; i < balls.length; i++) {
      ballMeshes[i].position.copy(balls[i].position)
      ballMeshes[i].quaternion.copy(balls[i].quaternion)
    }
    for (const voxel of voxels) {
      voxel.boxMesh.position.copy(voxel.box.position)
      voxel.boxMesh.quaternion.copy(voxel.box.quaternion)
    }
    meshTargetUpdate()
  }
  controls.update(Date.now() - time)
  renderer.render(scene, camera)
  time = Date.now()
}

var ballShape = new CANNON.Sphere(w)
var ballGeometry = new THREE.SphereGeometry(ballShape.radius, 32, 32)
var shootDirection = new THREE.Vector3()
var shootVelo = 15
var projector = new THREE.Projector()

function getShootDir(targetVec) {
  var vector = targetVec
  targetVec.set(0, 0, 1)
  projector.unprojectVector(vector, camera)
  var ray = new THREE.Ray(
    camera.position,
    vector.sub(camera.position).normalize()
  )
  targetVec.copy(ray.direction)
}

function getDir() {
  var vector = new THREE.Vector3()
  vector.set(0, 0, 1)
  vector.unproject(camera)
  temp = new THREE.Vector3(
    sphereBody.position.x,
    sphereBody.position.y,
    sphereBody.position.z
  )
  var ray = new THREE.Ray(temp, vector.sub(temp).normalize())
  return ray
}

var raycaster = new THREE.Raycaster()

function raycast() {
  // DAWN U RAYCASTER :P
  vectorFrom = new THREE.Vector3(
    camera.position.x + shootDirection.x,
    camera.position.y + shootDirection.y,
    camera.position.z + shootDirection.z
  )
  vectorTo = new THREE.Vector3(
    camera.position.x,
    camera.position.y,
    camera.position.z
  )
  someDir = getDirection(vectorFrom, vectorTo)
  raycaster.setFromCamera(someDir.clone().normalize(), camera)
  return raycaster.intersectObjects(voxelsGroup.children)
}

function initMeshTarget() {
  let x = round(0, 1)
  let y = round(0, 1)
  let z = round(0, 1)
  let clr = new THREE.Color()
  clr.setHex(0xffffff)
  material = new THREE.MeshBasicMaterial({ color: clr, side: THREE.DoubleSide })
  material.transparent = true
  material.opacity = 0.5
  material.depthTest = false;
  geometry = new THREE.PlaneGeometry(w * 2, w * 2, 1, 1)
  planeTarget = new THREE.Mesh(geometry, material)
  targetMesh.add(planeTarget)
  targetMesh.visible = false
}

function meshTargetUpdate() {
  const intersects = raycast(voxelsGroup.children)
  if (intersects[0]?.faceIndex === undefined || intersects[0].object.uuid == plane.uuid) {
    targetMesh.visible = false
    return
  } else {
    targetMesh.visible = true
  }
  var face
  if (intersects[0].faceIndex == 4 || intersects[0].faceIndex == 5) { face = 1 }
  if (intersects[0].faceIndex == 10 || intersects[0].faceIndex == 11) { face = 2 }
  if (intersects[0].faceIndex == 2 || intersects[0].faceIndex == 3) { face = 3 }
  if (intersects[0].faceIndex == 0 || intersects[0].faceIndex == 1) { face = 4 }
  if (intersects[0].faceIndex == 8 || intersects[0].faceIndex == 9) { face = 5 }
  if (intersects[0].faceIndex == 6 || intersects[0].faceIndex == 7) { face = 6 }
  var x = intersects[0].object.position.x
  var y = intersects[0].object.position.y
  var z = intersects[0].object.position.z
  if (face == 1) {
    y = y + w
    targetMesh.rotation.x = THREE.Math.degToRad(90)
    targetMesh.rotation.y = THREE.Math.degToRad(0)
    targetMesh.rotation.z = THREE.Math.degToRad(0)
  }
  if (face == 2) {
    z = z - w
    targetMesh.rotation.x = THREE.Math.degToRad(0)
    targetMesh.rotation.y = THREE.Math.degToRad(0)
    targetMesh.rotation.z = THREE.Math.degToRad(0)
  }
  if (face == 3) {
    x = x - w
    targetMesh.rotation.x = THREE.Math.degToRad(0)
    targetMesh.rotation.y = THREE.Math.degToRad(90)
    targetMesh.rotation.z = THREE.Math.degToRad(0)
  }
  if (face == 4) {
    x = x + w
    targetMesh.rotation.x = THREE.Math.degToRad(0)
    targetMesh.rotation.y = THREE.Math.degToRad(90)
    targetMesh.rotation.z = THREE.Math.degToRad(0)
  }
  if (face == 5) {
    z = z + w
    targetMesh.rotation.x = THREE.Math.degToRad(0)
    targetMesh.rotation.y = THREE.Math.degToRad(0)
    targetMesh.rotation.z = THREE.Math.degToRad(0)
  }
  if (face == 6) {
    y = y - w
    targetMesh.rotation.x = THREE.Math.degToRad(90)
    targetMesh.rotation.y = THREE.Math.degToRad(0)
    targetMesh.rotation.z = THREE.Math.degToRad(0)
  }
  targetMesh.position.x = x
  targetMesh.position.y = y
  targetMesh.position.z = z
}

const onMouseDown = (e) => {
  if (controls.enabled == true) {
    const intersects = raycast(voxelsGroup.children)
    if (intersects[0]?.faceIndex === undefined) return
    var face
    if (intersects[0].faceIndex == 4 || intersects[0].faceIndex == 5) { face = 1 }
    if (intersects[0].faceIndex == 10 || intersects[0].faceIndex == 11) { face = 2 }
    if (intersects[0].faceIndex == 2 || intersects[0].faceIndex == 3) { face = 3 }
    if (intersects[0].faceIndex == 0 || intersects[0].faceIndex == 1) { face = 4 }
    if (intersects[0].faceIndex == 8 || intersects[0].faceIndex == 9) { face = 5 }
    if (intersects[0].faceIndex == 6 || intersects[0].faceIndex == 7) { face = 6 }
    if (face == undefined) return
    if (e.button == 0 && !alt && !ctrl) {
      var x = intersects[0].object.position.x
      var y = intersects[0].object.position.y
      var z = intersects[0].object.position.z
      if (intersects[0].object.uuid == plane.uuid) {
        x = Math.round(intersects[0].point.x) - w * 2  // x
        y = 0 // v
        z = Math.round(intersects[0].point.z) // d
      }
      var voxel
      if (face == 1) voxel = new Voxel(x, y + w * 2, z, getFill())
      if (face == 2) voxel = new Voxel(x, y, z - w * 2, getFill())
      if (face == 3) voxel = new Voxel(x - w * 2, y, z, getFill())
      if (face == 4) voxel = new Voxel(x + w * 2, y, z, getFill())
      if (face == 5) voxel = new Voxel(x, y, z + w * 2, getFill())
      if (face == 6) voxel = new Voxel(x, y - w * 2, z, getFill())
      if (socket) {
        socket.emit("add voxel", [voxel.x, voxel.y, voxel.z, voxel.color])
      }
      autosave()
    }
    if (e.button == 0 && ctrl) {
      Object.keys(voxels).forEach((key) => {
        if (voxels[key].uuid == intersects[0].object.uuid) {
          colour = new THREE.Color()
          colour.setHex(`0x${colors[getFill()].hexString.substring(1)}`)
          if (colour < 500) {
            colour.setHex(500)
          }
          intersects[0].object.material.color = colour
          voxels[key].color = fill
        }
      })
      autosave()
    }

    if (e.button === 0 && alt) {
      Object.keys(voxels).forEach((key) => {
        if (voxels[key].uuid === intersects[0].object.uuid) {
          fill = voxels[key].color;
          document.querySelectorAll(".colorPicker").forEach((el) => {
            el.classList.remove("selected");
          });
          const selectedElement = document.getElementById('c' + getFill());
          if (selectedElement) {
            selectedElement.classList.toggle("selected");
          }
        }
      });
    }
    if (e.button == 2 && !alt && !ctrl) {
      for (const voxel of voxels) {
        if (voxel.uuid == intersects[0].object.uuid) {
          if (socket) {
            socket.emit("remove voxel", [voxel.x, voxel.y, voxel.z])
          }
          voxel.destroy()
          break
        }
      }
      autosave()
    }
  }
  return false
}

document.body.addEventListener("mousedown", onMouseDown, true)

function help() {
  const helpPage = document.getElementById("helpPage");
  if (helpPage.style.display === "none" || helpPage.style.display === "") {
    helpPage.style.display = "block";
  } else {
    helpPage.style.display = "none";
  }
}

function initPalette() {
  var element = document.getElementById("palette")
  element.innerHTML = ""
  color = document.createElement("div")
  color.setAttribute("class", "colorPicker")
  color.setAttribute("id", "c0")
  color.setAttribute("style", "background-color:" + colors[0].hexString + ";")
  color.appendChild(document.createTextNode(colors[0].colorId))
  element.appendChild(color)
  for (var i = colors.length - 1; i > 0; i--) {
    color = document.createElement("div")
    color.setAttribute("class", "colorPicker")
    color.setAttribute("id", "c" + i)
    color.setAttribute("style", "background-color:" + colors[i].hexString + ";")
    color.appendChild(document.createTextNode(colors[i].colorId))
    element.appendChild(color)
  }
  document.querySelectorAll(".colorPicker").forEach(function (element) {
    element.addEventListener("click", function () {
      fill = this.textContent;
      if (fill == "0") { fill = "255" }
      document.querySelectorAll(".colorPicker").forEach(function (el) {
        el.classList.remove("selected");
      });
      this.classList.toggle("selected");
    });
  });
}

var voxSize;

function getSIZE() {
  voxSize = {}
  let lx = Number.POSITIVE_INFINITY;
  let hx = Number.NEGATIVE_INFINITY;
  let dx;
  let tmp;
  for (var i = voxels.length - 1; i >= 0; i--) {
    tmp = voxels[i].x;
    if (tmp < lx) lx = tmp;
    if (tmp > hx) hx = tmp;
  }
  dx = hx - lx
  let ly = Number.POSITIVE_INFINITY;
  let hy = Number.NEGATIVE_INFINITY;
  let dy;
  for (var i = voxels.length - 1; i >= 0; i--) {
    tmp = voxels[i].y;
    if (tmp < ly) ly = tmp;
    if (tmp > hy) hy = tmp;
  }
  dy = hy - ly
  let lz = Number.POSITIVE_INFINITY;
  let hz = Number.NEGATIVE_INFINITY;
  let dz;
  for (var i = voxels.length - 1; i >= 0; i--) {
    tmp = voxels[i].z;
    if (tmp < lz) lz = tmp;
    if (tmp > hz) hz = tmp;
  }
  dz = hz - lz
  dx = dx + 1
  dy = dy + 1
  dz = dz + 1
  voxSize.size = {}
  voxSize.size.x = dx
  voxSize.size.y = dz
  voxSize.size.z = dy
  voxSize.min = {}
  voxSize.min.x = lx
  voxSize.min.y = lz
  voxSize.min.z = ly
  voxSize.max = {}
  voxSize.max.x = hx
  voxSize.max.y = hz
  voxSize.max.z = hy
}

function saveVox() {
  getSIZE();
  var voxFile = new VOXFILE(256, 256, 256);
  for (let i = 0; i < voxels.length; i++) {
    voxFile.setVoxel(
      -voxels[i].x + 128,
      voxels[i].z + 128,
      voxels[i].y,
      voxels[i].color
    )
  }
  for (let i = 1; i < colors.length - 1; i++) {
    voxFile.palette[i] = `0xff${colors[i + 1].hexString.substring(1)}`
  }
  return voxFile.export('test.vox')
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    var r = parseInt(result[1], 16);
    var g = parseInt(result[2], 16);
    var b = parseInt(result[3], 16);
    return r + "," + g + "," + b;
  }
  return null;
}

function VOXFILE(X, Y, Z) {
  this.X = X;
  this.Y = Y;
  this.Z = Z;
  this.vcount = 0
  this.voxels = [];
  this.palette = [];
  for (var i = 256; --i > -1;) {
    this.palette.push(0xff000000 | i | (i << 8) | (i << 16));
  }
  this.setVoxel = function (x, y, z, i) {
    i |= 0;
    x |= 0;
    y |= 0;
    z |= 0;
    if (i >= 0 && i < 256 && x >= 0 && y >= 0 && z >= 0 && x < this.X && z < this.Y && z < this.Z) {
      var key = x + "_" + y + "_" + z
      if (i > 0) {
        if (!this.voxels[key]) this.vcount++;
        this.voxels[key] = i;
      } else {
        if (this.voxels[key]) this.vcount--;
        delete this.voxels[key];
      }
    }
  }
  this.appendString = function (data, str) {
    for (var i = 0, j = str.length; i < j; ++i) {
      data.push(str.charCodeAt(i));
    }
  }
  this.appendUInt32 = function (data, n) {
    data.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
  }
  this.appendRGBA = function (data, n) {
    data.push((n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff, (n >>> 24) & 0xff);
  }
  this.appendVoxel = function (data, key) {
    var v = key.split("_");
    data.push(v[0], v[1], v[2], this.voxels[key]);
  }
  this.export = function (filename) {
    var data = [];
    this.appendString(data, "VOX ");
    this.appendUInt32(data, 150);
    this.appendString(data, "MAIN");
    this.appendUInt32(data, 0);
    this.appendUInt32(data, this.vcount * 4 + 0x434);
    this.appendString(data, "SIZE");
    this.appendUInt32(data, 12);
    this.appendUInt32(data, 0);
    this.appendUInt32(data, this.X);
    this.appendUInt32(data, this.Y);
    this.appendUInt32(data, this.Z);
    this.appendString(data, "XYZI");
    this.appendUInt32(data, 4 + this.vcount * 4);
    this.appendUInt32(data, 0);
    this.appendUInt32(data, this.vcount);
    for (var key in this.voxels) {
      this.appendVoxel(data, key);
    }
    this.appendString(data, "RGBA");
    this.appendUInt32(data, 0x400);
    this.appendUInt32(data, 0);
    for (var i = 0; i < 256; i++) {
      this.appendRGBA(data, this.palette[i]);
    }
    return new Blob([new Uint8Array(data)], { type: "octet/stream" });
  }
  this.saveByteArray = (function () {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function (data, name) {
      var blob = new Blob(data, {
        type: "octet/stream"
      }),
        url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = name;
      a.click();
      window.URL.revokeObjectURL(url);
    };
  }());
}

window.addEventListener("blur", function () {
  alt = false;
  const crosshair = document.getElementById("crosshair");
  crosshair.style.backgroundImage = 'url("./img/crosshair.png")';
});

function refresh() {
  var data = JSON.parse(localStorage["voxels"])
  if (data.length > 0) {
    clearVoxels()
    loadVoxels(data)
  }
}