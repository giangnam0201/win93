"use strict"
const Wipeout = function (containerId, width, height) {
  this.renderer = new THREE.WebGLRenderer({ antialias: true })
  this.renderer.setSize(width, height)
  this.renderer.setClearColor(0x00_00_00)
  this.container = document.getElementById(containerId)
  this.container.append(this.renderer.domElement)
  this.width = width
  this.height = height

  this.activeCameraMode = "fly"

  window.addEventListener("resize", this.resize.bind(this), true)
  this.clear()
  this.animate()
}

Wipeout.prototype.clear = function () {
  this.scene = new THREE.Scene()
  this.sprites = []

  // Add Camera and controls for orbit
  this.camera = new THREE.PerspectiveCamera(
    45,
    this.width / this.height,
    64,
    2_048_576,
  )
  this.camera.position.set(0, 10_000, 50_000)
  this.camera.rotation.order = "YZX"

  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement)
  this.controls.damping = 0.2
  this.controls.zoomSpeed = 2

  // Add Camera for fly through
  this.splineCamera = new THREE.PerspectiveCamera(
    84,
    window.innerWidth / window.innerHeight,
    64,
    2_048_576,
  )
  this.splineCamera.currentLookAt = new THREE.Vector3(0, 0, 0)
  this.splineCamera.roll = 0
  this.splineCamera.rotation.order = "YZX"

  this.cameraSpline = null
  this.sceneMaterial = {}
  this.trackMaterial = null
  this.weaponTileMaterial = null

  this.startTime = Date.now()
  this.ticks = 0
}

Wipeout.prototype.resize = function () {
  this.width = window.innerWidth
  this.height = window.innerHeight

  this.camera.aspect = this.width / this.height
  this.camera.updateProjectionMatrix()

  this.splineCamera.aspect = this.width / this.height
  this.splineCamera.updateProjectionMatrix()

  this.renderer.setSize(window.innerWidth, window.innerHeight)
}

Wipeout.prototype.animate = function () {
  this.rafId = requestAnimationFrame(this.animate.bind(this))
  const time = Date.now()

  // Update weapon tile color
  if (this.weaponTileMaterial) {
    this.updateWeaponMaterial(time)
  }

  // Camera is in fly mode and we have a spline to follow?
  if (this.activeCameraMode === "fly" && this.cameraSpline) {
    const elapsedTime = time - this.startTime
    const elapsedTicks = (elapsedTime / 1000) * 60

    // Fixed time step loop (60hz)
    while (this.ticks < elapsedTicks) {
      this.updateSplineCamera()
      this.ticks++
    }

    this.rotateSpritesToCamera(this.splineCamera)
    this.renderer.render(this.scene, this.splineCamera)
  }

  // Default Orbit camera
  else {
    this.controls.update()
    this.rotateSpritesToCamera(this.camera)
    this.renderer.render(this.scene, this.camera)
  }
}

Wipeout.prototype.updateSplineCamera = function () {
  const damping = 0.9
  const time = (this.ticks * 1000) / 60

  const loopTime = this.cameraSpline.points.length * 100

  // Camera position along the spline
  const tmod = (time % loopTime) / loopTime
  const cameraPos = this.cameraSpline.getPointAt(tmod).clone()
  this.splineCamera.position.multiplyScalar(damping).add(
    cameraPos
      .clone()
      .add({ x: 0, y: 600, z: 0 })
      .multiplyScalar(1 - damping),
  )

  // Camera lookAt along the spline
  const tmodLookAt = ((time + 800) % loopTime) / loopTime
  const lookAtPos = this.cameraSpline.getPointAt(tmodLookAt).clone()
  this.splineCamera.currentLookAt = this.splineCamera.currentLookAt
    .multiplyScalar(damping)
    .add(lookAtPos.clone().multiplyScalar(1 - damping))
  this.splineCamera.lookAt(this.splineCamera.currentLookAt)

  // Roll into corners - there's probably an easier way to do this. This
  // takes the angle between the current camera position and the current
  // lookAt, applies some damping and rolls the camera along its view vector
  const cn = cameraPos.sub(this.splineCamera.position)
  const tn = lookAtPos.sub(this.splineCamera.currentLookAt)
  let roll = Math.atan2(cn.z, cn.x) - Math.atan2(tn.z, tn.x)
  roll += roll > Math.PI ? -Math.PI * 2 : roll < -Math.PI ? Math.PI * 2 : 0

  this.splineCamera.roll = this.splineCamera.roll * 0.95 + roll * 0.1
  this.splineCamera.up = new THREE.Vector3(0, 1, 0).applyAxisAngle(
    this.splineCamera.position
      .clone()
      .sub(this.splineCamera.currentLookAt)
      .normalize(),
    this.splineCamera.roll * 0.25,
  )
}

Wipeout.prototype.rotateSpritesToCamera = function (camera) {
  for (let i = 0; i < this.sprites.length; i++) {
    this.sprites[i].rotation.y = camera.rotation.y
  }
}

