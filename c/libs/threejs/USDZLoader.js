/* eslint-disable */

//! Copyright (c) Pierre-Olivier. Modified Apache 2.0 License.
// three-usdz-loader - 1.0.9 - https://github.com/ponahoum/three-usdz-loader#readme

import * as THREE from "./0.174/three.js"

var commonjsGlobal =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
      ? window
      : typeof global !== "undefined"
        ? global
        : typeof self !== "undefined"
          ? self
          : {}

var USDZLoader$1 = {}

var ThreeJsRenderDelegate = {}

Object.defineProperty(ThreeJsRenderDelegate, "__esModule", { value: true })
ThreeJsRenderDelegate.RenderDelegateInterface = void 0

var TextureRegistry = /** @class */ (function () {
  function TextureRegistry(basename) {
    this.basename = basename
    this.textures = []
    this.loader = new THREE.TextureLoader()
  }
  TextureRegistry.prototype.getTexture = function (filename) {
    var _this = this
    if (this.textures[filename]) {
      return this.textures[filename]
    }
    var textureResolve, textureReject
    this.textures[filename] = new Promise(function (resolve, reject) {
      textureResolve = resolve
      textureReject = reject
    })
    var resourcePath = filename
    if (filename[0] !== "/") {
      resourcePath = this.basename + "[" + filename + "]"
    }
    var filetype = undefined
    if (filename.indexOf(".png") >= filename.length - 5) {
      filetype = "image/png"
    } else if (filename.indexOf(".jpg") >= filename.length - 5) {
      filetype = "image/jpeg"
    } else if (filename.indexOf(".jpeg") >= filename.length - 5) {
      filetype = "image/jpeg"
    } else {
      throw new Error("Unknown filetype")
    }
    window.driver.getFile(resourcePath, function (loadedFile) {
      if (!loadedFile) {
        textureReject(new Error("Unknown file: " + resourcePath))
        return
      }
      var blob = new Blob([loadedFile.slice(0)], { type: filetype })
      var blobUrl = URL.createObjectURL(blob)
      // Load the texture
      _this.loader.load(
        // resource URL
        blobUrl,
        // onLoad callback
        function (texture) {
          textureResolve(texture)
        },
        // onProgress callback currently not used
        undefined,
        // onError callback
        function (err) {
          textureReject(err)
        },
      )
    })
    return this.textures[filename]
  }
  return TextureRegistry
})()
var HydraMesh = /** @class */ (function () {
  function HydraMesh(id, hydraInterface) {
    this._geometry = new THREE.BufferGeometry()
    this._id = id
    this._interface = hydraInterface
    this._points = undefined
    this._normals = undefined
    this._colors = undefined
    this._uvs = undefined
    this._indices = undefined
    var material = new THREE.MeshPhysicalMaterial({
      side: THREE.DoubleSide,
      color: new THREE.Color(0x00ff00), // a green color to indicate a missing material
    })
    this._mesh = new THREE.Mesh(this._geometry, material)
    this._mesh.castShadow = true
    this._mesh.receiveShadow = true
    window.usdRoot.add(this._mesh) // FIXME
  }
  HydraMesh.prototype.updateOrder = function (
    attribute,
    attributeName,
    dimension,
  ) {
    if (dimension === void 0) {
      dimension = 3
    }
    if (attribute && this._indices) {
      var values = []
      for (var i = 0; i < this._indices.length; i++) {
        var index = this._indices[i]
        for (var j = 0; j < dimension; ++j) {
          values.push(attribute[dimension * index + j])
        }
      }
      this._geometry.setAttribute(
        attributeName,
        new THREE.Float32BufferAttribute(values, dimension),
      )
    }
  }
  HydraMesh.prototype.updateIndices = function (indices) {
    this._indices = []
    for (var i = 0; i < indices.length; i++) {
      this._indices.push(indices[i])
    }
    //this._geometry.setIndex( indicesArray );
    this.updateOrder(this._points, "position")
    this.updateOrder(this._normals, "normal")
    if (this._colors) {
      this.updateOrder(this._colors, "color")
    }
    if (this._uvs) {
      this.updateOrder(this._uvs, "uv", 2)
      this._geometry.attributes.uv1 = this._geometry.attributes.uv
    }
  }
  HydraMesh.prototype.setTransform = function (matrix) {
    var _a
    ;(_a = this._mesh.matrix).set.apply(_a, matrix)
    this._mesh.matrix.transpose()
    this._mesh.matrixAutoUpdate = false
  }
  HydraMesh.prototype.updateNormals = function (normals) {
    this._normals = normals.slice(0)
    this.updateOrder(this._normals, "normal")
  }
  // This is always called before prims are updated
  HydraMesh.prototype.setMaterial = function (materialId) {
    //console.log("Material: " + materialId);
    if (this._interface.materials[materialId]) {
      this._mesh.material = this._interface.materials[materialId]._material
    }
  }
  HydraMesh.prototype.setDisplayColor = function (data, interpolation) {
    var wasDefaultMaterial = false
    if (this._mesh.material === defaultMaterial) {
      this._mesh.material = this._mesh.material.clone()
      wasDefaultMaterial = true
    }
    this._colors = null
    if (interpolation === "constant") {
      this._mesh.material.color = new THREE.Color().fromArray(data)
    } else if (interpolation === "vertex") {
      // Per-vertex buffer attribute
      this._mesh.material.vertexColors = true
      if (wasDefaultMaterial) {
        // Reset the pink debugging color
        this._mesh.material.color = new THREE.Color(0xffffff)
      }
      this._colors = data.slice(0)
      this.updateOrder(this._colors, "color")
    } else;
  }
  HydraMesh.prototype.setUV = function (data, dimension, interpolation) {
    // TODO: Support multiple UVs. For now, we simply set uv = uv1, which is required when a material has an aoMap.
    this._uvs = null
    if (interpolation === "facevarying") {
      // The UV buffer has already been prepared on the C++ side, so we just set it
      this._geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(data, dimension),
      )
    } else if (interpolation === "vertex") {
      // We have per-vertex UVs, so we need to sort them accordingly
      this._uvs = data.slice(0)
      this.updateOrder(this._uvs, "uv", 2)
    }
    this._geometry.attributes.uv1 = this._geometry.attributes.uv
  }
  HydraMesh.prototype.updatePrimvar = function (
    name,
    data,
    dimension,
    interpolation,
  ) {
    if (name === "points" || name === "normals") {
      // Points and normals are set separately
      return
    }
    //console.log("Setting PrimVar: " + name);
    // TODO: Support multiple UVs. For now, we simply set uv = uv1, which is required when a material has an aoMap.
    if (name.startsWith("st")) {
      name = "uv"
    }
    switch (name) {
      case "displayColor":
        this.setDisplayColor(data, interpolation)
        break
      case "uv":
        this.setUV(data, dimension, interpolation)
        break
      //console.warn("Unsupported primvar", name);
    }
  }
  HydraMesh.prototype.updatePoints = function (points) {
    this._points = points.slice(0)
    this.updateOrder(this._points, "position")
  }
  HydraMesh.prototype.commit = function () {
    // Nothing to do here. All Three.js resources are already updated during the sync phase.
  }
  return HydraMesh
})()
var defaultMaterial
var HydraMaterial = /** @class */ (function () {
  function HydraMaterial(id, hydraInterface) {
    this._id = id
    this._nodes = {}
    this._interface = hydraInterface
    if (!defaultMaterial) {
      defaultMaterial = new THREE.MeshPhysicalMaterial({
        side: THREE.DoubleSide,
        color: new THREE.Color(0xff2997),
        envMap: window.envMap,
      })
    }
    this._material = defaultMaterial
  }
  HydraMaterial.prototype.updateNode = function (networkId, path, parameters) {
    //console.log("Updating Material Node: " + networkId + " " + path);
    this._nodes[path] = parameters
  }
  HydraMaterial.prototype.assignTexture = function (
    mainMaterial,
    parameterName,
  ) {
    var _this = this
    var materialParameterMapName =
      HydraMaterial.usdPreviewToMeshPhysicalTextureMap[parameterName]
    if (materialParameterMapName === undefined) {
      console.warn(
        "Unsupported material texture parameter '".concat(parameterName, "'."),
      )
      return
    }
    if (mainMaterial[parameterName] && mainMaterial[parameterName].nodeIn) {
      var textureFileName_1 = mainMaterial[parameterName].nodeIn.file
      var channel_1 = mainMaterial[parameterName].inputName
      // For debugging
      Object.keys(this._nodes).find(function (key) {
        return _this._nodes[key] === mainMaterial
      })
      //console.log(
      //  `Setting texture '${materialParameterMapName}' (${textureFileName}) of material '${matName}'...`
      //);
      this._interface.registry
        .getTexture(textureFileName_1)
        .then(function (texture) {
          var _a, _b
          if (materialParameterMapName === "alphaMap") {
            // If this is an opacity map, check if it's using the alpha channel of the diffuse map.
            // If so, simply change the format of that diffuse map to RGBA and make the material transparent.
            // If not, we need to copy the alpha channel into a new texture's green channel, because that's what Three.js
            // expects for alpha maps (not supported at the moment).
            // NOTE that this only works if diffuse maps are always set before opacity maps, so the order of
            // 'assingTexture' calls for a material matters.
            if (
              textureFileName_1 ===
                ((_b =
                  (_a = mainMaterial.diffuseColor) === null || _a === void 0
                    ? void 0
                    : _a.nodeIn) === null || _b === void 0
                  ? void 0
                  : _b.file) &&
              channel_1 === "a"
            ) {
              _this._material.map.format = THREE.RGBAFormat
            }
            _this._material.transparent = true
            _this._material.needsUpdate = true
            return
          } else if (materialParameterMapName === "metalnessMap") {
            _this._material.metalness = 1.0
          } else if (materialParameterMapName === "emissiveMap") {
            _this._material.emissive = new THREE.Color(0xffffff)
          } else if (!HydraMaterial.channelMap[channel_1]) {
            //console.warn(`Unsupported texture channel '${channel}'!`);
            return
          }
          // Clone texture and set the correct format.
          var clonedTexture = texture.clone()
          clonedTexture.format = HydraMaterial.channelMap[channel_1]
          clonedTexture.needsUpdate = true
          // Provide proper texture color space for regular maps. The rest can keep default.
          if (
            parameterName === "diffuseColor" ||
            parameterName === "emissiveColor"
          ) {
            clonedTexture.colorSpace = THREE.SRGBColorSpace
          }
          clonedTexture.wrapS = THREE.RepeatWrapping
          clonedTexture.wrapT = THREE.RepeatWrapping
          _this._material[materialParameterMapName] = clonedTexture
          _this._material.needsUpdate = true
        })
    }
  }
  HydraMaterial.prototype.assignProperty = function (
    mainMaterial,
    parameterName,
  ) {
    var materialParameterName =
      HydraMaterial.usdPreviewToMeshPhysicalMap[parameterName]
    if (materialParameterName === undefined) {
      //console.warn(`Unsupported material parameter '${parameterName}'.`);
      return
    }
    if (
      mainMaterial[parameterName] !== undefined &&
      !mainMaterial[parameterName].nodeIn
    ) {
      //console.log(
      //  `Assigning property ${parameterName}: ${mainMaterial[parameterName]}`
      //);
      if (Array.isArray(mainMaterial[parameterName])) {
        this._material[materialParameterName] = new THREE.Color().fromArray(
          mainMaterial[parameterName],
        )
      } else {
        this._material[materialParameterName] = mainMaterial[parameterName]
        if (
          materialParameterName === "opacity" &&
          mainMaterial[parameterName] < 1.0
        ) {
          this._material.transparent = true
        }
      }
    }
  }
  HydraMaterial.prototype.updateFinished = function (type, relationships) {
    for (
      var _i = 0, relationships_1 = relationships;
      _i < relationships_1.length;
      _i++
    ) {
      var relationship = relationships_1[_i]
      relationship.nodeIn = this._nodes[relationship.inputId]
      relationship.nodeOut = this._nodes[relationship.outputId]
      relationship.nodeIn[relationship.inputName] = relationship
      relationship.nodeOut[relationship.outputName] = relationship
    }
    //console.log("Finalizing Material: " + this._id);
    // find the main material node
    var mainMaterialNode = undefined
    for (var _a = 0, _b = Object.values(this._nodes); _a < _b.length; _a++) {
      var node = _b[_a]
      if (node.diffuseColor) {
        mainMaterialNode = node
        break
      }
    }
    if (!mainMaterialNode) {
      this._material = defaultMaterial
      return
    }
    // TODO: Ideally, we don't recreate the material on every update.
    // Creating a new one requires to also update any meshes that reference it. So we're relying on the C++ side to
    // call this before also calling `setMaterial` on the affected meshes.
    //console.log("Creating Material: " + this._id);
    this._material = new THREE.MeshPhysicalMaterial({})
    // Assign textures
    for (var key in HydraMaterial.usdPreviewToMeshPhysicalTextureMap) {
      this.assignTexture(mainMaterialNode, key)
    }
    // Assign material properties
    for (var key in HydraMaterial.usdPreviewToMeshPhysicalMap) {
      this.assignProperty(mainMaterialNode, key)
    }
    if (window.envMap) {
      this._material.envMap = window.envMap
    }
    //console.log(this._material);
  }
  // Maps USD preview material texture names to Three.js MeshPhysicalMaterial names
  HydraMaterial.usdPreviewToMeshPhysicalTextureMap = {
    diffuseColor: "map",
    clearcoat: "clearcoatMap",
    clearcoatRoughness: "clearcoatRoughnessMap",
    emissiveColor: "emissiveMap",
    occlusion: "aoMap",
    roughness: "roughnessMap",
    metallic: "metalnessMap",
    normal: "normalMap",
    opacity: "alphaMap",
  }
  HydraMaterial.channelMap = {
    // Three.js expects many 8bit values such as roughness or metallness in a specific RGB texture channel.
    // We could write code to combine multiple 8bit texture files into different channels of one RGB texture where it
    // makes sense, but that would complicate this loader a lot. Most Three.js loaders don't seem to do it either.
    // Instead, we simply provide the 8bit image as an RGB texture, even though this might be less efficient.
    r: THREE.RGBAFormat,
    rgb: THREE.RGBAFormat,
    rgba: THREE.RGBAFormat,
  }
  // Maps USD preview material property names to Three.js MeshPhysicalMaterial names
  HydraMaterial.usdPreviewToMeshPhysicalMap = {
    clearcoat: "clearcoat",
    clearcoatRoughness: "clearcoatRoughness",
    diffuseColor: "color",
    emissiveColor: "emissive",
    ior: "ior",
    metallic: "metalness",
    opacity: "opacity",
    roughness: "roughness",
  }
  return HydraMaterial
})()
var RenderDelegateInterface = /** @class */ (function () {
  function RenderDelegateInterface(filename, usdRoot) {
    this.registry = new TextureRegistry(filename)
    this.materials = {}
    this.meshes = {}
    window.usdRoot = usdRoot
  }
  RenderDelegateInterface.prototype.createRPrim = function (
    typeId,
    id,
    instancerId,
  ) {
    //console.log("Creating RPrim: " + typeId + " " + id);
    var mesh = new HydraMesh(id, this)
    this.meshes[id] = mesh
    return mesh
  }
  RenderDelegateInterface.prototype.createBPrim = function (typeId, id) {
    //console.log("Creating BPrim: " + typeId + " " + id);
    /*let mesh = new HydraMesh(id, this);
        this.meshes[id] = mesh;
        return mesh;*/
  }
  RenderDelegateInterface.prototype.createSPrim = function (typeId, id) {
    //console.log("Creating SPrim: " + typeId + " " + id);
    if (typeId === "material") {
      var material = new HydraMaterial(id, this)
      this.materials[id] = material
      return material
    } else {
      return undefined
    }
  }
  RenderDelegateInterface.prototype.setDriver = function (driver) {
    window.driver = driver
  }
  RenderDelegateInterface.prototype.CommitResources = function () {
    for (var id in this.meshes) {
      var hydraMesh = this.meshes[id]
      hydraMesh.commit()
    }
  }
  return RenderDelegateInterface
})()
ThreeJsRenderDelegate.RenderDelegateInterface = RenderDelegateInterface

