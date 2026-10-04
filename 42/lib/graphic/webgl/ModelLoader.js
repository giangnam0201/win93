/* eslint-disable guard-for-in */
/* eslint-disable unicorn/prefer-blob-reading-methods */
/* eslint-disable complexity */
import * as THREE from "../../../../c/libs/threejs/0.181/three.js"
import { TGALoader } from "../../../../c/libs/threejs/0.181/addons/loaders/TGALoader.js"
import {
  unzipSync,
  strFromU8,
} from "../../../../c/libs/threejs/0.181/addons/libs/fflate.module.js"
import { defer } from "../../type/promise/defer.js"

const LoaderUtils = {
  createFilesMap(files) {
    const map = {}

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      map[file.name] = file
    }

    return map
  },

  getFilesFromItemList(items, onDone) {
    // TOFIX: setURLModifier() breaks when the file being loaded is not in root

    let itemsCount = 0
    let itemsTotal = 0

    const files = []
    const filesMap = {}

    function onEntryHandled() {
      itemsCount++

      if (itemsCount === itemsTotal) {
        onDone(files, filesMap)
      }
    }

    function handleEntry(entry) {
      if (entry.isDirectory) {
        const reader = entry.createReader()
        reader.readEntries((entries) => {
          for (let i = 0; i < entries.length; i++) {
            handleEntry(entries[i])
          }

          onEntryHandled()
        })
      } else if (entry.isFile) {
        entry.file((file) => {
          files.push(file)

          filesMap[entry.fullPath.slice(1)] = file
          onEntryHandled()
        })
      }

      itemsTotal++
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (item.kind === "file") {
        handleEntry(item.webkitGetAsEntry())
      }
    }
  },
}

async function createGLTFLoader(manager) {
  const { GLTFLoader } = await import(
    "../../../../c/libs/threejs/0.181/addons/loaders/GLTFLoader.js"
  )
  const { DRACOLoader } = await import(
    "../../../../c/libs/threejs/0.181/addons/loaders/DRACOLoader.js"
  )
  const { KTX2Loader } = await import(
    "../../../../c/libs/threejs/0.181/addons/loaders/KTX2Loader.js"
  )
  const { MeshoptDecoder } = await import(
    "../../../../c/libs/threejs/0.181/addons/libs/meshopt_decoder.module.js"
  )

  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath("/c/libs/threejs/0.181/addons/libs/draco/gltf/")

  const ktx2Loader = new KTX2Loader(manager)
  ktx2Loader.setTranscoderPath("/c/libs/threejs/0.181/addons/libs/basis/")

  // deferred.signals.rendererDetectKTX2Support.dispatch(ktx2Loader)

  const loader = new GLTFLoader(manager)
  loader.setDRACOLoader(dracoLoader)
  loader.setKTX2Loader(ktx2Loader)
  loader.setMeshoptDecoder(MeshoptDecoder)

  return loader
}

function getManager(filesMap) {
  const globalManager = new THREE.LoadingManager()
  globalManager.addHandler(/\.tga$/i, new TGALoader())

  if (filesMap) {
    globalManager.setURLModifier((url) => {
      url = url.replace(/^(\.?\/)/, "") // remove './'

      const file = filesMap[url]

      if (file) {
        console.debug("Loading", url)

        return URL.createObjectURL(file)
      }

      return url
    })
  }

  return globalManager
}