Wipeout.prototype.updateWeaponMaterial = function (time) {
  // Purple -> blue -> cyan -> yellow -> amber (never 100% red or green)
  const colors = [0x80_00_80, 0x00_00_ff, 0x00_ff_ff, 0xff_ff_00, 0xff_80_00]
  const t = time / 1050
  const index = Math.floor(t)
  const alpha = t - index

  const colorA = new THREE.Color(colors[index % colors.length])
  const colorB = new THREE.Color(colors[(index + 1) % colors.length])
  this.weaponTileMaterial.color = colorA.lerp(colorB, alpha).multiplyScalar(1.5)
}

// ----------------------------------------------------------------------------
// Wipeout Data Types

// .TRV Files ---------------------------------------------

Wipeout.TrackVertex = Struct.create(
  Struct.int32("x"),
  Struct.int32("y"),
  Struct.int32("z"),
  Struct.int32("padding"),
)

// .TRF Files ---------------------------------------------

Wipeout.TrackFace = Struct.create(
  Struct.array("indices", Struct.uint16(), 4),
  Struct.int16("normalx"),
  Struct.int16("normaly"),
  Struct.int16("normalz"),
  Struct.uint8("tile"),
  Struct.uint8("flags"),
  Struct.uint32("color"),
)

Wipeout.TrackFace.FLAGS = {
  WALL: 0,
  TRACK: 1,
  WEAPON: 2,
  FLIP: 4,
  WEAPON_2: 8,
  UNKNOWN: 16,
  BOOST: 32,
}

// .TTF Files ---------------------------------------------

Wipeout.TrackTextureIndex = Struct.create(
  Struct.array("near", Struct.uint16(), 16), // 4x4 tiles
  Struct.array("med", Struct.uint16(), 4), // 2x2 tiles
  Struct.array("far", Struct.uint16(), 1), // 1 tile
)

// .TRS Files ---------------------------------------------

Wipeout.TrackSection = Struct.create(
  Struct.int32("nextJunction"),
  Struct.int32("previous"),
  Struct.int32("next"),
  Struct.int32("x"),
  Struct.int32("y"),
  Struct.int32("z"),
  Struct.skip(116),
  Struct.uint32("firstFace"),
  Struct.uint16("numFaces"),
  Struct.skip(4),
  Struct.uint16("flags"),
  Struct.skip(4),
)

// .TEX Files ---------------------------------------------

Wipeout.TrackTexture = Struct.create(
  Struct.uint8("tile"),
  Struct.uint8("flags"),
)

Wipeout.TrackSection.FLAGS = {
  JUMP: 1,
  JUNCTION_END: 8,
  JUNCTION_START: 16,
  JUNCTION: 32,
}

// .PRM Files ---------------------------------------------

Wipeout.Vector3 = Struct.create(
  Struct.int32("x"),
  Struct.int32("y"),
  Struct.int32("z"),
)

Wipeout.Vertex = Struct.create(
  Struct.int16("x"),
  Struct.int16("y"),
  Struct.int16("z"),
  Struct.int16("padding"),
)

Wipeout.UV = Struct.create(Struct.uint8("u"), Struct.uint8("v"))

Wipeout.ObjectHeader = Struct.create(
  Struct.string("name", 15),
  Struct.skip(1),
  Struct.uint16("vertexCount"),
  Struct.skip(14),
  Struct.uint16("polygonCount"),
  Struct.skip(20),
  Struct.uint16("index1"),
  Struct.skip(28),
  Struct.struct("origin", Wipeout.Vector3),
  Struct.skip(20),
  Struct.struct("position", Wipeout.Vector3),
  Struct.skip(16),
)

Wipeout.POLYGON_TYPE = {
  UNKNOWN_00: 0x00,
  FLAT_TRIS_FACE_COLOR: 0x01,
  TEXTURED_TRIS_FACE_COLOR: 0x02,
  FLAT_QUAD_FACE_COLOR: 0x03,
  TEXTURED_QUAD_FACE_COLOR: 0x04,
  FLAT_TRIS_VERTEX_COLOR: 0x05,
  TEXTURED_TRIS_VERTEX_COLOR: 0x06,
  FLAT_QUAD_VERTEX_COLOR: 0x07,
  TEXTURED_QUAD_VERTEX_COLOR: 0x08,
  SPRITE_TOP_ANCHOR: 0x0a,
  SPRITE_BOTTOM_ANCHOR: 0x0b,
}

Wipeout.PolygonHeader = Struct.create(
  Struct.uint16("type"),
  Struct.uint16("subtype"),
)

Wipeout.Polygon = {}
Wipeout.Polygon[Wipeout.POLYGON_TYPE.UNKNOWN_00] = Struct.create(
  Struct.struct("header", Wipeout.PolygonHeader),
  Struct.array("unknown", Struct.uint16(), 7),
)