var USDZInstance$1 = {}

Object.defineProperty(USDZInstance$1, "__esModule", { value: true })
USDZInstance$1.USDZInstance = void 0
/**
 * Represents a model loaded by the USDZLoader and handles its lifecycle in the THREE context
 */
var USDZInstance = /** @class */ (function () {
  function USDZInstance(
    fileName,
    usdModule,
    driver,
    renderInterface,
    targetGroup,
  ) {
    // Animations
    this.timeout = 40
    this.endTimecode = 1
    this.driver = driver
    this.targetGroup = targetGroup
    this.usdModule = usdModule
    this.renderInterface = renderInterface
    this.fileName = fileName
    var stage = this.driver.GetStage()
    this.endTimecode = stage.GetEndTimeCode()
    this.timeout = 1000 / stage.GetTimeCodesPerSecond()
  }
  /**
   * Returns the USDz instance container
   */
  USDZInstance.prototype.getGroup = function () {
    return this.targetGroup
  }
  /**
   * If there are some animations on this model, call this function to call the update loop of the animation
   * A time that evolves must be given for the animation to update
   */
  USDZInstance.prototype.update = function (seconds) {
    var time = (seconds * (1000 / this.timeout)) % this.endTimecode
    this.driver.SetTime(time)
    this.driver.Draw()
  }
  /**
   * Destroys the associated THREE.Group and unlink the data from the usd module driver
   */
  USDZInstance.prototype.clear = function () {
    this.targetGroup.clear()
    this.usdModule.FS.unlink(this.fileName)
  }
  return USDZInstance
})()
USDZInstance$1.USDZInstance = USDZInstance

