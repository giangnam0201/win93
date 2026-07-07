/*
  UPDATED:
  - Improve resizeCanvas() and countFilesWithExtension() performance
  - Glitch effect transition just before change music track
  - Fixed dekstopLeft lag
  - Fixed resizeCanvas
  - Ajout des fleches en plus de WASD, pour les droitiers ;-)
  - Reboot du score à zero si on meurt
  - Noob friendly : les fichiers dans /c/programs/games/Virus ne peuvent etre éffacés par Virus
    testé et fontionnel, mais nouveau bugs possibles, à surveiller / tester
  - Ajout d'un random trigger sur sfxGlitchSound (son plus propre + meilleures perfs)
*/

import "/42/api/os.js";
import { fileIndex } from "/42/api/fileIndex.js";
import { getIconFromPath } from "/42/api/os/managers/iconsManager/getIconFromPath.js";

import * as THREE from "/c/libs/threejs/0.181/three.js"
import { PointerLockControls } from "/c/libs/threejs/0.181/addons/controls/PointerLockControls.js"

import { sfxr, Params, SoundEffect } from "/c/libs/jsfxr/1.2/jsfxr.js"

let gameOver = false;
let isPaused = false;
let scene
let camera
let iconsGroup;
let glitchScene = false;
let reSpawn = false;
let finished = false;

const appPath = decodeURI(new URL("../", import.meta.url).pathname.slice(0, -1));
const fontPath = '/42/themes/tribute/windows9x/fonts/tomo/Tomo.ttf';

let currentRoom = appPath + "/";
let blockSize = 10;
let moveSpeed = 0.5;
let playerPosition = { x: 0, z: 0 };
let playerPositionCompensator = { x: 0, z: 0 };
let destination
let departure
let icons;
let iconsOrder;
let corridorsLength = 4;
let randomGenerator;
let deletedElements = [];
let bullets = [];
let slivers = [];
let angry = false;
let final = false;
let destroyedExt = {}
let destroyedDesk = {}
let mobs = [];
let map = []
let pain = false;
let audioTransition = false;

let controls

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let screenEl = document.querySelector('#screen');
screenEl.style.background = "#111111";

let desktopDiv = document.querySelector('#desktopDiv');
desktopDiv.style.position = 'absolute';
desktopDiv.style.top = 0;
desktopDiv.style.left = 0;
desktopDiv.style.zIndex = '4';

let extDiv = document.querySelector('#extDiv');
extDiv.style.position = 'absolute';
extDiv.style.bottom = 0 // '18px';
extDiv.style.left = 0;
extDiv.style.zIndex = '4';

let crosshair = document.querySelector('#crosshair');
crosshair.src = appPath + '/img/hand.png';
crosshair.style.position = 'absolute';
crosshair.style.zIndex = '3';
crosshair.style.top = '50%';
crosshair.style.left = '50%';
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.pointerEvents = 'none';

let action = "open"
let canvas = document.querySelector('#canvas');

let canvas2D = document.querySelector('#canvas2D');
let ctx2D = canvas2D.getContext('2d');

canvas2D.style.imageRendering = 'pixelated';
canvas2D.style.pointerEvents = 'none';
canvas2D.style.filter = 'saturate(1.2) contrast(1.5) hue-rotate(45deg)'
canvas2D.style.opacity = '1'
canvas2D.style.willChange = 'transform, opacity, display, filter';
ctx2D.imageSmoothingEnabled = false;

canvas.addEventListener('wheel', (event) => {
  if (event.deltaY < 0) {
    action = "delete";
    crosshair.src = appPath + '/img/crosshair.png';
  }
  else if (event.deltaY > 0) {
    action = "open";
    crosshair.src = appPath + '/img/hand.png';
  }
});


function getRoom(path) {
  try {
    return fileIndex.readDir(path, { absolute: true });
  } catch {
    currentRoom = currentRoom.replace(/\/[^\/]*\/?$/, '/');
    return getRoom(currentRoom);
  }
}

function setup() {
  crosshair.style.display = "initial";
  departure = currentRoom.replace(/\/[^\/]*\/?$/, '/');
  destination = currentRoom;
  icons = getRoom(currentRoom).filter(path => !path.endsWith('/'));
  randomGenerator = seedRandom(currentRoom);
  sfxStart.play();
  glitchScene = true;
  setTimeout(() => {
    glitchScene = false;
  }, 200);
  if (ScriptNodePlayer.getInstance() != null) {
    ScriptNodePlayer.getInstance()._gainNode.gain.value = 1;
  }
  gameOver = false;
  reSpawn = false;
  document.getElementById('currentRoom').innerHTML = currentRoom;
}