Wipeout.Polygon[Wipeout.POLYGON_TYPE.FLAT_TRIS_FACE_COLOR] = Struct.create(
  Struct.struct("header", Wipeout.PolygonHeader),
  Struct.array("indices", Struct.uint16(), 3),
  Struct.uint16("unknown"),
  Struct.uint32("color"),
)

Wipeout.Polygon[Wipeout.POLYGON_TYPE.TEXTURED_TRIS_FACE_COLOR] = Struct.create(
  Struct.struct("header", Wipeout.PolygonHeader),
  Struct.array("indices", Struct.uint16(), 3),
  Struct.uint16("texture"),
  Struct.array("unknown", Struct.uint16(), 2), // 4
  Struct.array("uv", Wipeout.UV, 3), // 6
  Struct.array("unknown2", Struct.uint16(), 1),
  Struct.uint32("color"),
)

Wipeout.Polygon[Wipeout.POLYGON_TYPE.FLAT_QUAD_FACE_COLOR] = Struct.create(
  Struct.struct("header", Wipeout.PolygonHeader),
  Struct.array("indices", Struct.uint16(), 4),
  Struct.uint32("color"),
)

Wipeout.Polygon[Wipeout.POLYGON_TYPE.TEXTURED_QUAD_FACE_COLOR] = Struct.create(
  Struct.struct("header", Wipeout.PolygonHeader),
  Struct.array("indices", Struct.uint16(), 4),
  Struct.uint16("texture"),
  Struct.array("unknown", Struct.uint16(), 2),
  Struct.array("uv", Wipeout.UV, 4),
  Struct.array("unknown2", Struct.uint16(), 1),
  Struct.uint32("color"),
)

Wipeout.Polygon[Wipeout.POLYGON_TYPE.FLAT_TRIS_VERTEX_COLOR] = Struct.create(
  Struct.struct("header", Wipeout.PolygonHeader),
  Struct.array("indices", Struct.uint16(), 3),
  Struct.uint16("unknown"),
  Struct.array("colors", Struct.uint32(), 3),
)

Wipeout.Polygon[Wipeout.POLYGON_TYPE.TEXTURED_TRIS_VERTEX_COLOR] =
  Struct.create(
    Struct.struct("header", Wipeout.PolygonHeader),
    Struct.array("indices", Struct.uint16(), 3),
    Struct.uint16("texture"),
    Struct.array("unknown", Struct.uint16(), 2), // 4
    Struct.array("uv", Wipeout.UV, 3), // 6
    Struct.array("unknown2", Struct.uint16(), 1),
    Struct.array("colors", Struct.uint32(), 3), // ?
  )

Wipeout.Polygon[Wipeout.POLYGON_TYPE.FLAT_QUAD_VERTEX_COLOR] = Struct.create(
  Struct.struct("header", Wipeout.PolygonHeader),
  Struct.array("indices", Struct.uint16(), 4),
  Struct.array("colors", Struct.uint32(), 4),
)

Wipeout.Polygon[Wipeout.POLYGON_TYPE.TEXTURED_QUAD_VERTEX_COLOR] =
  Struct.create(
    Struct.struct("header", Wipeout.PolygonHeader),
    Struct.array("indices", Struct.uint16(), 4),
    Struct.uint16("texture"),
    Struct.array("unknown", Struct.uint16(), 2),
    Struct.array("uv", Wipeout.UV, 4),
    Struct.array("unknown2", Struct.uint8(), 2),
    Struct.array("colors", Struct.uint32(), 4),
  )

Wipeout.Polygon[Wipeout.POLYGON_TYPE.SPRITE_TOP_ANCHOR] = Struct.create(
  Struct.struct("header", Wipeout.PolygonHeader),
  Struct.uint16("index"),
  Struct.uint16("width"),
  Struct.uint16("height"),
  Struct.uint16("texture"),
  Struct.uint32("color"),
)

Wipeout.Polygon[Wipeout.POLYGON_TYPE.SPRITE_BOTTOM_ANCHOR] =
  Wipeout.Polygon[Wipeout.POLYGON_TYPE.SPRITE_TOP_ANCHOR]

// .TIM Files (Little Endian!) -------------------------------

Wipeout.IMAGE_TYPE = {
  PALETTED_4_BPP: 0x08,
  PALETTED_8_BPP: 0x09,
  TRUE_COLOR_16_BPP: 0x02,
}

Wipeout.ImageFileHeader = Struct.create(
  Struct.uint32("magic", Struct.LITTLE_ENDIAN),
  Struct.uint32("type", Struct.LITTLE_ENDIAN),
  Struct.uint32("headerLength", Struct.LITTLE_ENDIAN),
  Struct.uint16("paletteX", Struct.LITTLE_ENDIAN),
  Struct.uint16("paletteY", Struct.LITTLE_ENDIAN),
  Struct.uint16("paletteColors", Struct.LITTLE_ENDIAN),
  Struct.uint16("palettes", Struct.LITTLE_ENDIAN),
)