var utils = {}

Object.defineProperty(utils, "__esModule", { value: true })
utils.USDZLoaderUtils = void 0
var USDZLoaderUtils = /** @class */ (function () {
  function USDZLoaderUtils() {}
  /**
   * Read a file async and returns an array buffer
   * @param file
   * @returns
   */
  USDZLoaderUtils.readFileAsync = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader()
      reader.onload = function () {
        resolve(reader.result)
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }
  /**
   * Generate random string GUID
   */
  USDZLoaderUtils.getRandomGuid = function () {
    return (Math.random() + 1).toString(36).substring(7)
  }
  /**
   * Given a file name / path, returns the file extension
   * @param filePath
   * @returns
   */
  USDZLoaderUtils.getFileExtension = function (filePath) {
    var extension = filePath.split(".").pop()
    if (extension == undefined) {
      throw "Cannot determine extension"
    }
    extension = extension.split("?")[0]
    return extension
  }
  return USDZLoaderUtils
})()
utils.USDZLoaderUtils = USDZLoaderUtils

var __awaiter =
  (commonjsGlobal && commonjsGlobal.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value)
          })
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value))
        } catch (e) {
          reject(e)
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value))
        } catch (e) {
          reject(e)
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected)
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next())
    })
  }
var __generator =
  (commonjsGlobal && commonjsGlobal.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1]
          return t[1]
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this
        }),
      g
    )
    function verb(n) {
      return function (v) {
        return step([n, v])
      }
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.")
      while (_)
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                    ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t
          if (((y = 0), t)) op = [op[0] & 2, t.value]
          switch (op[0]) {
            case 0:
            case 1:
              t = op
              break
            case 4:
              _.label++
              return { value: op[1], done: false }
            case 5:
              _.label++
              y = op[1]
              op = [0]
              continue
            case 7:
              op = _.ops.pop()
              _.trys.pop()
              continue
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0
                continue
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1]
                break
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1]
                t = op
                break
              }
              if (t && _.label < t[2]) {
                _.label = t[2]
                _.ops.push(op)
                break
              }
              if (t[2]) _.ops.pop()
              _.trys.pop()
              continue
          }
          op = body.call(thisArg, _)
        } catch (e) {
          op = [6, e]
          y = 0
        } finally {
          f = t = 0
        }
      if (op[0] & 5) throw op[1]
      return { value: op[0] ? op[1] : void 0, done: true }
    }
  }