function Loader() {
  const scope = this

  this.texturePath = ""

  this.loadItemList = function (items) {
    LoaderUtils.getFilesFromItemList(items, (files, filesMap) => {
      scope.loadFiles(files, filesMap)
    })
  }

  this.loadFiles = function (files, filesMap) {
    if (files.length > 0) {
      filesMap = filesMap || LoaderUtils.createFilesMap(files)
      const manager = getManager(filesMap)

      for (let i = 0; i < files.length; i++) {
        scope.loadFile(files[i], manager)
      }
    }
  }

  this.loadFile = async function (file, manager = getManager()) {
    if (typeof manager === "string") {
      const base = new URL(manager, location.origin).href
      manager = getManager()
      manager.setURLModifier((url) => new URL(url, base).href)
    }

    const deferred = defer()

    const filename = file.name
    const extension = filename.split(".").pop().toLowerCase()

    const reader = new FileReader()
    // reader.addEventListener("progress", (event) => {
    //   const size = "(" + Math.floor(event.total / 1000) + " KB)"
    //   const progress = Math.floor((event.loaded / event.total) * 100) + "%"
    //   console.debug("Loading", filename, size, progress)
    // })

    switch (extension) {
      case "3dm": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { Rhino3dmLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/3DMLoader.js"
            )

            const loader = new Rhino3dmLoader()
            loader.setLibraryPath("/c/libs/threejs/0.181/addons/libs/rhino3dm/")
            loader.parse(
              contents,
              (object) => {
                object.name = filename

                deferred.resolve(object)
              },
              (error) => {
                console.error(error)
              },
            )
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "3ds": {
        reader.addEventListener(
          "load",
          async (event) => {
            const { TDSLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/TDSLoader.js"
            )

            const loader = new TDSLoader()
            const object = loader.parse(event.target.result)

            deferred.resolve(object)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "3mf": {
        reader.addEventListener(
          "load",
          async (event) => {
            const { ThreeMFLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/3MFLoader.js"
            )

            const loader = new ThreeMFLoader()
            const object = loader.parse(event.target.result)

            deferred.resolve(object)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "amf": {
        reader.addEventListener(
          "load",
          async (event) => {
            const { AMFLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/AMFLoader.js"
            )

            const loader = new AMFLoader()
            const amfobject = loader.parse(event.target.result)

            deferred.resolve(amfobject)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "dae": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { ColladaLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/ColladaLoader.js"
            )

            const loader = new ColladaLoader(manager)
            const collada = loader.parse(contents)

            collada.scene.name = filename

            deferred.resolve(collada.scene)
          },
          false,
        )
        reader.readAsText(file)

        break
      }

      case "drc": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { DRACOLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/DRACOLoader.js"
            )

            const loader = new DRACOLoader()
            loader.setDecoderPath("/c/libs/threejs/0.181/addons/libs/draco/")
            loader.parse(contents, (geometry) => {
              let object

              if (geometry.index === null) {
                const material = new THREE.PointsMaterial({ size: 0.01 })
                material.vertexColors = geometry.hasAttribute("color")

                object = new THREE.Points(geometry, material)
                object.name = filename
              } else {
                const material = new THREE.MeshStandardMaterial()

                object = new THREE.Mesh(geometry, material)
                object.name = filename
              }

              loader.dispose()
              deferred.resolve(object)
            })
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "fbx": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { FBXLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/FBXLoader.js"
            )

            const loader = new FBXLoader(manager)
            const object = loader.parse(contents)

            deferred.resolve(object)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "glb": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const loader = await createGLTFLoader()

            loader.parse(contents, "", (result) => {
              const { scene } = result
              scene.name = filename

              scene.animations.push(...result.animations)
              deferred.resolve(scene)

              loader.dracoLoader.dispose()
              loader.ktx2Loader.dispose()
            })
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "gltf": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const loader = await createGLTFLoader(manager)

            loader.parse(contents, "", (result) => {
              const { scene } = result
              scene.name = filename

              scene.animations.push(...result.animations)
              deferred.resolve(scene)

              loader.dracoLoader.dispose()
              loader.ktx2Loader.dispose()
            })
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "js":
      case "json": {
        reader.addEventListener(
          "load",
          (event) => {
            const contents = event.target.result

            // 2.0

            if (contents.includes("postMessage")) {
              const blob = new Blob([contents], { type: "text/javascript" })
              const url = URL.createObjectURL(blob)

              const worker = new Worker(url)

              worker.onmessage = function (event) {
                event.data.metadata = { version: 2 }
                handleJSON(event.data, deferred)
              }

              worker.postMessage(Date.now())

              return
            }

            // >= 3.0

            let data

            try {
              data = JSON.parse(contents)
            } catch (error) {
              console.debug(error)
              return
            }

            handleJSON(data, deferred)
          },
          false,
        )
        reader.readAsText(file)

        break
      }

      case "kmz": {
        reader.addEventListener(
          "load",
          async (event) => {
            const { KMZLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/KMZLoader.js"
            )

            const loader = new KMZLoader()
            const collada = loader.parse(event.target.result)

            collada.scene.name = filename

            deferred.resolve(collada.scene)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "ldr":
      case "mpd": {
        reader.addEventListener(
          "load",
          async (event) => {
            const { LDrawLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/LDrawLoader.js"
            )

            const loader = new LDrawLoader()
            loader.setPath("../../examples/models/ldraw/officialLibrary/")
            loader.parse(event.target.result, (group) => {
              group.name = filename
              // Convert from LDraw coordinates: rotate 180 degrees around OX
              group.rotation.x = Math.PI

              deferred.resolve(group)
            })
          },
          false,
        )
        reader.readAsText(file)

        break
      }

      case "md2": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { MD2Loader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/MD2Loader.js"
            )

            const geometry = new MD2Loader().parse(contents)
            const material = new THREE.MeshStandardMaterial()

            const mesh = new THREE.Mesh(geometry, material)
            mesh.mixer = new THREE.AnimationMixer(mesh)
            mesh.name = filename

            mesh.animations.push(...geometry.animations)
            deferred.resolve(mesh)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "obj": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { OBJLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/OBJLoader.js"
            )

            const object = new OBJLoader().parse(contents)
            object.name = filename

            deferred.resolve(object)
          },
          false,
        )
        reader.readAsText(file)

        break
      }

      case "pcd": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { PCDLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/PCDLoader.js"
            )

            const points = new PCDLoader().parse(contents)
            points.name = filename

            deferred.resolve(points)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "ply": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { PLYLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/PLYLoader.js"
            )

            const geometry = new PLYLoader().parse(contents)
            let object

            if (geometry.index === null) {
              const material = new THREE.PointsMaterial({ size: 0.01 })
              material.vertexColors = geometry.hasAttribute("color")

              object = new THREE.Points(geometry, material)
              object.name = filename
            } else {
              const material = new THREE.MeshStandardMaterial()

              object = new THREE.Mesh(geometry, material)
              object.name = filename
            }

            deferred.resolve(object)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "stl": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { STLLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/STLLoader.js"
            )

            const geometry = new STLLoader().parse(contents)
            const material = new THREE.MeshStandardMaterial()

            const mesh = new THREE.Mesh(geometry, material)
            mesh.name = filename

            deferred.resolve(mesh)
          },
          false,
        )

        if (reader.readAsBinaryString === undefined) {
          reader.readAsArrayBuffer(file)
        } else {
          reader.readAsBinaryString(file)
        }

        break
      }

      // case "svg": {
      //   reader.addEventListener(
      //     "load",
      //     async (event) => {
      //       const contents = event.target.result

      //       const { SVGLoader } = await import(
      //         "../../../../c/libs/threejs/0.181/addons/loaders/SVGLoader.js"
      //       )

      //       const loader = new SVGLoader()
      //       const { paths } = loader.parse(contents)

      //       //

      //       const group = new THREE.Group()
      //       group.name = filename
      //       group.scale.multiplyScalar(0.1)
      //       group.scale.y *= -1

      //       for (let i = 0; i < paths.length; i++) {
      //         const path = paths[i]

      //         const material = new THREE.MeshBasicMaterial({
      //           color: path.color,
      //           depthWrite: false,
      //         })

      //         const shapes = SVGLoader.createShapes(path)

      //         for (let j = 0; j < shapes.length; j++) {
      //           const shape = shapes[j]

      //           const geometry = new THREE.ShapeGeometry(shape)
      //           const mesh = new THREE.Mesh(geometry, material)

      //           group.add(mesh)
      //         }
      //       }

      //       deferred.resolve(group)
      //     },
      //     false,
      //   )
      //   reader.readAsText(file)

      //   break
      // }

      // https://blog.logrocket.com/bringing-svgs-three-js-svgloader/
      case "svg": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { SVGLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/SVGLoader.js"
            )

            const loader = new SVGLoader()
            const { paths } = loader.parse(contents)

            //

            const group = new THREE.Group()
            group.name = filename
            // group.scale.multiplyScalar(0.1)
            group.scale.y *= -1

            for (let i = 0; i < paths.length; i++) {
              const path = paths[i]

              // const material = new THREE.MeshBasicMaterial({
              //   color: path.color,
              //   depthWrite: false,
              // })

              const material = new THREE.MeshNormalMaterial()

              const shapes = SVGLoader.createShapes(path)

              for (let j = 0; j < shapes.length; j++) {
                const shape = shapes[j]

                const geometry = new THREE.ExtrudeGeometry(shape, {
                  depth: 4,
                  bevelEnabled: false,
                })
                const mesh = new THREE.Mesh(geometry, material)
                mesh.name = "svg-yo" + j

                group.add(mesh)

                // const linesGeometry = new THREE.EdgesGeometry(mesh.geometry)
                // const lines = new THREE.LineSegments(
                //   linesGeometry,
                //   new THREE.LineBasicMaterial({
                //     color: "#000000",
                //   }),
                // )

                // group.add(mesh, lines)
              }
            }

            const box = new THREE.Box3().setFromObject(group)
            const size = box.getSize(new THREE.Vector3())
            const yOffset = size.y / -2
            const xOffset = size.x / -2

            // Offset all of group's elements, to center them
            group.children.forEach((item) => {
              item.position.x = xOffset
              item.position.y = yOffset
              item.rotation.x = -Math.PI
            })

            deferred.resolve(group)
          },
          false,
        )
        reader.readAsText(file)

        break
      }

      // case "usdz": {
      //   reader.addEventListener(
      //     "load",
      //     async (event) => {
      //       const contents = event.target.result

      //       const { USDZLoader } = await import(
      //         "../../../../c/libs/threejs/0.181/addons/loaders/USDZLoader.js"
      //       )

      //       const group = new USDZLoader().parse(contents)
      //       group.name = filename

      //       deferred.resolve(group)
      //     },
      //     false,
      //   )
      //   reader.readAsArrayBuffer(file)

      //   break
      // }

      case "usdz": {
        const { USDZLoader } = await import(
          "../../../../c/libs/threejs/USDZLoader.js"
        )

        const loader = new USDZLoader()
        const group = new THREE.Group()

        group.name = filename

        await loader.loadFile(file, group)

        // const loadedModel = await loader.loadFile(file, group)
        // console.debug(loadedModel)

        deferred.resolve(group)

        break
      }

      case "vox": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { VOXLoader, VOXMesh } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/VOXLoader.js"
            )

            const chunks = new VOXLoader().parse(contents)

            const group = new THREE.Group()
            group.name = filename

            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i]

              const mesh = new VOXMesh(chunk)
              group.add(mesh)
            }

            deferred.resolve(group)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "vtk":
      case "vtp": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { VTKLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/VTKLoader.js"
            )

            const geometry = new VTKLoader().parse(contents)
            const material = new THREE.MeshStandardMaterial()

            const mesh = new THREE.Mesh(geometry, material)
            mesh.name = filename

            deferred.resolve(mesh)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      case "wrl": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { VRMLLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/VRMLLoader.js"
            )

            const result = new VRMLLoader().parse(contents)

            deferred.resolve(result)
          },
          false,
        )
        reader.readAsText(file)

        break
      }

      case "xyz": {
        reader.addEventListener(
          "load",
          async (event) => {
            const contents = event.target.result

            const { XYZLoader } = await import(
              "../../../../c/libs/threejs/0.181/addons/loaders/XYZLoader.js"
            )

            const geometry = new XYZLoader().parse(contents)

            const material = new THREE.PointsMaterial()
            material.vertexColors = geometry.hasAttribute("color")

            const points = new THREE.Points(geometry, material)
            points.name = filename

            deferred.resolve(points)
          },
          false,
        )
        reader.readAsText(file)

        break
      }

      case "zip": {
        reader.addEventListener(
          "load",
          (event) => {
            handleZIP(event.target.result, deferred)
          },
          false,
        )
        reader.readAsArrayBuffer(file)

        break
      }

      default:
        console.error("Unsupported file format (" + extension + ").")

        break
    }

    return deferred
  }

  function handleJSON(data, deferred) {
    if (data.metadata === undefined) {
      // 2.0

      data.metadata = { type: "Geometry" }
    }

    if (data.metadata.type === undefined) {
      // 3.0

      data.metadata.type = "Geometry"
    }

    if (data.metadata.formatVersion !== undefined) {
      data.metadata.version = data.metadata.formatVersion
    }

    switch (data.metadata.type.toLowerCase()) {
      case "buffergeometry": {
        const loader = new THREE.BufferGeometryLoader()
        const result = loader.parse(data)

        const mesh = new THREE.Mesh(result)

        deferred.resolve(mesh)

        break
      }

      case "geometry":
        console.error('Loader: "Geometry" is no longer supported.')

        break

      case "object": {
        const loader = new THREE.ObjectLoader()
        loader.setResourcePath(scope.texturePath)

        loader.parse(data, (result) => {
          deferred.resolve(result)
        })

        break
      }

      case "app":
        deferred.fromJSON(data)

        break
    }
  }

  async function handleZIP(contents, deferred) {
    const zip = unzipSync(new Uint8Array(contents))

    const manager = new THREE.LoadingManager()
    manager.setURLModifier((url) => {
      const file = zip[url]

      if (file) {
        console.debug("Loading", url)

        const blob = new Blob([file.buffer], {
          type: "application/octet-stream",
        })
        return URL.createObjectURL(blob)
      }

      return url
    })

    // Poly

    if (zip["model.obj"] && zip["materials.mtl"]) {
      const { MTLLoader } = await import(
        "../../../../c/libs/threejs/0.181/addons/loaders/MTLLoader.js"
      )
      const { OBJLoader } = await import(
        "../../../../c/libs/threejs/0.181/addons/loaders/OBJLoader.js"
      )

      const materials = new MTLLoader(manager).parse(
        strFromU8(zip["materials.mtl"]),
      )
      const object = new OBJLoader()
        .setMaterials(materials)
        .parse(strFromU8(zip["model.obj"]))

      deferred.resolve(object)
      return
    }

    //

    for (const path in zip) {
      const file = zip[path]

      const extension = path.split(".").pop().toLowerCase()

      switch (extension) {
        case "fbx": {
          const { FBXLoader } = await import(
            "../../../../c/libs/threejs/0.181/addons/loaders/FBXLoader.js"
          )

          const loader = new FBXLoader(manager)
          const object = loader.parse(file.buffer)

          deferred.resolve(object)

          break
        }

        case "glb": {
          const loader = await createGLTFLoader()

          loader.parse(file.buffer, "", (result) => {
            const { scene } = result

            scene.animations.push(...result.animations)
            deferred.resolve(scene)

            loader.dracoLoader.dispose()
            loader.ktx2Loader.dispose()
          })

          break
        }

        case "gltf": {
          const loader = await createGLTFLoader(manager)

          loader.parse(strFromU8(file), "", (result) => {
            const { scene } = result

            scene.animations.push(...result.animations)
            deferred.resolve(scene)

            loader.dracoLoader.dispose()
            loader.ktx2Loader.dispose()
          })

          break
        }
      }
    }
  }
}