Wipeout.ImagePixelHeader = Struct.create(
  Struct.uint16("skipX", Struct.LITTLE_ENDIAN),
  Struct.uint16("skipY", Struct.LITTLE_ENDIAN),
  Struct.uint16("width", Struct.LITTLE_ENDIAN),
  Struct.uint16("height", Struct.LITTLE_ENDIAN),
)

// ----------------------------------------------------------------------------
// Utility Functions to load a binary buffer via AJAX

Wipeout.prototype.loadBinary = function (url, callback) {
  const req = new XMLHttpRequest()
  req.open("GET", url, true)
  req.responseType = "arraybuffer"

  if (req.overrideMimeType) {
    req.overrideMimeType("text/plain; charset=x-user-defined")
  } else {
    req.setRequestHeader("Accept-Charset", "x-user-defined")
  }

  req.onload = function (ev) {
    if (req.status == 200) {
      callback(req.response)
    }
  }

  req.send()
}

Wipeout.prototype.loadBinaries = function (urls, callback) {
  const files = {}
  let pending = 0
  for (var name in urls) {
    pending++
  }

  const that = this
  for (var name in urls) {
    ;(function (name, url) {
      that.loadBinary(url, (buffer) => {
        files[name] = buffer
        pending--
        if (pending === 0) {
          callback(files)
        }
      })
    })(name, urls[name])
  }
}

Wipeout.prototype.int32ToColor = function (v) {
  return new THREE.Color(
    ((v >> 24) & 0xff) / 0x80,
    ((v >> 16) & 0xff) / 0x80,
    ((v >> 8) & 0xff) / 0x80,
  )
}

// ----------------------------------------------------------------------------
// Read 3D Objects from a PRM File

Wipeout.prototype.readObjects = function (buffer) {
  let offset = 0
  const objects = []
  while (offset < buffer.byteLength) {
    const object = this.readObject(buffer, offset)
    offset += object.byteLength
    objects.push(object)
  }

  return objects
}

Wipeout.prototype.readObject = function (buffer, offset) {
  const initialOffset = offset

  const header = Wipeout.ObjectHeader.readStructs(buffer, offset, 1)[0]
  offset += Wipeout.ObjectHeader.byteLength

  const vertices = Wipeout.Vertex.readStructs(
    buffer,
    offset,
    header.vertexCount,
  )
  offset += Wipeout.Vertex.byteLength * header.vertexCount

  const polygons = []
  for (let i = 0; i < header.polygonCount; i++) {
    // Peek into the header first to select the right Polygon type
    const polygonHeader = Wipeout.PolygonHeader.readStructs(
      buffer,
      offset,
      1,
    )[0]

    const PolygonType = Wipeout.Polygon[polygonHeader.type]
    const polygon = PolygonType.readStructs(buffer, offset, 1)[0]
    offset += PolygonType.byteLength

    polygons.push(polygon)
  }

  return {
    header,
    vertices,
    polygons,
    byteLength: offset - initialOffset,
  }
}

// ----------------------------------------------------------------------------
// Create a ThreeJS Model from a single PRM 3D Object

Wipeout.prototype.createModelFromObject = function (object, spriteCollection) {
  const model = new THREE.Object3D()
  const geometry = new THREE.Geometry()

  model.position.set(
    object.header.position.x,
    -object.header.position.y,
    -object.header.position.z,
  )

  // Load vertices
  for (var i = 0; i < object.vertices.length; i++) {
    geometry.vertices.push(
      new THREE.Vector3(
        object.vertices[i].x,
        -object.vertices[i].y,
        -object.vertices[i].z,
      ),
    )
  }

  const whiteColor = new THREE.Color(1, 1, 1)
  const nullVector = new THREE.Vector2(0, 0)

  // Create faces
  for (var i = 0; i < object.polygons.length; i++) {
    const p = object.polygons[i]

    // Sprite
    if (
      p.header.type === Wipeout.POLYGON_TYPE.SPRITE_BOTTOM_ANCHOR ||
      p.header.type === Wipeout.POLYGON_TYPE.SPRITE_TOP_ANCHOR
    ) {
      const v = geometry.vertices[p.index]
      const color = this.int32ToColor(p.color)
      const yOffset =
        p.header.type === Wipeout.POLYGON_TYPE.SPRITE_BOTTOM_ANCHOR
          ? p.height / 2
          : -p.height / 2

      // We can't use THREE.Sprite here, because they rotate to the camera on
      // all axis. We just want rotation around the Y axis, so we do it manually.
      const spriteMaterial = new THREE.MeshBasicMaterial({
        map: this.sceneMaterial.materials[p.texture].map,
        color,
        alphaTest: 0.5,
      })
      const spriteMesh = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(p.width, p.height),
        spriteMaterial,
      )

      const sprite = new THREE.Object3D()
      sprite.position.set(v.x, v.y + yOffset, v.z)
      sprite.add(spriteMesh)
      model.add(sprite)

      // We have to collect sprites separately, so we can go through all of them
      // and rotate them to the camera before rendering the frame
      spriteCollection.push(sprite)
    }

    // Tris or Quad
    else if (p.indices) {
      let materialIndex = this.sceneMaterial.flatMaterialIndex
      const c = [whiteColor, whiteColor, whiteColor, whiteColor]
      const uv = [nullVector, nullVector, nullVector, nullVector]

      // Textured
      if (p.texture !== undefined) {
        materialIndex = p.texture

        const img = this.sceneMaterial.materials[materialIndex].map.image
        for (var j = 0; j < p.uv.length; j++) {
          uv[j] = new THREE.Vector2(
            p.uv[j].u / img.width,
            1 - p.uv[j].v / img.height,
          )
        }
      }

      // Face or Vertex color?
      if (p.color || p.colors) {
        for (var j = 0; j < p.indices.length; j++) {
          c[j] = this.int32ToColor(p.color || p.colors[j])
        }
      }

      geometry.faceVertexUvs[0].push([uv[2], uv[1], uv[0]])
      geometry.faces.push(
        new THREE.Face3(
          p.indices[2],
          p.indices[1],
          p.indices[0],
          null,
          [c[2], c[1], c[0]],
          materialIndex,
        ),
      )

      // Push extra UV and Face for Quads
      if (p.indices.length === 4) {
        geometry.faceVertexUvs[0].push([uv[2], uv[3], uv[1]])
        geometry.faces.push(
          new THREE.Face3(
            p.indices[2],
            p.indices[3],
            p.indices[1],
            null,
            [c[2], c[3], c[1]],
            materialIndex,
          ),
        )
      }
    }
  }

  if (geometry.faces.length > 0) {
    const mesh = new THREE.Mesh(geometry, this.sceneMaterial)
    model.add(mesh)
  }

  return model
}