function initThreeJS() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.001, 1000);
  camera.position.set(0, 1.6, 0);
  iconsGroup = new THREE.Object3D();
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x111111, 0);

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas2D.width = rect.width;
    canvas2D.height = rect.height;
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.aspect = canvas.width / canvas.height;
    camera.updateProjectionMatrix();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  controls = new PointerLockControls(camera, canvas);

  function makeCooldown() {
    return new Promise(resolve => {
      setTimeout(() => {
        cooldownNeeded = undefined;
        resolve();
      }, 1250);
    });
  }
  let cooldownNeeded
  controls.addEventListener('unlock', () => {
    cooldownNeeded = makeCooldown()
  });
  canvas.addEventListener('click', async () => {
    if (controls.isLocked) return
    if (cooldownNeeded) await cooldownNeeded;
    try {
      // Pareil que `controls.lock()` sauf qu'on peux vérifier si ya une erreur
      await canvas.requestPointerLock();
    } catch {
      // Retry once
      await makeCooldown();
      canvas.requestPointerLock();
    }
  });

  canvas.addEventListener('mousedown', onMouseClick);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('dblclick', onMouseDoubleClick);
  canvas.addEventListener('pointermove', onPointerMove);

  var isCapsLock;
  const keys = { w: false, a: false, s: false, d: false, e: false };

  function handleKeyDown(event) {
    if (event.code === "Tab") event.preventDefault();

    if (event.getModifierState && event.getModifierState('CapsLock')) {
      if (!isCapsLock) {
        moveSpeed = 1;
        isCapsLock = true;
      }
    } else {
      if (isCapsLock) {
        moveSpeed = 0.5;
        isCapsLock = false;
      }
    }

    if (event.code === "ShiftLeft") {
      moveSpeed = 1;
      keys.shift = true;
    }
    if (event.code === 'KeyW' || event.code === 'ArrowUp') keys.w = true;  // W or Up Arrow
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') keys.a = true;  // A or Left Arrow
    if (event.code === 'KeyS' || event.code === 'ArrowDown') keys.s = true;  // S or Down Arrow
    if (event.code === 'KeyD' || event.code === 'ArrowRight') keys.d = true;  // D or Right Arrow
    if (event.code === 'KeyE') keys.e = true;  // E
  }


  function handleKeyUp(event) {
    if (event.code === "ShiftLeft") {
      if (!isCapsLock) moveSpeed = 0.5;
      keys.shift = false;
    }
    if (event.code === 'KeyW' || event.code === 'ArrowUp') keys.w = false;  // W or Up Arrow
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') keys.a = false;  // A or Left Arrow
    if (event.code === 'KeyS' || event.code === 'ArrowDown') keys.s = false;  // S or Down Arrow
    if (event.code === 'KeyD' || event.code === 'ArrowRight') keys.d = false;  // D or Right Arrow
    if (event.code === 'KeyE') keys.e = false;  // E
  }


  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  function checkMobCollision(position, radius) {
    const extendedBlockSize = blockSize + moveSpeed * 4;
    const checkPoints = [
      { x: position.x + radius, z: position.z },
      { x: position.x - radius, z: position.z },
      { x: position.x, z: position.z + radius },
      { x: position.x, z: position.z - radius },
      { x: position.x + radius, z: position.z + radius },
      { x: position.x - radius, z: position.z + radius },
      { x: position.x + radius, z: position.z - radius },
      { x: position.x - radius, z: position.z - radius }
    ];
    for (let i = 0; i < checkPoints.length; i++) {
      const point = checkPoints[i];
      const row = Math.floor((point.z - moveSpeed * 2 + extendedBlockSize / 2) / blockSize);
      const col = Math.floor((point.x - moveSpeed * 2 + extendedBlockSize / 2) / blockSize);
      if (!map || row < 0 || row >= map.length || col < 0 || col >= map[row].length) {
        return true;
      }
      const cell = map[row][col];
      if (cell !== '0') {
        return true;
      }
    }
    return false;
  }

  function finalStage() {
    mobs = [];
    canvas.style.transition = 'opacity 3000ms ease';
    canvas.style.opacity = '0';
    setTimeout(() => {
      setTimeout(() => {
        if (ScriptNodePlayer.getInstance() != null) {
          ScriptNodePlayer.getInstance()._gainNode.gain.value = 1;
        }
        scene.remove.apply(scene, scene.children);
        map = generateMap();
        currentRoom = '../';
        destination = currentRoom;
        departure = currentRoom;
        generateRoom(4);
        camera.rotation.set(0, 0, 0);
        playerPositionCompensator = { x: 0, z: 0 };
        placePlayer();
        addLight();
        scene.fog = new THREE.Fog(0xCCCCCC, -10, 35);
        screenEl.style.background = "#CCCCCC";
        canvas.style.transition = 'opacity 1000ms ease';
        canvas.style.opacity = '1';
      }, 100);
    }, 5000);
    final = true;
  }

  let doorContact = false;
  let dekstopLeft = countFilesWithExtension('.desktop');

  function checkCollision(position) {
    const extendedBlockSize = blockSize + moveSpeed * 4;
    const row = Math.floor((position.z - moveSpeed * 2 + extendedBlockSize / 2) / blockSize);
    const col = Math.floor((position.x - moveSpeed * 2 + extendedBlockSize / 2) / blockSize);
    if (!map || row < 0 || row >= map.length || col < 0 || col >= map[row].length) {
      if (!final) {
        finalStage();
        return false;
      } else {
        return false;
      }
    }
    const cell = map[row][col];
    if (cell === '1') {
      return true;
    }
    if (cell === '3') {
      if (dekstopLeft == 0) {
        if (doorContact == false) {
          doorContact = true;
          sfxDoor.play();
        }
        map[row][col] = '2';
        scene.remove.apply(scene, scene.children);
        randomGenerator = seedRandom(currentRoom);
        map = folderToMap(getRoom(currentRoom));
        generateRoom(4);
        addLight();
        return false;
      } else {
        if (doorContact == false) {
          doorContact = true;
          notification('You can\'t pass yet [' + dekstopLeft + ']');
          sfxNope.play();
        }
        return true;
      }
    }
    if (cell.startsWith('F')) {
      let num = Number(cell.slice(1)) - 1;
      let folders = getRoom(currentRoom).filter(item => item.endsWith('/'));
      destination = folders[num];
      if (destination == undefined) {
        destination = currentRoom.replace(/\/[^\/]*\/$/, '/');
      }
      return false;
    }
    if (dekstopLeft == 0) { doorContact = false }
    return false;
  }

  function movePlayer(keys) {
    const previousPosition = { x: camera.position.x, z: camera.position.z };
    let moveX = 0;
    let moveZ = 0;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0));
    if (keys.w) {
      moveX = direction.x * moveSpeed;
      moveZ = direction.z * moveSpeed;
    }
    if (keys.s) {
      moveX = -direction.x * moveSpeed;
      moveZ = -direction.z * moveSpeed;
    }
    if (keys.a) {
      moveX = -right.x * moveSpeed;
      moveZ = -right.z * moveSpeed;
    }
    if (keys.d) {
      moveX = right.x * moveSpeed;
      moveZ = right.z * moveSpeed;
    }
    if (moveX !== 0 || moveZ !== 0) {
      const newX = camera.position.x + moveX;
      const newZ = camera.position.z + moveZ;
      const canMoveX = !checkCollision({ x: newX, z: camera.position.z });
      const canMoveZ = !checkCollision({ x: camera.position.x, z: newZ });
      if (canMoveX && canMoveZ) {
        camera.position.x = newX;
        camera.position.z = newZ;
      } else if (canMoveX) {
        camera.position.x = newX;
      } else if (canMoveZ) {
        camera.position.z = newZ;
      } else {
        //
      }
    }
  }

  function restartGame(folder) {
    clearBullets();
    departure = currentRoom
    currentRoom = folder;
    document.getElementById('currentRoom').innerHTML = currentRoom;
    randomGenerator = seedRandom(currentRoom);
    map = folderToMap(getRoom(currentRoom));
    //if(orientation=='N'){ camera.rotation.set(0, 0, 0); }
    //if(orientation=='S'){ camera.rotation.set(0, Math.PI, 0); }
    scene.remove.apply(scene, scene.children);
    generateRoom(4);
    placePlayer();
    addLight();
    doorContact = false;
    dekstopLeft = countFilesWithExtension('.desktop');
  }

  function onPointerMove(event) {
    const canvasRect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
    pointer.y = -((event.clientY - canvasRect.top) / canvasRect.height) * 2 + 1;
  }

  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  function flashIcon(iconGroup, duration = 1000, interval = 100, shake) {
    let originalColors = [];
    let originalFogSettings = [];
    let originalPosition = iconGroup.position.clone();
    iconGroup.children.forEach(child => {
      if (child.material && child.material.color) {
        originalColors.push(child.material.color.getHex());
        originalFogSettings.push(child.material.fog);
      }
    });

    function applyShake(group) {
      if (shake == undefined || shake == false) { return }
      const shakeIntensity = 0.4;
      const randomX = (Math.random() - 0.5) * shakeIntensity * 1.5;
      const randomY = (Math.random() - 0.5) * shakeIntensity * 1.5;
      const randomZ = (Math.random() - 0.5) * shakeIntensity * 1.5;
      group.position.y += randomY;
    }

    let flashing = setInterval(() => {
      iconGroup.children.forEach(child => {
        if (child.material && child.material.color) {
          child.material.color.set(getRandomColor());
          child.material.fog = false;
        }
      });
      applyShake(iconGroup);
    }, interval);

    setTimeout(() => {

      iconGroup.children.forEach((child, index) => {
        if (child.material && child.material.color) {
          //child.material.color.setHex(originalColors[index]);
          child.material.color.setHex(16777215);
          child.material.fog = true;
        }
      });
      clearInterval(flashing);
    }, duration);
  }

  function refreshDestroyedDesktops() {
    desktopDiv.innerHTML = '';
    for (let imgSrc in destroyedDesk) {
      if (destroyedDesk.hasOwnProperty(imgSrc)) {
        let span = document.createElement('span');
        span.style.display = 'inline-block';
        span.style.textAlign = 'center';
        let img = document.createElement('img');
        img.src = imgSrc;
        img.style.width = '32px';
        img.style.imageRendering = 'pixelated';
        img.style.imageRendering = 'crispy-edge';
        img.style.display = 'block';
        let text = document.createElement('div');
        text.style.textAlign = "center"
        text.textContent = `x${destroyedDesk[imgSrc]}`;
        span.appendChild(img);
        span.appendChild(text);
        desktopDiv.appendChild(span);
      }
    }
    // desktopDiv.style.position = 'fixed';
  }

  function refreshDestroyedIcons() {
    extDiv.innerHTML = '';
    let entries = Object.entries(destroyedExt);
    entries.sort((a, b) => b[1] - a[1]);
    destroyedExt = Object.fromEntries(entries);
    for (let imgSrc in destroyedExt) {
      if (destroyedExt.hasOwnProperty(imgSrc)) {
        let span = document.createElement('span');
        span.style.display = 'inline-block';
        span.style.textAlign = 'center';
        let img = document.createElement('img');
        img.src = imgSrc;
        img.style.width = '32px';
        img.style.imageRendering = 'crispy-edge';
        img.style.imageRendering = 'pixelated';
        img.style.display = 'block';
        let text = document.createElement('div');
        text.style.textAlign = "center"
        text.textContent = `x${destroyedExt[imgSrc]}`;
        span.appendChild(img);
        span.appendChild(text);
        extDiv.appendChild(span);
      }
    }
    // extDiv.style.position = 'fixed';
  }

  function destroyIcons(img, addIt) {
    if (addIt == true) {
      if (destroyedExt[img] !== undefined) {
        destroyedExt[img] += 1;
      } else {
        destroyedExt[img] = 1;
      }
      refreshDestroyedIcons();
    } else {
      if (addIt == false) {
        if (destroyedDesk[img] !== undefined) {
          destroyedDesk[img] += 1;
        } else {
          destroyedDesk[img] = 1;
        }
        refreshDestroyedDesktops();
      }
    }
  }

  function deleteFile(filename) {
    aStrike.play();
    sfxGenExplosion();
    document.getElementById('currentScore').innerHTML = getScore().toLocaleString('de-DE') + ' points';
    if (filename != 'https://windows93.net') {
      const isChildPath = (childPath, parentPath) => childPath.replace(/\\/g, '/').startsWith(parentPath.replace(/\\/g, '/'));
      if(!isChildPath(filename, "/c/programs/games/Trojan/")){
        notification('delete: ' + filename)
        window.top.sys42.fs.delete(filename)
      }else{
        notification('You can\'t delete: ' + filename)
      }
    } else {
      gameEnd();
    }
  }

  function gameEnd() {
    setTimeout(() => {
      if (ScriptNodePlayer.getInstance() != null) {
        fadeOutAudio()
      }
      // crosshair.style.display = 'none';
      setTimeout(() => {
        notification('Game Over')
        document.getElementById('msg').style.display = 'initial';
        let score = getScore().toLocaleString('de-DE');
        document.getElementById('msg').innerHTML = '<h1>Game Over</h1><h2>Your score is:</h2><h3>' + score + '</h3>';
        finished = true;
      }, 500);
      setTimeout(() => {
        isPaused = true;
      }, 750);
    }, 1000);
  }

  function getScore() {
    const extensionCount = {};
    if (deletedElements.length === 0) {return 0;}
    deletedElements.filter(file => file !== null).forEach(file => {
      const ext = file.split('.').pop();
      if (extensionCount[ext]) {
        extensionCount[ext]++;
      } else {
        extensionCount[ext] = 1;
      }
    });
    if (extensionCount["net"]) { extensionCount["net"] = 1000 }
    const values = Object.values(extensionCount);
    let score = values.reduce((accumulator, currentValue) => accumulator * currentValue);
    return score;
  }

  function countFilesWithExtension(extension) {
    // const deletedCount = deletedElements.filter(path => path.toLowerCase().endsWith(extension)).length
    // return fileIndex.glob(`**/*${extension}`).length - deletedCount;
    return fileIndex.glob(`**/*${extension}`).length
  }

  function iconAction(filename, iconsGroupIndex) {
    if (isPaused) { return }
    if (action === "delete") {
      sfxShoot.play();
      setTimeout(() => {
        sfxShootHit.play();
        sfxGenHurt();
      }, Math.random() * 100 + 50);
      if ((mobs.filter(mob => mob.life > 0).length) > 0) {
        if (!angry) {
          notification('Intrusion detected!', 'Doctor Marburg')
          initOst();
        }
        angry = true;
      }
      const touchedObject = iconsGroup.children[iconsGroupIndex];
      const mobIndex = findMobIndexByObject3DUUID(touchedObject);
      const groupToClear = iconsGroup.children[iconsGroupIndex];
      if (mobIndex !== -1) {
        flashIcon(touchedObject, 500, 5);
        if (mobs[mobIndex].life != undefined) {
          mobs[mobIndex].life -= 1;
          if (mobs[mobIndex].life <= 0) {
            setTimeout(() => {
              if (touchedObject.children[0] == undefined) { return }
              if (iconsGroup.children[iconsGroupIndex] != undefined) {
                if (!deletedElements.includes(filename)) {
                  let sliverSize = 1;
                  if (filename == undefined) {
                    filename = 'https://windows93.net'
                    sliverSize = 10;
                  }
                  deletedElements.push(filename);
                  deleteFile(filename);
                  destroyIcons(groupToClear.iconFile.image, false)
                  createSlivers(touchedObject.position, touchedObject.children[0].material.map, sliverSize);
                }
                iconsGroup.children[iconsGroupIndex].visible = false;
                mobs[mobIndex].alive = false;
              }
              while (groupToClear.children.length > 0) {
                groupToClear.remove(groupToClear.children[0]);
              }
            }, 500);
            return;
          }
        } else {
          setTimeout(() => {
            if (touchedObject.children[0] == undefined) { return }
            if (!deletedElements.includes(filename)) {
              deletedElements.push(filename);
              deleteFile(filename);
              destroyIcons(groupToClear.iconFile.image, true)
              createSlivers(touchedObject.position, touchedObject.children[0].material.map);
              if (iconsGroup.children[iconsGroupIndex] != undefined) {
                iconsGroup.children[iconsGroupIndex].visible = false;
              }
            }
            while (groupToClear.children.length > 0) {
              groupToClear.remove(groupToClear.children[0]);
            }
          }, 250);
          return;
        }
      } else {
        flashIcon(touchedObject, 100, 5);
        setTimeout(() => {
          if (touchedObject.children[0] == undefined) { return }
          if (!deletedElements.includes(filename)) {
            deletedElements.push(filename);
            deleteFile(filename);
            destroyIcons(groupToClear.iconFile.image, true)
            createSlivers(touchedObject.position, touchedObject.children[0].material.map);
            if (iconsGroup.children[iconsGroupIndex] != undefined) {
              iconsGroup.children[iconsGroupIndex].visible = false;
            }
          }
          while (groupToClear.children.length > 0) {
            groupToClear.remove(groupToClear.children[0]);
          }
        }, 250);
        return;
      }
    }
    if (action === "open") {
      const touchedObject = iconsGroup.children[iconsGroupIndex];
      flashIcon(touchedObject, 100, 5, false);
      notification('open: ' + filename)
      if (controls.isLocked) controls.unlock();
      window.top.sys42.exec(filename)
    }
  }

  function createSlivers(position, texture, size = 1) {
    const numSlivers = 5 + Math.floor(Math.random() * 15);
    for (let i = 0; i < numSlivers; i++) {
      const sliver = new Sliver(position, 0.25, texture, size);
      scene.add(sliver.mesh);
      slivers.push(sliver);
    }
  }

  function onMouseDoubleClick(event) {
    if (finished) { return; }
    if (action != 'open') { return; }
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const visibleIcons = iconsGroup.children.filter(icon => icon.visible === true);
    const intersects = raycaster.intersectObjects(visibleIcons, true);
    if (intersects.length > 0) {
      const firstIntersectedObject = intersects[0].object;
      let parentObject = firstIntersectedObject.parent;
      let highestParent = null;
      while (parentObject && parentObject !== iconsGroup) {
        highestParent = parentObject;
        parentObject = parentObject.parent;
      }
      if (highestParent) {
        const index = iconsGroup.children.indexOf(highestParent);
        if (index !== -1) {
          let clickedIcon = iconsOrder[index];
          iconAction(icons[clickedIcon], index);
        } else {
          //
        }
      } else {
        //
      }
    } else {
      //
    }
  }


  function generateMap() {
    let map = [];
    const size = 40;
    for (let i = 0; i < size; i++) {
      let row = [];
      for (let j = 0; j < size; j++) {
        row.push("0");
      }
      map.push(row);
    }
    map[20][20] = "B0";
    map[38][20] = "@";
    return map;
  }

  function onMouseUp(event) {
    if (gameOver && !reSpawn) { return }
    if (finished) { return }
    if (gameOver && reSpawn && !final) {
      // AFTER KILL
      clearBullets();
      deletedElements = [];
      document.getElementById('currentScore').innerHTML = getScore().toLocaleString('de-DE') + ' points';
      extDiv.innerHTML = '';
      desktopDiv.innerHTML = '';
      destroyedExt = {}
      destroyedDesk = {}
      // Silly position/wall glitch here, let's check this later.
      camera.rotation.set(0, 0, 0);
      playerPosition = {
        x: Math.round(camera.position.x / blockSize),
        z: Math.round(camera.position.z / blockSize)
      };
      // crosshair.style.display = "initial";
      icons = getRoom(currentRoom).filter(path => !path.endsWith('/'));
      randomGenerator = seedRandom(currentRoom);
      sfxStart.play();
      glitchScene = true;
      setTimeout(() => {
        glitchScene = false;
      }, 200);
      if (ScriptNodePlayer.getInstance() != null) {
        ScriptNodePlayer.getInstance()._gainNode.gain.value = 1;
      }
      gameOver = false;
      reSpawn = false;
      scene.remove.apply(scene, scene.children);
      map = folderToMap(getRoom(currentRoom));
      if (departure.startsWith(destination)) { camera.rotation.set(0, Math.PI, 0); }
      generateRoom(4);
      placePlayer();
      addLight();
      audioTransition = false;
      sfxNoise(audioTransition);
      if (ScriptNodePlayer.getInstance() != null) {
        ScriptNodePlayer.getInstance().play();
      } else {
        ScriptNodePlayer.createInstance(new MDXBackendAdapter(), basePath, tracks, true, doOnPlayerReady, doOnTrackReadyToPlay, doOnTrackEnd);
      }
    }

    if (gameOver && reSpawn && final) {
      // BOSS KILL
      extDiv.innerHTML = '';
      desktopDiv.innerHTML = '';
      deletedElements = [];
      document.getElementById('currentScore').innerHTML = getScore().toLocaleString('de-DE') + ' points';
      destroyedExt = {}
      destroyedDesk = {}
      camera.rotation.set(0, 0, 0);
      playerPosition = { x: 0, z: 0 };
      camera.position.set(0, blockSize / 3, 0);
      playerPosition = {
        x: Math.round(camera.position.x / blockSize),
        z: Math.round(camera.position.z / blockSize)
      };
      playerPositionCompensator = { x: 0, z: 0 };
      // crosshair.style.display = "initial";
      departure = currentRoom.replace(/\/[^\/]*\/?$/, '/');
      icons = [];
      randomGenerator = seedRandom(currentRoom);
      sfxStart.play();
      glitchScene = true;
      setTimeout(() => {
        glitchScene = false;
      }, 200);
      gameOver = false;
      reSpawn = false;
      scene.remove.apply(scene, scene.children);
      map = generateMap();
      generateRoom(4);
      placePlayer();
      addLight();
      scene.fog = new THREE.Fog(0xCCCCCC, -10, 35);
      audioTransition = false;
      sfxNoise(audioTransition);
      if (ScriptNodePlayer.getInstance() != null) {
        ScriptNodePlayer.getInstance().play();
        ScriptNodePlayer.getInstance()._gainNode.gain.value = 1;
      } else {
        ScriptNodePlayer.createInstance(new MDXBackendAdapter(), basePath, tracks, true, doOnPlayerReady, doOnTrackReadyToPlay, doOnTrackEnd);
        ScriptNodePlayer.getInstance()._gainNode.gain.value = 1;
      }
    }

  }

  function onMouseClick(event) {
    /*
    if (ScriptNodePlayer.getInstance() != null) {
      console.log(ScriptNodePlayer.getInstance().getPlaybackTimeout())
      console.log(ScriptNodePlayer.getInstance().getCurrentPlaytime())
      console.log(ScriptNodePlayer.getInstance().getMaxPlaybackPosition())
    }
    */
    if (finished) { return }
    if (gameOver) { return }
    if (isPaused) { return }
    if (action != 'delete') { return; }
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const visibleIcons = iconsGroup.children.filter(icon => icon.visible === true);
    const intersects = raycaster.intersectObjects(visibleIcons, true);
    if (intersects.length > 0) {
      const firstIntersectedObject = intersects[0].object;
      let parentObject = firstIntersectedObject.parent;
      let highestParent = null;
      while (parentObject && parentObject !== iconsGroup) {
        highestParent = parentObject;
        parentObject = parentObject.parent;
      }
      if (highestParent) {
        const index = iconsGroup.children.indexOf(highestParent);
        if (index !== -1) {
          let clickedIcon = iconsOrder[index];
          iconAction(icons[clickedIcon], index);
        } else {
          //
        }
      } else {
        //
      }
    } else {
      sfxShoot.play();
      let firstKey = Object.keys(destroyedExt)[0];
      if (destroyedExt[firstKey] > 0) {
        destroyedExt[firstKey]--;
        if (destroyedExt[firstKey] == 0) {
          delete destroyedExt[firstKey];
        }
        refreshDestroyedIcons();
      }
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    if (isPaused) return;
    if (gameOver) {
      if (!finished) {
        if (!reSpawn) {
          canvas2D.style.display = "initial";
          glitchCanvas2D();
          if(Math.random()>0.75){ sfxGlitchSound(); }
        }
        if (reSpawn) {
          canvas2D.style.display = "initial";
          drawWhiteNoise()
        }
      }
      return;
    }
    if (currentRoom !== destination) { restartGame(destination); }
    //
    movePlayer(keys);
    iconsGroup.children.forEach(icon => {
      icon.lookAt(camera.position);
    });
    //
    for (let i = 0; i < mobs.length; i++) {
      mobs[i].update(camera);
    }
    //
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (bullets[i].update(camera)) {
        scene.remove(bullets[i].mesh);
        bullets.splice(i, 1);
      }
    }
    //
    for (let i = slivers.length - 1; i >= 0; i--) {
      if (slivers[i].update(camera)) {
        scene.remove(slivers[i].mesh);
        slivers.splice(i, 1);
      }
    }
    renderer.render(scene, camera);
    if (!pain && !glitchScene) {
      canvas2D.style.display = "none";
    } else {
      canvas2D.style.display = "initial";
      glitchCanvas2D();
    }
    if (audioTransition || pain) {
      if(Math.random()>0.75){ sfxGlitchSound() }
    }
  }

  function sfxGlitchSound() {
    let p_env_attack = 0.02;
    let p_env_sustain = Math.random() * 0.58;
    let p_env_decay = 0.01;
    let sample_rate = [44100, 22050, 11025, 5512];
    let sound = {
      "oldParams": true,
      "wave_type": parseInt(Math.random() * 4),
      "p_env_attack": p_env_attack,
      "p_env_sustain": p_env_sustain,
      "p_env_punch": 0,
      "p_env_decay": p_env_decay,
      "p_base_freq": Math.random(),
      "p_freq_limit": 0,
      "p_freq_ramp": Math.random(),
      "p_freq_dramp": Math.random(),
      "p_vib_strength": Math.random(),
      "p_vib_speed": Math.random(),
      "p_arp_mod": Math.random(),
      "p_arp_speed": Math.random(),
      "p_duty": Math.random(),
      "p_duty_ramp": Math.random(),
      "p_repeat_speed": Math.random(),
      "p_pha_offset": Math.random(),
      "p_pha_ramp": Math.random() * 2 - 1,
      "p_lpf_freq": 1,
      "p_lpf_ramp": -1,
      "p_lpf_resonance": Math.random(),
      "p_hpf_freq": Math.random(),
      "p_hpf_ramp": -1,
      "sound_vol": 0.0525,
      "sample_rate": sample_rate[parseInt(Math.random() * 4)],
      "sample_size": (parseInt(Math.random() * 2) + 1) * 8
    };
    const soundEffect = new SoundEffect(sound)
    let sfxGlitch = soundEffect.generate();
    sfxGlitch.getAudio().play();
  }

  function glitchCanvas2D() {
    const randomSaturate = 1 + Math.random() * 1;
    const randomContrast = 1 + Math.random() * 1;
    const randomHueRotate = Math.random() * 360;
    canvas2D.style.filter = `saturate(${randomSaturate}) contrast(${randomContrast}) hue-rotate(${randomHueRotate}deg)`;
    const glitchAmount = Math.round(Math.random() * 150);
    ctx2D.drawImage(renderer.domElement, 0, 0, canvas2D.width, canvas2D.height);
    for (let i = 0; i < glitchAmount; i++) {
      const width = canvas2D.width * (0.1 + Math.random() * 0.4);
      const height = canvas2D.height * (0.05 + Math.random() * 0.2);
      const x = Math.random() * (canvas2D.width - width);
      const y = Math.random() * (canvas2D.height - height);
      const xOffset = (Math.random() - 0.5) * 30;
      const yOffset = (Math.random() - 0.5) * 30;
      ctx2D.drawImage(
        canvas2D,
        x, y, width, height,
        x + xOffset, y + yOffset, width, height
      );
      let glitchLineHeight;
      let glitchLineY;
      if (Math.random() > 0.99) {
        ctx2D.globalAlpha = 1;
        glitchLineHeight = Math.random() * 5 + 1;
        glitchLineY = Math.random() * canvas2D.height;
        ctx2D.fillStyle = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.5)`;
        ctx2D.fillStyle = `rgba(0,0,0,1)`;
        ctx2D.fillRect(0, glitchLineY, canvas2D.width, glitchLineHeight);
        ctx2D.globalAlpha = 1;
      }
      if (Math.random() > 0.9975) {
        ctx2D.globalAlpha = 1;
        glitchLineHeight = Math.random() * 5 + 1;
        glitchLineY = Math.random() * canvas2D.height;
        ctx2D.fillStyle = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.5)`;
        ctx2D.fillStyle = `rgba(255,255,255,1)`;
        ctx2D.fillRect(0, glitchLineY, canvas2D.width, glitchLineHeight);
        ctx2D.globalAlpha = 1;
      }
    }
  }

  function loadTextures() {
    const textureLoader = new THREE.TextureLoader();
    const texturePromises = [
      textureLoader.loadAsync(appPath + '/img/floor.png').then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        textures.floor = texture;
      }),
      textureLoader.loadAsync(appPath + '/img/wall-32px.png').then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        textures.wall = texture;
      }),
      textureLoader.loadAsync(appPath + '/img/wall-32px.png').then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        textures.ceiling = texture;
      }),
      textureLoader.loadAsync(appPath + '/img/door.png').then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        textures.door = texture;
      }),
      textureLoader.loadAsync(appPath + '/img/wall-32px.png').then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        textures.cellBlock = texture;
      }),
      textureLoader.loadAsync(appPath + '/img/logow.png').then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        textures.windows93 = texture;
      }),
      textureLoader.loadAsync(appPath + '/img/cursor.png').then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        textures.cursor = texture;
      }),
    ];
    return Promise.all(texturePromises);
  }

  let availablePositions = null;
  function getRandomZeroPosition(map) {
    if (availablePositions == null) {
      availablePositions = [];
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          if (map[y][x] === "0") {
            availablePositions.push({ x: x, z: y });
          }
        }
      }
    }
    if (availablePositions.length > 0) {
      const randomIndex = Math.floor(randomGenerator() * availablePositions.length);
      const chosenPosition = availablePositions.splice(randomIndex, 1)[0]; // Retirer et obtenir la position choisie
      return chosenPosition;
    } else {
      //console.log("Il n'y a plus d'espace disponible pour placer des icones.");
      return 0;
    }
  }

  function folderToMap(array) {
    icons = getRoom(currentRoom).filter(path => !path.endsWith('/'));
    const folders = array.filter(item => item.endsWith('/'));
    let mapWidth = (folders.length * 2) + 3;
    let optimalGridSize = calculateOptimalGridSize(icons.length);
    if (mapWidth <= 3) {
      mapWidth = 5;
    }
    let roomDepth = 2;
    if (folders.length == 0) {
      roomDepth + 4;
    }
    if (mapWidth == 5 && folders.length == 0) {
      roomDepth = 3;
    }
    let proposedRoomDepth = roomDepth;
    let roomType = Math.floor(randomGenerator() * 3);
    if (roomType == 0) {
      if (icons.length > (mapWidth - 2) * (roomDepth)) { proposedRoomDepth = Math.ceil(icons.length / (mapWidth - 2)); }
      roomDepth = proposedRoomDepth;
    }
    if (roomType == 1) {
      if (icons.length > (mapWidth - 2) * (roomDepth)) {
        proposedRoomDepth = Math.ceil(icons.length / (mapWidth - 2));
      }
      roomDepth = proposedRoomDepth;
      if (proposedRoomDepth > 5) {
        roomDepth = mapWidth;
        mapWidth = proposedRoomDepth;
      }
    }
    if (roomType == 2) {
      if (icons.length > (mapWidth - 2) * (roomDepth - 2)) {
        if (mapWidth < optimalGridSize.width + 2) { mapWidth = optimalGridSize.width + 2 }
        if (roomDepth < optimalGridSize.height + 2) { roomDepth = optimalGridSize.height + 2 }
      }
    }
    if (mapWidth % 2 === 0) {
      mapWidth += 1;
    }
    let newMap = [];
    for (let i = 0; i < corridorsLength + 6; i++) {
      newMap[i] = Array(mapWidth).fill("1");
    }
    let imax = folders.length;
    let offset = Math.floor((newMap[0].length - (imax * 2)) / 2) + 1;
    for (let i = 0; i < imax; i++) {
      let x = 0;
      newMap[x][(i * 2) + offset] = "1"; x++;
      newMap[x][(i * 2) + offset] = "2"; x++;
      newMap[x][(i * 2) + offset] = "2"; x++;
      newMap[x][(i * 2) + offset] = "2"; x++;
      newMap[x][(i * 2) + offset] = "F" + (i + 1); x++;
      if (folders[i] != departure) {
        newMap[x][(i * 2) + offset] = "2"; x++;
      } else {
        newMap[x][(i * 2) + offset] = "@"; x++;
      }
      newMap[x][(i * 2) + offset] = "2"; x++;
      newMap[x][(i * 2) + offset] = "2"; x++;
      newMap[x][(i * 2) + offset] = "2"; x++;
      newMap[x][(i * 2) + offset] = "2"; x++;
    }
    let r = newMap.length
    let rMax = newMap.length + roomDepth;
    for (let y = r; y < rMax; y++) {
      newMap[y] = Array(mapWidth).fill("0");
      newMap[y][0] = "1";
      newMap[y][mapWidth - 1] = "1";
    }
    r = newMap.length
    for (let y = r; y < r + corridorsLength + 3; y++) {
      newMap[y] = Array(mapWidth).fill("1");
      if (y == r + 2) {
        if (!departure.startsWith(currentRoom)) {
          newMap[y][Math.floor(mapWidth / 2)] = "@";
        } else {
          newMap[y][Math.floor(mapWidth / 2)] = "2";
        }
      } else {
        if (y == r + 3) {
          if (currentRoom != '/') {
            newMap[y][Math.floor(mapWidth / 2)] = "F0";
          } else {
            newMap[y][Math.floor(mapWidth / 2)] = "3";
          }
        } else {
          newMap[y][Math.floor(mapWidth / 2)] = "2";
        }
      }
    }
    r = newMap.length
    for (let y = r; y < r + corridorsLength - 3; y++) {
      newMap[y] = Array(mapWidth).fill("1");
      newMap[y][Math.floor(mapWidth / 2)] = "2";
    }
    //console.log(newMap)
    return newMap;
  }

  function findMobIndexByObject3DUUID(touchedObject) {
    for (let i = 0; i < mobs.length; i++) {
      if (mobs[i].object3D.uuid === touchedObject.uuid) {
        return i;
      }
    }
    return -1;
  }

  class DotDesktop {
    constructor(x, y, z, scale, alive, texture, iconName) {
      this.name = iconName;
      this.randomGenerator = seedRandom(iconName);
      this.randomValue = this.randomGenerator();
      this.randomValue = this.randomGenerator();
      this.type = 'desktop';
      this.metroMod = 45; // EASY = 60 // HARD = 30
      this.life = 3;
      this.speed = 0.25;
      // SHUFFLE
      if (this.randomValue < 0.33) {
        this.metroMod = Math.floor(15 + (this.randomValue * 15));
      } else {
        this.metroMod = Math.floor(30 + ((this.randomValue - 0.33) * 30));
      }
      if (this.randomValue >= 0.33 && this.randomValue <= 0.66) {
        this.life = 3 + Math.floor(this.randomValue * 4);
      } else {
        this.life = 3;
      }
      if (this.randomValue > 0.66) {
        this.speed = 0.25 + ((this.randomValue) * 0.35);
      } else {
        this.speed = 0.25 + + ((this.randomValue) * 0.05);
      }
      // console.log('stats: '+this.metroMod+','+this.life+','+this.speed)
      //
      this.angry = angry;
      this.object3D = new THREE.Object3D();
      const geometry = new THREE.PlaneGeometry(blockSize / 4, blockSize / 4);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        fog: true,
        transparent: true
      });
      this.plane = new THREE.Mesh(geometry, material);
      this.plane.scale.set(scale * blockSize / 2, scale * blockSize / 2, scale * blockSize / 2);
      this.plane.position.y += 0.0425 * blockSize;
      this.object3D.add(this.plane);
      createTextOnPlane(iconName, "Tomo", fontPath, '#000000', '#FFFFFF', true).then(obj => {
        this.object3D.add(obj);
        obj.position.set(0, -blockSize * 0.35, 0);
        obj.scale.set(0.5, 0.5, 0.5);
      });
      this.object3D.position.set(x, 0, z);
      this.metro = Math.round(Math.random() * this.metroMod);
      this.moveX = 0;
      this.moveZ = 0;
      this.baseY = y;
      this.oscillationSpeed = 0.25;
      this.oscillationAmplitude = blockSize / 64;
      this.time = 0;
      this.playerPos = { x: camera.position.x, z: camera.position.z }
      this.prepareShot = false;
      this.texture = texture;
    }

    update(camera) {
      if (this.object3D.visible) {

        this.time += this.oscillationSpeed;

        if (this.metro % this.metroMod === 0) {

          if (angry == true) { this.angry = true }

          if (!this.prepareShot) {
            let dice = Math.floor(randomGenerator() * 6);
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            const right = new THREE.Vector3();
            right.crossVectors(direction, new THREE.Vector3(0, 1, 0));
            switch (dice) {
              case 0:
                this.moveX = direction.x * this.speed;
                this.moveZ = direction.z * this.speed;
                break;
              case 1:
                this.moveX = -direction.x * this.speed;
                this.moveZ = -direction.z * this.speed;
                break;
              case 2:
                this.moveX = -right.x * this.speed;
                this.moveZ = -right.z * this.speed;
                break;
              case 3:
                this.moveX = right.x * this.speed;
                this.moveZ = right.z * this.speed;
                break;
              case 4:
                this.prepareShot = true;
                this.playerPos = { x: camera.position.x, z: camera.position.z }
                break;
              case 5:
                this.moveX = 0;
                this.moveZ = 0;
                break;
            }
          } else {
            this.prepareShot = false;
            if (this.angry) {
              const from = this.object3D.position.clone();
              const to = camera.position.clone();
              bullets.push(new Bullet(from, to, 0.7, this.texture));
              scene.add(bullets[bullets.length - 1].mesh);
              sfxGenLaserShoot();
            }
          }
        }
        if (this.moveX !== 0 || this.moveZ !== 0) {



          const newX = this.object3D.position.x + this.moveX;
          const newZ = this.object3D.position.z + this.moveZ;

          // console.log(this.object3D.position)

          const canMoveX = !checkMobCollision({ x: newX, z: this.object3D.position.z }, blockSize / 3);
          const canMoveZ = !checkMobCollision({ x: this.object3D.position.x, z: newZ }, blockSize / 3);
          if (canMoveX && canMoveZ) {
            this.object3D.position.y = this.baseY + Math.sin(this.time) * this.oscillationAmplitude;
            this.object3D.position.x = newX;
            this.object3D.position.z = newZ;
          }
          else if (canMoveX) {
            this.object3D.position.y = this.baseY + Math.sin(this.time) * this.oscillationAmplitude;
            this.object3D.position.x = newX;
          }
          else if (canMoveZ) {
            this.object3D.position.y = this.baseY + Math.sin(this.time) * this.oscillationAmplitude;
            this.object3D.position.z = newZ;
          }
        } else {
          this.object3D.position.y = this.baseY;
        }
        this.metro++;
      }
    }
  }

  class windows93DotNet {
    constructor(x, y, z, scale, alive, texture, iconName) {
      this.name = iconName;
      this.type = 'desktop';
      this.metroMod = 10;
      this.life = 1993;
      this.speed = 0.25;
      this.angry = angry;
      this.object3D = new THREE.Object3D();
      const geometry = new THREE.PlaneGeometry(blockSize / 4, blockSize / 4);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        fog: false,
        transparent: true,
        depthTest: false
      });
      this.plane = new THREE.Mesh(geometry, material);
      this.plane.scale.set(scale * blockSize / 2, scale * blockSize / 2, scale * blockSize / 2);
      this.plane.position.y += 0.0425 * blockSize;
      this.object3D.add(this.plane);
      createTextOnPlane(iconName, "Tomo", fontPath, '#000000', '#FFFFFF', false).then(obj => {
        this.object3D.add(obj);
        obj.position.set(0, (-scale * blockSize) / 1.75, 0);
        obj.scale.set(scale / 2, scale / 2, scale / 2);
      });
      this.object3D.position.set(x, 0, z);
      this.metro = 0;
      this.moveX = 0;
      this.moveZ = 0;
      this.baseY = y;
      this.oscillationSpeed = 0.25;
      this.oscillationAmplitude = blockSize / 64;
      this.time = 0;
      this.playerPos = { x: camera.position.x, z: camera.position.z }
      this.prepareShot = false;
      this.texture = texture;
    }

    update(camera) {
      if (this.object3D.visible) {

        this.object3D.children.forEach((child, index) => {
          if (child.material && child.material.color) {
            child.material.fog = false;
          }
        });

        this.time += this.oscillationSpeed;

        if (this.metro % this.metroMod === 0) {

          if (angry == true) { this.angry = true }

          if (!this.prepareShot) {
            let dice = Math.floor(randomGenerator() * 6);
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            const right = new THREE.Vector3();
            right.crossVectors(direction, new THREE.Vector3(0, 1, 0));
            switch (dice) {
              case 0:
                this.moveX = direction.x * this.speed;
                this.moveZ = direction.z * this.speed;
                break;
              case 1:
                this.moveX = -direction.x * this.speed;
                this.moveZ = -direction.z * this.speed;
                break;
              case 2:
                this.moveX = -right.x * this.speed;
                this.moveZ = -right.z * this.speed;
                break;
              case 3:
                this.moveX = right.x * this.speed;
                this.moveZ = right.z * this.speed;
                break;
              case 4:
                this.prepareShot = true;
                this.playerPos = { x: camera.position.x, z: camera.position.z }
                break;
              case 5:
                this.prepareShot = true;
                this.playerPos = { x: camera.position.x, z: camera.position.z }
                break;
            }
          } else {
            this.prepareShot = false;
            if (this.angry) {
              const from = this.object3D.position.clone();
              const to = camera.position.clone();
              bullets.push(new Bullet(from, to, 3, textures.cursor, 5));
              scene.add(bullets[bullets.length - 1].mesh);
              sfxGenLaserShoot();
            }
          }
        }
        if (this.moveX !== 0 || this.moveZ !== 0) {
          const newX = this.object3D.position.x + this.moveX;
          const newZ = this.object3D.position.z + this.moveZ;
          const canMoveX = checkMobCollision({ x: newX, z: this.object3D.position.z }, blockSize / 3);
          const canMoveZ = checkMobCollision({ x: this.object3D.position.x, z: newZ }, blockSize / 3);
          if (canMoveX && canMoveZ) {
            this.object3D.position.y = this.baseY + Math.sin(this.time) * this.oscillationAmplitude;
            this.object3D.position.x = newX;
            this.object3D.position.z = newZ;
          }
          else if (canMoveX) {
            this.object3D.position.y = this.baseY + Math.sin(this.time) * this.oscillationAmplitude;
            this.object3D.position.x = newX;
          }
          else if (canMoveZ) {
            this.object3D.position.y = this.baseY + Math.sin(this.time) * this.oscillationAmplitude;
            this.object3D.position.z = newZ;
          }
        } else {
          this.object3D.position.y = this.baseY;
        }
        this.metro++;
      }
    }
  }

  function clearBullets() {
    for (let i = 0; i < bullets.length; i++) {
      let bullet = bullets[i];

      // Retirer le mesh de la scène
      scene.remove(bullet.mesh);

      // Libérer la géométrie et le matériau pour éviter les fuites de mémoire
      if (bullet.mesh.geometry) bullet.mesh.geometry.dispose();
      if (bullet.mesh.material) bullet.mesh.material.dispose();
    }

    // Vider le tableau
    bullets.length = 0;
  }


  class Bullet {
    constructor(from, to, speed = 1, texture, size = 1) {
      const geometry = new THREE.PlaneGeometry((blockSize / 2) * size, (blockSize / 2) * size);
      const material = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        fog: false
      });
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.position.copy(from);
      this.direction = new THREE.Vector3().subVectors(to, from).normalize();
      this.speed = speed;
      this.collisionRadius = (blockSize * 0.33) * size;
      this.maxDistance = 500;
      this.initialPosition = from.clone();
      this.rotationSpeed = 10 * size;
    }
    update(camera) {
      this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed));
      const z = this.mesh.rotation.z;
      this.mesh.lookAt(camera.position);
      this.mesh.rotation.z = z + this.rotationSpeed;
      if (this.checkPlayerCollision(camera.position)) {
        // console.log('joueur touché')
        aHurt.play();
        if (Object.keys(destroyedExt).length > 0) {
          let keys = Object.keys(destroyedExt);
          delete destroyedExt[keys[keys.length - 1]];
          refreshDestroyedIcons();
        } else {
          gameOver = true;
          if (ScriptNodePlayer.getInstance() != null) {
            if(ScriptNodePlayer.getInstance()._gainNode != undefined){
              ScriptNodePlayer.getInstance()._gainNode.gain.value = 0;
              ScriptNodePlayer.getInstance().pause();
            }
          }
          // tracks = shuffle(tracks);
          setTimeout(() => {
            reSpawn = true;
            sfxNoiseKill.play();
            audioTransition = true;
            sfxNoise(audioTransition, 0.025);
            // crosshair.style.display = "none";
            extDiv.innerHTML = '';
            desktopDiv.innerHTML = '';
          }, 500);
          //

        }
        pain = true;
        setTimeout(() => {
          pain = false;
        }, 300);
        return true;
      }
      if (this.checkMapCollision()) {
        return true;
      }
      const distanceFromStart = this.mesh.position.distanceTo(this.initialPosition);
      if (distanceFromStart > this.maxDistance) {
        return true;
      }
      return false;
    }
    checkPlayerCollision(playerPosition) {
      const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);
      return distanceToPlayer <= this.collisionRadius;
    }
    checkMapCollision() {
      const row = Math.floor(this.mesh.position.z / blockSize + 0.5);
      const col = Math.floor(this.mesh.position.x / blockSize + 0.5);
      if (row >= 0 && row < map.length && col >= 0 && col < map[row].length) {
        return map[row][col] === '1';
      }
      return false;
    }
  }

  class Sliver {
    constructor(positionFrom, speed = 0.25, texture, size = 1) {
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const uvs = new Float32Array([
        0, 0,
        1, 0,
        0, 1
      ]);
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      const uvAttribute = geometry.attributes.uv;
      for (let i = 0; i < uvAttribute.count; i++) {
        const zoom = 0.125; // (0.5 = * 2)
        const offsetX = Math.random();
        const offsetY = Math.random();
        uvAttribute.setX(i, offsetX + uvAttribute.getX(i) * zoom);
        uvAttribute.setY(i, offsetY + uvAttribute.getY(i) * zoom);
      }
      uvAttribute.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({
        color: 0x999999,
        side: THREE.DoubleSide,
        map: texture,
        transparent: true,
        fog: false
      });
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.rotation.x = Math.random() * Math.PI * 2;
      this.mesh.rotation.y = Math.random() * Math.PI * 2;
      this.mesh.rotation.z = Math.random() * Math.PI * 2;
      this.mesh.position.copy({
        x: positionFrom.x + (Math.random() - 0.5) * 2 * size,
        y: positionFrom.y + blockSize / 16 + (Math.random() - 0.5) * 2 * size,
        z: positionFrom.z + (Math.random() - 0.5) * 2 * size
      });
      this.mesh.scale.set(size, size, size);
      this.direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 3 - 1,
        Math.random() * 2 - 1
      ).normalize();
      this.speed = (Math.random() * (speed / 2) + speed / 2) * size;
      this.gravity = 0.1;
      this.maxFrames = (15 + Math.floor(Math.random() * 25)) * size;
      this.age = 0;
    }
    update(camera) {
      this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed));
      this.direction.y -= this.gravity;
      this.age++;
      return this.age >= this.maxFrames;
    }
  }

  async function generateIcon(icon, i) {
    const index = i;
    const textureLoader = new THREE.TextureLoader();
    let iconFile = await getIconFromPath(icon);
    const img = iconFile.image;
    let texture;
    let iconName = icon.substring(icon.lastIndexOf('/') + 1);
    let extention = iconName.split('.').pop();
    if (textures[img]) {
      texture = textures[img];
    } else {
      texture = await textureLoader.loadAsync(img);
    }
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    textures[img] = texture;
    const planeWidth = blockSize / 4;
    const planeHeight = blockSize / 4;
    let randomPosition = getRandomZeroPosition(map);
    if (extention === 'desktop') {
      iconName = iconName.slice(0, -extention.length - 1);
      let newDesktop = new DotDesktop(
        randomPosition.x * blockSize,
        blockSize / 8 + 0.275 * blockSize,
        randomPosition.z * blockSize,
        0.5,
        true,
        texture,
        iconName
      );
      mobs.push(newDesktop);
      if (deletedElements.includes(icon)) {
        newDesktop.object3D.visible = false;
      }
      newDesktop.object3D.iconFile = iconFile;
      iconsOrder.push(index);
      iconsGroup.add(newDesktop.object3D);
      return;
    }
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(planeWidth, planeHeight),
      new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
      })
    );
    plane.position.set(
      0,
      blockSize / 8,
      0
    );
    let iconGroup = new THREE.Object3D();
    iconGroup.iconFile = iconFile;
    iconGroup.add(plane);
    iconGroup.position.set(
      randomPosition.x * blockSize,
      blockSize / 8,
      randomPosition.z * blockSize
    );
    iconGroup.rotation.y = 0;
    createTextOnPlane(iconName, "Tomo", fontPath, '#000000', '#FFFFFF', true).then(obj => {
      iconGroup.add(obj);
      obj.position.set(
        0,
        -blockSize / 16,
        0
      );
      obj.scale.set(0.5, 0.5, 0.5);
    });
    if (deletedElements.includes(icon)) {
      iconGroup.visible = false;
    }
    iconsOrder.push(index);
    iconsGroup.add(iconGroup);
  }

  function spawnBoss(col, row) {
    let newDesktop = new windows93DotNet(
      col * blockSize,
      6 * blockSize,
      row * blockSize,
      10,
      true,
      textures.windows93,
      'https://windows93.net'
    );
    mobs.push(newDesktop);
    newDesktop.object3D.iconFile = { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAE9GlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4yLWMwMDAgNzkuMWI2NWE3OWI0LCAyMDIyLzA2LzEzLTIyOjAxOjAxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjMuNSAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMTktMTAtMTRUMTI6MTY6MTcrMDI6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDI0LTEwLTE0VDA5OjAyOjM1KzAyOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDI0LTEwLTE0VDA5OjAyOjM1KzAyOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxZTc2NDBjMy03ZWM1LTRkNzktYmNjNy1iZGU3YmNjOTRhOTQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MWU3NjQwYzMtN2VjNS00ZDc5LWJjYzctYmRlN2JjYzk0YTk0IiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6MWU3NjQwYzMtN2VjNS00ZDc5LWJjYzctYmRlN2JjYzk0YTk0Ij4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDoxZTc2NDBjMy03ZWM1LTRkNzktYmNjNy1iZGU3YmNjOTRhOTQiIHN0RXZ0OndoZW49IjIwMTktMTAtMTRUMTI6MTY6MTcrMDI6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyMy41IChNYWNpbnRvc2gpIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PvrcovsAAAC0SURBVDiNpVPBDcMgDDwji1e3YJe+Mm5e3SVb9IUiuY/UrnEJCspJkYjxnY05SERwB3wxL1ahqwJn7Wmc+PtDgyS88Gg2nnhbTuoQJJKXXC1pybURTKH69ERTcecJn2GtubvWDgAAKlQAKROdpM1VOyPGGXjwThAW0PZ/Eya21mzEeATzgQrtdBA59BKJJsDyq6zkCHfvAFpfkByPYWikEbyVVahHPJ0PY2ykXmc+LtwJzoA+CF1AGpc7dfwAAAAASUVORK5CYII=' };
    iconsGroup.add(newDesktop.object3D);
    iconsOrder = [];
    iconsOrder.push(0);
  }

  function generateRoom(height) {
    let folders;
    if (currentRoom == '../') {
      folders = [];
      icons = [];
    } else {
      folders = getRoom(currentRoom).filter(item => item.endsWith('/'));
      icons = getRoom(currentRoom).filter(path => !path.endsWith('/'));
    }
    let optimalGridSize = calculateOptimalGridSize(icons.length);
    mobs = [];
    iconsOrder = [];
    availablePositions = null;
    let i = 0;
    iconsGroup = new THREE.Object3D();
    scene.add(iconsGroup)
    icons.forEach(icon => {
      generateIcon(icon, i);
      i++;
    });
    const wallMaterial = new THREE.MeshStandardMaterial({ map: textures.wall });
    const cellBlockMaterial = new THREE.MeshStandardMaterial({ map: textures.cellBlock });
    const doorMaterial = new THREE.MeshStandardMaterial({ map: textures.door, side: THREE.DoubleSide });
    const floorMaterial = new THREE.MeshStandardMaterial({ map: textures.floor });
    const ceilingMaterial = new THREE.MeshStandardMaterial({ map: textures.ceiling, side: THREE.BackSide });
    for (let row = 0; row < map.length; row++) {
      for (let col = 0; col < map[row].length; col++) {
        if (map[row][col] === '@') {
          let playerPositionRound = { x: Math.round(camera.position.x / blockSize), z: Math.round(camera.position.z / blockSize) }
          playerPositionCompensator = { x: camera.position.x - playerPositionRound.x * blockSize, z: camera.position.z - playerPositionRound.z * blockSize }
          playerPosition = { x: col * blockSize, z: row * blockSize };
          map[row][col] = '2';
        }
        if (map[row][col] === '1') {
          const cubeGeometry = new THREE.BoxGeometry(blockSize, blockSize * 2, blockSize);
          const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
          cube.position.set(col * blockSize, (blockSize * 2) / 2, row * blockSize);
          cube.visible = currentRoom != '../';
          scene.add(cube);
        } else if (map[row][col] === '2') {
          const cubeGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
          const cube = new THREE.Mesh(cubeGeometry, cellBlockMaterial);
          cube.position.set(col * blockSize, blockSize * 1.5, row * blockSize);
          cube.visible = currentRoom != '../';
          scene.add(cube);
        } else if (map[row][col] === '3') {
          const cubeGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
          const cube = new THREE.Mesh(cubeGeometry, doorMaterial);
          cube.position.set(col * blockSize, blockSize / 2, row * blockSize);
          cube.visible = currentRoom != '../';
          scene.add(cube);
          let text = currentRoom.replace(/\/[^\/]*\/$/, '/').split('/').filter(Boolean).pop();
          if (text == undefined && currentRoom == '/') {
            text = '/..';
          }
          createTextOnPlane(text, "Tomo", fontPath, '#FFFFFF', '#000000', false).then(obj => {
            scene.add(obj);
            obj.position.set(col * blockSize, blockSize * 1.15, (row - corridorsLength + 0.425) * blockSize);
            obj.rotation.set(0, Math.PI, 0);
          });
        } else if (map[row][col].startsWith('F')) {
          const cubeGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
          const cube = new THREE.Mesh(cubeGeometry, cellBlockMaterial);
          cube.position.set(col * blockSize, blockSize * 1.5, row * blockSize);
          scene.add(cube);
          cube.visible = currentRoom != '../';
          let num = Number(map[row][col].slice(1));
          if (num != 0) {
            let text = folders[num - 1].split('/').filter(Boolean).pop();
            createTextOnPlane(text, "Tomo", fontPath, '#FFFFFF', '#000000', false).then(obj => {
              scene.add(obj);
              obj.position.set(col * blockSize, blockSize * 1.15, (row + corridorsLength * 1.4) * blockSize);
            });
          } else {
            let text = currentRoom.replace(/\/[^\/]*\/$/, '/').split('/').filter(Boolean).pop();
            if (text == undefined && currentRoom != '/') {
              text = '/';
            }
            createTextOnPlane(text, "Tomo", fontPath, '#FFFFFF', '#000000', false).then(obj => {
              scene.add(obj);
              obj.position.set(col * blockSize, blockSize * 1.15, (row - corridorsLength + 0.425) * blockSize);
              obj.rotation.set(0, Math.PI, 0);
            });

          }
        } else if (map[row][col].startsWith('B')) {

          spawnBoss(col, row);

        }
      }
    }



    const floorWidth = map[0].length * blockSize;
    const floorHeight = map.length * blockSize;

    if (currentRoom != '../') {
      const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(floorWidth / 2 - blockSize / 2, 0, floorHeight / 2 - blockSize / 2);
      floor.visible = currentRoom != '../';
      scene.add(floor);

    } else {
      const floorMaterial = new THREE.MeshBasicMaterial({ map: textures.floor });
      const floorGeometry = new THREE.PlaneGeometry(10000, 10000); // large
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.position.set(0, 0, 0);
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);
    }



    const ceilingGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = -Math.PI / 2;
    ceiling.position.set(floorWidth / 2 - blockSize / 2, blockSize * 2, floorHeight / 2 - blockSize / 2);
    ceiling.visible = currentRoom != '../';
    scene.add(ceiling);
    // }
    textures.floor.wrapS = textures.floor.wrapT = THREE.RepeatWrapping;
    textures.ceiling.wrapS = textures.ceiling.wrapT = THREE.RepeatWrapping;
    textures.floor.repeat.set(map[0].length * 2, map.length * 2);
    textures.ceiling.repeat.set(map[0].length * 4, map.length * 4);
    textures.wall.wrapS = textures.wall.wrapT = THREE.RepeatWrapping;
    textures.cellBlock.wrapS = textures.cellBlock.wrapT = THREE.RepeatWrapping;
    textures.wall.repeat.set(4, 8);
    textures.cellBlock.repeat.set(4, 4);
    screenEl.style.background = "#111111";

    if (currentRoom == '../') {
      screenEl.style.background = "#CCCCCC";
      textures.floor.repeat.set(2000, 2000);
    }
    if (currentRoom == '/') {
      screenEl.style.background = "#CCCCCC";
    }
  }

  function placePlayer() {
    if (playerPosition) {
      camera.position.set(playerPosition.x + playerPositionCompensator.x, blockSize / 3, playerPosition.z + playerPositionCompensator.z);
    }
  }

  let ambientLight
  let directionalLight
  let pointLight

  function addLight() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 3);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10).normalize();
    scene.add(directionalLight);
    const pointLight = new THREE.PointLight(0xffffff, 10, 50);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);
    scene.fog = new THREE.Fog(0x111111, -10, 35);
  }

  let textures = {};
  const textureSize = 4;

  map = folderToMap(getRoom(currentRoom));
  loadTextures().then(() => {
    generateRoom(4);
    placePlayer();
    addLight();
    animate();
  }).catch(error => {
    console.error(error);
  });
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