export { Loader }

/*  */
/*  */
/*  */

// const manager = new THREE.LoadingManager()
// manager.addHandler(/\.tga$/i, new TGALoader())

// const LOADERS = {
//   "3mf": "3MFLoader",
//   "amf": "AMFLoader",
//   "assimp": "AssimpLoader",
//   "babylon": "BabylonLoader",
//   "bvh": "BVHLoader",
//   "dae": "ColladaLoader",
//   "drc": "DRACOLoader",
//   "fbx": "FBXLoader",
//   "gcode": "GCodeLoader",
//   "glb": "GLTFLoader",
//   "gltf": "GLTFLoader",
//   "kmz": "KMZLoader",
//   "md2": "MD2Loader",
//   "mmd": "MMDLoader",
//   "obj": "OBJLoader",
//   "pcd": "PCDLoader",
//   "ply": "PLYLoader",
//   "prwm": "PRWMLoader",
//   "stl": "STLLoader",
//   "svg": "SVGLoader",
//   "tds": "TDSLoader",
//   "usdz": "USDZLoader",
//   "vox": "VOXLoader",
//   "vtk": "VTKLoader",
//   "vtp": "VTKLoader",
//   "wrl": "VRMLLoader",
//   "x": "XLoader",
//   "zae": "ColladaArchiveLoader",
// }

// async function loadAny(ext, url) {
//   const m = await import(
//     `../../../c/libs/threejs/0.181/addons/loaders/${LOADERS[ext]}.js`
//   )
//   const Loader = m[LOADERS[ext]]
//   const loader = new Loader(manager)

//   return loader.loadAsync(url, null)
// }

// const getMesh = {
//   vox: async (url) => {
//     const { VOXLoader, VOXMesh } = await import(
//       `../../../c/libs/threejs/0.181/addons/loaders/VOXLoader.js`
//     )

//     const loader = new VOXLoader()
//     const chunks = await loader.loadAsync(url, null)

//     const group = new THREE.Group()
//     for (const chunk of chunks) {
//       const mesh = new VOXMesh(chunk)
//       // mesh.castShadow = true
//       // mesh.receiveShadow = true
//       group.add(mesh)
//     }

//     return group
//   },
// }