// ----------------------------------------------------------------------------
// Unpack TIM images from a compressed CMP File (LZ77)

Wipeout.prototype.unpackImages = function (buffer) {
  const data = new DataView(buffer)

  // Read the file header
  const numberOfFiles = data.getUint32(0, true)
  const packedDataOffset = (numberOfFiles + 1) * 4

  let unpackedLength = 0
  for (var i = 0; i < numberOfFiles; i++) {
    unpackedLength += data.getUint32((i + 1) * 4, true)
  }

  // Unpack
  const src = new Uint8Array(buffer, packedDataOffset)
  const dst = new Uint8Array(unpackedLength)
  const wnd = new Uint8Array(0x20_00)

  let srcPos = 0
  let dstPos = 0
  let wndPos = 1
  let curBit = 0
  let curByte = 0
  let bitMask = 0x80

  const readBitfield = function (size) {
    let value = 0
    while (size > 0) {
      if (bitMask === 0x80) {
        curByte = src[srcPos++]
      }

      if (curByte & bitMask) {
        value |= size
      }

      size >>= 1

      bitMask >>= 1
      if (bitMask === 0) {
        bitMask = 0x80
      }
    }

    return value
  }

  while (true) {
    if (srcPos > src.byteLength || dstPos > unpackedLength) {
      break
    }

    if (bitMask === 0x80) {
      curByte = src[srcPos++]
    }

    curBit = curByte & bitMask

    bitMask >>= 1
    if (bitMask === 0) {
      bitMask = 0x80
    }

    if (curBit) {
      wnd[wndPos & 0x1f_ff] = dst[dstPos] = readBitfield(0x80)
      wndPos++
      dstPos++
    } else {
      const position = readBitfield(0x10_00)
      if (position === 0) {
        break
      }

      const length = readBitfield(0x08) + 2
      for (var i = 0; i <= length; i++) {
        wnd[wndPos & 0x1f_ff] = dst[dstPos] = wnd[(i + position) & 0x1f_ff]
        wndPos++
        dstPos++
      }
    }
  }

  // Split unpacked data into separate buffer for each file
  let fileOffset = 0
  const files = []
  for (var i = 0; i < numberOfFiles; i++) {
    const fileLength = data.getUint32((i + 1) * 4, true)
    files.push(dst.buffer.slice(fileOffset, fileOffset + fileLength))
    fileOffset += fileLength
  }

  return files
}

// ----------------------------------------------------------------------------
// Render a TIM image into a 2D canvas