Object.defineProperty(USDZLoader$1, "__esModule", { value: true })
var USDZLoader_2 = (USDZLoader$1.USDZLoader = void 0)
var ThreeJsRenderDelegate_1 = ThreeJsRenderDelegate
var USDZInstance_1 = USDZInstance$1
var utils_1 = utils
var USDZLoader = /** @class */ (function () {
  /**
   * dependenciesDirectory is the directory where emHdBindings.js, emHdBindings.data, emHdBindings.wasm and emHdBindings.worker.js are located
   * Give the path without the end slash (/). Ex: http://localhost:8080/myWasmBinaries
   * @param dependenciesDirectory
   */
  function USDZLoader(dependenciesDirectory = import.meta.resolve("./USDZLoader/")) {
    if (dependenciesDirectory === void 0) {
      dependenciesDirectory = ""
    }
    // The USD module from AutoDesk. Only one should be there at a the time.
    this.usdModule = null
    // Tells if a model is currently loading
    this.modelIsLoading = false
    // Tells if the module loading completed (with success or not)
    this.moduleLoadingCompleted = false
    this.initialize(dependenciesDirectory)
  }
  /**
   * Initializes the WASM module
   */
  USDZLoader.prototype.initialize = function (depDirectory) {
    return __awaiter(this, void 0, void 0, function () {
      var usdBindingsTag
      var _this = this
      return __generator(this, function (_a) {
        usdBindingsTag = document.createElement("script")
        usdBindingsTag.onload = function () {
          return __awaiter(_this, void 0, void 0, function () {
            var isIOS, maxMemory, module_1, moduleReady, e_1
            return __generator(this, function (_a) {
              switch (_a.label) {
                case 0:
                  isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
                  maxMemory = undefined
                  if (isIOS) {
                    maxMemory = 838860800
                    console.log(
                      "iOS device detected, reducing maximum memory to " +
                        maxMemory,
                    )
                  }
                  _a.label = 1
                case 1:
                  _a.trys.push([1, 4, 5, 6])
                  return [
                    4 /*yield*/,
                    window.getUsdModule(undefined, depDirectory, maxMemory),
                  ]
                case 2:
                  module_1 = _a.sent()
                  return [4 /*yield*/, module_1.ready]
                case 3:
                  moduleReady = _a.sent()
                  if (moduleReady) {
                    this.usdModule = module_1
                  }
                  return [3 /*break*/, 6]
                case 4:
                  e_1 = _a.sent()
                  console.error(
                    "USDZ module could not initialize, error: " + e_1,
                  )
                  return [3 /*break*/, 6]
                case 5:
                  this.moduleLoadingCompleted = true
                  return [7 /*endfinally*/]
                case 6:
                  return [2 /*return*/]
              }
            })
          })
        }
        document.head.appendChild(usdBindingsTag)
        usdBindingsTag.setAttribute("src", depDirectory + "/emHdBindings.js")
        return [2 /*return*/]
      })
    })
  }
  /**
   * Gathers the module while ensuring it's ready to be used
   * Returns null if the loading was completed with error
   */
  USDZLoader.prototype.waitForModuleLoadingCompleted = function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (!!this.moduleLoadingCompleted) return [3 /*break*/, 2]
            return [
              4 /*yield*/,
              new Promise(function (resolve) {
                return setTimeout(resolve, 10)
              }),
            ]
          case 1:
            _a.sent()
            return [3 /*break*/, 0]
          case 2:
            return [2 /*return*/, this.usdModule]
        }
      })
    })
  }
  /**
   * Loads a USDZ file into the target ThreeJS Group
   * @param file
   * @param targetGroup
   */
  USDZLoader.prototype.loadFile = function (file, targetGroup) {
    return __awaiter(this, void 0, void 0, function () {
      var result, instance
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (this.modelIsLoading) {
              this.modelIsLoading = false
              throw "A model is already loading. Please wait."
            }
            // Wait for module to be ready
            return [4 /*yield*/, this.waitForModuleLoadingCompleted()]
          case 1:
            // Wait for module to be ready
            _a.sent()
            // Make sure module is ready
            if (this.usdModule == null) {
              this.modelIsLoading = false
              throw "Cannot load file. The module could not be loaded properly."
            }
            // Notice start of loading
            this.modelIsLoading = true
            return [4 /*yield*/, utils_1.USDZLoaderUtils.readFileAsync(file)]
          case 2:
            result = _a.sent()
            // Load the raw data with the module
            try {
              instance = this.loadUsdFileFromArrayBuffer(
                this.usdModule,
                file.name,
                result,
                targetGroup,
              )
              // Notice end of loading
              this.modelIsLoading = false
              return [2 /*return*/, instance]
            } catch (e) {
              this.modelIsLoading = false
              throw e
            }
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Raw methods that loads the USDZ file array buffer into the target ThreeJS Group
   * @param filename
   * @param usdFile
   * @param targetGroup
   */
  USDZLoader.prototype.loadUsdFileFromArrayBuffer = function (
    usdModule,
    filename,
    usdFile,
    targetGroup,
  ) {
    // Generate random filename to avoid conflict when opening a file multiple times
    var extension = utils_1.USDZLoaderUtils.getFileExtension(filename)
    var randomFileName = utils_1.USDZLoaderUtils.getRandomGuid()
    var inputFileName = randomFileName + "." + extension
    // Give the RAW data to the USD module
    usdModule.FS.createDataFile(
      "/",
      inputFileName,
      new Uint8Array(usdFile),
      true,
      true,
      true,
    )
    // Create Render Interface / Driver
    var renderInterface = new ThreeJsRenderDelegate_1.RenderDelegateInterface(
      inputFileName,
      targetGroup,
    )
    var driver = new usdModule.HdWebSyncDriver(renderInterface, inputFileName)
    renderInterface.setDriver(driver)
    driver.Draw()
    // Returns an object of with all of this that can be manipulated later
    var instance = new USDZInstance_1.USDZInstance(
      inputFileName,
      usdModule,
      driver,
      renderInterface,
      targetGroup,
    )
    return instance
  }
  return USDZLoader
})()
USDZLoader_2 = USDZLoader$1.USDZLoader = USDZLoader

export { USDZLoader_2 as USDZLoader, USDZLoader$1 as default }