function seedRandom(seed) {
  let seedHash = xmur3(seed);
  return sfc32(seedHash(), seedHash(), seedHash(), seedHash());
}

function calculateOptimalGridSize(numElements) {
  const sqrt = Math.sqrt(numElements);
  let width = Math.ceil(sqrt);
  let height = Math.floor(sqrt);
  while (width * height < numElements) {
    height++;
  }
  return { width: width, height: height };
}

function getGridPosition(index, width) {
  const x = index % width;
  const z = Math.floor(index / width);
  return { x, z };
}

const fontCache = {};

function loadFontOnce(fontName, fontUrl) {
  if (fontCache[fontName]) {
    return Promise.resolve();
  }
  const font = new FontFace(fontName, `url(${fontUrl})`);
  return font.load().then((loadedFont) => {
    document.fonts.add(loadedFont);
    fontCache[fontName] = true;
  });
}

async function createTextOnPlane(text, fontName, fontUrl, color, shadowColor, fog) {
  let txt = text;
  if (text == undefined && currentRoom == '/c/') {
    txt = "/";
  }
  if (text == undefined && currentRoom == '/') {
    txt = "/..";
  }
  await loadFontOnce(fontName, fontUrl);
  const obj = new THREE.Object3D();
  const charWidth = 60; // 32;
  const fontSize = 120; // 48;
  // const charHeight = fontSize;
  const color0x = parseInt(color.replace('#', ''), 16);
  const shadowColor0x = parseInt(shadowColor.replace('#', ''), 16);
  const canvasWidth = charWidth * txt.length; // charWidth * txt.length + charWidth * 2;
  const canvasHeight = fontSize; // fontSize + 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext('2d');
  context.font = `Bold ${fontSize}px/1.2 ${fontName}`;
  context.fillStyle = '#ffffff';
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.fillText(txt, 1, 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  let planeSize = 1.125;
  const aspectRatio = (canvasWidth / canvasHeight) * planeSize;
  const planeHeight = (planeSize);
  const planeWidth = (planeHeight * aspectRatio);
  let material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    fog: fog,
    side: THREE.DoubleSide,
    color: color0x,
    depthTest: true,
  });
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  let plane = new THREE.Mesh(geometry, material);
  obj.add(plane)
  material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    fog: true,
    side: THREE.DoubleSide,
    color: shadowColor0x
  });
  plane = new THREE.Mesh(geometry, material);
  plane.position.z = -blockSize / 40;
  obj.add(plane);
  return obj;
}