Wipeout.prototype.readImage = function (buffer) {
  const data = new DataView(buffer)
  const file = Wipeout.ImageFileHeader.readStructs(buffer, 0, 1)[0]
  let offset = Wipeout.ImageFileHeader.byteLength

  let palette = null
  if (
    file.type === Wipeout.IMAGE_TYPE.PALETTED_4_BPP ||
    file.type === Wipeout.IMAGE_TYPE.PALETTED_8_BPP
  ) {
    palette = new Uint16Array(buffer, offset, file.paletteColors)
    offset += file.paletteColors * 2
  }

  offset += 4 // skip data size

  let pixelsPerShort = 1
  if (file.type === Wipeout.IMAGE_TYPE.PALETTED_8_BPP) {
    pixelsPerShort = 2
  } else if (file.type === Wipeout.IMAGE_TYPE.PALETTED_4_BPP) {
    pixelsPerShort = 4
  }

  const dim = Wipeout.ImagePixelHeader.readStructs(buffer, offset, 1)[0]
  offset += Wipeout.ImagePixelHeader.byteLength

  const width = dim.width * pixelsPerShort
  const { height } = dim

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  const pixels = ctx.createImageData(width, height)

  const putPixel = function (dst, offset, color) {
    dst[offset + 0] = (color & 0x1f) << 3 // R
    dst[offset + 1] = ((color >> 5) & 0x1f) << 3 // G
    dst[offset + 2] = ((color >> 10) & 0x1f) << 3 // B
    dst[offset + 3] = color === 0 ? 0 : 0xff // A
  }

  const entries = dim.width * dim.height
  if (file.type === Wipeout.IMAGE_TYPE.TRUE_COLOR_16_BPP) {
    for (var i = 0; i < entries; i++) {
      const c = data.getUint16(offset + i * 2, true)
      putPixel(pixels.data, i * 4, c)
    }
  } else if (file.type === Wipeout.IMAGE_TYPE.PALETTED_8_BPP) {
    for (var i = 0; i < entries; i++) {
      var p = data.getUint16(offset + i * 2, true)

      putPixel(pixels.data, i * 8 + 0, palette[p & 0xff])
      putPixel(pixels.data, i * 8 + 4, palette[(p >> 8) & 0xff])
    }
  } else if (file.type === Wipeout.IMAGE_TYPE.PALETTED_4_BPP) {
    for (var i = 0; i < entries; i++) {
      var p = data.getUint16(offset + i * 2, true)

      putPixel(pixels.data, i * 16 + 0, palette[p & 0xf])
      putPixel(pixels.data, i * 16 + 4, palette[(p >> 4) & 0xf])
      putPixel(pixels.data, i * 16 + 8, palette[(p >> 8) & 0xf])
      putPixel(pixels.data, i * 16 + 12, palette[(p >> 12) & 0xf])
    }
  }

  ctx.putImageData(pixels, 0, 0)
  return canvas
}

// ----------------------------------------------------------------------------
// Create a single ThreeJS MeshFaceMaterial with the given images

Wipeout.prototype.createMeshFaceMaterial = function (
  images,
  vertexColors,
  side,
) {
  const materials = []
  const basicMaterial = new THREE.MeshBasicMaterial({ wireframe: false })
  basicMaterial.vertexColors = vertexColors

  for (let i = 0; i < images.length; i++) {
    let material = basicMaterial

    if (images[i].byteLength !== 0) {
      const texture = new THREE.Texture(images[i])
      texture.minFilter = THREE.NearestFilter
      texture.magFilter = THREE.NearestFilter
      texture.needsUpdate = true

      material = new THREE.MeshBasicMaterial({ map: texture })

      if (i === 3 && vertexColors === THREE.FaceColors) {
        // this is weapon tile. store material, so we can update color later
        material.vertexColors = THREE.NoColors
        this.weaponTileMaterial = material
      } else {
        material.vertexColors = vertexColors
      }

      material.side = side
      material.alphaTest = 0.5
    }

    materials.push(material)
  }

  materials.push(basicMaterial) - 1

  const faceMat = new THREE.MeshFaceMaterial(materials)
  faceMat.flatMaterialIndex = materials.length - 1

  return faceMat
}

// ----------------------------------------------------------------------------
// Add objects from the PRM and CMP files to the scene

Wipeout.prototype.createScene = function (files, modify) {
  const rawImages = files.textures ? this.unpackImages(files.textures) : []
  const images = rawImages.map(this.readImage.bind(this))

  this.sceneMaterial = this.createMeshFaceMaterial(
    images,
    THREE.VertexColors,
    THREE.FrontSide,
  )

  const objects = this.readObjects(files.objects)
  for (let i = 0; i < objects.length; i++) {
    const model = this.createModelFromObject(objects[i], this.sprites)
    if (modify && modify.scale) {
      model.scale.set(modify.scale, modify.scale, modify.scale)
    }

    if (modify && modify.move) {
      model.position.add(modify.move)
    }

    if (modify && modify.space) {
      model.position.add({
        x: (i + 0.5 - objects.length / 2) * modify.space,
        y: 0,
        z: 0,
      })
    }

    this.scene.add(model)
  }
}

// ----------------------------------------------------------------------------
// Add a track from TRV, TRF, CMP and TTF files to the scene

Wipeout.prototype.createTrack = function (files) {
  const rawImages = this.unpackImages(files.textures)
  const images = rawImages.map(this.readImage.bind(this))

  // Load Track Texture Index
  const indexEntries =
    files.textureIndex.byteLength / Wipeout.TrackTextureIndex.byteLength
  const textureIndex = Wipeout.TrackTextureIndex.readStructs(
    files.textureIndex,
    0,
    indexEntries,
  )

  // Extract the big (near) versions of these textures only. The near
  // version is composed of 4x4 32px tiles.
  const composedImages = []
  for (var i = 0; i < textureIndex.length; i++) {
    const idx = textureIndex[i]

    const composedImage = document.createElement("canvas")
    composedImage.width = 128
    composedImage.height = 128
    const ctx = composedImage.getContext("2d")

    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        const image = images[idx.near[y * 4 + x]]
        ctx.drawImage(image, x * 32, y * 32)
      }
    }

    composedImages.push(composedImage)
  }

  this.trackMaterial = this.createMeshFaceMaterial(
    composedImages,
    THREE.FaceColors,
    THREE.DoubleSide,
  )

  const model = new THREE.Object3D()
  const geometry = new THREE.Geometry()

  // Load vertices
  const vertexCount = files.vertices.byteLength / Wipeout.TrackVertex.byteLength
  const rawVertices = Wipeout.TrackVertex.readStructs(
    files.vertices,
    0,
    vertexCount,
  )

  for (var i = 0; i < rawVertices.length; i++) {
    geometry.vertices.push(
      new THREE.Vector3(rawVertices[i].x, -rawVertices[i].y, -rawVertices[i].z),
    )
  }

  // Load Faces
  const faceCount = files.faces.byteLength / Wipeout.TrackFace.byteLength
  const faces = Wipeout.TrackFace.readStructs(files.faces, 0, faceCount)

  // Load track texture file (WO2097/WOXL only)
  if (files.trackTexture) {
    const trackTextureCount =
      files.trackTexture.byteLength / Wipeout.TrackTexture.byteLength
    const trackTextures = Wipeout.TrackTexture.readStructs(
      files.trackTexture,
      0,
      trackTextureCount,
    )

    // Copy data from TEX to TRF structure
    for (var i = 0; i < faces.length; i++) {
      var f = faces[i]
      const t = trackTextures[i]

      f.tile = t.tile
      f.flags = t.flags
    }
  }

  for (var i = 0; i < faces.length; i++) {
    var f = faces[i]

    let color = this.int32ToColor(f.color)
    const materialIndex = f.tile

    if (f.flags & Wipeout.TrackFace.FLAGS.BOOST) {
      // render boost tile as bright blue
      color = new THREE.Color(0.25, 0.25, 2)
    }

    geometry.faces.push(
      new THREE.Face3(
        f.indices[0],
        f.indices[1],
        f.indices[2],
        null,
        color,
        materialIndex,
      ),
    )
    geometry.faces.push(
      new THREE.Face3(
        f.indices[2],
        f.indices[3],
        f.indices[0],
        null,
        color,
        materialIndex,
      ),
    )

    const flipx = f.flags & Wipeout.TrackFace.FLAGS.FLIP ? 1 : 0
    geometry.faceVertexUvs[0].push([
      new THREE.Vector2(1 - flipx, 1),
      new THREE.Vector2(0 + flipx, 1),
      new THREE.Vector2(0 + flipx, 0),
    ])
    geometry.faceVertexUvs[0].push([
      new THREE.Vector2(0 + flipx, 0),
      new THREE.Vector2(1 - flipx, 0),
      new THREE.Vector2(1 - flipx, 1),
    ])
  }

  const mesh = new THREE.Mesh(geometry, this.trackMaterial)
  model.add(mesh)
  this.scene.add(model)

  this.createCameraSpline(files.sections, faces, geometry.vertices)
}

// ----------------------------------------------------------------------------
// Extract a camera from the track section file (.TRS)

Wipeout.prototype.createCameraSpline = function (buffer, faces, vertices) {
  const sectionCount = buffer.byteLength / Wipeout.TrackSection.byteLength
  const sections = Wipeout.TrackSection.readStructs(buffer, 0, sectionCount)

  const cameraPoints = []
  const jumpIndexes = []

  // First curve, always skip junctions
  var index = 0
  do {
    var s = sections[index]
    if (s.flags & Wipeout.TrackSection.FLAGS.JUMP) {
      jumpIndexes.push(cameraPoints.length)
    }

    var pos = this.getSectionPosition(s, faces, vertices)
    cameraPoints.push(pos)

    index = s.next
  } while (index > 0 && index < sections.length)

  // Second curve, take junctions when possible
  index = 0
  do {
    var s = sections[index]
    if (s.flags & Wipeout.TrackSection.FLAGS.JUMP) {
      jumpIndexes.push(cameraPoints.length)
    }

    var pos = this.getSectionPosition(s, faces, vertices)
    cameraPoints.push(pos)

    // Get next section, look for junctions
    index =
      s.nextJunction != -1 &&
      sections[s.nextJunction].flags & Wipeout.TrackSection.FLAGS.JUNCTION_START
        ? s.nextJunction
        : s.next
  } while (index > 0 && index < sections.length)

  // extend path near jumps by adding tangent vector
  for (let i = 0; i < jumpIndexes.length; i++) {
    var index = jumpIndexes[i]

    const jumpPoint = cameraPoints[index]
    const tangent = jumpPoint
      .clone()
      .sub(
        cameraPoints[(index + cameraPoints.length - 1) % cameraPoints.length],
      )
    const lengthNext = cameraPoints[(index + 1) % cameraPoints.length]
      .clone()
      .sub(jumpPoint)
      .length()

    jumpPoint.add(tangent.setLength(lengthNext / 4))
  }

  this.cameraSpline = new THREE.HermiteCurve3(cameraPoints, 0.5, 0)

  // Increase arc length subdivisions to get constant camera speed during jumps.
  // This prevent camera going too fast due imprecise length distance estimations.
  this.cameraSpline.__arcLengthDivisions = 20_000

  // Draw the Camera Spline
  // this.scene.add( new THREE.Mesh(
  // 	new THREE.TubeGeometry(this.cameraSpline, cameraPoints.length, 50, 5, true),
  // 	new THREE.MeshBasicMaterial({color: 0xff00ff})
  // ));
}