let virusIcon
let doctorIcon

async function notification(msg, entity = "trojan") {
  // console.log('<' + entity + '> ' + msg);
  await window.top.sys42.apps.ready
  const isEntityVirus = entity === "trojan"

  if (isEntityVirus) {
    virusIcon ??= window.top.sys42.apps.getAppIcon("trojan", "16x16")
    window.top.sys42.toast(msg, {
      label: "Trojan",
      picto: virusIcon,
      timeout: 1500
    })
  } else {
    doctorIcon ??= window.top.sys42.apps.getAppIcon("doctor", "16x16")
    window.top.sys42.toast(msg, {
      picto: doctorIcon,
      label: "Dr. Marburg Antivirus",
      timeout: 15_000
    })
  }
}

/*
sounds
*/

let noiseNode;

function drawWhiteNoise(pixelSize = 10) {
  const ctx = canvas2D.getContext('2d');
  const width = canvas2D.width;
  const height = canvas2D.height;
  const offsetX = -(Math.floor(width / 2) % pixelSize);
  const offsetY = -(Math.floor(height / 2) % pixelSize);
  for (let y = offsetY; y < height + pixelSize; y += pixelSize) {
    for (let x = offsetX; x < width + pixelSize; x += pixelSize) {
      const randomValue = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgb(${randomValue}, ${randomValue}, ${randomValue})`;
      ctx.fillRect(x, y, pixelSize, pixelSize);
    }
  }
}

function sfxNoise(play, volume = 0.1) {
  const audioContext = ScriptNodePlayer.getWebAudioContext();
  if (!play && noiseNode) {
    noiseNode.stop();
    noiseNode.disconnect();
    noiseNode = null;
    return;
  }
  if (play && noiseNode) {
    return;
  }
  const bufferSize = 2 * audioContext.sampleRate;
  const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  noiseNode = audioContext.createBufferSource();
  noiseNode.buffer = noiseBuffer;
  noiseNode.loop = true;
  const gainNode = audioContext.createGain();
  gainNode.gain.value = volume;
  noiseNode.connect(gainNode);
  gainNode.connect(audioContext.destination);
  noiseNode.start();
}

let sound;
sound = {
  "oldParams": true,
  "wave_type": 1,
  "p_env_attack": 0,
  "p_env_sustain": 0.23631796728703272,
  "p_env_punch": 0,
  "p_env_decay": 0.3967646072833308,
  "p_base_freq": 0.7373825456844456,
  "p_freq_limit": 0.0356484626126512,
  "p_freq_ramp": -0.4082653336791494,
  "p_freq_dramp": 0,
  "p_vib_strength": 0,
  "p_vib_speed": 0,
  "p_arp_mod": 0,
  "p_arp_speed": 0,
  "p_duty": 0.8610861274229454,
  "p_duty_ramp": -0.497793022198958,
  "p_repeat_speed": 0,
  "p_pha_offset": 0.14382557782896851,
  "p_pha_ramp": -0.033770169152664974,
  "p_lpf_freq": 1,
  "p_lpf_ramp": 0,
  "p_lpf_resonance": 0,
  "p_hpf_freq": 0.23463729700454047,
  "p_hpf_ramp": 0,
  "sound_vol": 0.115,
  "sample_rate": 44100,
  "sample_size": 8
}
let sfxShoot = sfxr.toAudio(sound);

sound = {
  "oldParams": true,
  "wave_type": 1,
  "p_env_attack": 0,
  "p_env_sustain": 0.199,
  "p_env_punch": 0,
  "p_env_decay": 0.181,
  "p_base_freq": 0.782,
  "p_freq_limit": 0.0356484626126512,
  "p_freq_ramp": -0.504,
  "p_freq_dramp": 0,
  "p_vib_strength": 0,
  "p_vib_speed": 0,
  "p_arp_mod": 0,
  "p_arp_speed": 0.096,
  "p_duty": 0.8610861274229454,
  "p_duty_ramp": -0.497793022198958,
  "p_repeat_speed": 0,
  "p_pha_offset": 0.14382557782896851,
  "p_pha_ramp": -0.033770169152664974,
  "p_lpf_freq": 1,
  "p_lpf_ramp": 0,
  "p_lpf_resonance": 0,
  "p_hpf_freq": 0.23463729700454047,
  "p_hpf_ramp": 0,
  "sound_vol": 0.101,
  "sample_rate": 44100,
  "sample_size": 8
}
let sfxMobShoot = sfxr.toAudio(sound);

sound = {
  "oldParams": true,
  "wave_type": 0,
  "p_env_attack": 0,
  "p_env_sustain": 0.12802335297228293,
  "p_env_punch": 0,
  "p_env_decay": 0.20124035885121883,
  "p_base_freq": 0.263,
  "p_freq_limit": 0.032104020465880234,
  "p_freq_ramp": -0.309,
  "p_freq_dramp": 0,
  "p_vib_strength": 0,
  "p_vib_speed": 0,
  "p_arp_mod": 0,
  "p_arp_speed": 0,
  "p_duty": 0.07900171343487461,
  "p_duty_ramp": 0.11793740203383747,
  "p_repeat_speed": 0,
  "p_pha_offset": 0,
  "p_pha_ramp": 0,
  "p_lpf_freq": 1,
  "p_lpf_ramp": 0,
  "p_lpf_resonance": 0,
  "p_hpf_freq": 0.03572887470230177,
  "p_hpf_ramp": 0,
  "sound_vol": 0.1,
  "sample_rate": 44100,
  "sample_size": 8
}

let sfxShootHit = sfxr.toAudio(sound);

sound = {
  "oldParams": true,
  "wave_type": 3,
  "p_env_attack": 0,
  "p_env_sustain": 0.22751576159843553,
  "p_env_punch": 0.6977127378788313,
  "p_env_decay": 0.40791368978091347,
  "p_base_freq": 0.07987889750779116,
  "p_freq_limit": 0,
  "p_freq_ramp": 0,
  "p_freq_dramp": 0,
  "p_vib_strength": 0.04579729379526397,
  "p_vib_speed": 0.3466773205263349,
  "p_arp_mod": 0,
  "p_arp_speed": 1,
  "p_duty": 0,
  "p_duty_ramp": 0,
  "p_repeat_speed": 0.587244019294496,
  "p_pha_offset": 0.53,
  "p_pha_ramp": -0.503,
  "p_lpf_freq": 0.421,
  "p_lpf_ramp": 1,
  "p_lpf_resonance": 0,
  "p_hpf_freq": 0,
  "p_hpf_ramp": 0,
  "sound_vol": 0.13,
  "sample_rate": 44100,
  "sample_size": 8
};
let sfxNoiseKill = sfxr.toAudio(sound);

sound = {
  "oldParams": true,
  "wave_type": 1,
  "p_env_attack": 0.0002427195543364217,
  "p_env_sustain": 0.4128823798930348,
  "p_env_punch": 0.23489820341174994,
  "p_env_decay": -0.092021576575394,
  "p_base_freq": 1.006295732319059,
  "p_freq_limit": 0,
  "p_freq_ramp": -0.000014396112795052094,
  "p_freq_dramp": 0.0225925228860464,
  "p_vib_strength": 0.0025809156887610565,
  "p_vib_speed": -0.07908533816343821,
  "p_arp_mod": -0.1545460257318405,
  "p_arp_speed": 0.4740883833897098,
  "p_duty": -0.13749391543793266,
  "p_duty_ramp": 0.5491614514144287,
  "p_repeat_speed": -0.6491354587894906,
  "p_pha_offset": 0.9396343883508549,
  "p_pha_ramp": -0.01913624365092994,
  "p_lpf_freq": 0.8773076871070487,
  "p_lpf_ramp": 0.07370800622426259,
  "p_lpf_resonance": -0.9784429917931989,
  "p_hpf_freq": 0.000013371676885300717,
  "p_hpf_ramp": 0.0706296406389914,
  "sound_vol": 0.07,
  "sample_rate": 44100,
  "sample_size": 16
}
let sfxNope = sfxr.toAudio(sound);

function gen(fx, volume = 0.25) {
  let PARAMS
  const SOUND_VOL = volume
  const SAMPLE_RATE = 44_100
  const SAMPLE_SIZE = 8
  PARAMS = new Params()
  PARAMS.sound_vol = SOUND_VOL
  PARAMS.sample_rate = SAMPLE_RATE
  PARAMS.sample_size = SAMPLE_SIZE
  if (fx.indexOf("#") == 0) {
    PARAMS.fromB58(fx.slice(1))
  } else {
    PARAMS[fx]()
  }

  PARAMS.p_env_attack = 0
  PARAMS.p_env_sustain = 0.073
  PARAMS.p_env_punch = 0
  return PARAMS
}

function sfxGenHurt() {
  const x = gen('hitHurt', 0.1);
  sfxr.toAudio(x).play();
}

function sfxGenExplosion() {
  const x = gen('explosion', 0.1);
  sfxr.toAudio(x).play();
}

function sfxGenPowerUp() {
  const x = gen('powerUp', 0.075);
  sfxr.toAudio(x).play();
}

function sfxGenLaserShoot() {
  const x = {
    "oldParams": true,
    "wave_type": 0,
    "p_env_attack": 0,
    "p_env_sustain": 0.21201563786909766,
    "p_env_punch": 0.2626979041961854,
    "p_env_decay": 0.2 + Math.random() * 0.1,
    "p_base_freq": 0.5 + Math.random() * 0.3,
    "p_freq_limit": 0.2,
    "p_freq_ramp": -0.2854944949986903,
    "p_freq_dramp": 0,
    "p_vib_strength": 0,
    "p_vib_speed": 0,
    "p_arp_mod": 0,
    "p_arp_speed": 0,
    "p_duty": 0.5490879458069335,
    "p_duty_ramp": -0.4431071577869329,
    "p_repeat_speed": 0,
    "p_pha_offset": 0,
    "p_pha_ramp": 0,
    "p_lpf_freq": 1,
    "p_lpf_ramp": 0,
    "p_lpf_resonance": 0,
    "p_hpf_freq": 0.1601538740472885,
    "p_hpf_ramp": 0,
    "sound_vol": 0.07,
    "sample_rate": 44100,
    "sample_size": 8
  }
  sfxr.toAudio(x).play();
}

sound = {
  "oldParams": true,
  "wave_type": 3,
  "p_env_attack": 0,
  "p_env_sustain": 0.19154529378025287,
  "p_env_punch": 0.7549415527015575,
  "p_env_decay": 0.3069437536154961,
  "p_base_freq": 0.10238680335626701,
  "p_freq_limit": 0,
  "p_freq_ramp": 0.2920148309012838,
  "p_freq_dramp": 0,
  "p_vib_strength": 0.6437597776171173,
  "p_vib_speed": 0.5656234872324643,
  "p_arp_mod": 0.39378247808523315,
  "p_arp_speed": 0.8510344875584128,
  "p_duty": 0,
  "p_duty_ramp": 0,
  "p_repeat_speed": 0,
  "p_pha_offset": 0,
  "p_pha_ramp": 0,
  "p_lpf_freq": 1,
  "p_lpf_ramp": 0,
  "p_lpf_resonance": 0,
  "p_hpf_freq": 0,
  "p_hpf_ramp": 0,
  "sound_vol": 0.1,
  "sample_rate": 44100,
  "sample_size": 16
}
let aStrike = sfxr.toAudio(sound);

sound = {
  "oldParams": true,
  "wave_type": 1,
  "p_env_attack": 0.183,
  "p_env_sustain": 0.385,
  "p_env_punch": 0.227,
  "p_env_decay": 0.546,
  "p_base_freq": 0.736,
  "p_freq_limit": 0.298,
  "p_freq_ramp": -0.482,
  "p_freq_dramp": 0.048,
  "p_vib_strength": 0.252,
  "p_vib_speed": 0.201,
  "p_arp_mod": -1,
  "p_arp_speed": 0,
  "p_duty": 0.177,
  "p_duty_ramp": 1,
  "p_repeat_speed": 0.901,
  "p_pha_offset": 0.423,
  "p_pha_ramp": -0.825,
  "p_lpf_freq": 0.371,
  "p_lpf_ramp": -0.391,
  "p_lpf_resonance": 0.151,
  "p_hpf_freq": 0.367,
  "p_hpf_ramp": 0.387,
  "sound_vol": .4,
  "sample_rate": 44100,
  "sample_size": 16
}
let aHurt = sfxr.toAudio(sound);

sound = {
  "oldParams": true,
  "wave_type": 2,
  "p_env_attack": 0.153,
  "p_env_sustain": 0.348,
  "p_env_punch": 0.123,
  "p_env_decay": 0.318,
  "p_base_freq": 0.183,
  "p_freq_limit": 0,
  "p_freq_ramp": 0.427,
  "p_freq_dramp": 0.006,
  "p_vib_strength": 0.128,
  "p_vib_speed": 0.481,
  "p_arp_mod": -0.748,
  "p_arp_speed": 0.7382962551465724,
  "p_duty": 0,
  "p_duty_ramp": -1,
  "p_repeat_speed": 0.626,
  "p_pha_offset": 0.661,
  "p_pha_ramp": 0.105,
  "p_lpf_freq": 0.051,
  "p_lpf_ramp": 0.549,
  "p_lpf_resonance": 0.217,
  "p_hpf_freq": 0,
  "p_hpf_ramp": -0.561,
  "sound_vol": 0.32,
  "sample_rate": 44100,
  "sample_size": 16
};
let sfxStart = sfxr.toAudio(sound);

sound = {
  "oldParams": true,
  "wave_type": 0,
  "p_env_attack": 0.714133212895319517,
  "p_env_sustain": 1,
  "p_env_punch": 0.00003741135189218577,
  "p_env_decay": 1,
  "p_base_freq": 0.329928559881552,
  "p_freq_limit": 0,
  "p_freq_ramp": 0.15059389306484455,
  "p_freq_dramp": 0.0070765827024583915,
  "p_vib_strength": -0.04380375037778189,
  "p_vib_speed": -0.11926245033378802,
  "p_arp_mod": -0.03398055075094408,
  "p_arp_speed": -0.18083767170366993,
  "p_duty": -0.7335196908958288,
  "p_duty_ramp": -0.3552740667023875,
  "p_repeat_speed": 0.173,
  "p_pha_offset": 0.07578749091547986,
  "p_pha_ramp": 0.0029494555402028114,
  "p_lpf_freq": 0.9999957411249757,
  "p_lpf_ramp": 0.002995502111355711,
  "p_lpf_resonance": -0.4880011503985915,
  "p_hpf_freq": 0.5320724525232438,
  "p_hpf_ramp": 0.2677101369644506,
  "sound_vol": 0.15,
  "sample_rate": 44100,
  "sample_size": 8
}
let sfxSiren = sfxr.toAudio(sound);

sound = {
  "oldParams": true,
  "wave_type": 1,
  "p_env_attack": 0.29887441637183915,
  "p_env_sustain": 0.377,
  "p_env_punch": 0,
  "p_env_decay": 0.252,
  "p_base_freq": 1,
  "p_freq_limit": 0,
  "p_freq_ramp": -0.29567079733600776,
  "p_freq_dramp": 0,
  "p_vib_strength": 0,
  "p_vib_speed": 0,
  "p_arp_mod": 0,
  "p_arp_speed": 0,
  "p_duty": 1,
  "p_duty_ramp": 0,
  "p_repeat_speed": 0,
  "p_pha_offset": 0,
  "p_pha_ramp": 0,
  "p_lpf_freq": 1,
  "p_lpf_ramp": 0,
  "p_lpf_resonance": 0,
  "p_hpf_freq": 0.913089821209456,
  "p_hpf_ramp": 0,
  "sound_vol": 0.175,
  "sample_rate": 44100,
  "sample_size": 16
}
let sfxDoor = sfxr.toAudio(sound);

// ost
let audioTrack = 0;
let basePath = "";
let tracks = getRoom(appPath + '/music/');
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
tracks = shuffle(tracks);

function doOnPlayerReady() {
  setTimeout(() => {
    if (!gameOver && !finished) {
      var p = ScriptNodePlayer.getInstance();
      var options = {};
      p.loadMusicFromURL(tracks[audioTrack], options, (function (filename) { }), (function () { }.bind(this)), (function (total, loaded) { }));
      setTimeout(() => {
        audioTransition = true;
        sfxNoise(audioTransition)
      }, (ScriptNodePlayer.getInstance().getMaxPlaybackPosition() - 100));
    }
  }, 100);
}

function doOnTrackReadyToPlay() {
  if (!angry) {
    ScriptNodePlayer.getInstance().play();
  }
}

function doOnTrackEnd() {
  audioTransition = true;
  sfxNoise(audioTransition)
  setTimeout(() => {
    audioTrack++;
    if (audioTrack >= tracks.length) {
      audioTrack = 0;
    }
    var p = ScriptNodePlayer.getInstance();
    var options = {};
    p.loadMusicFromURL(tracks[audioTrack], options, (function (filename) { }), (function () { }.bind(this)), (function (total, loaded) { }));
    notification('playing: ' + tracks[audioTrack])
    setTimeout(() => {
      audioTransition = true;
      sfxNoise(audioTransition)
    }, (ScriptNodePlayer.getInstance().getMaxPlaybackPosition() - 100));
    audioTransition = false;
    sfxNoise(audioTransition)
    sfxGenPowerUp();
  }, 100);
}

function initOst() {
  if (ScriptNodePlayer.getInstance() == null) {
    setTimeout(() => {
      sfxSiren.play();
    }, 750);
    setTimeout(() => {
      if (!gameOver) {
        ScriptNodePlayer.createInstance(new MDXBackendAdapter(), basePath, tracks, true, doOnPlayerReady, doOnTrackReadyToPlay, doOnTrackEnd);
      }
    }, 2000);
    return;
  }

  if (ScriptNodePlayer.getInstance()._backendAdapter()._isPaused) {
    setTimeout(() => {
      sfxSiren.play();
    }, 750);
    setTimeout(() => {
      if (!gameOver) {
        ScriptNodePlayer.createInstance(new MDXBackendAdapter(), basePath, tracks, true, doOnPlayerReady, doOnTrackReadyToPlay, doOnTrackEnd);
      }
    }, 2000);
    return;
  }

}

function fadeOutAudio(duration = 5000) {
  const player = ScriptNodePlayer.getInstance();
  const initialGain = player._gainNode.gain.value;
  const steps = 100;
  const intervalDuration = duration / steps;
  const stepSize = initialGain / steps;
  let currentStep = 0;
  const interval = setInterval(() => {
    currentStep++;
    const newGain = initialGain - (currentStep * stepSize);
    player._gainNode.gain.value = Math.max(newGain, 0);
    if (currentStep >= steps || player._gainNode.gain.value <= 0) {
      ScriptNodePlayer.getInstance().pause();
      clearInterval(interval);
    }
  }, intervalDuration);
}

setup();
initThreeJS();