// ----------------------------------------------------------------------------
// Get track section center position from track vertices

Wipeout.prototype.getSectionPosition = function (section, faces, vertices) {
  let verticescount = 0
  const position = new THREE.Vector3()
  for (
    let i = section.firstFace;
    i < section.firstFace + section.numFaces;
    i++
  ) {
    const face = faces[i]
    if (face.flags & Wipeout.TrackFace.FLAGS.TRACK) {
      for (let j = 0; j < face.indices.length; j++) {
        const vertex = vertices[face.indices[j]]
        position.add(vertex)
        verticescount++
      }
    }
  }

  position.divideScalar(verticescount)
  return position
}

Wipeout.prototype.loadTrack = function (path, loadTEXFile) {
  const that = this
  this.loadBinaries(
    {
      textures: path + "/SCENE.CMP",
      objects: path + "/SCENE.PRM",
    },
    (files) => {
      that.createScene(files)
    },
  )

  this.loadBinaries(
    {
      textures: path + "/SKY.CMP",
      objects: path + "/SKY.PRM",
    },
    (files) => {
      that.createScene(files, { scale: 48 })
    },
  )

  const trackFiles = {
    textures: path + "/LIBRARY.CMP",
    textureIndex: path + "/LIBRARY.TTF",
    vertices: path + "/TRACK.TRV",
    faces: path + "/TRACK.TRF",
    sections: path + "/TRACK.TRS",
  }

  if (loadTEXFile) {
    trackFiles.trackTexture = path + "/TRACK.TEX"
  }

  this.loadBinaries(trackFiles, (files) => {
    that.createTrack(files)
  })
}

Wipeout.Tracks = {}
Wipeout.Tracks.Wipeout = [
  { path: "WIPEOUT/TRACK02", name: "Altima VII - Venom" },
  { path: "WIPEOUT/TRACK03", name: "Altima VII - Rapier" },
  { path: "WIPEOUT/TRACK04", name: "Karbonis V - Venom" },
  { path: "WIPEOUT/TRACK05", name: "Karbonis V - Rapier" },
  { path: "WIPEOUT/TRACK01", name: "Terramax - Venom" },
  { path: "WIPEOUT/TRACK06", name: "Terramax - Rapier" },
  { path: "WIPEOUT/TRACK12", name: "Korodera - Venom" },
  { path: "WIPEOUT/TRACK07", name: "Korodera - Rapier" },
  { path: "WIPEOUT/TRACK08", name: "Arridos IV - Venom" },
  { path: "WIPEOUT/TRACK11", name: "Arridos IV - Rapier" },
  { path: "WIPEOUT/TRACK09", name: "Silverstream - Venom" },
  { path: "WIPEOUT/TRACK13", name: "Silverstream - Rapier" },
  { path: "WIPEOUT/TRACK10", name: "Firestar - Venom" },
  { path: "WIPEOUT/TRACK14", name: "Firestar - Rapier" },
]

Wipeout.Tracks.Wipeout2097 = [
  { path: "WIPEOUT2/TRACK01", name: "Talon's Reach", hasTEXFile: true },
  { path: "WIPEOUT2/TRACK08", name: "Sagarmatha", hasTEXFile: true },
  { path: "WIPEOUT2/TRACK13", name: "Valparaiso", hasTEXFile: true },
  { path: "WIPEOUT2/TRACK20", name: "Phenitia Park", hasTEXFile: true },
  { path: "WIPEOUT2/TRACK02", name: "Gare d'Europa", hasTEXFile: true },
  { path: "WIPEOUT2/TRACK17", name: "Odessa Keys", hasTEXFile: true },
  { path: "WIPEOUT2/TRACK06", name: "Vostok Island", hasTEXFile: true },
  { path: "WIPEOUT2/TRACK07", name: "Spilskinanke", hasTEXFile: true },
  { path: "WIPEOUT2/TRACK04", name: "Unfinished Track" },
]
